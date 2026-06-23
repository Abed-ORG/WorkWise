import { TaskBreakdownInput } from "../types";

export const buildTaskBreakdownPrompt = ({
  featureDescription,
  projectContext,
}: TaskBreakdownInput) => {
  const contextSection = projectContext?.trim()
    ? `Project context:\n${projectContext.trim()}`
    : "Project context: Not provided.";

  return `
You are an expert Scrum product owner helping break a feature into implementation tasks.

Feature description:
${featureDescription.trim()}

${contextSection}

Return only valid JSON with this exact shape:
{
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "priority": "LOW | MEDIUM | HIGH | URGENT",
      "estimatedHours": 4,
      "acceptanceCriteria": ["string"]
    }
  ]
}

Rules:
- Create practical, independently actionable engineering tasks.
- Use only these priority values: LOW, MEDIUM, HIGH, URGENT.
- Include at least one acceptance criterion per task.
- estimatedHours must be a positive number representing realistic engineering effort (e.g. 1, 2, 4, 8).
- Do not include markdown, comments, or explanatory text outside the JSON.
`.trim();
};

