import apiClient from './apiClient';
import type { ProjectDocument } from './projectService';

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
  acceptanceCriteria?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  labels: string[];
  dueDate?: string | null;
  order: number;
  projectId: string;
  sprintId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  project?: { id: string; name: string; key: string };
  assignee?: TaskUser | null;
  creator?: TaskUser;
  sprint?: { id: string; name: string } | null;
  comments?: TaskComment[];
  activities?: TaskActivity[];
  documents?: ProjectDocument[];
}

export interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  author: TaskUser;
}

export interface TaskActivity {
  id: string;
  action: string;
  details?: string | null;
  createdAt: string;
  user: TaskUser;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  priority?: TaskPriority;
  labels?: string[];
  dueDate?: string;
  projectId: string;
  status?: TaskStatus;
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

export async function getTaskById(taskId: string): Promise<Task> {
  const response = await apiClient.get(`/tasks/${taskId}`);
  return response.data.data;
}

export async function getTaskDocuments(taskId: string): Promise<ProjectDocument[]> {
  const response = await apiClient.get(`/tasks/${taskId}/documents`);
  return response.data.data;
}

export async function updateTaskDocuments(taskId: string, documentIds: string[]): Promise<ProjectDocument[]> {
  const response = await apiClient.put(`/tasks/${taskId}/documents`, { documentIds });
  return response.data.data;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  const response = await apiClient.patch(`/tasks/${taskId}`, { status });
  return response.data.data;
}

export async function updateTask(taskId: string, payload: Partial<Pick<Task, 'title' | 'description' | 'acceptanceCriteria' | 'priority' | 'status' | 'labels' | 'dueDate' | 'sprintId'>> & { assigneeId?: string | null }): Promise<Task> {
  const response = await apiClient.patch(`/tasks/${taskId}`, payload);
  return response.data.data;
}

export async function createTaskComment(taskId: string, content: string): Promise<TaskComment> {
  const response = await apiClient.post(`/tasks/${taskId}/comments`, { content });
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
