import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DocumentLinkPicker from './DocumentLinkPicker';
import Icon from './Icon';
import { Button, Modal, Select, Spinner } from './ui';
import { getProjectById, getProjectSprints } from '../services/projectService';
import {
  createTaskChild,
  createTaskComment,
  deleteTask,
  deleteTaskAttachment,
  downloadTaskAttachment,
  fetchTaskAttachmentBlob,
  getProjectStatuses,
  getTaskAttachments,
  getTaskById,
  getTaskChildren,
  updateTask,
  updateTaskDocuments,
  uploadTaskAttachment,
} from '../services/taskService';
import type { Task, TaskAttachment, TaskType } from '../services/taskService';
import { generateAcceptanceCriteria } from '../services/aiService';
import type { ProjectDocument, ProjectMember, Sprint } from '../services/projectService';
import { queryKeys, queryTimes } from '../services/queryOptions';
import RichTextEditor from './RichTextEditor';
import { getInitials } from '../utils/initials';
import { isOpenSprintMoveTarget, isPastSprintMoveTarget } from '../utils/sprintOptions';
import { storyPointsSelectOptions } from '../utils/storyPoints';
import { isDone } from '../utils/taskStatus';
import { TASK_TYPE_OPTIONS, taskTypeIcon, taskTypeLabel } from '../utils/taskType';

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

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
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

