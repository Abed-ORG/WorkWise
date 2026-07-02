export const queryTimes = {
  profile: 5 * 60 * 1000,
  projects: 2 * 60 * 1000,
  projectDetail: 2 * 60 * 1000,
  tasks: 45 * 1000,
  sprints: 60 * 1000,
  documents: 60 * 1000,
  activity: 15 * 1000,
  notifications: 15 * 1000,
  notificationPreferences: 60 * 1000,
  ai: 45 * 1000,
} as const;

export const queryGcTime = 10 * 60 * 1000;

export const queryKeys = {
  profile: ['profile'] as const,
  projects: ['projects'] as const,
  invitations: ['invitations'] as const,
  project: (projectId: string) => ['projects', projectId] as const,
  projectTasks: (projectId: string) => ['projects', projectId, 'tasks'] as const,
  assignedTasks: ['tasks', 'assigned'] as const,
  projectDocuments: (projectId: string) => ['projects', projectId, 'documents'] as const,
  projectSprints: (projectId: string) => ['projects', projectId, 'sprints'] as const,
  sprint: (projectId: string, sprintId: string) => ['projects', projectId, 'sprints', sprintId] as const,
  projectActivity: (projectId: string) => ['projects', projectId, 'activity'] as const,
  projectDigests: (projectId: string) => ['projects', projectId, 'digests'] as const,
  sprintRetrospective: (projectId: string, sprintId: string) => ['projects', projectId, 'sprints', sprintId, 'retrospective'] as const,
  task: (taskId: string) => ['tasks', taskId] as const,
  notifications: ['notifications'] as const,
  projectNotificationPreferences: (projectId: string) => ['projects', projectId, 'notification-preferences'] as const,
} as const;
