import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Select, Spinner } from './ui';
import {
  getUserProjects,
  getProjectNotificationPreferences,
  updateProjectNotificationPreferences,
} from '../services/projectService';
import type { ProjectNotificationPreferences as ProjectNotificationPreferencesData } from '../services/projectService';
import { queryKeys, queryTimes } from '../services/queryOptions';

const notificationToggleOptions: Array<{ key: keyof ProjectNotificationPreferencesData; label: string; description: string }> = [
  { key: 'taskAssigned', label: 'Task assigned', description: 'Notify me when a task in this project is assigned to me.' },
  { key: 'taskMoved', label: 'Task status changed', description: 'Notify me when a task moves to a new status.' },
  { key: 'commentAdded', label: 'Comment added', description: 'Notify me when someone comments on a task.' },
  { key: 'mention', label: 'Mentions', description: 'Notify me when I am mentioned in a comment.' },
  { key: 'sprintStarted', label: 'Sprint started', description: 'Notify me when a new sprint starts.' },
  { key: 'sprintCompleted', label: 'Sprint completed', description: 'Notify me when a sprint is completed.' },
];

export default function ProjectNotificationPreferences() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: getUserProjects,
    staleTime: queryTimes.projects,
  });
  const projects = projectsQuery.data ?? [];
  const activeProjectId = selectedProjectId || projects[0]?.id || '';

  const preferencesQuery = useQuery({
    queryKey: queryKeys.projectNotificationPreferences(activeProjectId),
    queryFn: () => getProjectNotificationPreferences(activeProjectId),
    staleTime: queryTimes.notificationPreferences,
    enabled: Boolean(activeProjectId),
  });

  const mutation = useMutation({
    mutationFn: (updates: Partial<ProjectNotificationPreferencesData>) => updateProjectNotificationPreferences(activeProjectId, updates),
    onMutate: async (updates) => {
      const previous = queryClient.getQueryData<ProjectNotificationPreferencesData>(queryKeys.projectNotificationPreferences(activeProjectId));
      queryClient.setQueryData<ProjectNotificationPreferencesData | undefined>(
        queryKeys.projectNotificationPreferences(activeProjectId),
        (current) => (current ? { ...current, ...updates } : current)
      );
      return { previous };
    },
    onError: (_error, _updates, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.projectNotificationPreferences(activeProjectId), context.previous);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.projectNotificationPreferences(activeProjectId), data);
    },
  });

  function handleToggle(key: keyof ProjectNotificationPreferencesData, value: boolean) {
    mutation.mutate({ [key]: value } as Partial<ProjectNotificationPreferencesData>);
  }

  return (
    <Card title="Notification preferences" className="tip-card">
      {projectsQuery.isLoading ? (
        <div className="document-loading"><Spinner /><span>Loading your projects...</span></div>
      ) : projects.length === 0 ? (
        <p className="field-help">Join or create a project to manage its notification preferences.</p>
      ) : (
        <div className="form-stack">
          <Select
            label="Project"
            options={projects.map((project) => ({ value: project.id, label: `${project.key} · ${project.name}` }))}
            value={activeProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          />

          {preferencesQuery.isLoading ? (
            <div className="document-loading"><Spinner /><span>Loading notification preferences...</span></div>
          ) : preferencesQuery.data ? (
            <div className="form-stack">
              {notificationToggleOptions.map((option) => (
                <label className="sprint-activate-toggle" key={option.key}>
                  <input
                    type="checkbox"
                    checked={preferencesQuery.data[option.key]}
                    onChange={(event) => handleToggle(option.key, event.target.checked)}
                  />
                  <span className="sprint-activate-toggle-copy">
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="field-help">Could not load notification preferences.</p>
          )}
        </div>
      )}
    </Card>
  );
}
