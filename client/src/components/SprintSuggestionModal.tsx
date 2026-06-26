import { useState } from 'react';
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function toggle(taskId: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function startSelection() {
    setIncluded(new Set(validItems.map((s) => s.taskId)));
    setSelectionMode(true);
  }

  function cancelSelection() {
    setIncluded(new Set(validItems.map((s) => s.taskId)));
    setSelectionMode(false);
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
            <Button
              variant={selectionMode ? 'ghost' : 'secondary'}
              className="sprint-suggestion-select-btn"
              onClick={selectionMode ? cancelSelection : startSelection}
              disabled={submitting}
            >
              {selectionMode ? 'Cancel selection' : 'Select'}
            </Button>
            <div className="sprint-suggestion-hidden-actions" hidden>
              <span className="field-help" aria-hidden="true">·</span>
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
                  className={`sprint-suggestion-row${selectionMode && isIncluded ? ' is-selected' : ''}`}
                >
                  {selectionMode && (
                    <input
                      className="themed-checkbox"
                      type="checkbox"
                      checked={isIncluded}
                      disabled={submitting}
                      onChange={() => toggle(item.taskId)}
                      aria-label={`Select ${task.title}`}
                    />
                  )}
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
            Cancel
          </Button>
          {validItems.length > 0 && (
            <Button onClick={handleAccept} loading={submitting} disabled={addCount === 0}>
              <Icon name="plus" size={15} />
              Add {addCount} to sprint
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
