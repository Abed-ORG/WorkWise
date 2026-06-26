import { NotificationType } from "@prisma/client";
import prisma from "../utils/prisma";
import { NotFoundError } from "../errors/NotFoundError";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import { notifyProjectMembers } from "./notification.service";
import { emitProjectEvent } from "./realtime.service";
import { createProjectActivity } from "./activity.service";

export const createComment = async (
  taskId: string,
  authorId: string,
  content: string
) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: { select: { name: true } } },
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  const member = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId: authorId,
        projectId: task.projectId,
      },
    },
  });

  if (!member) {
    throw new NotFoundError("Task not found");
  }

  const comment = await prisma.comment.create({
    data: {
      taskId,
      authorId,
      content,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  await prisma.taskActivity.create({
    data: {
      taskId,
      userId: authorId,
      action: "COMMENT_ADDED",
      details: "A comment was added to the task",
    },
  });
  await createProjectActivity({
    projectId: task.projectId,
    userId: authorId,
    action: "COMMENT_ADDED",
    target: task.title,
    details: "Comment added",
  });

  await notifyProjectMembers(
    task.projectId,
    authorId,
    NotificationType.COMMENT_ADDED,
    `A comment was added to "${task.title}" in ${task.project.name}.`
  );
  emitProjectEvent(task.projectId, "comment:created", { taskId, comment });

  return comment;
};

export const updateComment = async (
  commentId: string,
  userId: string,
  content: string
) => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw new NotFoundError("Comment not found");
  }

  if (comment.authorId !== userId) {
    throw new UnauthorizedError("You can only edit your own comments");
  }

  return prisma.comment.update({
    where: { id: commentId },
    data: { content },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
};

export const deleteComment = async (
  commentId: string,
  userId: string
) => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw new NotFoundError("Comment not found");
  }

  if (comment.authorId !== userId) {
    throw new UnauthorizedError("You can only delete your own comments");
  }

  await prisma.comment.delete({
    where: { id: commentId },
  });

  return comment;
};
