export interface TaskSearchPromptInput {
  query: string;
  memberNames: string[];
  labels: string[];
  statusNames: string[];
  today: string;
}

export const buildTaskSearchPrompt = ({
  query,
  memberNames,
  labels,
  statusNames,
  today,
}: TaskSearchPromptInput) => {
  const membersSection = memberNames.length > 0
    ? `Team members: ${memberNames.map((n) => `"${n}"`).join(', ')}`
    : 'Team members: none available';

  const labelsSection = labels.length > 0
    ? `Available labels: ${labels.map((l) => `"${l}"`).join(', ')}`
    : 'Available labels: none';

  const statusesSection = statusNames.length > 0
    ? `Available statuses: ${statusNames.map((s) => `"${s}"`).join(', ')}`
    : 'Available statuses: none configured';

  return `
You are a task filter assistant. Extract structured filter parameters from a natural language search query about project tasks.

Today's date: ${today}

${membersSection}
${labelsSection}
${statusesSection}
Available priorities: "LOW", "MEDIUM", "HIGH", "URGENT"

User query: "${query}"

Return only valid JSON with this exact shape:
{
  "filters": {
    "status": "<one of the available statuses>" | null,
    "priority": "HIGH" | null,
    "assigneeName": "John Smith" | null,
    "dueBefore": "2024-06-25" | null,
    "dueAfter": "2024-06-01" | null,
    "label": "frontend" | null,
    "titleKeyword": "login page" | null
  }
}

Rules:
- Set a field to null if the query does not mention it.
- status must be one of the exact available statuses or null.
- priority must be one of the exact available priorities or null.
- assigneeName must exactly match one of the listed team member names (case-sensitive), or null if no match.
- dueBefore: set to an ISO date (YYYY-MM-DD) when the query implies tasks due before a date. "overdue" means dueBefore today (${today}). "due this week" means dueBefore end of this week.
- dueAfter: set to an ISO date when the query implies a lower bound on due date.
- label must exactly match one of the listed labels or null.
- titleKeyword: a short keyword or phrase to match against task titles and descriptions; only set when the query is searching for a specific topic that is not covered by other filters.
- If no filters can be extracted, return all nulls.
- Do not include markdown, comments, or explanatory text outside the JSON.
`.trim();
};
