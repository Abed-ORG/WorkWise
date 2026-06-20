import apiClient from './apiClient';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  notificationPreference?: 'ALL' | 'MENTIONS_ONLY' | 'NONE';
  onboardingCompleted: boolean;
  onboardingDismissed: boolean;
  createdAt: string;
  _count: {
    projectMembers: number;
  };
  projectMembers: Array<{
    role: 'ADMIN' | 'DEVELOPER' | 'VIEWER';
    project: { id: string; name: string; key: string };
  }>;
}

export interface UpdateProfilePayload {
  name?: string;
  avatarUrl?: string;
}

export async function getMyProfile(): Promise<UserProfile> {
  const { data } = await apiClient.get<{ success: boolean; data: UserProfile }>('/api/users/me');
  return data.data;
}

export async function updateMyProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  const { data } = await apiClient.patch<{ success: boolean; data: UserProfile }>('/api/users/me', payload);
  return data.data;
}

export async function updateOnboardingStatus(status: 'COMPLETED' | 'DISMISSED'): Promise<{
  onboardingCompleted: boolean;
  onboardingDismissed: boolean;
}> {
  const { data } = await apiClient.patch('/api/users/me/onboarding', { status });
  return data.data;
}
