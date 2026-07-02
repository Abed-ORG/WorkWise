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
  isActive: boolean;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Sprint extends ActiveSprint {
  goal?: string | null;
}

export interface SprintWithCount extends Sprint {
  _count?: { tasks: number };
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

export interface DailyDigest {
  id: string;
  title: string;
  summary: string;
  completedCount: number;
  inProgressCount: number;
  blockerCount: number;
  source: string;
  createdAt: string;
  projectId: string;
  generatedBy?: { id: string; name: string; email: string } | null;
}

export interface ProjectNotificationPreferences {
  taskAssigned: boolean;
  taskMoved: boolean;
  commentAdded: boolean;
  mention: boolean;
  sprintStarted: boolean;
  sprintCompleted: boolean;
}

export interface SprintRetrospective {
  id: string;
  whatWentWell: string;
  whatDidnt: string;
  actionItems: string;
  manualNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  sprintId: string;
  generatedBy?: { id: string; name: string; email: string } | null;
}

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

// ── Notification Preferences ──────────────────────────────

export const getProjectNotificationPreferences = async (projectId: string): Promise<ProjectNotificationPreferences> => {
  const response = await apiClient.get(`/api/projects/${projectId}/notification-preferences`);
  return response.data.data;
};

export const updateProjectNotificationPreferences = async (
  projectId: string,
  updates: Partial<ProjectNotificationPreferences>
): Promise<ProjectNotificationPreferences> => {
  const response = await apiClient.patch(`/api/projects/${projectId}/notification-preferences`, updates);
  return response.data.data;
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
  data: { name: string; goal?: string; startDate?: string; endDate?: string }
): Promise<Sprint> => {
  const response = await apiClient.post(`/api/projects/${projectId}/sprints/start`, data);
  return response.data.data;
};

export const getProjectSprints = async (projectId: string): Promise<Sprint[]> => {
  const response = await apiClient.get(`/api/projects/${projectId}/sprints`);
  return response.data.data;
};

export const createSprint = async (
  projectId: string,
  payload: { name: string; startDate?: string; endDate?: string; goal?: string; activateNow?: boolean }
): Promise<Sprint> => {
  const response = await apiClient.post(`/api/projects/${projectId}/sprints`, payload);
  return response.data.data;
};

export const getSprintById = async (
  projectId: string,
  sprintId: string
): Promise<SprintWithCount> => {
  const response = await apiClient.get(`/api/projects/${projectId}/sprints/${sprintId}`);
  return response.data.data;
};

export const completeSprint = async (
  projectId: string,
  sprintId: string,
  payload: { incompleteTaskDestination: 'backlog' | 'sprint'; targetSprintId?: string }
): Promise<Sprint> => {
  const response = await apiClient.post(`/api/projects/${projectId}/sprints/${sprintId}/complete`, payload);
  return response.data.data;
};

export const deleteSprint = async (projectId: string, sprintId: string): Promise<void> => {
  await apiClient.delete(`/api/projects/${projectId}/sprints/${sprintId}`);
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

export const getProjectDigests = async (projectId: string): Promise<DailyDigest[]> => {
  const response = await apiClient.get(`/api/projects/${projectId}/digests`);
  return response.data.data;
};

export const generateDailyDigest = async (projectId: string): Promise<DailyDigest> => {
  const response = await apiClient.post(`/api/projects/${projectId}/digests/generate`);
  return response.data.data;
};

export const getSprintRetrospective = async (
  projectId: string,
  sprintId: string
): Promise<SprintRetrospective | null> => {
  const response = await apiClient.get(`/api/projects/${projectId}/sprints/${sprintId}/retrospective`);
  return response.data.data;
};

export const generateSprintRetrospective = async (
  projectId: string,
  sprintId: string
): Promise<SprintRetrospective> => {
  const response = await apiClient.post(`/api/projects/${projectId}/sprints/${sprintId}/retrospective/generate`);
  return response.data.data;
};

export const updateSprintRetrospectiveNotes = async (
  projectId: string,
  sprintId: string,
  manualNotes: string
): Promise<SprintRetrospective> => {
  const response = await apiClient.patch(`/api/projects/${projectId}/sprints/${sprintId}/retrospective/notes`, { manualNotes });
  return response.data.data;
};
