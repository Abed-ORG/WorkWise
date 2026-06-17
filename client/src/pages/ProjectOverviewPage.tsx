import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BacklogList from '../components/BacklogList';
import CreateTaskModal from '../components/CreateTaskModal';
import Icon from '../components/Icon';
import KanbanBoard from '../components/KanbanBoard';
import PageHeader from '../components/PageHeader';
import { Button, Spinner } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getProjectById } from '../services/projectService';
import type { Project } from '../services/projectService';
import { joinProjectRoom, leaveProjectRoom } from '../services/realtimeService';
import { deleteTask, getProjectTasks } from '../services/taskService';
import type { Task } from '../services/taskService';

function upsertTask(tasks: Task[], nextTask: Task) {
  const exists = tasks.some((task) => task.id === nextTask.id);
  if (exists) return tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
  return [nextTask, ...tasks];
}

export default function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([getProjectById(projectId), getProjectTasks(projectId)])
      .then(([projectData, taskData]) => { setProject(projectData); setTasks(taskData); })
      .catch(() => navigate('/projects', { replace: true }))
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

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

  async function handleDeleteSelected(taskIds: string[]) {
    try {
      await Promise.all(taskIds.map(deleteTask));
      setTasks((current) => current.filter((task) => !taskIds.includes(task.id)));
      toast.success(`${taskIds.length} task${taskIds.length === 1 ? '' : 's'} deleted.`);
    } catch {
      toast.error('One or more tasks could not be deleted.');
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
          <Button variant="secondary" onClick={() => navigate(`/projects/${project.id}/activity`)}><Icon name="activity" size={16} /> Activity feed</Button>
          {isAdmin && <Button variant="secondary" onClick={() => navigate(`/projects/${project.id}/settings`)}><Icon name="settings" size={16} /> Project settings</Button>}
        </div>}
      />

      <section className="stats-grid animate-enter-delay">
        <article className="app-card stat-card"><div className="stat-head"><span>Open tasks</span><span className="stat-icon"><Icon name="tasks" size={18} /></span></div><p className="stat-value">{openTaskCount}</p><p className="stat-label">Ready to prioritize</p></article>
        <article className="app-card stat-card"><div className="stat-head"><span>Members</span><span className="stat-icon"><Icon name="team" size={18} /></span></div><p className="stat-value">{project.members?.length ?? 0}</p><p className="stat-label">Collaborating here</p></article>
        <article className="app-card stat-card"><div className="stat-head"><span>Active sprints</span><span className="stat-icon"><Icon name="activity" size={18} /></span></div><p className="stat-value">{project.sprints?.length ?? 0}</p><p className="stat-label">Current delivery cycles</p></article>
        <article className="app-card stat-card"><div className="stat-head"><span>Project key</span><span className="stat-icon"><Icon name="board" size={18} /></span></div><p className="stat-value text-xl">{project.key}</p><p className="stat-label">Task identifier prefix</p></article>
      </section>

      <section className="animate-enter-delay"><KanbanBoard tasks={tasks} onTasksChange={setTasks} /></section>
      <BacklogList tasks={tasks} title="Project backlog" description="All tasks belonging to this project." canDelete={isAdmin} onDeleteSelected={handleDeleteSelected} />

      <section className="app-card card-padding animate-enter-delay project-team-card">
        <div className="section-heading"><div><h2>Project team</h2><p>People who can collaborate in this workspace.</p></div></div>
        <div className="focus-list">{project.members?.map((member) => <div className="focus-item" key={member.id}><span className="avatar">{member.user.name.slice(0, 2).toUpperCase()}</span><span className="focus-copy"><strong>{member.user.name}</strong><span>{member.role.toLowerCase()}</span></span></div>)}</div>
      </section>

      <CreateTaskModal isOpen={createOpen} projectId={projectId} members={project.members ?? []} onClose={() => setCreateOpen(false)} onCreated={(task) => { setTasks((current) => [task, ...current]); toast.success('Task created successfully.'); }} />
    </>
  );
}
