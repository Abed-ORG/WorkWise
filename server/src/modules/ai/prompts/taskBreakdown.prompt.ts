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
      "storyPoints": 3,
      "acceptanceCriteria": ["string"]
    }
  ]
}

Rules:
- Create practical, independently actionable engineering tasks.
- Use only these priority values: LOW, MEDIUM, HIGH, URGENT.
- Include at least one acceptance criterion per task.
- storyPoints must be one of the Fibonacci values 1, 2, 3, 5, 8, 13, representing relative engineering effort/complexity (1 = trivial, 13 = very large — suggest splitting the task if it seems larger than 13).
- Do not include markdown, comments, or explanatory text outside the JSON.
`.trim();
};

