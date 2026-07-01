import { TaskPriority, TaskStatus } from "@prisma/client";
import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().datetime().optional(),
  projectId: z.string().min(1, "Project ID is required"),
  status: z.nativeEnum(TaskStatus).optional(),
  sprintId: z.string().optional(),
  assigneeId: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional(),
  acceptanceCriteria: z.string().nullable().optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  order: z.number().int().optional(),
});

export const createTimeLogSchema = z.object({
  durationMinutes: z.number().int().positive(),
  description: z.string().optional(),
});

export const createChecklistItemSchema = z.object({
  text: z.string().min(1, "Subtask text is required"),
  order: z.number().int().optional(),
});

export const updateChecklistItemSchema = z.object({
  text: z.string().min(1, "Subtask text is required").optional(),
  completed: z.boolean().optional(),
  order: z.number().int().optional(),
});

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const createAttachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
  data: z.string().min(1),
});
