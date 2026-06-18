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
  priority: TaskPriority;
  status: TaskStatus;
  labels: string[];
  dueDate?: string | null;
  projectId: string;
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

export async function deleteTask(taskId: string): Promise<void> {
  await apiClient.delete(`/tasks/${taskId}`);
}
