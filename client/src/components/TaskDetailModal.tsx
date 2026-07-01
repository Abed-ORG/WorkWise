import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DocumentLinkPicker from './DocumentLinkPicker';
import Icon from './Icon';
import { Button, Modal, Select, Spinner } from './ui';
import { getProjectById, getProjectSprints } from '../services/projectService';
import { createTaskComment, getTaskById, updateTask, updateTaskDocuments } from '../services/taskService';
import type { Task, TaskStatus } from '../services/taskService';
import { generateAcceptanceCriteria } from '../services/aiService';
import type { ProjectDocument, ProjectMember, Sprint } from '../services/projectService';
import { queryKeys, queryTimes } from '../services/queryOptions';
import { isOpenSprintMoveTarget, isPastSprintMoveTarget } from '../utils/sprintOptions';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated?: (task: Task) => void;
}

interface AcceptanceCriterion {
  id: string;
  text: string;
  done: boolean;
}

function formatDate(date?: string | null) {
  if (!date) return 'No due date';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

function toDateInputValue(date?: string | null) {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function dateInputToTaskDate(value: string) {
  return value ? new Date(`${value}T12:00:00.000Z`).toISOString() : null;
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

function getCriterionRows(text: string) {
  const wrappedRows = text.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 76)), 0);
  return Math.max(2, wrappedRows);
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

const statusOptions = [
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'IN_REVIEW', label: 'Review' },
  { value: 'DONE', label: 'Done' },
];

function workflowStatus(status: TaskStatus): Exclude<TaskStatus, 'BACKLOG'> {
  return status === 'BACKLOG' ? 'TODO' : status;
}

