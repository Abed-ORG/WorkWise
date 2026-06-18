import { useEffect, useState } from 'react';
import DocumentLinkPicker from './DocumentLinkPicker';
import Icon from './Icon';
import { Button, Modal, Spinner } from './ui';
import { getTaskById, updateTask, updateTaskDocuments } from '../services/taskService';
import type { Task } from '../services/taskService';
import type { ProjectDocument } from '../services/projectService';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

interface AcceptanceCriterion {
  id: string;
  text: string;
  done: boolean;
}

function formatStatus(status?: string) {
  if (!status) return 'Unknown';
  return status.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function formatDate(date?: string | null) {
  if (!date) return 'No due date';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

function createCriterion(text = '', done = false): AcceptanceCriterion {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    text,
    done,
  };
}

function parseAcceptanceCriteria(value?: string | null): AcceptanceCriterion[] {
  if (!value?.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && typeof item.text === 'string')
        .map((item) => ({ id: String(item.id || createCriterion().id), text: item.text, done: Boolean(item.done) }));
    }
  } catch {
    // Existing plain-text criteria are treated as one item per non-empty line.
  }

  return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => createCriterion(line));
}

function serializeAcceptanceCriteria(items: AcceptanceCriterion[]) {
  const cleaned = items.map((item) => ({ ...item, text: item.text.trim() })).filter((item) => item.text);
  return cleaned.length ? JSON.stringify(cleaned) : '';
}

