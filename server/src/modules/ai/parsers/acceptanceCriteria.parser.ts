import { z } from "zod";
import { AppError } from "../../../errors/AppError";
import { AcceptanceCriteriaResult } from "../types";
import { parseJsonObject } from "./json.parser";

const acceptanceCriteriaSchema = z.object({
  acceptanceCriteria: z.array(z.string().trim().min(1)).min(1),
});

export const parseAcceptanceCriteriaResponse = (
  rawResponse: string
): AcceptanceCriteriaResult => {
  const parsed = acceptanceCriteriaSchema.safeParse(parseJsonObject(rawResponse));

  if (!parsed.success) {
    throw new AppError(
      "AI response did not match acceptance criteria structure",
      502
    );
  }

  return parsed.data;
};