export default function TaskDetailModal({ taskId, onClose, onTaskUpdated }: TaskDetailModalProps) {
  const queryClient = useQueryClient();
  const [task, setTask] = useState<Task | null>(null);
  const [linkedDocuments, setLinkedDocuments] = useState<ProjectDocument[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [descriptionMessage, setDescriptionMessage] = useState('');
  const [acceptanceCriteriaItems, setAcceptanceCriteriaItems] = useState<AcceptanceCriterion[]>([]);
  const [acceptanceCriteriaDirty, setAcceptanceCriteriaDirty] = useState(false);
  const [lastSavedAcceptanceCriteria, setLastSavedAcceptanceCriteria] = useState('');
  const [savingAcceptanceCriteria, setSavingAcceptanceCriteria] = useState(false);
  const [generatingCriteria, setGeneratingCriteria] = useState(false);
  const [acceptanceCriteriaMessage, setAcceptanceCriteriaMessage] = useState('');
  const [commentsView, setCommentsView] = useState<'comments' | 'activity'>('comments');
  const [commentDraft, setCommentDraft] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [commentMessage, setCommentMessage] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [savingSprint, setSavingSprint] = useState(false);
  const [sprintMessage, setSprintMessage] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState('');
  const [error, setError] = useState('');

  const taskQuery = useQuery({
    queryKey: queryKeys.task(taskId ?? ''),
    queryFn: () => getTaskById(taskId!),
    enabled: Boolean(taskId),
    staleTime: queryTimes.tasks,
  });
  const projectQuery = useQuery({
    queryKey: queryKeys.project(taskQuery.data?.projectId ?? ''),
    queryFn: () => getProjectById(taskQuery.data!.projectId),
    enabled: Boolean(taskQuery.data?.projectId),
    staleTime: queryTimes.projectDetail,
  });
  const sprintsQuery = useQuery({
    queryKey: queryKeys.projectSprints(taskQuery.data?.projectId ?? ''),
    queryFn: () => getProjectSprints(taskQuery.data!.projectId),
    enabled: Boolean(taskQuery.data?.projectId),
    staleTime: queryTimes.sprints,
  });
  const sprints = Array.isArray(sprintsQuery.data) ? sprintsQuery.data : [];
  const currentSprint = task?.sprintId ? sprints.find((sprint) => sprint.id === task.sprintId) ?? null : null;
  const currentPastSprint = currentSprint && isPastSprintMoveTarget(currentSprint) ? currentSprint : null;
  const selectableSprints = sprints.filter((sprint) => isOpenSprintMoveTarget(sprint) || sprint.id === task?.sprintId);
  const sprintOptions = [
    { value: '', label: 'Product backlog / No sprint' },
    ...selectableSprints.map((sprint) => ({
      value: sprint.id,
      label: `${sprint.name}${sprint.isActive ? ' (active)' : currentPastSprint?.id === sprint.id ? ' (completed)' : ''}`,
      disabled: currentPastSprint?.id === sprint.id,
    })),
  ];

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setLinkedDocuments([]);
      setProjectMembers([]);
      return;
    }
    setError('');
  }, [taskId]);

  useEffect(() => {
    if (!taskQuery.data) return;
    setTask(taskQuery.data);
    setLinkedDocuments(taskQuery.data.documents ?? []);
    setDescriptionDraft(taskQuery.data.description ?? '');
    setDescriptionMessage('');
    const parsedCriteria = parseAcceptanceCriteria(taskQuery.data.acceptanceCriteria);
    setAcceptanceCriteriaItems(parsedCriteria);
    setLastSavedAcceptanceCriteria(serializeAcceptanceCriteria(parsedCriteria));
    setAcceptanceCriteriaDirty(false);
    setAcceptanceCriteriaMessage('');
    setCommentDraft('');
    setCommentMessage('');
    setCommentsView('comments');
    setStatusMessage('');
    setSprintMessage('');
    setDetailsMessage('');
  }, [taskQuery.data]);

  useEffect(() => {
    if (projectQuery.data?.members) setProjectMembers(projectQuery.data.members);
  }, [projectQuery.data]);

  useEffect(() => {
    if (taskQuery.isError || projectQuery.isError || sprintsQuery.isError) setError('Task details could not be loaded.');
  }, [projectQuery.isError, sprintsQuery.isError, taskQuery.isError]);

  function cacheTask(nextTask: Task) {
    setTask(nextTask);
    queryClient.setQueryData(queryKeys.task(nextTask.id), nextTask);
    queryClient.setQueryData<Task[]>(queryKeys.projectTasks(nextTask.projectId), (current) => {
      if (!current) return current;
      return current.map((item) => (item.id === nextTask.id ? { ...item, ...nextTask } : item));
    });
    onTaskUpdated?.(nextTask);
  }

  async function handleDocumentChange(documentIds: string[]) {
    if (!taskId) return linkedDocuments;
    const previousDocuments = linkedDocuments;
    setLinkedDocuments((current) => current.filter((document) => documentIds.includes(document.id)));
    try {
      const documents = await updateTaskDocuments(taskId, documentIds);
      setLinkedDocuments(documents);
      setTask((current) => {
        if (!current) return current;
        const nextTask = { ...current, documents };
        queryClient.setQueryData(queryKeys.task(current.id), nextTask);
        return nextTask;
      });
      return documents;
    } catch (error) {
      setLinkedDocuments(previousDocuments);
      throw error;
    }
  }

  async function saveDescription() {
    if (!taskId || !task || descriptionDraft === (task.description ?? '')) return;

    setSavingDescription(true);
    setDescriptionMessage('');
    const previousTask = task;
    const optimisticTask = { ...task, description: descriptionDraft };
    cacheTask(optimisticTask);
    try {
      const updatedTask = await updateTask(taskId, { description: descriptionDraft });
      cacheTask({ ...optimisticTask, ...updatedTask });
      setDescriptionMessage('Saved');
    } catch {
      cacheTask(previousTask);
      setDescriptionMessage('Could not save');
    } finally {
      setSavingDescription(false);
    }
  }

  async function saveAcceptanceCriteria(nextItems = acceptanceCriteriaItems) {
    if (!taskId || !task) return;

    const nextValue = serializeAcceptanceCriteria(nextItems);
    if (nextValue === lastSavedAcceptanceCriteria) {
      setAcceptanceCriteriaDirty(false);
      return;
    }

    setSavingAcceptanceCriteria(true);
    setAcceptanceCriteriaMessage('');
    const previousTask = task;
    const previousItems = acceptanceCriteriaItems;
    const optimisticTask = { ...task, acceptanceCriteria: nextValue };
    cacheTask(optimisticTask);
    setAcceptanceCriteriaItems(nextItems);
    try {
      const updatedTask = await updateTask(taskId, { acceptanceCriteria: nextValue });
      cacheTask({ ...optimisticTask, ...updatedTask });
      const savedItems = parseAcceptanceCriteria(updatedTask.acceptanceCriteria);
      setAcceptanceCriteriaItems(savedItems);
      setLastSavedAcceptanceCriteria(serializeAcceptanceCriteria(savedItems));
      setAcceptanceCriteriaDirty(false);
      setAcceptanceCriteriaMessage('Saved');
    } catch {
      cacheTask(previousTask);
      setAcceptanceCriteriaItems(previousItems);
      setAcceptanceCriteriaMessage('Could not save');
    } finally {
      setSavingAcceptanceCriteria(false);
    }
  }

  async function updateStatus(status: TaskStatus) {
    if (!taskId || !task || status === task.status) return;

    setSavingStatus(true);
    setStatusMessage('');
    const previousTask = task;
    cacheTask({ ...task, status });
    try {
      const updatedTask = await updateTask(taskId, { status });
      cacheTask({ ...task, ...updatedTask });
      setStatusMessage('Saved');
    } catch {
      cacheTask(previousTask);
      setStatusMessage('Could not save');
    } finally {
      setSavingStatus(false);
    }
  }

  async function updateSprint(sprintId: string) {
    if (!taskId || !task) return;
    const nextSprintId = sprintId || null;
    if ((task.sprintId ?? null) === nextSprintId) return;
    const targetSprint = nextSprintId ? sprints.find((sprint: Sprint) => sprint.id === nextSprintId) ?? null : null;
    if (targetSprint && isPastSprintMoveTarget(targetSprint)) {
      setSprintMessage('Completed sprints cannot be selected');
      return;
    }

    setSavingSprint(true);
    setSprintMessage('');
    const previousTask = task;
    const nextSprint = targetSprint;
    const nextStatus = nextSprintId && task.status === 'BACKLOG' ? 'TODO' : task.status;
    const optimisticTask: Task = {
      ...task,
      status: nextStatus,
      sprintId: nextSprintId,
      sprint: nextSprint ? { id: nextSprint.id, name: nextSprint.name } : null,
    };

    cacheTask(optimisticTask);
    try {
      const updatedTask = await updateTask(taskId, {
        sprintId: nextSprintId,
        ...(nextStatus !== task.status ? { status: nextStatus } : {}),
      });
      cacheTask({ ...optimisticTask, ...updatedTask });
      setSprintMessage('Saved');
    } catch {
      cacheTask(previousTask);
      setSprintMessage('Could not save sprint');
    } finally {
      setSavingSprint(false);
    }
  }

  async function updateAssignee(assigneeId: string) {
    if (!taskId || !task) return;
    const nextAssigneeId = assigneeId || null;
    if ((task.assignee?.id ?? null) === nextAssigneeId) return;

    setSavingDetails(true);
    setDetailsMessage('');
    const previousTask = task;
    const nextAssignee = projectMembers.find((member) => member.user.id === nextAssigneeId)?.user ?? null;
    cacheTask({ ...task, assignee: nextAssignee });
    try {
      const updatedTask = await updateTask(taskId, { assigneeId: nextAssigneeId });
      cacheTask({ ...task, ...updatedTask });
      setDetailsMessage('Saved');
    } catch {
      cacheTask(previousTask);
      setDetailsMessage('Could not save assignee');
    } finally {
      setSavingDetails(false);
    }
  }

  async function updateDueDate(dueDate: string) {
    if (!taskId || !task) return;
    const nextDueDate = dateInputToTaskDate(dueDate);
    if ((toDateInputValue(task.dueDate) || null) === (dueDate || null)) return;

    setSavingDetails(true);
    setDetailsMessage('');
    const previousTask = task;
    cacheTask({ ...task, dueDate: nextDueDate });
    try {
      const updatedTask = await updateTask(taskId, { dueDate: nextDueDate });
      cacheTask({ ...task, ...updatedTask });
      setDetailsMessage('Saved');
    } catch {
      cacheTask(previousTask);
      setDetailsMessage('Could not save due date');
    } finally {
      setSavingDetails(false);
    }
  }

  function updateCriterion(id: string, patch: Partial<AcceptanceCriterion>) {
    setAcceptanceCriteriaItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    setAcceptanceCriteriaDirty(true);
    setAcceptanceCriteriaMessage('');
  }

  function deleteCriterion(id: string) {
    setAcceptanceCriteriaItems((current) => current.filter((item) => item.id !== id));
    setAcceptanceCriteriaDirty(true);
    setAcceptanceCriteriaMessage('');
  }

  function addCriterion() {
    setAcceptanceCriteriaItems((current) => [...current, createCriterion()]);
    setAcceptanceCriteriaDirty(true);
    setAcceptanceCriteriaMessage('');
  }

  async function generateCriteria() {
    if (!task || !task.description?.trim()) return;
    setGeneratingCriteria(true);
    setAcceptanceCriteriaMessage('');
    try {
      const result = await generateAcceptanceCriteria(task.title, task.description);
      const newItems = result.acceptanceCriteria.map((text) => createCriterion(text));
      setAcceptanceCriteriaItems((current) =>
        current.length > 0 ? [...current, ...newItems] : newItems
      );
      setAcceptanceCriteriaDirty(true);
    } catch {
      setAcceptanceCriteriaMessage('Could not generate criteria');
    } finally {
      setGeneratingCriteria(false);
    }
  }

  async function postComment() {
    const content = commentDraft.trim();
    if (!taskId || !task || !content) return;

    setPostingComment(true);
    setCommentMessage('');
    try {
      await createTaskComment(taskId, content);
      const refreshedTask = await getTaskById(taskId);
      cacheTask(refreshedTask);
      setCommentDraft('');
      setCommentMessage('Posted');
      await queryClient.invalidateQueries({ queryKey: queryKeys.projectActivity(task.projectId) });
    } catch {
      setCommentMessage('Could not post comment');
    } finally {
      setPostingComment(false);
    }
  }

  return (
    <Modal isOpen={Boolean(taskId)} onClose={onClose} className="task-detail-modal">
      {taskQuery.isLoading || projectQuery.isLoading || sprintsQuery.isLoading ? (
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
                        disabled={savingAcceptanceCriteria || generatingCriteria}
                        onChange={(event) => updateCriterion(item.id, { done: event.target.checked })}
                        aria-label="Mark acceptance criterion complete"
                      />
                      <textarea
                        className="acceptance-checklist-input"
                        value={item.text}
                        disabled={savingAcceptanceCriteria || generatingCriteria}
                        onChange={(event) => updateCriterion(item.id, { text: event.target.value })}
                        rows={getCriterionRows(item.text)}
                        placeholder="Criterion"
                      />
                      <button type="button" className="icon-button acceptance-delete-button" onClick={() => deleteCriterion(item.id)} disabled={savingAcceptanceCriteria || generatingCriteria} aria-label="Delete criterion">
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  ))}
                  {acceptanceCriteriaItems.length === 0 && <div className="document-link-empty">No acceptance criteria yet.</div>}
                </div>
                <div className="acceptance-actions">
                  <Button variant="secondary" onClick={addCriterion} disabled={savingAcceptanceCriteria || generatingCriteria}><Icon name="plus" size={15} /> Add criterion</Button>
                  <Button
                    variant="secondary"
                    onClick={generateCriteria}
                    loading={generatingCriteria}
                    disabled={!task.description?.trim() || savingAcceptanceCriteria}
                    title={!task.description?.trim() ? 'Add a description first to generate criteria' : undefined}
                  >
                    Generate with AI
                  </Button>
                  {acceptanceCriteriaDirty && (
                    <Button onClick={() => saveAcceptanceCriteria()} loading={savingAcceptanceCriteria} disabled={savingAcceptanceCriteria || generatingCriteria}>Save criteria</Button>
                  )}
                </div>
              </section>

              <section className="task-detail-section">
                <div className="task-detail-section-heading">
                  <h3>Comments and activity</h3>
                  <span>{postingComment ? 'Posting...' : commentMessage}</span>
                </div>
                <div className="task-detail-tabs" role="tablist" aria-label="Task discussion">
                  <button type="button" className={commentsView === 'comments' ? 'is-active' : ''} onClick={() => setCommentsView('comments')} role="tab" aria-selected={commentsView === 'comments'}>Comments ({task.comments?.length ?? 0})</button>
                  <button type="button" className={commentsView === 'activity' ? 'is-active' : ''} onClick={() => setCommentsView('activity')} role="tab" aria-selected={commentsView === 'activity'}>Activity ({task.activities?.length ?? 0})</button>
                </div>
                {commentsView === 'comments' ? (
                  <div className="task-comments-panel">
                    <div className="task-comment-list">
                      {task.comments?.length ? task.comments.map((comment) => (
                        <article className="task-comment" key={comment.id}>
                          <div className="task-comment-avatar">{comment.author.name.slice(0, 2).toUpperCase()}</div>
                          <div className="task-comment-body">
                            <div className="task-comment-meta">
                              <strong>{comment.author.name}</strong>
                              <time>{formatCommentDate(comment.createdAt)}</time>
                            </div>
                            <p>{comment.content}</p>
                          </div>
                        </article>
                      )) : (
                        <div className="document-link-empty">No comments yet.</div>
                      )}
                    </div>
                    <div className="task-comment-composer">
                      <textarea
                        className="task-description-field task-comment-input"
                        value={commentDraft}
                        onChange={(event) => {
                          setCommentDraft(event.target.value);
                          setCommentMessage('');
                        }}
                        disabled={postingComment}
                        rows={3}
                        placeholder="Write a comment..."
                      />
                      <div className="task-comment-actions">
                        <Button onClick={postComment} loading={postingComment} disabled={postingComment || !commentDraft.trim()}>Post comment</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="task-activity-list">
                    {task.activities?.length ? task.activities.map((activity) => (
                      <article className="task-activity-item" key={activity.id}>
                        <span><Icon name="activity" size={13} /></span>
                        <div>
                          <strong>{activity.action.replaceAll('_', ' ').toLowerCase()}</strong>
                          {activity.details && <p>{activity.details}</p>}
                          <time>{formatCommentDate(activity.createdAt)} by {activity.user.name}</time>
                        </div>
                      </article>
                    )) : (
                      <div className="document-link-empty">No activity yet.</div>
                    )}
                  </div>
                )}
              </section>
            </main>

            <aside className="task-detail-sidebar">
              <section className="task-detail-section">
                <div className="task-detail-section-heading">
                  <h3>Details</h3>
                  <span>{savingDetails ? 'Saving...' : detailsMessage}</span>
                </div>
                <div className="task-detail-meta">
                  <span className={`priority-badge priority-${task.priority.toLowerCase()}`}><span />{task.priority.toLowerCase()}</span>
                  <span className="due-date"><Icon name="calendar" size={14} />{formatDate(task.dueDate)}</span>
                </div>
                <Select
                  label="Status"
                  className="task-status-select"
                  value={workflowStatus(task.status)}
                  options={statusOptions}
                  onChange={(event) => updateStatus(event.target.value as TaskStatus)}
                  disabled={savingStatus}
                  helperText={savingStatus ? 'Saving status...' : statusMessage || 'Status does not move a task onto the board; assign it to a sprint for board visibility.'}
                />
                <Select
                  label="Sprint"
                  value={task.sprintId ?? ''}
                  options={sprintOptions}
                  onChange={(event) => updateSprint(event.target.value)}
                  disabled={savingSprint}
                  helperText={savingSprint ? 'Saving sprint...' : sprintMessage || 'Sprint controls where this task appears. Tasks in a sprint appear on the board.'}
                />
                <Select
                  label="Assignee"
                  value={task.assignee?.id ?? ''}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...projectMembers.map((member) => ({ value: member.user.id, label: `${member.user.name} (${member.role.toLowerCase()})` })),
                  ]}
                  onChange={(event) => updateAssignee(event.target.value)}
                  disabled={savingDetails}
                  helperText="Assign this task to a project member."
                />
                <label className="field">
                  <span className="field-label">Due date</span>
                  <input
                    className="field-control"
                    type="date"
                    value={toDateInputValue(task.dueDate)}
                    onChange={(event) => updateDueDate(event.target.value)}
                    disabled={savingDetails}
                  />
                  <span className="field-help">Leave empty to remove the due date.</span>
                </label>
                <div className="task-detail-fields">
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
