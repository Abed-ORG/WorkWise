import { z } from "zod";
import { AppError } from "../../../errors/AppError";
import { SprintRiskResult } from "../types";
import { parseJsonObject } from "./json.parser";

const sprintRiskSchema = z.object({
  riskLevel: z.enum(["low", "medium", "high"]),
  summary: z.string().trim().min(1),
  risks: z.array(
    z.object({
      title: z.string().trim().min(1),
      explanation: z.string().trim().min(1),
    })
  ),
  suggestions: z.array(z.string().trim().min(1)),
});

export const parseSprintRiskResponse = (rawResponse: string): SprintRiskResult => {
  const parsed = sprintRiskSchema.safeParse(parseJsonObject(rawResponse));

  if (!parsed.success) {
    throw new AppError("AI response did not match sprint risk structure", 502);
  }

  return parsed.data;
};
