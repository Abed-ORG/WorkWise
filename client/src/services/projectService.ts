import apiClient from './apiClient';

export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  sprints: ActiveSprint[];
  _count: { tasks: number };
}

export interface ProjectMember {
  id: string;
  role: 'ADMIN' | 'DEVELOPER' | 'VIEWER';
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

export interface ActiveSprint {
  id: string;
  name: string;
  goal?: string | null;
  startDate?: string;
  endDate?: string;
}

export interface Sprint extends ActiveSprint {
  goal?: string;
  isActive: boolean;
}

export interface Invitation {
  id: string;
  email: string;
  role: 'ADMIN' | 'DEVELOPER' | 'VIEWER';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
  project?: { id: string; name: string; key: string };
  sender: { id: string; name: string; email: string };
}

export interface CreateProjectDto {
  name: string;
  key: string;
  description?: string;
}

export interface ProjectDocument {
  id: string;
  title: string;
  content?: string | null;
  projectId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveProjectDocumentDto {
  title: string;
  content: string;
}

export type ProjectDocumentPayload = SaveProjectDocumentDto;

// ── Project CRUD ───────────────────────────────────────────

export const createProject = async (data: CreateProjectDto): Promise<Project> => {
  const response = await apiClient.post('/api/projects', data);
  return response.data.data;
};

export const getUserProjects = async (): Promise<Project[]> => {
  const response = await apiClient.get('/api/projects');
  return response.data.data;
};

export const getProjectById = async (projectId: string): Promise<Project> => {
  const response = await apiClient.get(`/api/projects/${projectId}`);
  return response.data.data;
};

export const updateProject = async (
  projectId: string,
  data: { name?: string; description?: string }
): Promise<Project> => {
  const response = await apiClient.patch(`/api/projects/${projectId}`, data);
  return response.data.data;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await apiClient.delete(`/api/projects/${projectId}`);
};

// ── Members ────────────────────────────────────────────────

export const inviteMember = async (
  projectId: string,
  data: { email: string; role: string }
): Promise<Invitation> => {
  const response = await apiClient.post(`/api/projects/${projectId}/members/invite`, data);
  return response.data.data;
};

export const getProjectInvitations = async (projectId: string): Promise<Invitation[]> => {
  const response = await apiClient.get(`/api/projects/${projectId}/members/invitations`);
  return response.data.data;
};

export const updateMemberRole = async (
  projectId: string,
  memberId: string,
  role: string
): Promise<void> => {
  await apiClient.patch(`/api/projects/${projectId}/members/${memberId}/role`, { role });
};

export const removeMember = async (projectId: string, memberId: string): Promise<void> => {
  await apiClient.delete(`/api/projects/${projectId}/members/${memberId}`);
};

// ── Invitations ────────────────────────────────────────────

export const getUserInvitations = async (): Promise<Invitation[]> => {
  const response = await apiClient.get('/api/projects/invitations/me');
  return response.data.data;
};

export const acceptInvitation = async (invitationId: string): Promise<Project> => {
  const response = await apiClient.post(`/api/projects/invitations/${invitationId}/accept`);
  return response.data.data;
};

export const declineInvitation = async (invitationId: string): Promise<void> => {
  await apiClient.post(`/api/projects/invitations/${invitationId}/decline`);
};

export const startSprint = async (
  projectId: string,
  data: { name: string; goal?: string }
): Promise<Sprint> => {
  const response = await apiClient.post(`/api/projects/${projectId}/sprints/start`, data);
  return response.data.data;
};

export const getProjectDocument = async (
  projectId: string,
  documentId?: string
): Promise<ProjectDocument | null> => {
  const path = documentId
    ? `/api/projects/${projectId}/documents/${documentId}`
    : `/api/projects/${projectId}/document`;
  const response = await apiClient.get(path);
  return response.data.data;
};

export const saveProjectDocument = async (
  projectId: string,
  data: SaveProjectDocumentDto
): Promise<ProjectDocument> => {
  const response = await apiClient.put(`/api/projects/${projectId}/document`, data);
  return response.data.data;
};

export const getProjectDocuments = async (projectId: string, q?: string): Promise<ProjectDocument[]> => {
  const response = await apiClient.get(`/api/projects/${projectId}/documents`, { params: q ? { q } : undefined });
  return response.data.data;
};

export const getProjectDocumentById = async (
  projectId: string,
  documentId: string
): Promise<ProjectDocument> => {
  return getProjectDocument(projectId, documentId) as Promise<ProjectDocument>;
};

export const createProjectDocument = async (
  projectId: string,
  data: ProjectDocumentPayload
): Promise<ProjectDocument> => {
  const response = await apiClient.post(`/api/projects/${projectId}/documents`, data);
  return response.data.data;
};

export const updateProjectDocument = async (
  projectId: string,
  documentId: string,
  data: ProjectDocumentPayload
): Promise<ProjectDocument> => {
  const response = await apiClient.put(`/api/projects/${projectId}/documents/${documentId}`, data);
  return response.data.data;
};

export const deleteProjectDocument = async (
  projectId: string,
  documentId: string
): Promise<void> => {
  await apiClient.delete(`/api/projects/${projectId}/documents/${documentId}`);
};

export const getSprintDocuments = async (
  projectId: string,
  sprintId: string
): Promise<ProjectDocument[]> => {
  const response = await apiClient.get(`/api/projects/${projectId}/sprints/${sprintId}/documents`);
  return response.data.data;
};

export const updateSprintDocuments = async (
  projectId: string,
  sprintId: string,
  documentIds: string[]
): Promise<ProjectDocument[]> => {
  const response = await apiClient.put(`/api/projects/${projectId}/sprints/${sprintId}/documents`, { documentIds });
  return response.data.data;
};
