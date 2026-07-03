import type { DragEvent } from 'react';
import Icon from './Icon';
import type { Task } from '../services/taskService';
import { isDone } from '../utils/taskStatus';

interface TaskCardProps {
  task: Task;
  dragging?: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onClick?: () => void;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
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

function formatDueDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const overdue = date.getTime() < new Date().setHours(0, 0, 0, 0);
  return { label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), overdue };
}

export default function TaskCard({ task, dragging = false, onDragStart, onDragEnd, onClick, selected = false, onSelect }: TaskCardProps) {
  const dueDate = formatDueDate(task.dueDate);
  return (
    <article
      className={`task-card priority-${task.priority.toLowerCase()}${dragging ? ' is-dragging' : ''}${selected ? ' is-selected' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={(event) => { if (onClick && (event.key === 'Enter' || event.key === ' ')) onClick(); }}
      tabIndex={0}
      aria-label={`${task.title}, ${task.priority.toLowerCase()} priority`}
    >
      {onSelect && <label className="task-card-selector" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked)} aria-label={`Select ${task.title}`} /></label>}
      <div className="task-card-topline">
        <span className="task-priority-dot" aria-hidden="true" />
        <span className="task-priority-label">{task.priority.toLowerCase()}</span>
        <span className="task-status-label">{task.status.name}</span>
        <span className="task-drag-handle" aria-hidden="true"><Icon name="menu" size={15} /></span>
      </div>

      <h3>{task.title}</h3>

      {(task.labels?.length > 0 || dueDate) && <div className="task-card-details">
        {task.labels?.slice(0, 3).map((label) => <span className="task-label" key={label}>{label}</span>)}
        {(task.labels?.length ?? 0) > 3 && <span className="task-label">+{task.labels.length - 3}</span>}
        {dueDate && <span className={`task-card-due${dueDate.overdue && !isDone(task) ? ' is-overdue' : ''}`}><Icon name="calendar" size={13} />{dueDate.label}</span>}
      </div>}

      <footer className="task-card-footer">
        <span className="task-assignee-avatar" title={task.assignee?.name}>{task.assignee?.avatarUrl ? <img src={task.assignee.avatarUrl} alt="" /> : getInitials(task.assignee?.name)}</span>
      </footer>
    </article>
  );
}
