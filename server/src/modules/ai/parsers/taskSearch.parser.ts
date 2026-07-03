import { z } from "zod";
import { AppError } from "../../../errors/AppError";
import { TaskSearchFilters } from "../types";
import { parseJsonObject } from "./json.parser";

const nullableString = z.string().trim().nullable().optional().transform((v) => v ?? null);
const nullableDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const parseTaskSearchResponse = (rawResponse: string, statusNames: string[]): TaskSearchFilters => {
  const statusSchema = statusNames.length > 0
    ? z.enum(statusNames as [string, ...string[]]).nullable().optional().transform((v) => v ?? null)
    : z.null().optional().transform(() => null);

  const taskSearchSchema = z.object({
    filters: z.object({
      status: statusSchema,
      priority: z
        .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
        .nullable()
        .optional()
        .transform((v) => v ?? null),
      assigneeName: nullableString,
      dueBefore: nullableDate,
      dueAfter: nullableDate,
      label: nullableString,
      titleKeyword: nullableString,
    }),
  });

  const parsed = taskSearchSchema.safeParse(parseJsonObject(rawResponse));

  if (!parsed.success) {
    throw new AppError("AI response did not match task search structure", 502);
  }

  return parsed.data.filters as TaskSearchFilters;
};
