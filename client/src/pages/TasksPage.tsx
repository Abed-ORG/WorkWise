import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import BacklogList from '../components/BacklogList';
import PageHeader from '../components/PageHeader';
import TaskDetailModal from '../components/TaskDetailModal';
import Icon from '../components/Icon';
import { Button, Select } from '../components/ui';
import { getAssignedTasks, updateTask } from '../services/taskService';
import type { Task } from '../services/taskService';
import { queryKeys, queryTimes } from '../services/queryOptions';
import { useToast } from '../hooks/useToast';

export default function TasksPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'today' | 'overdue' | 'completed'>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'project' | 'priority' | 'dueDate'>('none');
  const tasksQuery = useQuery({
    queryKey: queryKeys.assignedTasks,
    queryFn: getAssignedTasks,
    staleTime: queryTimes.tasks,
  });
  const tasks = Array.isArray(tasksQuery.data) ? tasksQuery.data : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const due = task.dueDate ? new Date(task.dueDate) : null;
    if (due) due.setHours(0, 0, 0, 0);
    if (filter === 'completed') return task.status === 'DONE';
    if (filter === 'today') return task.status !== 'DONE' && due?.getTime() === today.getTime();
    if (filter === 'overdue') return task.status !== 'DONE' && Boolean(due && due < today);
    return true;
  }), [filter, tasks]);

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
    try { const updated = await updateTask(task.id, payload); queryClient.setQueryData<Task[]>(queryKeys.assignedTasks, (current = []) => current.map((item) => item.id === updated.id ? updated : item)); toast.success('Task updated.'); }
    catch { toast.error('Task update could not be saved.'); }
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
            {group.tasks.slice(0, 4).map((task) => <div key={task.id} className="task-quick-row"><strong>{task.title}</strong><Button variant="secondary" onClick={() => quickUpdate(task, { status: task.status === 'DONE' ? 'TODO' : 'DONE' })}>{task.status === 'DONE' ? 'Reopen' : 'Mark done'}</Button><input aria-label={`Due date for ${task.title}`} type="date" value={task.dueDate?.slice(0, 10) ?? ''} onChange={(event) => quickUpdate(task, { dueDate: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null })} /></div>)}
          </div>}
        </section>)}
      <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onTaskUpdated={(task) => {
        queryClient.setQueryData<Task[]>(queryKeys.assignedTasks, (current = []) => current.map((item) => item.id === task.id ? task : item));
        queryClient.setQueryData(queryKeys.task(task.id), task);
      }} />
    </>
  );
}
