import { z } from "zod";
import { AppError } from "../../../errors/AppError";
import { TaskBreakdownResult } from "../types";
import { parseJsonObject } from "./json.parser";

const taskBreakdownSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
        estimatedHours: z.number().nonnegative(),
        acceptanceCriteria: z.array(z.string().trim().min(1)).min(1),
      })
    )
    .min(1),
});

export const parseTaskBreakdownResponse = (
  rawResponse: string
): TaskBreakdownResult => {
  const parsed = taskBreakdownSchema.safeParse(parseJsonObject(rawResponse));

  if (!parsed.success) {
    throw new AppError("AI response did not match task breakdown structure", 502);
  }

  return parsed.data;
};

