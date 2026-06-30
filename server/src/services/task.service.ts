import { NotificationType, Role, TaskPriority, TaskStatus } from "@prisma/client";
import prisma from "../utils/prisma";
import { NotFoundError } from "../errors/NotFoundError";
import { AppError } from "../errors/AppError";
import { emitProjectEvent } from "./realtime.service";
import { createNotification, notifyProjectMembers } from "./notification.service";
import { createProjectActivity } from "./activity.service";

const taskSummaryInclude = {
  project: { select: { id: true, name: true, key: true } },
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
  creator: { select: { id: true, name: true, email: true } },
} as const;

const linkedDocumentSelect = {
  id: true,
  title: true,
  content: true,
  projectId: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const requireProjectMember = async (projectId: string, userId: string) => {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (!member) throw new NotFoundError("Project not found");
  return member;
};

export interface CreateTaskInput {
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  estimatedHours?: number | null;
  priority?: TaskPriority;
  labels?: string[];
  dueDate?: string | null;
  projectId: string;
  sprintId?: string;
  assigneeId?: string;
  creatorId: string;
}

export const createTask = async (input: CreateTaskInput) => {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      members: { some: { userId: input.creatorId } },
    },
  });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  if (input.assigneeId) {
    const assignee = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: input.assigneeId,
          projectId: input.projectId,
        },
      },
    });

    if (!assignee) {
      throw new NotFoundError("Assignee is not a project member");
    }
  }

  if (input.sprintId) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: input.sprintId },
    });

    if (!sprint || sprint.projectId !== input.projectId) {
      throw new NotFoundError("Sprint not found");
    }
  }

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      acceptanceCriteria: input.acceptanceCriteria,
      estimatedHours: input.estimatedHours,
      priority: input.priority ?? TaskPriority.MEDIUM,
      status: TaskStatus.BACKLOG,
      labels: input.labels ?? [],
      dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
      projectId: input.projectId,
      sprintId: input.sprintId,
      assigneeId: input.assigneeId,
      creatorId: input.creatorId,
    },
    include: taskSummaryInclude,
  });

  await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      userId: input.creatorId,
      action: "TASK_CREATED",
      details: `Created task "${task.title}"`,
    },
  });
  await createProjectActivity({
    projectId: task.projectId,
    userId: input.creatorId,
    action: "TASK_CREATED",
    target: task.title,
    details: `Created ${task.project.key}-${task.id.slice(-4)}`,
  });

  if (task.assigneeId && task.assigneeId !== input.creatorId) {
    await createNotification({
      userId: task.assigneeId,
      type: NotificationType.TASK_ASSIGNED,
      message: `You were assigned to "${task.title}" in ${task.project.name}.`,
    });
  }

  emitProjectEvent(task.projectId, "task:created", task);
  return task;
};
export const getProjectTasks = async (projectId: string, userId: string) => {
  await requireProjectMember(projectId, userId);

  return prisma.task.findMany({
    where: { projectId },
    include: taskSummaryInclude,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
};

export const getAssignedTasks = async (userId: string) => prisma.task.findMany({
  where: {
    assigneeId: userId,
    project: { members: { some: { userId } } },
  },
  include: taskSummaryInclude,
  orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
});

export const getTaskById = async (taskId: string, userId: string) => {
  const task = await prisma.task.findUnique({
    where: {
      id: taskId,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          key: true,
        },
      },
      sprint: {
        select: {
          id: true,
          name: true,
        },
      },
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      comments: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      activities: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      documents: {
        include: {
          document: {
            select: linkedDocumentSelect,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  await requireProjectMember(task.projectId, userId);

  return {
    ...task,
    documents: task.documents.map((link) => link.document),
  };
};

const getTaskForDocumentLinks = async (taskId: string, userId: string) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });

  if (!task) throw new NotFoundError("Task not found");
  await requireProjectMember(task.projectId, userId);
  return task;
};

export const getTaskDocuments = async (taskId: string, userId: string) => {
  await getTaskForDocumentLinks(taskId, userId);

  const links = await prisma.taskDocument.findMany({
    where: { taskId },
    include: { document: { select: linkedDocumentSelect } },
    orderBy: { createdAt: "desc" },
  });

  return links.map((link) => link.document);
};

export const updateTaskDocuments = async (taskId: string, userId: string, documentIds: string[]) => {
  const task = await getTaskForDocumentLinks(taskId, userId);
  const uniqueDocumentIds = Array.from(new Set(documentIds));

  if (uniqueDocumentIds.length > 0) {
    const documents = await prisma.document.findMany({
      where: {
        id: { in: uniqueDocumentIds },
        projectId: task.projectId,
      },
      select: { id: true },
    });

    if (documents.length !== uniqueDocumentIds.length) {
      throw new NotFoundError("Document not found");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.taskDocument.deleteMany({ where: { taskId } });

    if (uniqueDocumentIds.length > 0) {
      await tx.taskDocument.createMany({
        data: uniqueDocumentIds.map((documentId) => ({ taskId, documentId })),
        skipDuplicates: true,
      });
    }
  });

  return getTaskDocuments(taskId, userId);
};
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  acceptanceCriteria?: string | null;
  estimatedHours?: number | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  labels?: string[];
  dueDate?: string;
  assigneeId?: string | null;
  // global order field; per-sprint ordering uses this — no migration needed, field already exists
  order?: number;
  sprintId?: string | null;
  userId: string;
}

export const updateTask = async (
  taskId: string,
  input: UpdateTaskInput
) => {
  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!existingTask) {
    throw new NotFoundError("Task not found");
  }

  await requireProjectMember(existingTask.projectId, input.userId);

  if (input.assigneeId) {
    await requireProjectMember(existingTask.projectId, input.assigneeId);
  }

  if (input.sprintId) {
    const sprint = await prisma.sprint.findUnique({ where: { id: input.sprintId } });
    if (!sprint || sprint.projectId !== existingTask.projectId) {
      throw new AppError("Sprint not found or does not belong to this project", 404);
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: input.title,
      description: input.description,
      acceptanceCriteria: input.acceptanceCriteria,
      estimatedHours: input.estimatedHours,
      status: input.status,
      priority: input.priority,
      labels: input.labels,
      dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
      assigneeId: input.assigneeId,
      sprintId: input.sprintId,
      ...(input.order !== undefined && { order: input.order }),
    },
    include: taskSummaryInclude,
  });

  await prisma.taskActivity.create({
    data: {
      taskId,
      userId: input.userId,
      action: input.status && input.status !== existingTask.status ? "TASK_MOVED" : "TASK_UPDATED",
      details: input.status && input.status !== existingTask.status
        ? `Moved task "${updatedTask.title}" from ${existingTask.status} to ${input.status}`
        : `Updated task "${updatedTask.title}"`,
    },
  });

  if (input.status && input.status !== existingTask.status) {
    await createProjectActivity({
      projectId: existingTask.projectId,
      userId: input.userId,
      action: "TASK_MOVED",
      target: updatedTask.title,
      details: `${existingTask.status} to ${input.status}`,
    });
    await notifyProjectMembers(
      existingTask.projectId,
      input.userId,
      NotificationType.TASK_MOVED,
      `"${updatedTask.title}" moved to ${input.status.replace("_", " ").toLowerCase()}.`
    );
  } else {
    await createProjectActivity({
      projectId: existingTask.projectId,
      userId: input.userId,
      action: "TASK_UPDATED",
      target: updatedTask.title,
      details: "Task details updated",
    });
  }

  if (input.assigneeId && input.assigneeId !== existingTask.assigneeId && input.assigneeId !== input.userId) {
    await createNotification({
      userId: input.assigneeId,
      type: NotificationType.TASK_ASSIGNED,
      message: `You were assigned to "${updatedTask.title}" in ${updatedTask.project.name}.`,
    });
  }

  emitProjectEvent(existingTask.projectId, "task:updated", updatedTask);

  return updatedTask;
};

