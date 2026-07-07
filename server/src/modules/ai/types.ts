export type AiTaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskBreakdownInput {
  featureDescription: string;
  projectContext?: string;
}

export type StoryPoints = 1 | 2 | 3 | 5 | 8 | 13;

export interface GeneratedTask {
  title: string;
  description: string;
  priority: AiTaskPriority;
  storyPoints: StoryPoints;
  acceptanceCriteria: string[];
}

export interface TaskBreakdownResult {
  tasks: GeneratedTask[];
}

export interface AcceptanceCriteriaInput {
  title: string;
  description: string;
}

export interface AcceptanceCriteriaResult {
  acceptanceCriteria: string[];
}

export interface TaskSearchInput {
  query: string;
  projectId: string;
}

export interface TaskSearchFilters {
  status: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null;
  assigneeName: string | null;
  dueBefore: string | null;
  dueAfter: string | null;
  label: string | null;
  titleKeyword: string | null;
}

export interface SprintRiskResult {
  riskLevel: "low" | "medium" | "high";
  summary: string;
  risks: Array<{ title: string; explanation: string }>;
  suggestions: string[];
}

export interface SprintSuggestionResult {
  reasoning: string;
  suggestions: Array<{ taskId: string; reason: string }>;
}

