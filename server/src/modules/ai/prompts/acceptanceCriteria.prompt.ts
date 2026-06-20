import { AcceptanceCriteriaInput } from "../types";

export const buildAcceptanceCriteriaPrompt = ({
  title,
  description,
}: AcceptanceCriteriaInput) => {
  return `
You are an expert Scrum product owner writing clear, testable acceptance criteria.

Task title:
${title.trim()}

Task description:
${description.trim()}

Return only valid JSON with this exact shape:
{
  "acceptanceCriteria": [
    "string"
  ]
}

Rules:
- Write criteria that are observable and verifiable.
- Keep each criterion concise.
- Do not include markdown, comments, or explanatory text outside the JSON.
`.trim();
};