export const deleteTask = async (taskId: string, userId: string) => {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Task not found");

  const member = await requireProjectMember(task.projectId, userId);
  if (member.role !== Role.ADMIN) {
    throw new AppError("Only project admins can delete tasks", 403);
  }

  await prisma.task.delete({ where: { id: taskId } });
};

const getTaskForTaskFeature = async (taskId: string, userId: string) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });

  if (!task) throw new NotFoundError("Task not found");
  await requireProjectMember(task.projectId, userId);
  return task;
};

export const getTaskTimeLogs = async (taskId: string, userId: string) => {
  await getTaskForTaskFeature(taskId, userId);

  const logs = await prisma.timeLog.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const totalMinutes = logs.reduce((total, log) => total + log.durationMinutes, 0);
  return { logs, totalMinutes };
};

export const createTaskTimeLog = async (
  taskId: string,
  userId: string,
  input: { durationMinutes: number; description?: string }
) => {
  await getTaskForTaskFeature(taskId, userId);

  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) {
    throw new AppError("durationMinutes must be a positive integer", 400);
  }

  const log = await prisma.timeLog.create({
    data: {
      taskId,
      userId,
      durationMinutes: input.durationMinutes,
      description: input.description?.trim() || undefined,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  await prisma.taskActivity.create({
    data: {
      taskId,
      userId,
      action: "TIME_LOGGED",
      details: `Logged ${input.durationMinutes} minutes`,
    },
  });

  return log;
};

export const deleteTaskTimeLog = async (timeLogId: string, userId: string) => {
  const log = await prisma.timeLog.findUnique({
    where: { id: timeLogId },
    include: { task: { select: { projectId: true } } },
  });

  if (!log) throw new NotFoundError("Time log not found");
  const member = await requireProjectMember(log.task.projectId, userId);
  if (log.userId !== userId && member.role !== Role.ADMIN) {
    throw new AppError("Only the log owner or a project admin can delete time entries", 403);
  }
  await prisma.timeLog.delete({ where: { id: timeLogId } });
};

export const getTaskChecklistItems = async (taskId: string, userId: string) => {
  await getTaskForTaskFeature(taskId, userId);

  return prisma.taskChecklistItem.findMany({
    where: { taskId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });
};

export const createTaskChecklistItem = async (
  taskId: string,
  userId: string,
  input: { text: string; order?: number }
) => {
  await getTaskForTaskFeature(taskId, userId);
  const text = input.text.trim();
  if (!text) throw new AppError("Subtask text is required", 400);

  const order = input.order ?? await prisma.taskChecklistItem.count({ where: { taskId } });

  return prisma.taskChecklistItem.create({
    data: {
      taskId,
      text,
      order,
    },
  });
};

export const updateTaskChecklistItem = async (
  subtaskId: string,
  userId: string,
  input: { text?: string; completed?: boolean; order?: number }
) => {
  const item = await prisma.taskChecklistItem.findUnique({
    where: { id: subtaskId },
    include: { task: { select: { projectId: true } } },
  });

  if (!item) throw new NotFoundError("Subtask not found");
  await requireProjectMember(item.task.projectId, userId);

  const text = input.text === undefined ? undefined : input.text.trim();
  if (text !== undefined && !text) throw new AppError("Subtask text is required", 400);

  return prisma.taskChecklistItem.update({
    where: { id: subtaskId },
    data: {
      text,
      completed: input.completed,
      order: input.order,
    },
  });
};

export const deleteTaskChecklistItem = async (subtaskId: string, userId: string) => {
  const item = await prisma.taskChecklistItem.findUnique({
    where: { id: subtaskId },
    include: { task: { select: { projectId: true } } },
  });

  if (!item) throw new NotFoundError("Subtask not found");
  await requireProjectMember(item.task.projectId, userId);
  await prisma.taskChecklistItem.delete({ where: { id: subtaskId } });
};

// ─── Attachment constants ────────────────────────────────────────────────────

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

const attachmentMetaSelect = {
  id: true,
  taskId: true,
  uploaderId: true,
  fileName: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;

// ─── Attachment service functions ────────────────────────────────────────────

export const getTaskAttachments = async (taskId: string, userId: string) => {
  await getTaskForTaskFeature(taskId, userId);

  return prisma.attachment.findMany({
    where: { taskId },
    select: attachmentMetaSelect,
    orderBy: { createdAt: "desc" },
  });
};

export const getAttachmentForDownload = async (attachmentId: string, userId: string) => {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      data: true,
      task: { select: { projectId: true } },
    },
  });

  if (!attachment) throw new NotFoundError("Attachment not found");
  await requireProjectMember(attachment.task.projectId, userId);
  return attachment;
};

export const createTaskAttachment = async (
  taskId: string,
  userId: string,
  input: { fileName: string; mimeType: string; size: number; data: string }
) => {
  await getTaskForTaskFeature(taskId, userId);

  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new AppError("File type not allowed", 400);
  }

  // Verify actual decoded size — client-reported size could be spoofed
  const fileBuffer = Buffer.from(input.data, "base64");
  if (fileBuffer.length > MAX_ATTACHMENT_BYTES) {
    throw new AppError("File exceeds the 5 MB size limit", 400);
  }

  return prisma.attachment.create({
    data: {
      taskId,
      uploaderId: userId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: fileBuffer.length,
      data: input.data,
    },
    select: attachmentMetaSelect,
  });
};

export const deleteTaskAttachment = async (attachmentId: string, userId: string) => {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { task: { select: { projectId: true } } },
  });

  if (!attachment) throw new NotFoundError("Attachment not found");
  const member = await requireProjectMember(attachment.task.projectId, userId);
  if (attachment.uploaderId !== userId && member.role !== Role.ADMIN) {
    throw new AppError("Only the uploader or a project admin can delete attachments", 403);
  }
  await prisma.attachment.delete({ where: { id: attachmentId } });
};
