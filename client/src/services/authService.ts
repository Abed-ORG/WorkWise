import apiClient from './apiClient';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  notificationPreference?: 'ALL' | 'MENTIONS_ONLY' | 'NONE';
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/login', payload);
  return data.data;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/register', payload);
  return data.data;
}

export async function refreshToken(token: string): Promise<RefreshResponse> {
  const { data } = await apiClient.post<{ success: boolean; data: RefreshResponse }>('/auth/refresh', {
    refreshToken: token,
  });
  return data.data;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await apiClient.post('/auth/reset-password', { token, password });
}
