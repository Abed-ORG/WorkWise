import apiClient from './apiClient';

export type NotificationPreference = 'ALL' | 'MENTIONS_ONLY' | 'NONE';
export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_MOVED'
  | 'COMMENT_ADDED'
  | 'MENTION'
  | 'SPRINT_STARTED'
  | 'SPRINT_COMPLETED';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
  userId: string;
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const response = await apiClient.get('/notifications');
  return response.data.data;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiClient.patch(`/notifications/${notificationId}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all');
}

export async function updateNotificationPreference(preference: NotificationPreference): Promise<NotificationPreference> {
  const response = await apiClient.patch('/notifications/preference', { preference });
  return response.data.data.notificationPreference;
}
