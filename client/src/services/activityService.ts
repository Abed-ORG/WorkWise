import apiClient from './apiClient';

export interface ProjectActivity {
  id: string;
  action: string;
  target: string;
  details?: string | null;
  createdAt: string;
  projectId: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export async function getProjectActivityFeed(projectId: string, cursor?: string): Promise<ProjectActivity[]> {
  const response = await apiClient.get(`/activities/projects/${projectId}`, {
    params: cursor ? { cursor } : undefined,
  });
  return response.data.data;
}
