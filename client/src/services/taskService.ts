import apiClient from './apiClient';
import type { ProjectDocument } from './projectService';

export type StatusCategory = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskType = 'STORY' | 'BUG' | 'SUBTASK';

export interface ProjectStatus {
  id: string;
  name: string;
  category: StatusCategory;
  order: number;
  color?: string | null;
  isBacklogDefault: boolean;
  isSprintDefault: boolean;
  projectId?: string;
}

export interface TaskUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface TaskParentSummary {
  id: string;
  title: string;
  type: TaskType;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string | null;
  estimatedHours?: number | null;
  storyPoints?: number | null;
  type: TaskType;
  priority: TaskPriority;
  status: ProjectStatus;
  statusId: string;
  labels: string[];
  dueDate?: string | null;
  order: number;
  projectId: string;
  sprintId?: string | null;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  project?: { id: string; name: string; key: string };
  assignee?: TaskUser | null;
  creator?: TaskUser;
  parent?: TaskParentSummary | null;
  sprint?: { id: string; name: string } | null;
  comments?: TaskComment[];
  activities?: TaskActivity[];
  documents?: ProjectDocument[];
  _count?: {
    comments?: number;
    activities?: number;
  };
}

export interface TaskChecklistItem {
  id: string;
  taskId: string;
  text: string;
  description?: string | null;
  completed: boolean;
  order: number;
  assigneeId?: string | null;
  assignee?: TaskUser | null;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  uploaderId: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
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
  storyPoints?: number | null;
  type?: Exclude<TaskType, 'SUBTASK'>;
  priority?: TaskPriority;
  labels?: string[];
  dueDate?: string;
  projectId: string;
  statusId?: string;
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

export async function updateTaskStatus(taskId: string, statusId: string): Promise<Task> {
  const response = await apiClient.patch(`/tasks/${taskId}`, { statusId });
  return response.data.data;
}

export async function updateTask(taskId: string, payload: Partial<Pick<Task, 'title' | 'description' | 'acceptanceCriteria' | 'estimatedHours' | 'storyPoints' | 'priority' | 'labels' | 'dueDate' | 'sprintId'>> & { type?: Exclude<TaskType, 'SUBTASK'>; assigneeId?: string | null; statusId?: string }): Promise<Task> {
  const response = await apiClient.patch(`/tasks/${taskId}`, payload);
  return response.data.data;
}

export async function getProjectStatuses(projectId: string): Promise<ProjectStatus[]> {
  const response = await apiClient.get(`/api/projects/${projectId}/statuses`);
  return response.data.data;
}

export interface CreateProjectStatusPayload {
  name: string;
  category: StatusCategory;
  color?: string | null;
}

export interface UpdateProjectStatusPayload {
  name?: string;
  category?: StatusCategory;
  color?: string | null;
  isBacklogDefault?: true;
  isSprintDefault?: true;
}

export async function createProjectStatus(projectId: string, payload: CreateProjectStatusPayload): Promise<ProjectStatus> {
  const response = await apiClient.post(`/api/projects/${projectId}/statuses`, payload);
  return response.data.data;
}

export async function updateProjectStatus(projectId: string, statusId: string, payload: UpdateProjectStatusPayload): Promise<ProjectStatus> {
  const response = await apiClient.patch(`/api/projects/${projectId}/statuses/${statusId}`, payload);
  return response.data.data;
}

export async function reorderProjectStatuses(projectId: string, orderedIds: string[]): Promise<ProjectStatus[]> {
  const response = await apiClient.patch(`/api/projects/${projectId}/statuses/reorder`, { orderedIds });
  return response.data.data;
}

export async function deleteProjectStatus(projectId: string, statusId: string, reassignToStatusId?: string): Promise<void> {
  await apiClient.delete(`/api/projects/${projectId}/statuses/${statusId}`, {
    data: reassignToStatusId ? { reassignToStatusId } : undefined,
  });
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

// Real Task subtasks (parentId/type SUBTASK) — supersedes the checklist-based subtasks
// below (TaskChecklistItem), which stay dormant for existing data/API compatibility.
export interface CreateSubtaskPayload {
  title: string;
  description?: string;
  assigneeId?: string;
  storyPoints?: number | null;
  priority?: TaskPriority;
}

export async function getTaskChildren(taskId: string): Promise<Task[]> {
  const response = await apiClient.get(`/tasks/${taskId}/children`);
  return response.data.data;
}

export async function createTaskChild(taskId: string, payload: CreateSubtaskPayload): Promise<Task> {
  const response = await apiClient.post(`/tasks/${taskId}/children`, payload);
  return response.data.data;
}

export async function getTaskSubtasks(taskId: string): Promise<TaskChecklistItem[]> {
  const response = await apiClient.get(`/tasks/${taskId}/subtasks`);
  return response.data.data;
}

export async function createTaskSubtask(taskId: string, text: string, extra?: { description?: string; assigneeId?: string }): Promise<TaskChecklistItem> {
  const response = await apiClient.post(`/tasks/${taskId}/subtasks`, { text, ...extra });
  return response.data.data;
}

export async function updateTaskSubtask(subtaskId: string, payload: Partial<Pick<TaskChecklistItem, 'text' | 'completed' | 'order' | 'description' | 'assigneeId'>>): Promise<TaskChecklistItem> {
  const response = await apiClient.patch(`/tasks/subtasks/${subtaskId}`, payload);
  return response.data.data;
}

export async function deleteTaskSubtask(subtaskId: string): Promise<void> {
  await apiClient.delete(`/tasks/subtasks/${subtaskId}`);
}

export async function getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const response = await apiClient.get(`/tasks/${taskId}/attachments`);
  return response.data.data;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip the "data:<mime>;base64," prefix — server only wants the raw base64
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadTaskAttachment(taskId: string, file: File): Promise<TaskAttachment> {
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('File exceeds the 5 MB size limit');
  }
  const data = await fileToBase64(file);
  const response = await apiClient.post(`/tasks/${taskId}/attachments`, {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    data,
  });
  return response.data.data;
}

export async function fetchTaskAttachmentBlob(attachmentId: string): Promise<Blob> {
  const response = await apiClient.get(`/tasks/attachments/${attachmentId}/download`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function downloadTaskAttachment(attachmentId: string): Promise<void> {
  const blob = await fetchTaskAttachmentBlob(attachmentId);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function deleteTaskAttachment(attachmentId: string): Promise<void> {
  await apiClient.delete(`/tasks/attachments/${attachmentId}`);
}
