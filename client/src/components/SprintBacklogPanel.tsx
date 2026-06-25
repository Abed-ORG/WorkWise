import { useState, type DragEvent } from 'react';
import Icon from './Icon';
import { Button, Spinner } from './ui';
import { moveTaskToSprint, reorderTask } from '../services/taskService';
import type { Task } from '../services/taskService';
import { getSprintSuggestion } from '../services/aiService';
import type { SprintSuggestionResult } from '../services/aiService';
import SprintSuggestionModal from './SprintSuggestionModal';

interface SprintBacklogPanelProps {
  sprintId: string;
  projectId: string;
  allTasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function priorityLabel(p: string) {
  return p.charAt(0) + p.slice(1).toLowerCase();
}

function formatStatus(s: string) {
  return s.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

export default function SprintBacklogPanel({
  sprintId,
  projectId,
  allTasks,
  onTasksChange,
}: SprintBacklogPanelProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<SprintSuggestionResult | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const sprintTasks = [...allTasks.filter((t) => t.sprintId === sprintId)]
    .sort((a, b) => a.order - b.order);
  const backlogTasks = [...allTasks.filter((t) => !t.sprintId)]
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));

  async function handleSuggest() {
    if (suggesting) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await getSprintSuggestion(projectId, sprintId);
      setSuggestion(result);
    } catch {
      setSuggestError('Could not generate suggestions. Please try again.');
    } finally {
      setSuggesting(false);
    }
  }

  function handleSuggestionAccepted(updatedTasks: Task[]) {
    // Merge the newly sprint-assigned tasks back into allTasks
    onTasksChange(allTasks.map((t) => updatedTasks.find((u) => u.id === t.id) ?? t));
  }

  async function handleAddToSprint(task: Task) {
    setBusy(task.id);
    const optimistic = allTasks.map((t) => t.id === task.id ? { ...t, sprintId } : t);
    onTasksChange(optimistic);
    try {
      const updated = await moveTaskToSprint(task.id, sprintId);
      onTasksChange(allTasks.map((t) => t.id === updated.id ? updated : t));
    } catch {
      onTasksChange(allTasks);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveFromSprint(task: Task) {
    setBusy(task.id);
    const optimistic = allTasks.map((t) => t.id === task.id ? { ...t, sprintId: null } : t);
    onTasksChange(optimistic);
    try {
      const updated = await moveTaskToSprint(task.id, null);
      onTasksChange(allTasks.map((t) => t.id === updated.id ? updated : t));
    } catch {
      onTasksChange(allTasks);
    } finally {
      setBusy(null);
    }
  }

  function handleDragStart(event: DragEvent<HTMLElement>, taskId: string) {
    event.dataTransfer.effectAllowed = 'move';
    setDraggedId(taskId);
  }

  function handleDragOver(event: DragEvent<HTMLElement>, index: number) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  }

  async function handleDrop(event: DragEvent<HTMLElement>, targetIndex: number) {
    event.preventDefault();
    if (!draggedId) return;
    const sourceTask = sprintTasks.find((t) => t.id === draggedId);
    if (!sourceTask) return;

    const reordered = sprintTasks.filter((t) => t.id !== draggedId);
    reordered.splice(targetIndex, 0, sourceTask);

    // Assign order values 0, 1, 2… — global order field, no migration needed
    const updated = reordered.map((t, i) => ({ ...t, order: i }));
    onTasksChange(allTasks.map((t) => updated.find((u) => u.id === t.id) ?? t));

    setDraggedId(null);
    setDropIndex(null);

    await Promise.allSettled(updated.map((t) => reorderTask(t.id, t.order)));
  }

  return (
    <div className="sprint-backlog-root">
      {/* One-line orientation banner */}
      <p className="sprint-backlog-intro">
        <Icon name="tasks" size={13} />
        Add tasks from the product backlog on the left into this sprint on the right. Drag sprint tasks to reorder them.
      </p>

      <div className="sprint-backlog-layout">
        {/* LEFT — Product backlog (source) */}
        <div className="app-card sprint-backlog-col">
          <div className="sprint-backlog-col-head">
            <div>
              <p className="section-kicker">Product backlog</p>
              <h2>Available tasks</h2>
              <p>Unassigned tasks sorted by priority. Click <strong>+</strong> to add to the sprint.</p>
            </div>
            <div className="sprint-backlog-col-head-actions">
              <span className="kanban-summary">
                <Icon name="tasks" size={14} />
                {backlogTasks.length}
              </span>
              <Button
                variant="secondary"
                className="sprint-suggest-btn"
                disabled={suggesting || backlogTasks.length === 0}
                onClick={handleSuggest}
                title="Ask AI to suggest tasks for this sprint"
              >
                {suggesting ? <Spinner size="sm" /> : <Icon name="sparkles" size={14} />}
                {suggesting ? 'Suggesting…' : 'Suggest tasks'}
              </Button>
            </div>
          </div>
          {suggestError && <p className="sprint-suggest-error">{suggestError}</p>}

          {backlogTasks.length === 0 ? (
            <div className="sprint-backlog-empty">
              <span className="sprint-backlog-empty-icon"><Icon name="check" size={20} /></span>
              <p>All tasks are in a sprint or the project has no backlog tasks yet.</p>
            </div>
          ) : (
            <ul className="sprint-task-list">
              {backlogTasks.map((task) => (
                <li key={task.id} className="sprint-task-row">
                  <span className={`task-priority-dot priority-${task.priority.toLowerCase()}`} />
                  <span className="sprint-task-info">
                    <span className="sprint-task-title">{task.title}</span>
                    <span className="sprint-task-meta">
                      <span className={`status-badge status-${task.status.toLowerCase()}`}>{formatStatus(task.status)}</span>
                      <span className="sprint-task-priority">{priorityLabel(task.priority)}</span>
                      {task.assignee && <span className="sprint-task-assignee">{task.assignee.name}</span>}
                    </span>
                  </span>
                  <Button
                    variant="secondary"
                    className="sprint-task-action"
                    disabled={busy === task.id}
                    onClick={() => handleAddToSprint(task)}
                    title="Add to sprint"
                  >
                    <Icon name="plus" size={14} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* RIGHT — Sprint tasks (destination) */}
        <div className="app-card sprint-backlog-col">
          <div className="sprint-backlog-col-head">
            <div>
              <p className="section-kicker">Sprint backlog</p>
              <h2>In this sprint</h2>
              <p>Drag to reorder. Click <strong>←</strong> to return a task to the backlog.</p>
            </div>
            <span className="kanban-summary">
              <Icon name="tasks" size={14} />
              {sprintTasks.length}
            </span>
          </div>

          {sprintTasks.length === 0 ? (
            <div className="sprint-backlog-empty">
              <span className="sprint-backlog-empty-icon"><Icon name="tasks" size={20} /></span>
              <p>No tasks in this sprint yet. Add tasks from the product backlog on the left.</p>
            </div>
          ) : (
            <ul className="sprint-task-list">
              {sprintTasks.map((task, index) => (
                <li
                  key={task.id}
                  className={`sprint-task-row${draggedId === task.id ? ' is-dragging' : ''}${dropIndex === index && draggedId !== task.id ? ' is-drop-target' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={() => { setDraggedId(null); setDropIndex(null); }}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <span className="sprint-task-drag-handle" aria-hidden="true">
                    <Icon name="menu" size={14} />
                  </span>
                  <span className={`task-priority-dot priority-${task.priority.toLowerCase()}`} />
                  <span className="sprint-task-info">
                    <span className="sprint-task-title">{task.title}</span>
                    <span className="sprint-task-meta">
                      <span className={`status-badge status-${task.status.toLowerCase()}`}>{formatStatus(task.status)}</span>
                      <span className="sprint-task-priority">{priorityLabel(task.priority)}</span>
                      {task.assignee && <span className="sprint-task-assignee">{task.assignee.name}</span>}
                    </span>
                  </span>
                  <Button
                    variant="secondary"
                    className="sprint-task-action"
                    disabled={busy === task.id}
                    onClick={() => handleRemoveFromSprint(task)}
                    title="Remove from sprint"
                  >
                    <Icon name="arrow-left" size={14} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {suggestion && (
        <SprintSuggestionModal
          isOpen
          suggestion={suggestion}
          backlogTasks={backlogTasks}
          sprintId={sprintId}
          onClose={() => setSuggestion(null)}
          onAccepted={handleSuggestionAccepted}
        />
      )}
    </div>
  );
}
