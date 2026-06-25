import type { DragEvent } from 'react';
import Icon from './Icon';
import type { Task } from '../services/taskService';

interface TaskCardProps {
  task: Task;
  dragging?: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onClick?: () => void;
}

function getInitials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function TaskCard({ task, dragging = false, onDragStart, onDragEnd, onClick }: TaskCardProps) {
  return (
    <article
      className={`task-card priority-${task.priority.toLowerCase()}${dragging ? ' is-dragging' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={(event) => { if (onClick && (event.key === 'Enter' || event.key === ' ')) onClick(); }}
      tabIndex={0}
      aria-label={`${task.title}, ${task.priority.toLowerCase()} priority`}
    >
      <div className="task-card-topline">
        <span className="task-priority-dot" aria-hidden="true" />
        <span className="task-priority-label">{task.priority.toLowerCase()}</span>
        <span className="task-status-label">{task.status.toLowerCase().replaceAll('_', ' ')}</span>
        <span className="task-drag-handle" aria-hidden="true"><Icon name="menu" size={15} /></span>
      </div>

      <h3>{task.title}</h3>

      <footer className="task-card-footer">
        <span className="task-assignee-avatar">{getInitials(task.assignee?.name)}</span>
        <span className="task-assignee-name">{task.assignee?.name ?? 'Unassigned'}</span>
      </footer>
    </article>
  );
}
