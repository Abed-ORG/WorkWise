import apiClient from './apiClient';

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  labels: string[];
  dueDate?: string | null;
  order: number;
  projectId: string;
  sprintId?: string | null;
  project?: { id: string; name: string; key: string };
  assignee?: TaskUser | null;
  creator?: TaskUser;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: TaskPriority;
  labels?: string[];
  dueDate?: string;
  projectId: string;
  sprintId?: string;
  assigneeId?: string;
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const response = await apiClient.post('/tasks', payload);
  return response.data.data;
}

export async function getProjectTasks(projectId: string): Promise<Task[]> {
  const response = await apiClient.get(`/tasks/project/${projectId}`);
  return response.data.data;
}

export async function getAssignedTasks(): Promise<Task[]> {
  const response = await apiClient.get('/tasks/assigned/me');
  return response.data.data;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  const response = await apiClient.patch(`/tasks/${taskId}`, { status });
  return response.data.data;
}

export async function deleteTask(taskId: string): Promise<void> {
  await apiClient.delete(`/tasks/${taskId}`);
}

export async function moveTaskToSprint(taskId: string, sprintId: string | null): Promise<Task> {
  const response = await apiClient.patch(`/tasks/${taskId}`, { sprintId });
  return response.data.data;
}

export async function reorderTask(taskId: string, order: number): Promise<Task> {
  const response = await apiClient.patch(`/tasks/${taskId}`, { order });
  return response.data.data;
}
