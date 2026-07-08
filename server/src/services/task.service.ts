import { NotificationType, Role, StatusCategory, TaskPriority, TaskType } from "@prisma/client";
import prisma from "../utils/prisma";
import { NotFoundError } from "../errors/NotFoundError";
import { AppError } from "../errors/AppError";
import { emitProjectEvent } from "./realtime.service";
import { createNotification, notifyProjectMembers } from "./notification.service";
import { createProjectActivity } from "./activity.service";
import { getBacklogDefaultStatus, getSprintDefaultStatus, requireProjectStatus } from "../utils/taskStatus";

const taskSummaryInclude = {
  project: { select: { id: true, name: true, key: true } },
  status: true,
  sprint: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
  creator: { select: { id: true, name: true, email: true } },
  parent: { select: { id: true, title: true, type: true } },
  comments: {
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  activities: {
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  },
} as const;

const taskListSelect = {
  id: true,
  title: true,
  description: true,
  estimatedHours: true,
  storyPoints: true,
  type: true,
  statusId: true,
  priority: true,
  labels: true,
  dueDate: true,
  order: true,
  createdAt: true,
  updatedAt: true,
  projectId: true,
  sprintId: true,
  assigneeId: true,
  creatorId: true,
  parentId: true,
  project: { select: { id: true, name: true, key: true } },
  status: {
    select: {
      id: true,
      name: true,
      category: true,
      order: true,
      color: true,
      isBacklogDefault: true,
      isSprintDefault: true,
      projectId: true,
    },
  },
  sprint: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
  creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
  parent: { select: { id: true, title: true, type: true } },
  _count: { select: { comments: true, activities: true } },
} as const;

const dashboardFocusTaskSelect = {
  id: true,
  title: true,
  dueDate: true,
  projectId: true,
  project: { select: { id: true, name: true, key: true } },
} as const;

const attachmentMetaSelect = {
  id: true,
  taskId: true,
  uploaderId: true,
  fileName: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  taskId: true,
  author: { select: { id: true, name: true, email: true, avatarUrl: true } },
} as const;

const taskActivitySelect = {
  id: true,
  action: true,
  details: true,
  createdAt: true,
  taskId: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
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
  storyPoints?: number | null;
  type?: TaskType;
  priority?: TaskPriority;
  labels?: string[];
  dueDate?: string | null;
  projectId: string;
  statusId?: string;
  sprintId?: string;
  assigneeId?: string;
  creatorId: string;
}

export interface PaginationInput {
  limit?: number;
  cursor?: string;
}

export interface ProjectTaskListInput extends PaginationInput {
  sprintId?: string | null;
  statusId?: string;
}

export interface AssignedTaskListInput extends PaginationInput {
  filter?: "all" | "today" | "overdue" | "completed";
}

async function pagedFindMany<T>(
  limit: number,
  query: (take: number) => Promise<T[]>,
  getCursor: (item: T) => string
) {
  const rows = await query(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    hasMore,
    nextCursor: hasMore && items.length ? getCursor(items[items.length - 1]) : null,
  };
}

export const createTask = async (input: CreateTaskInput) => {
  // SUBTASK is only ever created through createSubtask (which sets parentId) — a
  // top-level task can never be created with that type.
  if (input.type === TaskType.SUBTASK) {
    throw new AppError("Subtasks must be created from a parent task", 400);
  }

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

  const resolvedStatus = input.statusId
    ? await requireProjectStatus(input.statusId, input.projectId)
    : await getBacklogDefaultStatus(input.projectId);

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      acceptanceCriteria: input.acceptanceCriteria,
      estimatedHours: input.estimatedHours,
      storyPoints: input.storyPoints,
      type: input.type ?? TaskType.STORY,
      priority: input.priority ?? TaskPriority.MEDIUM,
      statusId: resolvedStatus.id,
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
      projectId: task.projectId,
      type: NotificationType.TASK_ASSIGNED,
      message: `You were assigned to "${task.title}" in ${task.project.name}.`,
    });
  }

  emitProjectEvent(task.projectId, "task:created", task);
  return task;
};
export const getProjectTasksLegacy = async (projectId: string, userId: string) => {
  await requireProjectMember(projectId, userId);

  // Board, backlog, and every other project-wide task view render this list directly —
  // child tasks (subtasks) must never appear here as top-level items. They're only
  // ever surfaced within their parent's detail view via getTaskChildren.
  return prisma.task.findMany({
    where: { projectId, parentId: null },
    select: taskListSelect,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
};

export const getProjectTasks = async (projectId: string, userId: string, options: ProjectTaskListInput = {}) => {
  await requireProjectMember(projectId, userId);
  const limit = options.limit ?? 75;
  const where = {
    projectId,
    parentId: null,
    ...(options.sprintId !== undefined ? { sprintId: options.sprintId } : {}),
    ...(options.statusId ? { statusId: options.statusId } : {}),
  };

  const [page, totalCount] = await Promise.all([
    pagedFindMany(
      limit,
      (take) => prisma.task.findMany({
        where,
        select: taskListSelect,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take,
        ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
      }),
      (task) => task.id
    ),
    prisma.task.count({ where }),
  ]);

  return { ...page, totalCount };
};

// Unlike getProjectTasks, subtasks ARE included here — a user assigned to a subtask
// should see it in their personal task list (the parent include gives it context).
export const getAssignedTasksLegacy = async (userId: string) => prisma.task.findMany({
  where: {
    assigneeId: userId,
    project: { members: { some: { userId } } },
  },
  select: taskListSelect,
  orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
});

export const getAssignedTasks = async (userId: string, options: AssignedTaskListInput = {}) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  const limit = options.limit ?? 50;
  const where = {
    assigneeId: userId,
    project: { members: { some: { userId } } },
    ...(options.filter === "completed" ? { status: { category: StatusCategory.DONE } } : {}),
    ...(options.filter === "today" ? {
      status: { category: { not: StatusCategory.DONE } },
      dueDate: { gte: todayStart, lte: todayEnd },
    } : {}),
    ...(options.filter === "overdue" ? {
      status: { category: { not: StatusCategory.DONE } },
      dueDate: { lt: todayStart },
    } : {}),
  };

  const [page, totalCount] = await Promise.all([
    pagedFindMany(
      limit,
      (take) => prisma.task.findMany({
        where,
        select: taskListSelect,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take,
        ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
      }),
      (task) => task.id
    ),
    prisma.task.count({ where }),
  ]);

  return { ...page, totalCount };
};

export const getAssignedFocusTasks = async (userId: string) => {
  const endToday = new Date();
  endToday.setHours(23, 59, 59, 999);

  return prisma.task.findMany({
    where: {
      assigneeId: userId,
      dueDate: { lte: endToday },
      status: { category: { not: StatusCategory.DONE } },
      project: { members: { some: { userId } } },
    },
    select: dashboardFocusTaskSelect,
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    take: 5,
  });
};

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
      status: true,
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
      parent: {
        select: {
          id: true,
          title: true,
          type: true,
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
      subtasks: {
        select: taskListSelect,
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
      _count: { select: { comments: true, activities: true, attachments: true } },
    },
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  await requireProjectMember(task.projectId, userId);

  const { subtasks, ...taskDetail } = task;

  return {
    ...taskDetail,
    documents: task.documents.map((link) => link.document),
    children: subtasks,
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

export const getTaskComments = async (taskId: string, userId: string, options: PaginationInput = {}) => {
  await getTaskForTaskFeature(taskId, userId);
  const limit = options.limit ?? 20;
  const [page, totalCount] = await Promise.all([
    pagedFindMany(
      limit,
      (take) => prisma.comment.findMany({
        where: { taskId },
        select: commentSelect,
        orderBy: { createdAt: "desc" },
        take,
        ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
      }),
      (comment) => comment.id
    ),
    prisma.comment.count({ where: { taskId } }),
  ]);

  return { ...page, items: [...page.items].reverse(), totalCount };
};

export const getTaskActivities = async (taskId: string, userId: string, options: PaginationInput = {}) => {
  await getTaskForTaskFeature(taskId, userId);
  const limit = options.limit ?? 20;
  const [page, totalCount] = await Promise.all([
    pagedFindMany(
      limit,
      (take) => prisma.taskActivity.findMany({
        where: { taskId },
        select: taskActivitySelect,
        orderBy: { createdAt: "desc" },
        take,
        ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
      }),
      (activity) => activity.id
    ),
    prisma.taskActivity.count({ where: { taskId } }),
  ]);

  return { ...page, totalCount };
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
  storyPoints?: number | null;
  type?: TaskType;
  statusId?: string;
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
    include: { status: true },
  });

  if (!existingTask) {
    throw new NotFoundError("Task not found");
  }

  await requireProjectMember(existingTask.projectId, input.userId);

  if (input.assigneeId) {
    await requireProjectMember(existingTask.projectId, input.assigneeId);
  }

  // SUBTASK is assigned only at creation (via createSubtask) and is otherwise immutable —
  // it's what distinguishes a child task from a regular top-level Story/Bug.
  if (input.type !== undefined && (input.type === TaskType.SUBTASK || existingTask.type === TaskType.SUBTASK)) {
    throw new AppError("Task type SUBTASK can only be set when a subtask is created and cannot be changed", 400);
  }

  // Subtasks always mirror their parent's sprint (see createSubtask / the cascade below) —
  // moving one independently would let it drift out of sync with the parent it belongs to.
  if (existingTask.parentId && input.sprintId !== undefined) {
    throw new AppError("Subtasks inherit their parent's sprint and cannot be moved independently", 400);
  }

  if (input.sprintId) {
    const sprint = await prisma.sprint.findUnique({ where: { id: input.sprintId } });
    if (!sprint || sprint.projectId !== existingTask.projectId) {
      throw new AppError("Sprint not found or does not belong to this project", 404);
    }
  }

  const nextStatus = input.statusId
    ? await requireProjectStatus(input.statusId, existingTask.projectId)
    : input.sprintId && existingTask.status.isBacklogDefault
      ? await getSprintDefaultStatus(existingTask.projectId)
      : undefined;
  const statusChanged = Boolean(nextStatus && nextStatus.id !== existingTask.statusId);

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: input.title,
      description: input.description,
      acceptanceCriteria: input.acceptanceCriteria,
      estimatedHours: input.estimatedHours,
      storyPoints: input.storyPoints,
      type: input.type,
      statusId: nextStatus?.id,
      priority: input.priority,
      labels: input.labels,
      dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
      assigneeId: input.assigneeId,
      sprintId: input.sprintId,
      ...(input.order !== undefined && { order: input.order }),
    },
    include: taskSummaryInclude,
  });

  // A top-level task's subtasks always ride along to whatever sprint (or backlog) their
  // parent moves to — see the immutability guard above that keeps subtasks from drifting
  // out of sync by being moved independently.
  if (input.sprintId !== undefined && updatedTask.sprintId !== existingTask.sprintId) {
    await prisma.task.updateMany({
      where: { parentId: taskId },
      data: { sprintId: updatedTask.sprintId },
    });
  }

  await prisma.taskActivity.create({
    data: {
      taskId,
      userId: input.userId,
      action: statusChanged ? "TASK_MOVED" : "TASK_UPDATED",
      details: statusChanged
        ? `Moved task "${updatedTask.title}" from ${existingTask.status.name} to ${nextStatus!.name}`
        : `Updated task "${updatedTask.title}"`,
    },
  });

  if (statusChanged && nextStatus) {
    await createProjectActivity({
      projectId: existingTask.projectId,
      userId: input.userId,
      action: "TASK_MOVED",
      target: updatedTask.title,
      details: `${existingTask.status.name} to ${nextStatus.name}`,
    });
    await notifyProjectMembers(
      existingTask.projectId,
      input.userId,
      NotificationType.TASK_MOVED,
      `"${updatedTask.title}" moved to ${nextStatus.name.toLowerCase()}.`
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
      projectId: existingTask.projectId,
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

// ─── Subtasks (real child Tasks) ─────────────────────────────────────────────
// Supersedes the checklist-based subtasks below (TaskChecklistItem) for new work.
// A subtask is a full Task with parentId set and type SUBTASK — it gets its own
// status, assignee, story points, comments, and attachments like any other task.

export const getTaskChildren = async (parentTaskId: string, userId: string) => {
  await getTaskForTaskFeature(parentTaskId, userId);

  return prisma.task.findMany({
    where: { parentId: parentTaskId },
    include: taskSummaryInclude,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
};

export interface CreateSubtaskInput {
  title: string;
  description?: string;
  assigneeId?: string;
  storyPoints?: number | null;
  priority?: TaskPriority;
}

export const createSubtaskTask = async (parentTaskId: string, userId: string, input: CreateSubtaskInput) => {
  const parent = await prisma.task.findUnique({ where: { id: parentTaskId } });
  if (!parent) throw new NotFoundError("Task not found");

  await requireProjectMember(parent.projectId, userId);

  // Nesting is one level deep only — a subtask cannot itself be a parent.
  if (parent.parentId) {
    throw new AppError("Subtasks cannot have their own subtasks", 400);
  }

  const title = input.title.trim();
  if (!title) throw new AppError("Subtask title is required", 400);

  if (input.assigneeId) {
    await requireProjectMember(parent.projectId, input.assigneeId);
  }

  // New subtask inherits the parent's current sprint (or backlog) immediately, and its
  // starting status matches — sprint-default when it lands in a sprint, backlog-default
  // otherwise. See updateTask's cascade for how it stays synced if the parent later moves.
  const resolvedStatus = parent.sprintId
    ? await getSprintDefaultStatus(parent.projectId)
    : await getBacklogDefaultStatus(parent.projectId);

  const subtask = await prisma.task.create({
    data: {
      title,
      description: input.description,
      storyPoints: input.storyPoints,
      priority: input.priority ?? TaskPriority.MEDIUM,
      type: TaskType.SUBTASK,
      statusId: resolvedStatus.id,
      projectId: parent.projectId,
      sprintId: parent.sprintId,
      parentId: parent.id,
      assigneeId: input.assigneeId,
      creatorId: userId,
    },
    include: taskSummaryInclude,
  });

  await prisma.taskActivity.create({
    data: {
      taskId: subtask.id,
      userId,
      action: "TASK_CREATED",
      details: `Created subtask "${subtask.title}" under "${parent.title}"`,
    },
  });

  if (subtask.assigneeId && subtask.assigneeId !== userId) {
    await createNotification({
      userId: subtask.assigneeId,
      projectId: subtask.projectId,
      type: NotificationType.TASK_ASSIGNED,
      message: `You were assigned to "${subtask.title}" in ${subtask.project.name}.`,
    });
  }

  return subtask;
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

const subtaskAssigneeSelect = { id: true, name: true, email: true, avatarUrl: true } as const;

export const getTaskChecklistItems = async (taskId: string, userId: string) => {
  await getTaskForTaskFeature(taskId, userId);

  return prisma.taskChecklistItem.findMany({
    where: { taskId },
    include: { assignee: { select: subtaskAssigneeSelect } },
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });
};

export const createTaskChecklistItem = async (
  taskId: string,
  userId: string,
  input: { text: string; description?: string; assigneeId?: string; order?: number }
) => {
  const task = await getTaskForTaskFeature(taskId, userId);
  const text = input.text.trim();
  if (!text) throw new AppError("Subtask text is required", 400);

  if (input.assigneeId) {
    await requireProjectMember(task.projectId, input.assigneeId);
  }

  const order = input.order ?? await prisma.taskChecklistItem.count({ where: { taskId } });

  return prisma.taskChecklistItem.create({
    data: {
      taskId,
      text,
      description: input.description,
      assigneeId: input.assigneeId,
      order,
    },
    include: { assignee: { select: subtaskAssigneeSelect } },
  });
};

export const updateTaskChecklistItem = async (
  subtaskId: string,
  userId: string,
  input: { text?: string; description?: string | null; assigneeId?: string | null; completed?: boolean; order?: number }
) => {
  const item = await prisma.taskChecklistItem.findUnique({
    where: { id: subtaskId },
    include: { task: { select: { projectId: true } } },
  });

  if (!item) throw new NotFoundError("Subtask not found");
  await requireProjectMember(item.task.projectId, userId);

  const text = input.text === undefined ? undefined : input.text.trim();
  if (text !== undefined && !text) throw new AppError("Subtask text is required", 400);

  if (input.assigneeId) {
    await requireProjectMember(item.task.projectId, input.assigneeId);
  }

  return prisma.taskChecklistItem.update({
    where: { id: subtaskId },
    data: {
      text,
      description: input.description,
      assigneeId: input.assigneeId,
      completed: input.completed,
      order: input.order,
    },
    include: { assignee: { select: subtaskAssigneeSelect } },
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

// ─── Attachment service functions ────────────────────────────────────────────

export const getTaskAttachments = async (taskId: string, userId: string, options: PaginationInput = {}) => {
  await getTaskForTaskFeature(taskId, userId);
  const limit = options.limit ?? 20;

  const [page, totalCount] = await Promise.all([
    pagedFindMany(
      limit,
      (take) => prisma.attachment.findMany({
        where: { taskId },
        select: attachmentMetaSelect,
        orderBy: { createdAt: "desc" },
        take,
        ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
      }),
      (attachment) => attachment.id
    ),
    prisma.attachment.count({ where: { taskId } }),
  ]);

  return { ...page, totalCount };
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
