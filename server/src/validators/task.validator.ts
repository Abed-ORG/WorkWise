import { TaskPriority } from "@prisma/client";
import { z } from "zod";

// Story points are Fibonacci-constrained — the only valid effort scale going forward.
const storyPointsSchema = z
  .union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(8), z.literal(13)])
  .nullable()
  .optional();

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  // Accepted-but-ignored during the storyPoints transition so old clients/requests don't 400.
  estimatedHours: z.number().nonnegative().nullable().optional(),
  storyPoints: storyPointsSchema,
  priority: z.nativeEnum(TaskPriority).optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().datetime().optional(),
  projectId: z.string().min(1, "Project ID is required"),
  statusId: z.string().min(1).optional(),
  sprintId: z.string().optional(),
  assigneeId: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional(),
  acceptanceCriteria: z.string().nullable().optional(),
  // Accepted-but-ignored during the storyPoints transition so old clients/requests don't 400.
  estimatedHours: z.number().nonnegative().nullable().optional(),
  storyPoints: storyPointsSchema,
  statusId: z.string().min(1).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  order: z.number().int().optional(),
});

export const createChecklistItemSchema = z.object({
  text: z.string().min(1, "Subtask text is required"),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  order: z.number().int().optional(),
});

export const updateChecklistItemSchema = z.object({
  text: z.string().min(1, "Subtask text is required").optional(),
  description: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
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
