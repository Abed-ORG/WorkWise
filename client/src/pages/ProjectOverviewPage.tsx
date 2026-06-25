import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AITaskBreakdownModal from '../components/AITaskBreakdownModal';
import CreateTaskModal from '../components/CreateTaskModal';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import { ProjectHealthOverview } from '../components/ProjectAnalyticsWidgets';
import { Button, Spinner } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  generateDailyDigest,
  getProjectById,
  getProjectDigests,
} from '../services/projectService';
import type { DailyDigest, Project } from '../services/projectService';
import { joinProjectRoom, leaveProjectRoom } from '../services/realtimeService';
import { getProjectTasks } from '../services/taskService';
import type { Task } from '../services/taskService';
import { calculateProjectHealth } from '../utils/projectAnalytics';


function upsertTask(tasks: Task[], nextTask: Task) {
  const exists = tasks.some((task) => task.id === nextTask.id);
  if (exists) return tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
  return [nextTask, ...tasks];
}

function formatDigestDate(value: string) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getRequestMessage(error: unknown, fallback: string) {
  return axios.isAxiosError<{ message?: string }>(error)
    ? error.response?.data?.message || fallback
    : fallback;
}

export default function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [digests, setDigests] = useState<DailyDigest[]>([]);
  const [digestLoading, setDigestLoading] = useState(true);
  const [digestGenerating, setDigestGenerating] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([getProjectById(projectId), getProjectTasks(projectId)])
      .then(([projectData, taskData]) => { setProject(projectData); setTasks(taskData); })
      .catch(() => navigate('/projects', { replace: true }))
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

  useEffect(() => {
    if (!projectId) return;
    let active = true;

    setDigestLoading(true);
    setDigestError(null);
    getProjectDigests(projectId)
      .then((projectDigests) => {
        if (active) setDigests(Array.isArray(projectDigests) ? projectDigests : []);
      })
      .catch((error) => {
        if (active) {
          setDigests([]);
          setDigestError(getRequestMessage(error, 'Digest history could not be loaded.'));
        }
      })
      .finally(() => {
        if (active) setDigestLoading(false);
      });

    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return undefined;

    const activeSocket = joinProjectRoom(projectId);
    if (!activeSocket) return undefined;

    function handleTaskCreated(task: Task) {
      if (task.projectId === projectId) {
        setTasks((current) => upsertTask(current, task));
      }
    }

    function handleTaskUpdated(task: Task) {
      if (task.projectId === projectId) {
        setTasks((current) => upsertTask(current, task));
      }
    }

    function handleSprintStarted(sprint: NonNullable<Project['sprints']>[number]) {
      setProject((current) => {
        if (!current || current.id !== projectId) return current;
        return { ...current, sprints: [sprint, ...(current.sprints ?? []).filter((item) => item.id !== sprint.id)] };
      });
    }

    activeSocket.on('task:created', handleTaskCreated);
    activeSocket.on('task:updated', handleTaskUpdated);
    activeSocket.on('sprint:started', handleSprintStarted);

    return () => {
      activeSocket.off('task:created', handleTaskCreated);
      activeSocket.off('task:updated', handleTaskUpdated);
      activeSocket.off('sprint:started', handleSprintStarted);
      leaveProjectRoom(projectId);
    };
  }, [projectId]);

  if (loading) return <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Opening project...</p></div>;
  if (!project || !projectId) return null;

  const currentMember = project.members?.find((member) => member.user.id === user.id);
  const isAdmin = currentMember?.role === 'ADMIN';
  const openTaskCount = tasks.filter((task) => task.status !== 'DONE').length;
  const projectHealth = calculateProjectHealth(project, tasks);

  async function handleGenerateDigest() {
    if (!projectId) return;

    setDigestGenerating(true);
    setDigestError(null);
    try {
      const digest = await generateDailyDigest(projectId);
      setDigests((current) => [digest, ...current.filter((item) => item.id !== digest.id)]);
      toast.success('Daily digest generated.');
    } catch (error) {
      const message = getRequestMessage(error, 'Daily digest could not be generated.');
      setDigestError(message);
      toast.error(message);
    } finally {
      setDigestGenerating(false);
    }
  }

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate('/projects')}><Icon name="arrow-left" size={15} /> All projects</button>
      <PageHeader
        eyebrow={project.key}
        title={project.name}
        description={project.description || 'A shared workspace for planning, prioritizing, and delivering the next milestone.'}
        actions={<div className="page-actions">
          {isAdmin && <Button onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> Create task</Button>}
          {isAdmin && <Button variant="secondary" onClick={() => setBreakdownOpen(true)}><Icon name="sparkles" size={16} /> AI breakdown</Button>}
          <Button variant="secondary" onClick={() => navigate(`/projects/${project.id}/activity`)}><Icon name="activity" size={16} /> Activity feed</Button>
        </div>}
      />

      <section className="stats-grid animate-enter-delay">
        <article className="app-card stat-card"><div className="stat-head"><span>Open tasks</span><span className="stat-icon"><Icon name="tasks" size={18} /></span></div><p className="stat-value">{openTaskCount}</p><p className="stat-label">Ready to prioritize</p></article>
        <article className="app-card stat-card"><div className="stat-head"><span>Members</span><span className="stat-icon"><Icon name="team" size={18} /></span></div><p className="stat-value">{project.members?.length ?? 0}</p><p className="stat-label">Collaborating here</p></article>
        <article className="app-card stat-card"><div className="stat-head"><span>Active sprints</span><span className="stat-icon"><Icon name="activity" size={18} /></span></div><p className="stat-value">{project.sprints?.length ?? 0}</p><p className="stat-label">Current delivery cycles</p></article>
        <article className="app-card stat-card"><div className="stat-head"><span>Project key</span><span className="stat-icon"><Icon name="board" size={18} /></span></div><p className="stat-value text-xl">{project.key}</p><p className="stat-label">Task identifier prefix</p></article>
      </section>

      <ProjectHealthOverview health={projectHealth} />

      <section className="app-card card-padding animate-enter-delay digest-card">
        <div className="section-heading">
          <div>
            <h2>Daily digest</h2>
            <p>AI-generated project summary for today, saved with history.</p>
          </div>
          <Button onClick={handleGenerateDigest} loading={digestGenerating}>
            <Icon name="sparkles" size={16} /> Generate digest
          </Button>
        </div>

        {digestError && <p className="digest-alert">{digestError}</p>}

        {digestLoading ? (
          <div className="document-loading"><Spinner /><span>Loading digest history...</span></div>
        ) : digests.length > 0 ? (
          <div className="digest-layout">
            <article className="digest-latest">
              <div className="digest-meta">
                <span>Latest</span>
                <span>{formatDigestDate(digests[0].createdAt)}</span>
              </div>
              <h3>{digests[0].title}</h3>
              <div className="digest-summary">
                {digests[0].summary.split('\n').filter(Boolean).map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>
              <div className="digest-stats">
                <span>{digests[0].completedCount} completed</span>
                <span>{digests[0].inProgressCount} in progress</span>
                <span>{digests[0].blockerCount} blockers</span>
              </div>
            </article>
            <aside className="digest-history">
              <strong>History</strong>
              {digests.slice(0, 5).map((digest) => (
                <div className="digest-history-item" key={digest.id}>
                  <span>{formatDigestDate(digest.createdAt)}</span>
                  <small>{digest.completedCount} done / {digest.blockerCount} blockers</small>
                </div>
              ))}
            </aside>
          </div>
        ) : (
          <div className="document-empty-state digest-empty">
            <span className="empty-icon"><Icon name="sparkles" size={24} /></span>
            <h3>No digest yet</h3>
            <p>Generate one after task movement or project activity to create the first daily summary.</p>
            <Button onClick={handleGenerateDigest} loading={digestGenerating}>
              <Icon name="sparkles" size={16} /> Generate today&apos;s digest
            </Button>
          </div>
        )}
      </section>

      <section className="app-card card-padding animate-enter-delay project-team-card">
        <div className="section-heading"><div><h2>Project team</h2><p>People who can collaborate in this workspace.</p></div></div>
        <div className="focus-list">{project.members?.map((member) => <div className="focus-item" key={member.id}><span className="avatar">{member.user.name.slice(0, 2).toUpperCase()}</span><span className="focus-copy"><strong>{member.user.name}</strong><span>{member.role.toLowerCase()}</span></span></div>)}</div>
      </section>

      <CreateTaskModal isOpen={createOpen} projectId={projectId} members={project.members ?? []} onClose={() => setCreateOpen(false)} onCreated={(task) => { setTasks((current) => upsertTask(current, task)); toast.success('Task created successfully.'); }} />
      <AITaskBreakdownModal isOpen={breakdownOpen} projectId={projectId} onClose={() => setBreakdownOpen(false)} onTasksCreated={(created) => setTasks((current) => [...created, ...current])} />
    </>
  );
}