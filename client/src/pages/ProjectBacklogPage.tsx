import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import BacklogList from '../components/BacklogList';
import CreateTaskModal from '../components/CreateTaskModal';
import Icon from '../components/Icon';
import TaskDetailModal from '../components/TaskDetailModal';
import { Button } from '../components/ui';
import PageSkeleton from '../components/PageSkeleton';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getProjectById } from '../services/projectService';
import { joinProjectRoom, leaveProjectRoom } from '../services/realtimeService';
import { deleteTask, getProjectTasks, reorderTask, updateTask } from '../services/taskService';
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

  useEffect(() => {
    if (projectQuery.isError || tasksQuery.isError) navigate('/projects', { replace: true });
  }, [navigate, projectQuery.isError, tasksQuery.isError]);

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
  const loading = projectQuery.isLoading || tasksQuery.isLoading;

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

  async function handleMoveSelectedToBoard(taskIds: string[]) {
    if (!projectId) return;
    const previousTasks = tasks;
    const selectedBacklogIds = new Set(taskIds.filter((taskId) => tasks.some((task) => task.id === taskId && task.status === 'BACKLOG')));

    if (selectedBacklogIds.size === 0) {
      toast.error('Only backlog tasks can be moved to the board.');
      return;
    }

    queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => current.map((task) => (
      selectedBacklogIds.has(task.id) ? { ...task, status: 'TODO' } : task
    )));

    try {
      const updatedTasks = await Promise.all(Array.from(selectedBacklogIds).map((taskId) => updateTask(taskId, { status: 'TODO' })));
      queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => current.map((task) => updatedTasks.find((updated) => updated.id === task.id) ?? task));
      updatedTasks.forEach((task) => queryClient.setQueryData(queryKeys.task(task.id), task));
      toast.success(`${updatedTasks.length} task${updatedTasks.length === 1 ? '' : 's'} moved to To do.`);
    } catch {
      queryClient.setQueryData(queryKeys.projectTasks(projectId), previousTasks);
      toast.error('One or more tasks could not be moved to the board.');
      throw new Error('Move to board failed');
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
      <button type="button" className="back-link" onClick={() => navigate(`/projects/${projectId}`)}><Icon name="arrow-left" size={15} /> Back to project</button>
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
        onMoveSelectedToBoard={handleMoveSelectedToBoard}
        onTaskUpdate={handleTaskUpdate}
        onBulkUpdate={handleBulkUpdate}
        onReorder={handleReorder}
        onTaskClick={(task) => setSelectedTaskId(task.id)}
        projectId={projectId}
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
