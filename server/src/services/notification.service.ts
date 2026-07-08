import { NotificationPreference, NotificationType } from "@prisma/client";
import prisma from "../utils/prisma";
import { emitUserEvent } from "./realtime.service";

export interface NotificationPayload {
  type: NotificationType;
  message: string;
  userId: string;
  projectId: string;
}

const projectWideTypes = new Set<NotificationType>([
  NotificationType.TASK_MOVED,
  NotificationType.COMMENT_ADDED,
  NotificationType.SPRINT_STARTED,
  NotificationType.SPRINT_COMPLETED,
]);
const shouldLogNotificationFanout = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

export type ProjectNotificationToggleField =
  | "taskAssigned"
  | "taskMoved"
  | "commentAdded"
  | "mention"
  | "sprintStarted"
  | "sprintCompleted";

// Maps each NotificationType to its corresponding ProjectNotificationPreference boolean column.
const notificationTypeToPreferenceField: Record<NotificationType, ProjectNotificationToggleField> = {
  [NotificationType.TASK_ASSIGNED]: "taskAssigned",
  [NotificationType.TASK_MOVED]: "taskMoved",
  [NotificationType.COMMENT_ADDED]: "commentAdded",
  [NotificationType.MENTION]: "mention",
  [NotificationType.SPRINT_STARTED]: "sprintStarted",
  [NotificationType.SPRINT_COMPLETED]: "sprintCompleted",
};

export async function createNotification(payload: NotificationPayload) {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { notificationPreference: true },
  });

  if (!user || user.notificationPreference === NotificationPreference.NONE) return null;
  if (user.notificationPreference === NotificationPreference.MENTIONS_ONLY && projectWideTypes.has(payload.type)) return null;

  // Absence of a per-project preference row means "notify" (opt-out model) — only an explicit
  // false on the matching column suppresses. This preserves existing behavior for every user
  // who has never touched per-project settings.
  const projectPreference = await prisma.projectNotificationPreference.findUnique({
    where: { userId_projectId: { userId: payload.userId, projectId: payload.projectId } },
  });
  if (projectPreference && projectPreference[notificationTypeToPreferenceField[payload.type]] === false) {
    return null;
  }

  const notification = await prisma.notification.create({
    data: { type: payload.type, message: payload.message, userId: payload.userId },
  });
  emitUserEvent(payload.userId, "notification:new", notification);
  return notification;
}

export async function notifyProjectMembers(projectId: string, actorId: string, type: NotificationType, message: string) {
  const startedAt = process.hrtime.bigint();
  let recipientCount = 0;
  let createdCount = 0;

  const members = await prisma.projectMember.findMany({
    where: { projectId, userId: { not: actorId } },
    select: {
      userId: true,
      user: { select: { notificationPreference: true } },
    },
  });
  recipientCount = members.length;

  if (members.length === 0) {
    if (shouldLogNotificationFanout) {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      console.log("[notifications:fanout]", {
        projectId,
        type,
        recipientCount,
        createdCount,
        durationMs: Math.round(durationMs),
      });
    }
    return;
  }

  const recipientIds = members.map((member) => member.userId);
  const projectPreferences = await prisma.projectNotificationPreference.findMany({
    where: {
      projectId,
      userId: { in: recipientIds },
    },
  });

  const userPreferenceByUserId = new Map(
    members.map((member) => [member.userId, member.user.notificationPreference]),
  );
  const projectPreferenceByUserId = new Map(projectPreferences.map((preference) => [preference.userId, preference]));
  const preferenceField = notificationTypeToPreferenceField[type];
  const recipients = members.filter((member) => {
    const userPreference = userPreferenceByUserId.get(member.userId);
    if (userPreference === NotificationPreference.NONE) return false;
    if (userPreference === NotificationPreference.MENTIONS_ONLY && projectWideTypes.has(type)) return false;

    const projectPreference = projectPreferenceByUserId.get(member.userId);
    return !projectPreference || projectPreference[preferenceField] !== false;
  });

  const notifications = await Promise.all(
    recipients.map((recipient) => prisma.notification.create({
      data: { type, message, userId: recipient.userId },
    })),
  );
  createdCount = notifications.length;

  notifications.forEach((notification) => {
    emitUserEvent(notification.userId, "notification:new", notification);
  });

  if (shouldLogNotificationFanout) {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log("[notifications:fanout]", {
      projectId,
      type,
      recipientCount,
      createdCount,
      durationMs: Math.round(durationMs),
    });
  }
}

export async function getUserNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function markNotificationRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