export default function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [linkedDocuments, setLinkedDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [descriptionMessage, setDescriptionMessage] = useState('');
  const [acceptanceCriteriaItems, setAcceptanceCriteriaItems] = useState<AcceptanceCriterion[]>([]);
  const [savingAcceptanceCriteria, setSavingAcceptanceCriteria] = useState(false);
  const [acceptanceCriteriaMessage, setAcceptanceCriteriaMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setLinkedDocuments([]);
      return;
    }

    setLoading(true);
    setError('');
    getTaskById(taskId)
      .then((taskData) => {
        setTask(taskData);
        setLinkedDocuments(taskData.documents ?? []);
        setDescriptionDraft(taskData.description ?? '');
        setDescriptionMessage('');
        setAcceptanceCriteriaItems(parseAcceptanceCriteria(taskData.acceptanceCriteria));
        setAcceptanceCriteriaMessage('');
      })
      .catch(() => setError('Task details could not be loaded.'))
      .finally(() => setLoading(false));
  }, [taskId]);

  async function handleDocumentChange(documentIds: string[]) {
    if (!taskId) return linkedDocuments;
    const documents = await updateTaskDocuments(taskId, documentIds);
    setLinkedDocuments(documents);
    setTask((current) => current ? { ...current, documents } : current);
    return documents;
  }

  async function saveDescription() {
    if (!taskId || !task || descriptionDraft === (task.description ?? '')) return;

    setSavingDescription(true);
    setDescriptionMessage('');
    try {
      const updatedTask = await updateTask(taskId, { description: descriptionDraft });
      setTask((current) => current ? { ...current, description: updatedTask.description ?? '' } : current);
      setDescriptionMessage('Saved');
    } catch {
      setDescriptionMessage('Could not save');
    } finally {
      setSavingDescription(false);
    }
  }

  async function saveAcceptanceCriteria(nextItems = acceptanceCriteriaItems) {
    if (!taskId || !task) return;

    const nextValue = serializeAcceptanceCriteria(nextItems);
    if (nextValue === (task.acceptanceCriteria ?? '')) return;

    setSavingAcceptanceCriteria(true);
    setAcceptanceCriteriaMessage('');
    try {
      const updatedTask = await updateTask(taskId, { acceptanceCriteria: nextValue });
      setTask((current) => current ? { ...current, acceptanceCriteria: updatedTask.acceptanceCriteria ?? '' } : current);
      setAcceptanceCriteriaItems(parseAcceptanceCriteria(updatedTask.acceptanceCriteria));
      setAcceptanceCriteriaMessage('Saved');
    } catch {
      setAcceptanceCriteriaMessage('Could not save');
    } finally {
      setSavingAcceptanceCriteria(false);
    }
  }

  function updateCriterion(id: string, patch: Partial<AcceptanceCriterion>) {
    setAcceptanceCriteriaItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    setAcceptanceCriteriaMessage('');
  }

  function deleteCriterion(id: string) {
    setAcceptanceCriteriaItems((current) => current.filter((item) => item.id !== id));
    setAcceptanceCriteriaMessage('');
  }

  function addCriterion() {
    setAcceptanceCriteriaItems((current) => [...current, createCriterion()]);
    setAcceptanceCriteriaMessage('');
  }

  return (
    <Modal isOpen={Boolean(taskId)} onClose={onClose} className="task-detail-modal">
      {loading ? (
        <div className="task-detail-loading"><Spinner /><span>Loading task details...</span></div>
      ) : error ? (
        <div className="empty-panel"><p>{error}</p></div>
      ) : task ? (
        <div className="task-detail-stack">
          <header className="task-detail-header">
            <div>
              <p className="section-kicker">{task.project?.key ?? 'Task'}{task.sprint ? ` / ${task.sprint.name}` : ''}</p>
              <span>Task details</span>
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close task details"><Icon name="close" size={18} /></button>
          </header>

          <div className="task-detail-content">
            <main className="task-detail-main">
              <section className="task-title-panel">
                <h2>{task.title}</h2>
                {task.labels?.length > 0 && (
                  <div className="task-label-list">{task.labels.map((label) => <span key={label}>{label}</span>)}</div>
                )}
              </section>

              <section className="task-detail-section">
                <div className="task-detail-section-heading">
                  <h3>Description</h3>
                  <span>{savingDescription ? 'Saving...' : descriptionMessage}</span>
                </div>
                <textarea
                  className="task-description-field"
                  value={descriptionDraft}
                  onChange={(event) => {
                    setDescriptionDraft(event.target.value);
                    setDescriptionMessage('');
                  }}
                  onBlur={saveDescription}
                  disabled={savingDescription}
                  rows={5}
                  placeholder="Add context, scope, or implementation notes."
                />
              </section>

              <section className="task-detail-section">
                <div className="task-detail-section-heading">
                  <h3>Acceptance Criteria</h3>
                  <span>{savingAcceptanceCriteria ? 'Saving...' : acceptanceCriteriaMessage}</span>
                </div>
                <div className="acceptance-checklist">
                  {acceptanceCriteriaItems.map((item) => (
                    <div className="acceptance-checklist-item" key={item.id}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        disabled={savingAcceptanceCriteria}
                        onChange={(event) => updateCriterion(item.id, { done: event.target.checked })}
                        aria-label="Mark acceptance criterion complete"
                      />
                      <input
                        className="acceptance-checklist-input"
                        value={item.text}
                        disabled={savingAcceptanceCriteria}
                        onChange={(event) => updateCriterion(item.id, { text: event.target.value })}
                        placeholder="Criterion"
                      />
                      <button type="button" className="icon-button acceptance-delete-button" onClick={() => deleteCriterion(item.id)} disabled={savingAcceptanceCriteria} aria-label="Delete criterion">
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  ))}
                  {acceptanceCriteriaItems.length === 0 && <div className="document-link-empty">No acceptance criteria yet.</div>}
                </div>
                <div className="acceptance-actions">
                  <Button variant="secondary" onClick={addCriterion} disabled={savingAcceptanceCriteria}><Icon name="plus" size={15} /> Add criterion</Button>
                  <Button onClick={() => saveAcceptanceCriteria()} loading={savingAcceptanceCriteria}>Save criteria</Button>
                </div>
              </section>

              <section className="task-detail-section">
                <h3>Comments and activity</h3>
                <div className="activity-summary">
                  <span><Icon name="document" size={15} /> {task.comments?.length ?? 0} comments</span>
                  <span><Icon name="activity" size={15} /> {task.activities?.length ?? 0} activity events</span>
                </div>
              </section>
            </main>

            <aside className="task-detail-sidebar">
              <section className="task-detail-section">
                <h3>Details</h3>
                <div className="task-detail-meta">
                  <span className={`status-badge status-${task.status.toLowerCase()}`}>{formatStatus(task.status)}</span>
                  <span className={`priority-badge priority-${task.priority.toLowerCase()}`}><span />{task.priority.toLowerCase()}</span>
                  <span className="due-date"><Icon name="calendar" size={14} />{formatDate(task.dueDate)}</span>
                </div>
                <div className="task-detail-fields">
                  <div><span>Assignee</span><strong>{task.assignee?.name ?? 'Unassigned'}</strong></div>
                  <div><span>Reporter</span><strong>{task.creator?.name ?? 'Unknown'}</strong></div>
                  <div><span>Project</span><strong>{task.project?.name ?? 'Unknown'}</strong></div>
                </div>
              </section>

              <section className="task-detail-section">
                <h3>Linked Documents</h3>
                <DocumentLinkPicker projectId={task.projectId} linkedDocuments={linkedDocuments} onChange={handleDocumentChange} />
              </section>
            </aside>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
