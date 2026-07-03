import { useEffect, useState } from 'react';
import axios from 'axios';
import Icon from './Icon';
import { Button, Modal, Select, Spinner } from './ui';
import { completeSprint, getProjectSprints } from '../services/projectService';
import type { Sprint } from '../services/projectService';
import type { Task } from '../services/taskService';
import { isDone } from '../utils/taskStatus';

interface CompleteSprintModalProps {
  isOpen: boolean;
  projectId: string;
  sprintId: string;
  sprintName: string;
  sprintTasks: Task[];
  onClose: () => void;
  onCompleted: () => void;
}

type Destination = 'backlog' | 'sprint';

export default function CompleteSprintModal({
  isOpen,
  projectId,
  sprintId,
  sprintName,
  sprintTasks,
  onClose,
  onCompleted,
}: CompleteSprintModalProps) {
  const [otherSprints, setOtherSprints] = useState<Sprint[]>([]);
  const [loadingSprints, setLoadingSprints] = useState(false);
  const [destination, setDestination] = useState<Destination>('backlog');
  const [targetSprintId, setTargetSprintId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const completedTasks = sprintTasks.filter((t) => isDone(t));
  const incompleteTasks = sprintTasks.filter((t) => !isDone(t));
  const hasIncomplete = incompleteTasks.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    setDestination('backlog');
    setTargetSprintId('');
    setError('');
    setLoadingSprints(true);
    getProjectSprints(projectId)
      .then((sprints) => {
        // other sprints = not this sprint (upcoming or inactive)
        setOtherSprints(sprints.filter((s) => s.id !== sprintId && !s.isActive));
      })
      .finally(() => setLoadingSprints(false));
  }, [isOpen, projectId, sprintId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (destination === 'sprint' && !targetSprintId) {
      setError('Please select a sprint for the incomplete tasks.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await completeSprint(projectId, sprintId, {
        incompleteTaskDestination: destination,
        targetSprintId: destination === 'sprint' ? targetSprintId : undefined,
      });
      onCompleted();
    } catch (err) {
      const message = axios.isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message
        : undefined;
      setError(message || 'Could not complete the sprint. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const sprintOptions = otherSprints.map((s) => ({ value: s.id, label: s.name }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Complete sprint">
      <form className="form-stack" onSubmit={handleSubmit}>
        {/* Summary */}
        <div className="sprint-complete-summary">
          <p className="sprint-complete-summary-label">Completing <strong>{sprintName}</strong></p>
          <div className="sprint-complete-counts">
            <div className="sprint-complete-count sprint-complete-count--done">
              <span className="sprint-complete-count-number">{completedTasks.length}</span>
              <span className="sprint-complete-count-label">
                <Icon name="check" size={13} /> Completed
              </span>
            </div>
            <div className="sprint-complete-count sprint-complete-count--open">
              <span className="sprint-complete-count-number">{incompleteTasks.length}</span>
              <span className="sprint-complete-count-label">
                <Icon name="activity" size={13} /> Incomplete
              </span>
            </div>
          </div>
        </div>

        {/* Incomplete task destination */}
        {hasIncomplete && (
          <div className="sprint-complete-destination">
            <p className="field-label">Move {incompleteTasks.length} incomplete {incompleteTasks.length === 1 ? 'task' : 'tasks'} to</p>

            <div className="sprint-complete-radio-group">
              <label className={`sprint-complete-radio${destination === 'backlog' ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="destination"
                  value="backlog"
                  checked={destination === 'backlog'}
                  onChange={() => { setDestination('backlog'); setTargetSprintId(''); }}
                />
                <span className="sprint-complete-radio-dot" />
                <span className="sprint-complete-radio-copy">
                  <strong>Product backlog</strong>
                  <span>Tasks will be unassigned from any sprint</span>
                </span>
              </label>

              <label className={`sprint-complete-radio${destination === 'sprint' ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="destination"
                  value="sprint"
                  checked={destination === 'sprint'}
                  onChange={() => setDestination('sprint')}
                />
                <span className="sprint-complete-radio-dot" />
                <span className="sprint-complete-radio-copy">
                  <strong>Another sprint</strong>
                  <span>Move tasks to an existing sprint</span>
                </span>
              </label>
            </div>

            {destination === 'sprint' && (
              <>
                {loadingSprints ? (
                  <div className="sprint-complete-sprint-loading">
                    <Spinner size="sm" /> Loading sprints…
                  </div>
                ) : otherSprints.length === 0 ? (
                  <div className="alert alert-error">No other sprints available. Create a sprint first or move tasks to the backlog.</div>
                ) : (
                  <Select
                    label="Select sprint"
                    placeholder="Choose a sprint…"
                    value={targetSprintId}
                    options={sprintOptions}
                    onChange={(e) => setTargetSprintId(e.target.value)}
                  />
                )}
              </>
            )}
          </div>
        )}

        {!hasIncomplete && (
          <div className="alert alert-success">
            <Icon name="check" size={14} /> All tasks are completed — this sprint is ready to close.
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            type="submit"
            variant="danger"
            loading={saving}
            disabled={destination === 'sprint' && !targetSprintId && hasIncomplete}
          >
            <Icon name="check" size={15} /> Complete sprint
          </Button>
        </div>
      </form>
    </Modal>
  );
}
