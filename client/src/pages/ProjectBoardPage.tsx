import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import CreateTaskModal from '../components/CreateTaskModal';
import Icon from '../components/Icon';
import KanbanBoard from '../components/KanbanBoard';
import TaskDetailModal from '../components/TaskDetailModal';
import { Button } from '../components/ui';
import PageSkeleton from '../components/PageSkeleton';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getProjectById, getProjectSprints } from '../services/projectService';
import { joinProjectRoom, leaveProjectRoom } from '../services/realtimeService';
import { createTask, getProjectTasks, updateTask } from '../services/taskService';
import type { Task } from '../services/taskService';
import { queryKeys, queryTimes } from '../services/queryOptions';

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
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId ?? ''),
    queryFn: () => getProjectById(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.projectDetail,
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.projectTasks(projectId ?? ''),
    queryFn: () => getProjectTasks(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.tasks,
  });
  const sprintsQuery = useQuery({
    queryKey: queryKeys.projectSprints(projectId ?? ''),
    queryFn: () => getProjectSprints(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.sprints,
  });

  useEffect(() => {
    if (projectQuery.isError || tasksQuery.isError || sprintsQuery.isError) navigate('/projects', { replace: true });
  }, [navigate, projectQuery.isError, sprintsQuery.isError, tasksQuery.isError]);

  useEffect(() => {
    if (!projectId) return undefined;

    const activeSocket = joinProjectRoom(projectId);
    if (!activeSocket) return undefined;

    function handleTaskCreated(task: Task) {
      if (task.projectId === projectId) {
        queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => upsertTask(current, task));
        queryClient.setQueryData(queryKeys.task(task.id), task);
      }
    }

    function handleTaskUpdated(task: Task) {
      if (task.projectId === projectId) {
        queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => upsertTask(current, task));
        queryClient.setQueryData(queryKeys.task(task.id), task);
      }
    }

    activeSocket.on('task:created', handleTaskCreated);
    activeSocket.on('task:updated', handleTaskUpdated);

    return () => {
      activeSocket.off('task:created', handleTaskCreated);
      activeSocket.off('task:updated', handleTaskUpdated);
      leaveProjectRoom(projectId);
    };
  }, [projectId, queryClient]);

  const project = projectQuery.data ?? null;
  const tasks = Array.isArray(tasksQuery.data) ? tasksQuery.data : [];
  const sprints = Array.isArray(sprintsQuery.data) ? sprintsQuery.data : [];
  const activeSprint = sprints.find((sprint) => sprint.isActive) ?? null;
  const loading = projectQuery.isLoading || tasksQuery.isLoading || sprintsQuery.isLoading;
  const setTasks = (nextTasks: Task[]) => {
    if (!projectId) return;
    queryClient.setQueryData(queryKeys.projectTasks(projectId), nextTasks);
  };

  if (loading) return <PageSkeleton variant="board" />;
  if (!project || !projectId) return null;

  const currentMember = project.members?.find((member) => member.user.id === user.id);
  const isAdmin = currentMember?.role === 'ADMIN';

  async function handleBulkUpdate(taskIds: string[], changes: Parameters<typeof updateTask>[1]) {
    const previous = tasks;
    setTasks(tasks.map((task) => taskIds.includes(task.id) ? { ...task, ...changes } as Task : task));
    try { const updated = await Promise.all(taskIds.map((id) => updateTask(id, changes))); setTasks(tasks.map((task) => updated.find((item) => item.id === task.id) ?? task)); toast.success(`${updated.length} board tasks updated.`); }
    catch { setTasks(previous); toast.error('Board changes could not be saved.'); }
  }

  async function handleBoardQuickAdd(input: { title: string; status: Task['status']; sprintId: string }) {
    if (!projectId) throw new Error('Project not found');
    try {
      const task = await createTask({
        projectId,
        title: input.title,
        status: input.status,
        sprintId: input.sprintId,
      });
      queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => upsertTask(current, task));
      queryClient.setQueryData(queryKeys.task(task.id), task);
      toast.success('Task added to the board.');
      return task;
    } catch {
      toast.error('Task could not be created.');
      throw new Error('Create failed');
    }
  }

  return (
    <>
      <section className="animate-enter-delay">
        <KanbanBoard
          tasks={tasks}
          onTasksChange={setTasks}
          onTaskClick={(task) => setSelectedTaskId(task.id)}
          eyebrow={project.key}
          title="Project board"
          description="Move work across the board and keep delivery visible."
          headerAction={isAdmin ? <Button onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> Create task</Button> : undefined}
          assignees={(project.members ?? []).map((member) => ({
            id: member.user.id,
            name: member.user.name,
            avatarUrl: member.user.avatarUrl,
          }))}
          onBulkUpdate={handleBulkUpdate}
          activeSprintId={activeSprint?.id ?? null}
          onCreateTask={activeSprint ? handleBoardQuickAdd : undefined}
        />
      </section>
      <CreateTaskModal isOpen={createOpen} projectId={projectId} members={project.members ?? []} onClose={() => setCreateOpen(false)} onCreated={(task) => {
        queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => upsertTask(current, task));
        queryClient.setQueryData(queryKeys.task(task.id), task);
        toast.success('Task created successfully.');
      }} />
      <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onTaskUpdated={(task) => {
        queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => upsertTask(current, task));
        queryClient.setQueryData(queryKeys.task(task.id), task);
      }} />
    </>
  );
}
