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
  priority?: TaskPriority;
  labels?: string[];
  dueDate?: string;
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
      priority: input.priority ?? TaskPriority.MEDIUM,
      status: TaskStatus.BACKLOG,
      labels: input.labels ?? [],
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
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
    },
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  await requireProjectMember(task.projectId, userId);

  return task;
};
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  labels?: string[];
  dueDate?: string;
  assigneeId?: string | null;
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

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      labels: input.labels,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      assigneeId: input.assigneeId,
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
