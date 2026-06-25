export interface SprintSuggestionTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
  assigneeName: string | null;
}

export interface SprintSuggestionPromptInput {
  sprintName: string;
  currentSprintTaskCount: number;
  memberNames: string[];
  backlogTasks: SprintSuggestionTask[];
}

const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export const buildSprintSuggestionPrompt = ({
  sprintName,
  currentSprintTaskCount,
  memberNames,
  backlogTasks,
}: SprintSuggestionPromptInput): string => {
  const membersLine = memberNames.length > 0
    ? memberNames.join(', ')
    : 'No team members on record';

  const sortedTasks = [...backlogTasks].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2),
  );

  const taskLines = sortedTasks
    .slice(0, 60)
    .map((t) => {
      const due = t.dueDate ? ` | due ${t.dueDate}` : '';
      const assignee = t.assigneeName ? ` | assigned: ${t.assigneeName}` : ' | unassigned';
      return `  - id:${t.id} | ${t.title} | ${t.priority} | ${t.status}${due}${assignee}`;
    })
    .join('\n');

  return `
You are a sprint planning assistant. Recommend which backlog tasks should be pulled into the current sprint.

Sprint: "${sprintName}"
Tasks already in sprint: ${currentSprintTaskCount}
Team members: ${membersLine}

IMPORTANT: Capacity is measured by task count only — no hours or story points are available. Use task count as the proxy for workload.

Backlog tasks available (sorted by priority, max 60 shown):
${taskLines}

Recommend a sensible set of tasks to pull into this sprint by following these guidelines:
1. Favor URGENT and HIGH priority tasks first.
2. Include any tasks with upcoming or past due dates.
3. Aim for a balanced workload distribution across team members.
4. Avoid recommending too many tasks — if the sprint already has tasks, be conservative.
5. Only recommend tasks from the list above — use the exact id values provided.

Return only valid JSON with this exact shape:
{
  "reasoning": "2-4 sentence plain-English summary of why these tasks were chosen",
  "suggestions": [
    {
      "taskId": "exact id from the list above",
      "reason": "One sentence reason for including this task (max 15 words)"
    }
  ]
}

Rules:
- taskId must be an exact id from the list above — do not invent ids.
- Recommend between 1 and 15 tasks. Fewer is better than overloading the sprint.
- Do not include markdown, comments, or text outside the JSON.
`.trim();
};
