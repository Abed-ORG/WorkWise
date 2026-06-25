export type AiTaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskBreakdownInput {
  featureDescription: string;
  projectContext?: string;
}

export interface GeneratedTask {
  title: string;
  description: string;
  priority: AiTaskPriority;
  estimatedHours: number;
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

