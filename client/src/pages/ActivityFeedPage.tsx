import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Breadcrumbs from '../components/Breadcrumbs';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import { Button, Spinner } from '../components/ui';
import { getProjectById } from '../services/projectService';
import { getProjectActivityFeed } from '../services/activityService';
import type { ProjectActivity } from '../services/activityService';
import { queryKeys, queryTimes } from '../services/queryOptions';

const actionLabels: Record<string, string> = {
  TASK_CREATED: 'created a task',
  TASK_MOVED: 'moved a task',
  TASK_UPDATED: 'updated a task',
  COMMENT_ADDED: 'commented on a task',
  SPRINT_STARTED: 'started a sprint',
  SPRINT_COMPLETED: 'completed a sprint',
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function ActivityFeedPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loadingMore, setLoadingMore] = useState(false);

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId ?? ''),
    queryFn: () => getProjectById(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.projectDetail,
  });
  const activitiesQuery = useQuery({
    queryKey: queryKeys.projectActivity(projectId ?? ''),
    queryFn: () => getProjectActivityFeed(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.activity,
  });

  useEffect(() => {
    if (projectQuery.isError || activitiesQuery.isError) navigate('/projects', { replace: true });
  }, [activitiesQuery.isError, navigate, projectQuery.isError]);

  const project = projectQuery.data ?? null;
  const activities = Array.isArray(activitiesQuery.data) ? activitiesQuery.data : [];
  const loading = projectQuery.isLoading || activitiesQuery.isLoading;

  async function handleLoadMore() {
    if (!projectId || !activities.length) return;
    setLoadingMore(true);
    const nextActivities = await getProjectActivityFeed(projectId, activities[activities.length - 1].id).catch(() => []);
    queryClient.setQueryData<ProjectActivity[]>(queryKeys.projectActivity(projectId), (current = []) => [...current, ...nextActivities]);
    setLoadingMore(false);
  }

  if (loading) return <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Loading activity...</p></div>;
  if (!project || !projectId) return null;

  return (
    <>
      <Breadcrumbs items={[
        { label: 'Projects', to: '/projects' },
        { label: project.name, to: `/projects/${projectId}` },
        { label: 'Activity' },
      ]} />
      <PageHeader
        eyebrow={project.key}
        title="Activity feed"
        description="A chronological record of tasks, comments, and sprint updates for this project."
      />

      <section className="app-card card-padding activity-feed-card animate-enter-delay">
        {activities.length ? (
          <div className="activity-feed">
            {activities.map((activity) => (
              <article className="activity-entry" key={activity.id}>
                <span className="activity-marker"><Icon name="activity" size={15} /></span>
                <div>
                  <p>
                    <strong>{activity.user.name}</strong> {actionLabels[activity.action] ?? activity.action.toLowerCase()}:
                    {' '}<span>{activity.target}</span>
                  </p>
                  {activity.details && <small>{activity.details}</small>}
                  <time>{formatTime(activity.createdAt)}</time>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-panel compact">
            <span className="empty-icon"><Icon name="activity" size={24} /></span>
            <h3>No activity yet</h3>
            <p>Create or move a task and the project story will start here.</p>
          </div>
        )}

        {activities.length >= 20 && (
          <div className="activity-actions">
            <Button variant="secondary" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load older activity'}
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
