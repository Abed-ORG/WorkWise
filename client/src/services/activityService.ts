import apiClient from './apiClient';
import type { PaginatedResponse } from './taskService';

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

function normalizePage<T>(data: PaginatedResponse<T> | T[]): PaginatedResponse<T> {
  if (Array.isArray(data)) return { items: data, totalCount: data.length, hasMore: false, nextCursor: null };
  return data;
}

export async function getProjectActivityFeedPage(projectId: string, cursor?: string, limit = 20): Promise<PaginatedResponse<ProjectActivity>> {
  const response = await apiClient.get(`/activities/projects/${projectId}`, {
    params: { ...(cursor ? { cursor } : {}), limit },
  });
  return normalizePage<ProjectActivity>(response.data.data);
}

export async function getProjectActivityFeed(projectId: string, cursor?: string): Promise<ProjectActivity[]> {
  const page = await getProjectActivityFeedPage(projectId, cursor);
  return page.items;
}
