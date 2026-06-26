import { z } from "zod";
import { AppError } from "../../../errors/AppError";
import { SprintSuggestionResult } from "../types";
import { parseJsonObject } from "./json.parser";

const sprintSuggestionSchema = z.object({
  reasoning: z.string().trim().min(1),
  suggestions: z.array(
    z.object({
      taskId: z.string().trim().min(1),
      reason: z.string().trim().min(1),
    })
  ),
});

export const parseSprintSuggestionResponse = (rawResponse: string): SprintSuggestionResult => {
  const parsed = sprintSuggestionSchema.safeParse(parseJsonObject(rawResponse));

  if (!parsed.success) {
    throw new AppError("AI response did not match sprint suggestion structure", 502);
  }

  return parsed.data;
};
