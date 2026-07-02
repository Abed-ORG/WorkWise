import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BurndownChart, ContributionMetrics, CumulativeFlowChart, VelocityChart } from '../components/ProjectAnalyticsWidgets';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui';
import PageSkeleton from '../components/PageSkeleton';
import { getProjectActivityFeed } from '../services/activityService';
import { getProjectById, getProjectSprints } from '../services/projectService';
import { getProjectTasks } from '../services/taskService';
import { queryKeys, queryTimes } from '../services/queryOptions';
import {
  buildBurndownData,
  buildContributionMetrics,
  buildVelocityData,
  calculateAverageVelocity,
  buildCumulativeFlowData,
} from '../utils/projectAnalytics';

export default function ProjectAnalyticsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId ?? ''),
    queryFn: () => getProjectById(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.projectDetail,
  });
  const sprintsQuery = useQuery({
    queryKey: queryKeys.projectSprints(projectId ?? ''),
    queryFn: () => getProjectSprints(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.sprints,
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.projectTasks(projectId ?? ''),
    queryFn: () => getProjectTasks(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.tasks,
  });
  const activitiesQuery = useQuery({
    queryKey: queryKeys.projectActivity(projectId ?? ''),
    queryFn: () => getProjectActivityFeed(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.activity,
  });

  const project = projectQuery.data ?? null;
  const sprints = Array.isArray(sprintsQuery.data) ? sprintsQuery.data : [];
  const tasks = Array.isArray(tasksQuery.data) ? tasksQuery.data : [];
  const activities = Array.isArray(activitiesQuery.data) ? activitiesQuery.data : [];
  const loading = projectQuery.isLoading || sprintsQuery.isLoading || tasksQuery.isLoading || activitiesQuery.isLoading;

  useEffect(() => {
    if (projectQuery.isError || sprintsQuery.isError || tasksQuery.isError) navigate('/projects', { replace: true });
  }, [navigate, projectQuery.isError, sprintsQuery.isError, tasksQuery.isError]);

  useEffect(() => {
    if (selectedSprintId || sprints.length === 0) return;
    const activeSprint = sprints.find((sprint) => sprint.isActive) ?? sprints[0];
    setSelectedSprintId(activeSprint?.id ?? '');
  }, [selectedSprintId, sprints]);

  const selectedSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? sprints.find((sprint) => sprint.isActive) ?? sprints[0],
    [selectedSprintId, sprints]
  );

  const burndownPoints = useMemo(
    () => (selectedSprint ? buildBurndownData(selectedSprint, tasks) : []),
    [selectedSprint, tasks]
  );

  const velocityPoints = useMemo(() => buildVelocityData(sprints, tasks), [sprints, tasks]);
  const averageVelocity = useMemo(() => calculateAverageVelocity(velocityPoints), [velocityPoints]);
  const cumulativeFlowPoints = useMemo(() => buildCumulativeFlowData(tasks), [tasks]);

  const contributionMetrics = useMemo(
    () => buildContributionMetrics(project?.members ?? [], tasks, activities, {
      sprintId: selectedSprintId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [activities, endDate, project?.members, selectedSprintId, startDate, tasks]
  );

  if (loading) return <PageSkeleton variant="cards" />;
  if (!project || !projectId) return null;

  return (
    <>
      <PageHeader
        eyebrow={project.key}
        title="Project analytics"
        description="Burndown, sprint velocity, and contribution signals for this workspace."
        actions={<Button variant="secondary" onClick={() => navigate(`/projects/${projectId}/sprints`)}><Icon name="activity" size={16} /> Sprints</Button>}
      />

      <section className="app-card card-padding analytics-filter-card">
        <div className="section-heading">
          <div>
            <h2>Filters</h2>
            <p>Scope contribution metrics by sprint or by a date range.</p>
          </div>
        </div>
        <div className="analytics-filter-grid">
          <label className="field">
            <span className="field-label">Sprint</span>
            <select className="field-control" value={selectedSprintId} onChange={(event) => setSelectedSprintId(event.target.value)}>
              <option value="">All sprint activity</option>
              {sprints.map((sprint) => <option value={sprint.id} key={sprint.id}>{sprint.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">From</span>
            <input className="field-control" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">To</span>
            <input className="field-control" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="analytics-grid">
        <article className="app-card card-padding analytics-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Sprint burndown</p>
              <h2>{selectedSprint?.name ?? 'No sprint selected'}</h2>
              <p>Ideal pace against actual remaining work across sprint days.</p>
            </div>
          </div>
          {selectedSprint ? <BurndownChart points={burndownPoints} /> : <p className="field-help">Create a sprint to show burndown data.</p>}
        </article>

        <article className="app-card card-padding analytics-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Velocity</p>
              <h2>Completed sprint output</h2>
              <p>Completed tasks per finished sprint with the team average.</p>
            </div>
          </div>
          <VelocityChart points={velocityPoints} average={averageVelocity} />
        </article>
      </section>

      <section className="app-card card-padding analytics-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Team contribution</p>
            <h2>Workload distribution</h2>
            <p>Completed tasks, comments, and recorded PR merges per project member.</p>
          </div>
        </div>
        <ContributionMetrics metrics={contributionMetrics} />
      </section>
      <section className="app-card card-padding analytics-section">
        <div className="section-heading"><div><p className="section-kicker">Flow analytics</p><h2>Cumulative flow</h2><p>Backlog, active, and completed work across the last 14 days.</p></div></div>
        <CumulativeFlowChart points={cumulativeFlowPoints} />
      </section>
    </>
  );
}
