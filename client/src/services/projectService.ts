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
  startDate?: string;
  endDate?: string;
}

export interface Sprint extends ActiveSprint {
  goal?: string;
  isActive: boolean;
  createdAt: string;
}

export interface SprintWithCount extends Sprint {
  _count: { tasks: number };
}

export interface CompleteSprintResult {
  sprint: Sprint;
  completedCount: number;
  incompleteCount: number;
}

export interface CreateSprintDto {
  name: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
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

export const createSprint = async (
  projectId: string,
  data: CreateSprintDto
): Promise<Sprint> => {
  const response = await apiClient.post(`/api/projects/${projectId}/sprints`, data);
  return response.data.data;
};

export const getProjectSprints = async (projectId: string): Promise<Sprint[]> => {
  const response = await apiClient.get(`/api/projects/${projectId}/sprints`);
  return response.data.data;
};

export const startSprint = async (
  projectId: string,
  data: { name: string; goal?: string; startDate?: string; endDate?: string }
): Promise<Sprint> => {
  const response = await apiClient.post(`/api/projects/${projectId}/sprints/start`, data);
  return response.data.data;
};

export const getSprintById = async (projectId: string, sprintId: string): Promise<SprintWithCount> => {
  const response = await apiClient.get(`/api/projects/${projectId}/sprints/${sprintId}`);
  return response.data.data;
};

export const completeSprint = async (
  projectId: string,
  sprintId: string,
  data: { incompleteTaskDestination: 'backlog' | 'sprint'; targetSprintId?: string }
): Promise<CompleteSprintResult> => {
  const response = await apiClient.post(`/api/projects/${projectId}/sprints/${sprintId}/complete`, data);
  return response.data.data;
};
