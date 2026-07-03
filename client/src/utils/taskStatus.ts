import type { Task } from '../services/taskService';

export const isDone = (task: Pick<Task, 'status'>) => task.status.category === 'DONE';
export const isInProgress = (task: Pick<Task, 'status'>) => task.status.category === 'IN_PROGRESS';
export const isTodo = (task: Pick<Task, 'status'>) => task.status.category === 'TODO';