function getTextFromHtml(value?: string | null) {
  if (!value) return '';
  const container = document.createElement('div');
  container.innerHTML = value;
  return container.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
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

function formatActivityAction(action: string) {
  return action.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export default function TaskDetailModal({ taskId: propTaskId, onClose, onTaskUpdated }: TaskDetailModalProps) {
  const queryClient = useQueryClient();
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  // Internal navigation lets the modal drill into a subtask (opened "like a task", via the
  // same modal) and breadcrumb back to the parent, without the host page's selection changing.
  const [taskId, setTaskId] = useState<string | null>(propTaskId);
  const [task, setTask] = useState<Task | null>(null);
  const [linkedDocuments, setLinkedDocuments] = useState<ProjectDocument[]>([]);
  const [children, setChildren] = useState<Task[]>([]);
  const [childDraft, setChildDraft] = useState('');
  const [savingChildId, setSavingChildId] = useState<string | null>(null);
  const [childrenMessage, setChildrenMessage] = useState('');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentDragActive, setAttachmentDragActive] = useState(false);
  const [attachmentsMessage, setAttachmentsMessage] = useState('');
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [lightboxAttachmentId, setLightboxAttachmentId] = useState<string | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
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
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
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
  const statusesQuery = useQuery({
    queryKey: queryKeys.projectStatuses(taskQuery.data?.projectId ?? ''),
    queryFn: () => getProjectStatuses(taskQuery.data!.projectId),
    enabled: Boolean(taskQuery.data?.projectId),
    staleTime: queryTimes.statuses,
  });
  const statuses = useMemo(
    () => [...(statusesQuery.data ?? [])].sort((a, b) => a.order - b.order),
    [statusesQuery.data],
  );
  const statusOptions = statuses.map((status) => ({ value: status.id, label: status.name }));
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
    setTaskId(propTaskId);
    if (!propTaskId) {
      setTask(null);
      setLinkedDocuments([]);
      setChildren([]);
      setAttachments([]);
      setProjectMembers([]);
      setImagePreviews({});
      setLightboxAttachmentId(null);
    }
    setError('');
  }, [propTaskId]);

  useEffect(() => {
    if (!taskQuery.data) return;
    setTask(taskQuery.data);
    setLinkedDocuments(taskQuery.data.documents ?? []);
    setDescriptionDraft(taskQuery.data.description ?? '');
    setEditingDescription(false);
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
    if (!taskId) return;
    let active = true;
    setChildrenMessage('');
    setAttachmentsMessage('');
    setImagePreviews({});

    const createdPreviewUrls: string[] = [];

    Promise.all([
      getTaskChildren(taskId),
      getTaskAttachments(taskId),
    ])
      .then(([nextChildren, nextAttachments]) => {
        if (!active) return;
        setChildren(nextChildren);
        setAttachments(nextAttachments);

        nextAttachments
          .filter((attachment) => attachment.mimeType.startsWith('image/'))
          .forEach((attachment) => {
            fetchTaskAttachmentBlob(attachment.id)
              .then((blob) => {
                if (!active) return;
                const url = URL.createObjectURL(blob);
                createdPreviewUrls.push(url);
                setImagePreviews((current) => ({ ...current, [attachment.id]: url }));
              })
              .catch(() => undefined);
          });
      })
      .catch(() => {
        if (active) setError('Task details could not be loaded.');
      });

    return () => {
      active = false;
      createdPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [taskId]);

  useEffect(() => {
    if (projectQuery.data?.members) setProjectMembers(projectQuery.data.members);
  }, [projectQuery.data]);

  useEffect(() => {
    if (taskQuery.isError || projectQuery.isError || sprintsQuery.isError || statusesQuery.isError) setError('Task details could not be loaded.');
  }, [projectQuery.isError, sprintsQuery.isError, statusesQuery.isError, taskQuery.isError]);

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
    if (!taskId || !task) return;
    if (descriptionDraft === (task.description ?? '')) {
      setEditingDescription(false);
      return;
    }

    setSavingDescription(true);
    setDescriptionMessage('');
    const previousTask = task;
    const optimisticTask = { ...task, description: descriptionDraft };
    cacheTask(optimisticTask);
    try {
      const updatedTask = await updateTask(taskId, { description: descriptionDraft });
      cacheTask({ ...optimisticTask, ...updatedTask });
      setDescriptionMessage('Saved');
      setEditingDescription(false);
    } catch {
      cacheTask(previousTask);
      setDescriptionDraft(previousTask.description ?? '');
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

  async function updateStatus(statusId: string) {
    if (!taskId || !task || statusId === task.statusId) return;

    setSavingStatus(true);
    setStatusMessage('');
    const previousTask = task;
    const nextStatus = statuses.find((status) => status.id === statusId) ?? task.status;
    cacheTask({ ...task, statusId, status: nextStatus });
    try {
      const updatedTask = await updateTask(taskId, { statusId });
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
    // Status is left as-is optimistically — if the task is sitting on the project's backlog-default
    // status, the server auto-promotes it to the sprint-default status; cacheTask below applies the
    // authoritative response once it arrives.
    const optimisticTask: Task = {
      ...task,
      sprintId: nextSprintId,
      sprint: nextSprint ? { id: nextSprint.id, name: nextSprint.name } : null,
    };

    cacheTask(optimisticTask);
    try {
      const updatedTask = await updateTask(taskId, { sprintId: nextSprintId });
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

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!taskId || !task) return;
    if (!trimmed || trimmed === task.title) {
      setTitleDraft(task.title);
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    const previousTask = task;
    cacheTask({ ...task, title: trimmed });
    try {
      const updatedTask = await updateTask(taskId, { title: trimmed });
      cacheTask({ ...task, ...updatedTask });
      setEditingTitle(false);
    } catch {
      cacheTask(previousTask);
      setTitleDraft(previousTask.title);
    } finally {
      setSavingTitle(false);
    }
  }

  async function updateStoryPoints(value: string) {
    if (!taskId || !task) return;
    const nextValue = value ? Number(value) : null;
    if ((task.storyPoints ?? null) === nextValue) return;

    setSavingDetails(true);
    setDetailsMessage('');
    const previousTask = task;
    cacheTask({ ...task, storyPoints: nextValue });
    try {
      const updatedTask = await updateTask(taskId, { storyPoints: nextValue });
      cacheTask({ ...task, ...updatedTask });
      setDetailsMessage('Saved');
    } catch {
      cacheTask(previousTask);
      setDetailsMessage('Could not save story points');
    } finally {
      setSavingDetails(false);
    }
  }

  function cancelTitleEdit() {
    if (!task) return;
    setTitleDraft(task.title);
    setEditingTitle(false);
  }

  function cancelDescriptionEdit() {
    if (!task) return;
    setDescriptionDraft(task.description ?? '');
    setDescriptionMessage('');
    setEditingDescription(false);
  }

  async function updateType(value: Exclude<TaskType, 'SUBTASK'>) {
    if (!taskId || !task || task.type === value) return;

    setSavingDetails(true);
    setDetailsMessage('');
    const previousTask = task;
    cacheTask({ ...task, type: value });
    try {
      const updatedTask = await updateTask(taskId, { type: value });
      cacheTask({ ...task, ...updatedTask });
      setDetailsMessage('Saved');
    } catch {
      cacheTask(previousTask);
      setDetailsMessage('Could not save type');
    } finally {
      setSavingDetails(false);
    }
  }

  async function addChild() {
    const title = childDraft.trim();
    if (!taskId || !title) return;
    setSavingChildId('new');
    setChildrenMessage('');
    try {
      const child = await createTaskChild(taskId, { title });
      setChildren((current) => [...current, child]);
      setChildDraft('');
      setChildrenMessage('Added');
    } catch {
      setChildrenMessage('Could not add subtask');
    } finally {
      setSavingChildId(null);
    }
  }

  async function removeChild(child: Task) {
    setSavingChildId(child.id);
    setChildrenMessage('');
    const previous = children;
    setChildren((current) => current.filter((item) => item.id !== child.id));
    try {
      await deleteTask(child.id);
    } catch {
      setChildren(previous);
      setChildrenMessage('Could not delete subtask');
    } finally {
      setSavingChildId(null);
    }
  }

  async function uploadAttachments(files: FileList | File[]) {
    if (!taskId || files.length === 0) return;
    setUploadingAttachment(true);
    setAttachmentsMessage('');
    try {
      const uploaded = await Promise.all(Array.from(files).map((file) => uploadTaskAttachment(taskId, file)));
      setAttachments((current) => [...uploaded, ...current]);
      setAttachmentsMessage('Uploaded');
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    } catch {
      setAttachmentsMessage('Upload failed');
    } finally {
      setUploadingAttachment(false);
      setAttachmentDragActive(false);
    }
  }

  function handleAttachmentDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setAttachmentDragActive(false);
    uploadAttachments(event.dataTransfer.files);
  }

  async function removeAttachment(attachment: TaskAttachment) {
    setAttachmentsMessage('');
    const previous = attachments;
    setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    try {
      await deleteTaskAttachment(attachment.id);
    } catch {
      setAttachments(previous);
      setAttachmentsMessage('Could not delete attachment');
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

  const lightboxAttachment = lightboxAttachmentId ? attachments.find((item) => item.id === lightboxAttachmentId) : null;
  const lightboxUrl = lightboxAttachmentId ? imagePreviews[lightboxAttachmentId] : undefined;
  const hasDescription = Boolean(getTextFromHtml(task?.description));

  return (
    <>
    <Modal isOpen={Boolean(propTaskId)} onClose={onClose} className="task-detail-modal">
      {taskQuery.isLoading || projectQuery.isLoading || sprintsQuery.isLoading || statusesQuery.isLoading ? (
        <div className="task-detail-loading"><Spinner /><span>Loading task details...</span></div>
      ) : error ? (
        <div className="empty-panel"><p>{error}</p></div>
      ) : task ? (
        <div className="task-detail-stack">
          <header className="task-detail-header">
            <div>
              {task.parent ? (
                <p className="section-kicker task-breadcrumb">
                  <button type="button" className="task-breadcrumb-link" onClick={() => setTaskId(task.parent!.id)}>{task.parent.title}</button>
                  <span className="task-breadcrumb-sep"> ▸ </span>
                  <span>{task.title}</span>
                </p>
              ) : (
                <p className="section-kicker">{task.project?.key ?? 'Task'}{task.sprint ? ` / ${task.sprint.name}` : ''}</p>
              )}
              <span>{task.parent ? 'Subtask details' : 'Task details'}</span>
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close task details"><Icon name="close" size={18} /></button>
          </header>

          <div className="task-detail-content">
            <main className="task-detail-main">
              <section className="task-title-panel">
                {editingTitle ? (
                  <div className="task-title-edit-row">
                    <textarea
                      className="task-title-edit"
                      value={titleDraft}
                      autoFocus
                      rows={Math.max(1, Math.ceil(titleDraft.length / 40))}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void saveTitle();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelTitleEdit();
                        }
                      }}
                      disabled={savingTitle}
                      aria-label="Edit task title"
                    />
                    <div className="task-title-edit-actions">
                      <button type="button" className="icon-button task-title-confirm" onClick={saveTitle} disabled={savingTitle} aria-label="Save title" title="Save title">
                        <Icon name="check" size={16} />
                      </button>
                      <button type="button" className="icon-button task-title-cancel" onClick={cancelTitleEdit} disabled={savingTitle} aria-label="Cancel title edit" title="Cancel">
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <h2
                    onDoubleClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}
                    title="Double-click to edit title"
                    style={{ cursor: 'text' }}
                    className={savingTitle ? 'task-title-saving' : ''}
                  >{task.title}</h2>
                )}
                {task.labels?.length > 0 && (
                  <div className="task-label-list">{task.labels.map((label) => <span key={label}>{label}</span>)}</div>
                )}
              </section>

              <section className="task-detail-section">
                <div className="task-detail-section-heading">
                  <h3>Description</h3>
                  <span>{savingDescription ? 'Saving...' : descriptionMessage}</span>
                </div>
                {editingDescription ? (
                  <>
                    <RichTextEditor
                      value={descriptionDraft}
                      onChange={(value) => {
                        setDescriptionDraft(value);
                        setDescriptionMessage('');
                      }}
                      disabled={savingDescription}
                    />
                    <div className="task-description-actions">
                      <Button onClick={saveDescription} loading={savingDescription}>Save description</Button>
                      <Button variant="secondary" onClick={cancelDescriptionEdit} disabled={savingDescription}>Cancel</Button>
                    </div>
                  </>
                ) : hasDescription ? (
                  <div className="task-description-view-wrap">
                    <div className="task-description-view rich-text-editor-content" dangerouslySetInnerHTML={{ __html: task.description ?? '' }} />
                    <Button
                      variant="secondary"
                      className="task-description-edit-button"
                      onClick={() => {
                        setDescriptionDraft(task.description ?? '');
                        setEditingDescription(true);
                      }}
                    >
                      <Icon name="pencil" size={14} /> Edit
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="task-description-placeholder"
                    onClick={() => {
                      setDescriptionDraft('');
                      setEditingDescription(true);
                    }}
                  >
                    Add description
                  </button>
                )}
              </section>

              {!task.parentId && (
              <section className="task-detail-section">
                <div className="task-detail-section-heading">
                  <h3>Subtasks</h3>
                  <span>{savingChildId ? 'Saving...' : childrenMessage}</span>
                </div>
                <div className="subtask-list">
                  {children.map((child) => (
                    <div className="subtask-row" key={child.id}>
                      <span className="task-type-icon" title={taskTypeLabel(child.type)}><Icon name={taskTypeIcon(child.type)} size={14} /></span>
                      <button
                        type="button"
                        className={`subtask-row-open ${isDone(child) ? 'is-complete' : ''}`}
                        onClick={() => setTaskId(child.id)}
                      >
                        <span className="subtask-row-text">{child.title}</span>
                        <span className={`status-badge category-${child.status.category.toLowerCase()}`} style={child.status.color ? { borderColor: child.status.color, color: child.status.color, background: `${child.status.color}1a` } : undefined}>{child.status.name}</span>
                        {child.assignee && (
                          <span className="mini-avatar" title={child.assignee.name}>{getInitials(child.assignee.name)}</span>
                        )}
                      </button>
                      <button type="button" className="icon-button acceptance-delete-button" onClick={() => removeChild(child)} disabled={savingChildId === child.id} aria-label="Delete subtask">
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  ))}
                  {children.length === 0 && <div className="document-link-empty">No subtasks yet.</div>}
                </div>
                <div className="task-comment-composer">
                  <textarea
                    className="task-description-field task-comment-input"
                    value={childDraft}
                    onChange={(event) => {
                      setChildDraft(event.target.value);
                      setChildrenMessage('');
                    }}
                    rows={2}
                    placeholder="Add a subtask..."
                    disabled={savingChildId !== null}
                  />
                  <div className="task-comment-actions">
                    <Button onClick={addChild} loading={savingChildId === 'new'} disabled={!childDraft.trim() || savingChildId !== null}>
                      <Icon name="plus" size={15} /> Add subtask
                    </Button>
                  </div>
                </div>
              </section>
              )}

              <section className="task-detail-section">
                <div className="task-detail-section-heading">
                  <h3>Attachments</h3>
                  <span>{uploadingAttachment ? 'Uploading...' : attachmentsMessage}</span>
                </div>
                <input
                  ref={attachmentInputRef}
                  className="sr-only"
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  onChange={(event) => {
                    if (event.target.files) uploadAttachments(event.target.files);
                  }}
                />
                <div
                  className={`attachment-drop-zone${attachmentDragActive ? ' is-active' : ''}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setAttachmentDragActive(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setAttachmentDragActive(false);
                  }}
                  onDrop={handleAttachmentDrop}
                >
                  <Button variant="secondary" onClick={() => attachmentInputRef.current?.click()} disabled={uploadingAttachment}>
                    <Icon name="upload" size={15} /> Choose files
                  </Button>
                </div>
                <div className="linked-document-list task-attachment-list">
                  {attachments.map((attachment) => {
                    const isImage = attachment.mimeType.startsWith('image/');
                    const previewUrl = imagePreviews[attachment.id];
                    return (
                      <div
                        className={`linked-document-row attachment-row${isImage ? '' : ' is-clickable'}`}
                        key={attachment.id}
                        role={isImage ? undefined : 'button'}
                        tabIndex={isImage ? undefined : 0}
                        onClick={isImage ? undefined : () => downloadTaskAttachment(attachment.id)}
                        onKeyDown={isImage ? undefined : (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            downloadTaskAttachment(attachment.id);
                          }
                        }}
                      >
                        {isImage ? (
                          <span className="attachment-thumb-preview" aria-hidden="true">
                            {previewUrl ? (
                              <img className="attachment-thumb" src={previewUrl} alt="" />
                            ) : (
                              <span className="linked-document-icon"><Icon name="document" size={15} /></span>
                            )}
                          </span>
                        ) : (
                          <span className="linked-document-icon"><Icon name="document" size={15} /></span>
                        )}
                        <span className="linked-document-copy">
                          {isImage ? (
                            <button
                              type="button"
                              className="attachment-filename-link"
                              onClick={(event) => {
                                event.stopPropagation();
                                setLightboxAttachmentId(attachment.id);
                              }}
                            >
                              {attachment.fileName}
                            </button>
                          ) : (
                            <strong>{attachment.fileName}</strong>
                          )}
                          <span>{attachment.mimeType} · {formatFileSize(attachment.size)}</span>
                        </span>
                        <Button
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeAttachment(attachment);
                          }}
                        >
                          <Icon name="trash" size={14} />
                        </Button>
                      </div>
                    );
                  })}
                  {attachments.length === 0 && <div className="document-link-empty">No files attached yet.</div>}
                </div>
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
                  <h3>Comments and task history</h3>
                  <span>{postingComment ? 'Posting...' : commentMessage}</span>
                </div>
                <div className="task-detail-tabs" role="tablist" aria-label="Task discussion and history">
                  <button type="button" className={commentsView === 'comments' ? 'is-active' : ''} onClick={() => setCommentsView('comments')} role="tab" aria-selected={commentsView === 'comments'}>Comments ({task.comments?.length ?? 0})</button>
                  <button type="button" className={commentsView === 'activity' ? 'is-active' : ''} onClick={() => setCommentsView('activity')} role="tab" aria-selected={commentsView === 'activity'}>History ({task.activities?.length ?? 0})</button>
                </div>
                {commentsView === 'comments' ? (
                  <div className="task-comments-panel">
                    <div className="task-comment-list">
                      {task.comments?.length ? task.comments.map((comment) => (
                        <article className="task-comment" key={comment.id}>
                          <div className="task-comment-avatar">{getInitials(comment.author.name)}</div>
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
                    <p className="task-history-help">Status changes, comments, and task updates are recorded here in order.</p>
                    {task.activities?.length ? task.activities.map((activity) => (
                      <article className="task-activity-item" key={activity.id}>
                        <span><Icon name="activity" size={13} /></span>
                        <div>
                          <strong>{formatActivityAction(activity.action)}</strong>
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
                </div>
                {task.parentId ? (
                  <div className="field">
                    <span className="field-label">Type</span>
                    <strong className="task-type-readonly"><Icon name="subtask" size={14} /> Subtask</strong>
                  </div>
                ) : (
                  <Select
                    label="Type"
                    value={task.type}
                    options={TASK_TYPE_OPTIONS}
                    onChange={(event) => updateType(event.target.value as Exclude<TaskType, 'SUBTASK'>)}
                    disabled={savingDetails}
                    helperText="Story or bug classification for this task."
                  />
                )}
                <Select
                  label="Status"
                  className="task-status-select"
                  value={task.statusId}
                  options={statusOptions}
                  onChange={(event) => updateStatus(event.target.value)}
                  disabled={savingStatus}
                  helperText={savingStatus ? 'Saving status...' : statusMessage || 'Status does not move a task onto the board; assign it to a sprint for board visibility.'}
                />
                {task.parentId ? (
                  <div className="field">
                    <span className="field-label">Sprint</span>
                    <strong>{task.sprint?.name ?? 'Product backlog / No sprint'}</strong>
                    <span className="field-help">Subtasks inherit their parent's sprint and can't be moved independently.</span>
                  </div>
                ) : (
                  <Select
                    label="Sprint"
                    value={task.sprintId ?? ''}
                    options={sprintOptions}
                    onChange={(event) => updateSprint(event.target.value)}
                    disabled={savingSprint}
                    helperText={savingSprint ? 'Saving sprint...' : sprintMessage || 'Sprint controls where this task appears. Tasks in a sprint appear on the board.'}
                  />
                )}
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
                <Select
                  label="Story points"
                  value={task.storyPoints ? String(task.storyPoints) : ''}
                  options={storyPointsSelectOptions}
                  onChange={(event) => updateStoryPoints(event.target.value)}
                  disabled={savingDetails}
                  helperText="Fibonacci-scaled effort estimate for this task."
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
    {lightboxUrl && (
      <div className="attachment-lightbox" onClick={() => setLightboxAttachmentId(null)}>
        <button
          type="button"
          className="attachment-lightbox-close"
          onClick={() => setLightboxAttachmentId(null)}
          aria-label="Close image preview"
        >
          <Icon name="close" size={18} />
        </button>
        <img
          className="attachment-lightbox-image"
          src={lightboxUrl}
          alt={lightboxAttachment?.fileName ?? 'Attachment preview'}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    )}
    </>
  );
}
