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
  estimatedHours?: number | null;
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

export interface TaskChecklistItem {
  id: string;
  taskId: string;
  text: string;
  completed: boolean;
  order: number;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  storageKey: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface TaskTimeLog {
  id: string;
  taskId: string;
  userId: string;
  durationMinutes: number;
  description?: string | null;
  createdAt: string;
  user: TaskUser;
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
  estimatedHours?: number | null;
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

export async function updateTask(taskId: string, payload: Partial<Pick<Task, 'title' | 'description' | 'acceptanceCriteria' | 'estimatedHours' | 'priority' | 'status' | 'labels' | 'dueDate'>> & { assigneeId?: string | null }): Promise<Task> {
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

export async function getTaskSubtasks(taskId: string): Promise<TaskChecklistItem[]> {
  const response = await apiClient.get(`/tasks/${taskId}/subtasks`);
  return response.data.data;
}

export async function createTaskSubtask(taskId: string, text: string): Promise<TaskChecklistItem> {
  const response = await apiClient.post(`/tasks/${taskId}/subtasks`, { text });
  return response.data.data;
}

export async function updateTaskSubtask(subtaskId: string, payload: Partial<Pick<TaskChecklistItem, 'text' | 'completed' | 'order'>>): Promise<TaskChecklistItem> {
  const response = await apiClient.patch(`/tasks/subtasks/${subtaskId}`, payload);
  return response.data.data;
}

export async function deleteTaskSubtask(subtaskId: string): Promise<void> {
  await apiClient.delete(`/tasks/subtasks/${subtaskId}`);
}

export async function getTaskTimeLogs(taskId: string): Promise<{ logs: TaskTimeLog[]; totalMinutes: number }> {
  const response = await apiClient.get(`/tasks/${taskId}/time-logs`);
  return response.data.data;
}

export async function createTaskTimeLog(taskId: string, payload: { durationMinutes: number; description?: string }): Promise<TaskTimeLog> {
  const response = await apiClient.post(`/tasks/${taskId}/time-logs`, payload);
  return response.data.data;
}

export async function deleteTaskTimeLog(timeLogId: string): Promise<void> {
  await apiClient.delete(`/tasks/time-logs/${timeLogId}`);
}

export async function getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const response = await apiClient.get(`/tasks/${taskId}/attachments`);
  return response.data.data;
}

export async function uploadTaskAttachment(taskId: string, file: File): Promise<TaskAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(`/tasks/${taskId}/attachments`, formData);
  return response.data.data;
}

export async function deleteTaskAttachment(attachmentId: string): Promise<void> {
  await apiClient.delete(`/tasks/attachments/${attachmentId}`);
}
