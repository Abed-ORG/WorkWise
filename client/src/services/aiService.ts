import apiClient from './apiClient';

export type AiTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

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

export async function generateTaskBreakdown(
  featureDescription: string,
  projectContext?: string,
): Promise<TaskBreakdownResult> {
  const response = await apiClient.post('/api/ai/task-breakdown', {
    featureDescription,
    ...(projectContext?.trim() ? { projectContext: projectContext.trim() } : {}),
  });
  return response.data.data;
}

export interface AcceptanceCriteriaResult {
  acceptanceCriteria: string[];
}

export async function generateAcceptanceCriteria(
  title: string,
  description: string,
): Promise<AcceptanceCriteriaResult> {
  const response = await apiClient.post('/api/ai/acceptance-criteria', { title, description });
  return response.data.data;
}

export interface SprintSuggestionItem {
  taskId: string;
  reason: string;
}

export interface SprintSuggestionResult {
  reasoning: string;
  suggestions: SprintSuggestionItem[];
}

export async function getSprintSuggestion(
  projectId: string,
  sprintId: string,
): Promise<SprintSuggestionResult> {
  const response = await apiClient.post('/api/ai/sprint-suggestion', { projectId, sprintId });
  return response.data.data;
}

export interface SprintRiskResult {
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
  risks: Array<{ title: string; explanation: string }>;
  suggestions: string[];
}

export async function getSprintRisk(
  projectId: string,
  sprintId: string,
): Promise<SprintRiskResult> {
  const response = await apiClient.post('/api/ai/sprint-risk', { projectId, sprintId });
  return response.data.data;
}

export interface TaskSearchFilters {
  status: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
  assigneeName: string | null;
  dueBefore: string | null;
  dueAfter: string | null;
  label: string | null;
  titleKeyword: string | null;
}

export async function parseTaskQuery(
  query: string,
  projectId: string,
): Promise<TaskSearchFilters> {
  const response = await apiClient.post('/api/ai/task-search', { query, projectId });
  return response.data.data.filters;
}

export interface AiQuotaStatus {
  count: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  warning: boolean;
  resetAt: string;
}

export async function getAiQuotaStatus(): Promise<AiQuotaStatus> {
  const response = await apiClient.get('/api/ai/status');
  return response.data.data;
}
