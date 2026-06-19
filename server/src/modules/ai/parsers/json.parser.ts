import { AppError } from "../../../errors/AppError";

export const parseJsonObject = (rawResponse: string): unknown => {
  const trimmed = rawResponse.trim();

  if (!trimmed) {
    throw new AppError("AI response was empty", 502);
  }

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const jsonStart = withoutFence.indexOf("{");
  const jsonEnd = withoutFence.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new AppError("AI response did not contain JSON", 502);
  }

  const jsonText = withoutFence.slice(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new AppError("AI response contained invalid JSON", 502);
  }
};

