import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import BacklogList from '../components/BacklogList';
import PageHeader from '../components/PageHeader';
import TaskDetailModal from '../components/TaskDetailModal';
import { Spinner } from '../components/ui';
import { getAssignedTasks } from '../services/taskService';
import type { Task } from '../services/taskService';
import { queryKeys, queryTimes } from '../services/queryOptions';

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const tasksQuery = useQuery({
    queryKey: queryKeys.assignedTasks,
    queryFn: getAssignedTasks,
    staleTime: queryTimes.tasks,
  });
  const tasks = Array.isArray(tasksQuery.data) ? tasksQuery.data : [];

  return (
    <>
      <PageHeader eyebrow="Personal queue" title="My tasks" description="Every task assigned to you, grouped across all of your projects." />
      {tasksQuery.isLoading
        ? <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Loading your assignments...</p></div>
        : <BacklogList tasks={tasks} showProject title="Assigned to me" description="Your real assignments across every project you can access." onTaskClick={(task) => setSelectedTaskId(task.id)} />}
      <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onTaskUpdated={(task) => {
        queryClient.setQueryData<Task[]>(queryKeys.assignedTasks, (current = []) => current.map((item) => item.id === task.id ? task : item));
        queryClient.setQueryData(queryKeys.task(task.id), task);
      }} />
    </>
  );
}
