import { useState, type DragEvent } from 'react';
import Icon from './Icon';
import TaskCard from './TaskCard';
import type { Task, TaskStatus } from '../services/taskService';
import { updateTaskStatus } from '../services/taskService';

const columns: { status: TaskStatus; label: string }[] = [
  { status: 'TODO', label: 'To do' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'IN_REVIEW', label: 'Review' },
  { status: 'DONE', label: 'Done' },
];

interface KanbanBoardProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  onTaskClick?: (task: Task) => void;
}

export default function KanbanBoard({ tasks, onTasksChange, onTaskClick }: KanbanBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const [saveError, setSaveError] = useState(false);
  const boardTaskCount = tasks.filter((task) => task.status !== 'BACKLOG').length;

  const handleDragStart = (event: DragEvent<HTMLElement>, taskId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
    setSaveError(false);
  };

  const handleDrop = async (status: TaskStatus) => {
    if (!draggedTaskId) return;
    const taskId = draggedTaskId;
    const previousTasks = tasks;
    const currentTask = tasks.find((task) => task.id === taskId);

    setDropTarget(null);
    if (!currentTask || currentTask.status === status) {
      setDraggedTaskId(null);
      return;
    }

    onTasksChange(tasks.map((task) => task.id === taskId ? { ...task, status } : task));

    try {
      await updateTaskStatus(taskId, status);
    } catch {
      onTasksChange(previousTasks);
      setSaveError(true);
    } finally {
      setDraggedTaskId(null);
    }
  };

  return (
    <div className="kanban-shell app-card">
      <div className="kanban-heading">
        <div>
          <p className="section-kicker">Live workflow</p>
          <h2>Project board</h2>
          <p>Drag tasks between stages to keep this project moving.</p>
        </div>
        <span className="kanban-summary"><Icon name="activity" size={15} /> {boardTaskCount} tasks</span>
      </div>

      {saveError && <div className="board-alert" role="alert">The status could not be saved. The task was returned to its previous column.</div>}

      <div className="kanban-board" aria-label="Project task status board">
        {columns.map((column, index) => {
          const columnTasks = tasks.filter((task) => task.status === column.status);
          const isTarget = dropTarget === column.status && draggedTaskId !== null;

          return (
            <section
              key={column.status}
              className={`kanban-column${isTarget ? ' is-drop-target' : ''}`}
              style={{ '--column-index': index } as React.CSSProperties}
              onDragEnter={() => setDropTarget(column.status)}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null); }}
              onDrop={() => handleDrop(column.status)}
            >
              <header className="kanban-column-head">
                <span className={`status-marker status-${column.status.toLowerCase()}`} />
                <h3>{column.label}</h3>
                <span className="kanban-count">{columnTasks.length}</span>
              </header>
              <div className="kanban-task-stack">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    dragging={draggedTaskId === task.id}
                    onClick={onTaskClick ? () => onTaskClick(task) : undefined}
                    onDragStart={(event) => handleDragStart(event, task.id)}
                    onDragEnd={() => { setDraggedTaskId(null); setDropTarget(null); }}
                  />
                ))}
                {columnTasks.length === 0 && <div className="kanban-empty"><span />Drop tasks here</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
