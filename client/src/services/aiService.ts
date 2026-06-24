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
