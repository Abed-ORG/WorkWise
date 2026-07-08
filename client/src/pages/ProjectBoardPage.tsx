import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
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
import { createTask, getProjectTasksPage, updateTask } from '../services/taskService';
import type { Task } from '../services/taskService';
import { queryKeys, queryTimes } from '../services/queryOptions';

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
  const sprintsQuery = useQuery({
    queryKey: queryKeys.projectSprints(projectId ?? ''),
    queryFn: () => getProjectSprints(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.sprints,
  });
  const sprints = Array.isArray(sprintsQuery.data) ? sprintsQuery.data : [];
  const activeSprint = sprints.find((sprint) => sprint.isActive) ?? null;
  const tasksQuery = useInfiniteQuery({
    queryKey: queryKeys.projectTasksPage(projectId ?? '', activeSprint?.id ? `board:${activeSprint.id}` : 'board:none'),
    queryFn: ({ pageParam }) => getProjectTasksPage(projectId!, { cursor: pageParam, limit: 100, sprintId: activeSprint?.id ?? '__none__' }),
    enabled: Boolean(projectId && activeSprint?.id),
    staleTime: queryTimes.tasks,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined,
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
        // Subtasks never appear as top-level board cards — only merge them into the
        // per-task cache (e.g. for an open TaskDetailModal), not the board list.
        if (!task.parentId) queryClient.invalidateQueries({ queryKey: queryKeys.projectTasksPage(projectId, activeSprint?.id ? `board:${activeSprint.id}` : 'board:none') });
        queryClient.setQueryData(queryKeys.task(task.id), task);
      }
    }

    function handleTaskUpdated(task: Task) {
      if (task.projectId === projectId) {
        if (!task.parentId) queryClient.invalidateQueries({ queryKey: queryKeys.projectTasksPage(projectId, activeSprint?.id ? `board:${activeSprint.id}` : 'board:none') });
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
  }, [activeSprint?.id, projectId, queryClient]);

  const project = projectQuery.data ?? null;
  const tasks = tasksQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const totalTaskCount = tasksQuery.data?.pages[0]?.totalCount ?? 0;
  const loading = projectQuery.isLoading || tasksQuery.isLoading || sprintsQuery.isLoading;
  const setTasks = (nextTasks: Task[]) => {
    if (!projectId) return;
    queryClient.setQueryData(queryKeys.projectTasksPage(projectId, activeSprint?.id ? `board:${activeSprint.id}` : 'board:none'), (current: any) => current ? {
      ...current,
      pages: current.pages.map((page: any) => ({ ...page, items: page.items.map((task: Task) => nextTasks.find((item) => item.id === task.id) ?? task) })),
    } : current);
  };

  if (loading) return <PageSkeleton variant="board" />;
  if (!project || !projectId) return null;
  const activeProjectId = projectId;
  const boardTasksQueryKey = queryKeys.projectTasksPage(activeProjectId, activeSprint?.id ? `board:${activeSprint.id}` : 'board:none');

  const currentMember = project.members?.find((member) => member.user.id === user.id);
  const isAdmin = currentMember?.role === 'ADMIN';

  async function handleBulkUpdate(taskIds: string[], changes: Parameters<typeof updateTask>[1]) {
    const previous = tasks;
    setTasks(tasks.map((task) => taskIds.includes(task.id) ? { ...task, ...changes } as Task : task));
    try { const updated = await Promise.all(taskIds.map((id) => updateTask(id, changes))); setTasks(tasks.map((task) => updated.find((item) => item.id === task.id) ?? task)); await queryClient.invalidateQueries({ queryKey: boardTasksQueryKey }); toast.success(`${updated.length} board tasks updated.`); }
    catch { setTasks(previous); toast.error('Board changes could not be saved.'); }
  }

  async function handleBoardQuickAdd(input: { title: string; statusId: string; sprintId: string }) {
    if (!projectId) throw new Error('Project not found');
    try {
      const task = await createTask({
        projectId,
        title: input.title,
        statusId: input.statusId,
        sprintId: input.sprintId,
      });
      if (!task.parentId) await queryClient.invalidateQueries({ queryKey: queryKeys.projectTasksPage(projectId, activeSprint?.id ? `board:${activeSprint.id}` : 'board:none') });
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
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: project.name, to: `/projects/${projectId}` },
          { label: 'Board' },
        ]}
      />


      <section className="animate-enter-delay">
        <KanbanBoard
          tasks={tasks}
          projectId={projectId}
          onTasksChange={setTasks}
          onTaskClick={(task) => setSelectedTaskId(task.id)}
          eyebrow={project.key}
          title={activeSprint?.name ?? 'No active sprint'}
          description={activeSprint ? `Move work through ${activeSprint.name} and keep delivery visible.` : 'Start a sprint to display its tasks on the board.'}
          headerAction={isAdmin && activeSprint ? <Button onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> Create task</Button> : undefined}
          assignees={(project.members ?? []).map((member) => ({
            id: member.user.id,
            name: member.user.name,
            avatarUrl: member.user.avatarUrl,
          }))}
          onBulkUpdate={handleBulkUpdate}
          activeSprintId={activeSprint?.id ?? null}
          onCreateTask={activeSprint ? handleBoardQuickAdd : undefined}
        />
        {activeSprint && tasks.length > 0 && (
          <div className="backlog-footer">
            <span>Showing {tasks.length} of {totalTaskCount} board task{totalTaskCount === 1 ? '' : 's'}</span>
            {tasksQuery.hasNextPage && <Button variant="secondary" loading={tasksQuery.isFetchingNextPage} onClick={() => tasksQuery.fetchNextPage()}>Load more board tasks</Button>}
          </div>
        )}
      </section>
      <CreateTaskModal isOpen={createOpen} projectId={projectId} sprintId={activeSprint?.id} members={project.members ?? []} onClose={() => setCreateOpen(false)} onCreated={(task) => {
        if (!task.parentId) queryClient.invalidateQueries({ queryKey: queryKeys.projectTasksPage(projectId, activeSprint?.id ? `board:${activeSprint.id}` : 'board:none') });
        queryClient.setQueryData(queryKeys.task(task.id), task);
        toast.success('Task created successfully.');
      }} />
      <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onTaskUpdated={(task) => {
        // TaskDetailModal can drill into a subtask (parentId set) via its internal breadcrumb
        // navigation — editing that subtask must never leak it into the board's task list.
        if (!task.parentId) queryClient.invalidateQueries({ queryKey: queryKeys.projectTasksPage(projectId, activeSprint?.id ? `board:${activeSprint.id}` : 'board:none') });
        queryClient.setQueryData(queryKeys.task(task.id), task);
      }} />
    </>
  );
}
