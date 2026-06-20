import { useEffect, useState } from 'react';
import BacklogList from '../components/BacklogList';
import PageHeader from '../components/PageHeader';
import TaskDetailModal from '../components/TaskDetailModal';
import { Spinner } from '../components/ui';
import { getAssignedTasks } from '../services/taskService';
import type { Task } from '../services/taskService';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    getAssignedTasks().then(setTasks).catch(() => setTasks([])).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader eyebrow="Personal queue" title="My tasks" description="Every task assigned to you, grouped across all of your projects." />
      {loading
        ? <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Loading your assignments...</p></div>
        : <BacklogList tasks={tasks} showProject title="Assigned to me" description="Your real assignments across every project you can access." onTaskClick={(task) => setSelectedTaskId(task.id)} />}
      <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </>
  );
}
