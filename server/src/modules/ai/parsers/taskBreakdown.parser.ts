import { z } from "zod";
import { AppError } from "../../../errors/AppError";
import { TaskBreakdownResult } from "../types";
import { parseJsonObject } from "./json.parser";

const storyPointsSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(8),
  z.literal(13),
]);

const taskBreakdownSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
        storyPoints: storyPointsSchema,
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

