import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import BacklogList from '../components/BacklogList';
import Breadcrumbs from '../components/Breadcrumbs';
import type { BacklogMoveTarget } from '../components/BacklogList';
import CreateTaskModal from '../components/CreateTaskModal';
import Icon from '../components/Icon';
import TaskDetailModal from '../components/TaskDetailModal';
import { Button } from '../components/ui';
import PageSkeleton from '../components/PageSkeleton';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getProjectById, getProjectSprints } from '../services/projectService';
import { joinProjectRoom, leaveProjectRoom } from '../services/realtimeService';
import { createTask, deleteTask, getProjectTasks, moveTaskToSprint, reorderTask, updateTask } from '../services/taskService';
import type { Task } from '../services/taskService';
import { queryKeys, queryTimes } from '../services/queryOptions';

function upsertTask(tasks: Task[], nextTask: Task) {
  const exists = tasks.some((task) => task.id === nextTask.id);
  if (exists) return tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
  return [nextTask, ...tasks];
}

export default function ProjectBacklogPage() {
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
        // Subtasks never appear as top-level backlog rows — only merge them into the
        // per-task cache (e.g. for an open TaskDetailModal), not the backlog list.
        if (!task.parentId) queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => upsertTask(current, task));
        queryClient.setQueryData(queryKeys.task(task.id), task);
      }
    }

    function handleTaskUpdated(task: Task) {
      if (task.projectId === projectId) {
        if (!task.parentId) queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => upsertTask(current, task));
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

  if (loading) return <PageSkeleton variant="table" />;
  if (!project || !projectId) return null;

  const currentMember = project.members?.find((member) => member.user.id === user.id);
  const isAdmin = currentMember?.role === 'ADMIN';

  async function handleDeleteSelected(taskIds: string[]) {
    if (!projectId) return;
    const previousTasks = tasks;
    queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => current.filter((task) => !taskIds.includes(task.id)));
    try {
      await Promise.all(taskIds.map(deleteTask));
      toast.success(`${taskIds.length} task${taskIds.length === 1 ? '' : 's'} deleted.`);
    } catch {
      queryClient.setQueryData(queryKeys.projectTasks(projectId), previousTasks);
      toast.error('One or more tasks could not be deleted.');
    }
  }

  async function handleMoveTasks(taskIds: string[], target: BacklogMoveTarget) {
    if (!projectId || taskIds.length === 0) return;

    const previousTasks = tasks;
    const sprint = target.type === 'sprint' ? sprints.find((item) => item.id === target.sprintId) : null;

    queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => current.map((task) => {
      if (!taskIds.includes(task.id)) return task;
      if (target.type === 'backlog') return { ...task, sprintId: null, sprint: null };
      // Status is left as-is — the server auto-promotes a backlog-default status to the sprint
      // default when a task enters a sprint; the response below applies the authoritative result.
      return {
        ...task,
        sprintId: target.sprintId,
        sprint: sprint ? { id: sprint.id, name: sprint.name } : task.sprint,
      };
    }));

    try {
      const updatedTasks = await Promise.all(taskIds.map(async (taskId) => {
        if (target.type === 'backlog') return moveTaskToSprint(taskId, null);
        return moveTaskToSprint(taskId, target.sprintId);
      }));

      queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => current.map((task) => updatedTasks.find((updated) => updated.id === task.id) ?? task));
      updatedTasks.forEach((task) => queryClient.setQueryData(queryKeys.task(task.id), task));

      const destination = target.type === 'backlog'
        ? 'the product backlog'
        : sprint?.name ?? 'the selected sprint';
      toast.success(`${updatedTasks.length} task${updatedTasks.length === 1 ? '' : 's'} moved to ${destination}.`);
    } catch {
      queryClient.setQueryData(queryKeys.projectTasks(projectId), previousTasks);
      toast.error('One or more tasks could not be moved.');
      throw new Error('Move failed');
    }
  }

  async function handleQuickAddTask(title: string) {
    if (!projectId) return;
    try {
      const task = await createTask({ projectId, title });
      queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => upsertTask(current, task));
      queryClient.setQueryData(queryKeys.task(task.id), task);
      toast.success('Task added to the product backlog.');
    } catch {
      toast.error('Task could not be created.');
      throw new Error('Create failed');
    }
  }

  async function handleTaskUpdate(task: Task, changes: Parameters<typeof updateTask>[1]) {
    const previous = tasks;
    queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId!), (current = []) => current.map((item) => item.id === task.id ? { ...item, ...changes } as Task : item));
    try {
      const updated = await updateTask(task.id, changes);
      queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId!), (current = []) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success('Task updated.');
    } catch { queryClient.setQueryData(queryKeys.projectTasks(projectId!), previous); toast.error('Task update could not be saved.'); }
  }

  async function handleBulkUpdate(taskIds: string[], changes: Parameters<typeof updateTask>[1]) {
    const previous = tasks;
    queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId!), (current = []) => current.map((task) => taskIds.includes(task.id) ? { ...task, ...changes } as Task : task));
    try { const updated = await Promise.all(taskIds.map((id) => updateTask(id, changes))); queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId!), (current = []) => current.map((task) => updated.find((item) => item.id === task.id) ?? task)); toast.success(`${updated.length} tasks updated.`); }
    catch { queryClient.setQueryData(queryKeys.projectTasks(projectId!), previous); toast.error('Bulk update could not be saved.'); }
  }

  async function handleReorder(taskId: string, order: number) {
    try { const updated = await reorderTask(taskId, order); queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId!), (current = []) => current.map((task) => task.id === updated.id ? updated : task)); toast.success('Backlog priority updated.'); }
    catch { toast.error('Task order could not be saved.'); }
  }

  return (
    <>
      <Breadcrumbs items={[
        { label: 'Projects', to: '/projects' },
        { label: project.name, to: `/projects/${projectId}` },
        { label: 'Backlog' },
      ]} />
      <BacklogList
        tasks={tasks}
        eyebrow={project.key}
        title="Project backlog"
        description="Create, sort, and prioritize every task in this project."
        headerAction={isAdmin ? <Button onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> Create task</Button> : undefined}
        assignees={(project.members ?? []).map((member) => ({
          id: member.user.id,
          name: member.user.name,
          avatarUrl: member.user.avatarUrl,
        }))}
        canDelete={isAdmin}
        onDeleteSelected={handleDeleteSelected}
        onMoveTasks={handleMoveTasks}
        onQuickAddTask={handleQuickAddTask}
        onTaskUpdate={handleTaskUpdate}
        onBulkUpdate={handleBulkUpdate}
        onReorder={handleReorder}
        onTaskClick={(task) => setSelectedTaskId(task.id)}
        projectId={projectId}
        sprints={sprints}
        activeSprint={activeSprint}
      />

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
