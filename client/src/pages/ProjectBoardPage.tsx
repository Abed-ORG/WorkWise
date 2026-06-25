import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CreateTaskModal from '../components/CreateTaskModal';
import Icon from '../components/Icon';
import KanbanBoard from '../components/KanbanBoard';
import PageHeader from '../components/PageHeader';
import TaskDetailModal from '../components/TaskDetailModal';
import { Button, Spinner } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getProjectById } from '../services/projectService';
import type { Project } from '../services/projectService';
import { joinProjectRoom, leaveProjectRoom } from '../services/realtimeService';
import { getProjectTasks } from '../services/taskService';
import type { Task } from '../services/taskService';

function upsertTask(tasks: Task[], nextTask: Task) {
  const exists = tasks.some((task) => task.id === nextTask.id);
  if (exists) return tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
  return [nextTask, ...tasks];
}

export default function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    Promise.all([getProjectById(projectId), getProjectTasks(projectId)])
      .then(([projectData, taskData]) => {
        setProject(projectData);
        setTasks(Array.isArray(taskData) ? taskData : []);
      })
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

    activeSocket.on('task:created', handleTaskCreated);
    activeSocket.on('task:updated', handleTaskUpdated);

    return () => {
      activeSocket.off('task:created', handleTaskCreated);
      activeSocket.off('task:updated', handleTaskUpdated);
      leaveProjectRoom(projectId);
    };
  }, [projectId]);

  if (loading) return <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Opening board...</p></div>;
  if (!project || !projectId) return null;

  const currentMember = project.members?.find((member) => member.user.id === user.id);
  const isAdmin = currentMember?.role === 'ADMIN';

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(`/projects/${projectId}`)}><Icon name="arrow-left" size={15} /> Back to project</button>
      <PageHeader
        eyebrow={project.key}
        title="Project board"
        description="Move work across the board and keep delivery visible."
        actions={<div className="page-actions">
          {isAdmin && <Button onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> Create task</Button>}
          <Button variant="secondary" onClick={() => navigate(`/projects/${projectId}/backlog`)}><Icon name="tasks" size={16} /> Backlog</Button>
          <Button variant="secondary" onClick={() => navigate(`/projects/${projectId}/docs`)}><Icon name="document" size={16} /> Docs</Button>
        </div>}
      />

      <section className="animate-enter-delay">
        <KanbanBoard tasks={tasks} onTasksChange={setTasks} onTaskClick={(task) => setSelectedTaskId(task.id)} />
      </section>

      <CreateTaskModal isOpen={createOpen} projectId={projectId} members={project.members ?? []} onClose={() => setCreateOpen(false)} onCreated={(task) => { setTasks((current) => upsertTask(current, task)); toast.success('Task created successfully.'); }} />
      <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onTaskUpdated={(task) => setTasks((current) => upsertTask(current, task))} />
    </>
  );
}
