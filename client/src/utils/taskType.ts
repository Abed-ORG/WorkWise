import type { IconName } from '../components/Icon';
import type { TaskType } from '../services/taskService';

export const TASK_TYPE_OPTIONS: { value: Exclude<TaskType, 'SUBTASK'>; label: string }[] = [
  { value: 'STORY', label: 'Story' },
  { value: 'BUG', label: 'Bug' },
];

const ICONS: Record<TaskType, IconName> = {
  STORY: 'story',
  BUG: 'bug',
  SUBTASK: 'subtask',
};

const LABELS: Record<TaskType, string> = {
  STORY: 'Story',
  BUG: 'Bug',
  SUBTASK: 'Subtask',
};

export function taskTypeIcon(type: TaskType): IconName {
  return ICONS[type];
}

export function taskTypeLabel(type: TaskType): string {
  return LABELS[type];
}
