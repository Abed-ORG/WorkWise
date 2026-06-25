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

const taskSearchSchema = z.object({
  filters: z.object({
    status: z
      .enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"])
      .nullable()
      .optional()
      .transform((v) => v ?? null),
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

export const parseTaskSearchResponse = (rawResponse: string): TaskSearchFilters => {
  const parsed = taskSearchSchema.safeParse(parseJsonObject(rawResponse));

  if (!parsed.success) {
    throw new AppError("AI response did not match task search structure", 502);
  }

  return parsed.data.filters as TaskSearchFilters;
};
