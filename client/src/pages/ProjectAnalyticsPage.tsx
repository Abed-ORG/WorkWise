import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BurndownChart, ContributionMetrics, VelocityChart } from '../components/ProjectAnalyticsWidgets';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import { Button, Spinner } from '../components/ui';
import { getProjectActivityFeed } from '../services/activityService';
import type { ProjectActivity } from '../services/activityService';
import { getProjectById, getProjectSprints } from '../services/projectService';
import type { Project, Sprint } from '../services/projectService';
import { getProjectTasks } from '../services/taskService';
import type { Task } from '../services/taskService';
import {
  buildBurndownData,
  buildContributionMetrics,
  buildVelocityData,
  calculateAverageVelocity,
} from '../utils/projectAnalytics';

export default function ProjectAnalyticsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    Promise.all([
      getProjectById(projectId),
      getProjectSprints(projectId),
      getProjectTasks(projectId),
      getProjectActivityFeed(projectId).catch(() => []),
    ])
      .then(([projectData, sprintData, taskData, activityData]) => {
        setProject(projectData);
        setSprints(sprintData);
        setTasks(taskData);
        setActivities(activityData);
        const activeSprint = sprintData.find((sprint) => sprint.isActive) ?? sprintData[0];
        setSelectedSprintId(activeSprint?.id ?? '');
      })
      .catch(() => navigate('/projects', { replace: true }))
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

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

  const contributionMetrics = useMemo(
    () => buildContributionMetrics(project?.members ?? [], tasks, activities, {
      sprintId: selectedSprintId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [activities, endDate, project?.members, selectedSprintId, startDate, tasks]
  );

  if (loading) return <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Loading analytics...</p></div>;
  if (!project || !projectId) return null;

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(`/projects/${projectId}`)}>
        <Icon name="arrow-left" size={15} /> Back to project
      </button>

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
    </>
  );
}
