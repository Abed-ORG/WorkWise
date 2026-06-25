export interface SprintRiskPromptInput {
  sprintName: string;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number | null;
  totalTasks: number;
  byStatus: {
    BACKLOG: number;
    TODO: number;
    IN_PROGRESS: number;
    IN_REVIEW: number;
    DONE: number;
  };
  byPriority: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    URGENT: number;
  };
  overdueTasks: number;
  workload: Array<{ name: string; taskCount: number }>;
  unassignedCount: number;
}

export const buildSprintRiskPrompt = (input: SprintRiskPromptInput): string => {
  const {
    sprintName,
    startDate,
    endDate,
    daysRemaining,
    totalTasks,
    byStatus,
    byPriority,
    overdueTasks,
    workload,
    unassignedCount,
  } = input;

  const dateRange = startDate && endDate
    ? `${startDate} → ${endDate}`
    : startDate
    ? `Started ${startDate}, no end date set`
    : 'No dates set';

  const daysLine = daysRemaining === null
    ? 'Days remaining: unknown (no end date)'
    : daysRemaining === 0
    ? 'Days remaining: Last day (0)'
    : `Days remaining: ${daysRemaining}`;

  const notStarted = byStatus.BACKLOG + byStatus.TODO;
  const inFlight = byStatus.IN_PROGRESS + byStatus.IN_REVIEW;

  const workloadLines = workload.length > 0
    ? workload.map((w) => `  - ${w.name}: ${w.taskCount} task${w.taskCount !== 1 ? 's' : ''}`).join('\n')
    : '  (no assigned members)';

  return `
You are a sprint health analyst. Assess the risk of a software development sprint based on the data below and return structured JSON.

IMPORTANT: Capacity is measured only by task count (no hours or story points are available). Acknowledge this limitation in your analysis.

Sprint: "${sprintName}"
Dates: ${dateRange}
${daysLine}

Task summary (total: ${totalTasks}):
  - Not started (Backlog + To Do): ${notStarted}
  - In progress + In review: ${inFlight}
  - Done: ${byStatus.DONE}
  - Overdue (past due date, not done): ${overdueTasks}

Priority breakdown:
  - Urgent: ${byPriority.URGENT}
  - High: ${byPriority.HIGH}
  - Medium: ${byPriority.MEDIUM}
  - Low: ${byPriority.LOW}

Workload distribution (tasks per assignee):
${workloadLines}
  - Unassigned: ${unassignedCount} task${unassignedCount !== 1 ? 's' : ''}

Return only valid JSON with this exact shape:
{
  "riskLevel": "low" | "medium" | "high",
  "summary": "1-2 sentence plain-English overview of the sprint health",
  "risks": [
    {
      "title": "Short risk title (max 8 words)",
      "explanation": "1-2 sentence explanation with specific numbers from the data"
    }
  ],
  "suggestions": [
    "Specific, actionable suggestion (max 20 words)"
  ]
}

Rules:
- riskLevel: "low" = generally healthy, minor concerns; "medium" = notable issues worth attention; "high" = serious problems likely to cause sprint failure.
- risks: list every distinct risk you identify. If none, return an empty array.
- suggestions: provide 2-5 specific, actionable suggestions. Prefer concrete advice (e.g. "Move 3 unstarted tasks to backlog" over vague advice).
- Do not invent data not present in the input.
- Do not include markdown, comments, or text outside the JSON.
`.trim();
};
