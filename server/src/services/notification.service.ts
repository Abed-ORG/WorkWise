import { NotificationPreference, NotificationType } from "@prisma/client";
import prisma from "../utils/prisma";
import { emitUserEvent } from "./realtime.service";

export interface NotificationPayload {
  type: NotificationType;
  message: string;
  userId: string;
}

const projectWideTypes = new Set<NotificationType>([
  NotificationType.TASK_MOVED,
  NotificationType.COMMENT_ADDED,
  NotificationType.SPRINT_STARTED,
  NotificationType.SPRINT_COMPLETED,
]);

export async function createNotification(payload: NotificationPayload) {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { notificationPreference: true },
  });

  if (!user || user.notificationPreference === NotificationPreference.NONE) return null;
  if (user.notificationPreference === NotificationPreference.MENTIONS_ONLY && projectWideTypes.has(payload.type)) return null;

  const notification = await prisma.notification.create({ data: payload });
  emitUserEvent(payload.userId, "notification:new", notification);
  return notification;
}

export async function notifyProjectMembers(projectId: string, actorId: string, type: NotificationType, message: string) {
  const members = await prisma.projectMember.findMany({
    where: { projectId, userId: { not: actorId } },
    select: { userId: true },
  });

  await Promise.all(members.map((member) => createNotification({ userId: member.userId, type, message })));
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
