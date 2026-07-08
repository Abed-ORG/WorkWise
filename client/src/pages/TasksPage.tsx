import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import BacklogList from '../components/BacklogList';
import PageHeader from '../components/PageHeader';
import TaskDetailModal from '../components/TaskDetailModal';
import Icon from '../components/Icon';
import { Button, Select } from '../components/ui';
import { getAssignedTasksPage, getProjectStatuses, updateTask } from '../services/taskService';
import type { Task } from '../services/taskService';
import { queryKeys, queryTimes } from '../services/queryOptions';
import { useToast } from '../hooks/useToast';
import { isDone } from '../utils/taskStatus';

export default function TasksPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'today' | 'overdue' | 'completed'>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'project' | 'priority' | 'dueDate'>('none');
  const tasksQuery = useInfiniteQuery({
    queryKey: queryKeys.assignedTasksPage(filter),
    queryFn: ({ pageParam }) => getAssignedTasksPage({ cursor: pageParam, limit: 50, filter }),
    staleTime: queryTimes.tasks,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined,
  });
  const tasks = useMemo(() => tasksQuery.data?.pages.flatMap((page) => page.items) ?? [], [tasksQuery.data]);
  const totalCount = tasksQuery.data?.pages[0]?.totalCount ?? 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const filteredTasks = tasks;

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ label: '', tasks: filteredTasks }];
    const map = new Map<string, Task[]>();
    filteredTasks.forEach((task) => {
      const key = groupBy === 'project' ? task.project?.name ?? 'Unknown project'
        : groupBy === 'priority' ? task.priority
          : task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date';
      map.set(key, [...(map.get(key) ?? []), task]);
    });
    return Array.from(map, ([label, groupedTasks]) => ({ label, tasks: groupedTasks }));
  }, [filteredTasks, groupBy]);

  async function quickUpdate(task: Task, payload: Parameters<typeof updateTask>[1]) {
    try { const updated = await updateTask(task.id, payload); queryClient.setQueriesData<{ pages: { items: Task[] }[] }>({ queryKey: ['tasks', 'assigned'] }, (current) => current ? { ...current, pages: current.pages.map((page) => ({ ...page, items: page.items.map((item) => item.id === updated.id ? updated : item) })) } : current); toast.success('Task updated.'); }
    catch { toast.error('Task update could not be saved.'); }
  }

  async function toggleTaskDone(task: Task) {
    const statuses = await getProjectStatuses(task.projectId);
    const targetStatus = isDone(task)
      ? statuses.find((status) => status.isBacklogDefault) ?? statuses.find((status) => status.category === 'TODO')
      : statuses.find((status) => status.category === 'DONE');
    if (!targetStatus) return;
    await quickUpdate(task, { statusId: targetStatus.id });
  }

  return (
    <>
      <PageHeader eyebrow="Personal queue" title="My tasks" description="Every task assigned to you, grouped across all of your projects." />
      <div className="task-view-toolbar app-card">
        <div className="task-filter-tabs" role="tablist" aria-label="Task filters">
          {(['all', 'today', 'overdue', 'completed'] as const).map((value) => <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
        </div>
        <Select aria-label="Group tasks" value={groupBy} onChange={(event) => setGroupBy(event.target.value as typeof groupBy)} options={[
          { value: 'none', label: 'No grouping' }, { value: 'project', label: 'Group by project' }, { value: 'priority', label: 'Group by priority' }, { value: 'dueDate', label: 'Group by due date' },
        ]} />
      </div>
      {tasksQuery.isLoading
        ? <div className="page-skeleton" aria-label="Loading assignments"><div className="skeleton h-20" /><div className="skeleton h-64" /></div>
        : groups.map((group) => <section key={group.label || 'all'} className="task-group-section">
          {group.label && <h2 className="task-group-heading">{group.label}<span>{group.tasks.length}</span></h2>}
          <BacklogList tasks={group.tasks} showProject title={group.label ? undefined : 'Assigned to me'} description={group.label ? undefined : 'Your real assignments across every project you can access.'} onTaskClick={(task) => setSelectedTaskId(task.id)} />
          {group.tasks.length > 0 && <div className="task-quick-actions" aria-label="Quick task actions">
            <span><Icon name="sparkles" size={14} /> Quick actions are available from each selected task.</span>
            {group.tasks.slice(0, 4).map((task) => <div key={task.id} className="task-quick-row"><strong>{task.title}</strong><Button variant="secondary" onClick={() => toggleTaskDone(task)}>{isDone(task) ? 'Reopen' : 'Mark done'}</Button><input aria-label={`Due date for ${task.title}`} type="date" value={task.dueDate?.slice(0, 10) ?? ''} onChange={(event) => quickUpdate(task, { dueDate: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null })} /></div>)}
          </div>}
        </section>)}
      {!tasksQuery.isLoading && tasks.length > 0 && (
        <div className="backlog-footer">
          <span>Showing {tasks.length} of {totalCount} assigned task{totalCount === 1 ? '' : 's'}</span>
          {tasksQuery.hasNextPage && <Button variant="secondary" loading={tasksQuery.isFetchingNextPage} onClick={() => tasksQuery.fetchNextPage()}>Load more</Button>}
        </div>
      )}
      <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onTaskUpdated={(task) => {
        queryClient.setQueriesData<{ pages: { items: Task[] }[] }>({ queryKey: ['tasks', 'assigned'] }, (current) => current ? { ...current, pages: current.pages.map((page) => ({ ...page, items: page.items.map((item) => item.id === task.id ? task : item) })) } : current);
        queryClient.setQueryData(queryKeys.task(task.id), task);
      }} />
    </>
  );
}
