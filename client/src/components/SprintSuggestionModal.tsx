import { useState, type CSSProperties } from 'react';
import { Button, Modal } from './ui';
import Icon from './Icon';
import { moveTaskToSprint } from '../services/taskService';
import type { Task } from '../services/taskService';
import type { SprintSuggestionResult } from '../services/aiService';
import { useToast } from '../hooks/useToast';

interface Props {
  isOpen: boolean;
  suggestion: SprintSuggestionResult;
  backlogTasks: Task[];
  sprintId: string;
  onClose: () => void;
  onAccepted: (updatedTasks: Task[]) => void;
}

function StatusPill({
  included,
  disabled,
  onClick,
}: {
  included: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 14px',
    borderRadius: '999px',
    border: `1.5px solid ${included ? 'var(--success)' : 'var(--danger)'}`,
    background: included ? 'var(--success-soft)' : 'var(--danger-soft)',
    color: included ? 'var(--success)' : 'var(--danger)',
    fontSize: '12px',
    fontWeight: 750,
    lineHeight: 1,
    flexShrink: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  };
  return (
    <button
      type="button"
      style={style}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={included}
      aria-label={included ? 'Click to skip this task' : 'Click to include this task'}
    >
      {included ? <Icon name="check" size={13} /> : <Icon name="close" size={13} />}
      {included ? 'Adding' : 'Skipping'}
    </button>
  );
}

function priorityLabel(p: string) {
  return p.charAt(0) + p.slice(1).toLowerCase();
}

export default function SprintSuggestionModal({
  isOpen,
  suggestion,
  backlogTasks,
  sprintId,
  onClose,
  onAccepted,
}: Props) {
  const toast = useToast();

  // Build a map for quick task lookup
  const taskMap = new Map(backlogTasks.map((t) => [t.id, t]));

  // Only surface suggestions for tasks we can actually find in the local backlog list
  const validItems = suggestion.suggestions.filter((s) => taskMap.has(s.taskId));

  const [included, setIncluded] = useState<Set<string>>(
    () => new Set(validItems.map((s) => s.taskId)),
  );
  const [submitting, setSubmitting] = useState(false);

  function toggle(taskId: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function setAll(value: boolean) {
    setIncluded(value ? new Set(validItems.map((s) => s.taskId)) : new Set());
  }

  async function handleAccept() {
    const toAdd = validItems.filter((s) => included.has(s.taskId));
    if (toAdd.length === 0) {
      toast.error('Select at least one task to add to the sprint.');
      return;
    }
    setSubmitting(true);
    try {
      const results = await Promise.all(
        toAdd.map((s) => moveTaskToSprint(s.taskId, sprintId)),
      );
      onAccepted(results);
      toast.success(
        `${results.length} task${results.length === 1 ? '' : 's'} added to the sprint.`,
      );
      onClose();
    } catch {
      toast.error('One or more tasks could not be added. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const addCount = included.size;

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      title="AI sprint suggestion"
      className="max-w-3xl!"
    >
      {/* Reasoning summary */}
      <div className="sprint-suggestion-reasoning">
        <p className="sprint-suggestion-reasoning-label">
          <Icon name="sparkles" size={13} /> AI reasoning
        </p>
        <p>{suggestion.reasoning}</p>
      </div>

      {validItems.length === 0 ? (
        <p className="sprint-suggestion-empty">
          No matching backlog tasks were found for this suggestion. The backlog may have changed since the analysis ran.
        </p>
      ) : (
        <>
          {/* Header controls */}
          <div className="sprint-suggestion-controls">
            <p className="field-help">
              <strong style={{ color: 'var(--text)' }}>{addCount}</strong>{' '}
              of {validItems.length} suggested task{validItems.length !== 1 ? 's' : ''} will be added.
              Workload is measured by task count — no estimates available.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-link"
                style={{ fontSize: '12px' }}
                onClick={() => setAll(true)}
                disabled={submitting}
              >
                Add all
              </button>
              <span className="field-help" aria-hidden="true">·</span>
              <button
                type="button"
                className="text-link"
                style={{ fontSize: '12px' }}
                onClick={() => setAll(false)}
                disabled={submitting}
              >
                Skip all
              </button>
            </div>
          </div>

          {/* Suggestion rows */}
          <div className="flex flex-col gap-3">
            {validItems.map((item) => {
              const task = taskMap.get(item.taskId)!;
              const isIncluded = included.has(item.taskId);
              return (
                <div
                  key={item.taskId}
                  className="sprint-suggestion-row"
                  style={{ opacity: isIncluded ? 1 : 0.5 }}
                >
                  <div className="sprint-suggestion-row-main">
                    <span
                      className={`task-priority-dot priority-${task.priority.toLowerCase()}`}
                      aria-hidden="true"
                    />
                    <div className="sprint-suggestion-info">
                      <span className="sprint-suggestion-title">{task.title}</span>
                      <span className="sprint-suggestion-meta">
                        <span className="task-priority-label">{priorityLabel(task.priority)}</span>
                        {task.assignee && (
                          <span className="sprint-task-assignee">{task.assignee.name}</span>
                        )}
                        {task.dueDate && (
                          <span className="sprint-task-assignee">
                            due {new Date(task.dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </span>
                      <span className="sprint-suggestion-reason">{item.reason}</span>
                    </div>
                  </div>
                  <StatusPill
                    included={isIncluded}
                    disabled={submitting}
                    onClick={() => toggle(item.taskId)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 mt-5">
        <div />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Dismiss
          </Button>
          {validItems.length > 0 && (
            <Button onClick={handleAccept} loading={submitting} disabled={addCount === 0}>
              <Icon name="plus" size={15} />
              {addCount > 0 ? `Add ${addCount} to sprint` : 'Add to sprint'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
