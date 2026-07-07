import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from './Icon';
import { Button, Input, Modal, Select } from './ui';
import { useToast } from '../hooks/useToast';
import { queryKeys, queryTimes } from '../services/queryOptions';
import {
  createProjectStatus,
  deleteProjectStatus,
  getProjectStatuses,
  getProjectTasks,
  reorderProjectStatuses,
  updateProjectStatus,
} from '../services/taskService';
import type { ProjectStatus, StatusCategory } from '../services/taskService';

interface ProjectStatusSettingsProps {
  projectId: string;
}

const categoryOptions: { value: StatusCategory; label: string }[] = [
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'DONE', label: 'Done' },
];

const defaultColor = '#94a3b8';

function categoryLabel(category: StatusCategory) {
  return categoryOptions.find((option) => option.value === category)?.label ?? category;
}

function getRequestMessage(error: unknown, fallback: string) {
  return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || fallback : fallback;
}

interface StatusFormValues {
  name: string;
  category: StatusCategory;
  color: string;
}

const emptyForm: StatusFormValues = { name: '', category: 'TODO', color: '' };
const isHiddenBacklogStatus = (status: ProjectStatus) => status.isBacklogDefault && !status.isSprintDefault;

export default function ProjectStatusSettings({ projectId }: ProjectStatusSettingsProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const statusesQuery = useQuery({
    queryKey: queryKeys.projectStatuses(projectId),
    queryFn: () => getProjectStatuses(projectId),
    staleTime: queryTimes.statuses,
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.projectTasks(projectId),
    queryFn: () => getProjectTasks(projectId),
    staleTime: queryTimes.tasks,
  });

  const statuses = useMemo(
    () => [...(statusesQuery.data ?? [])].sort((a, b) => a.order - b.order),
    [statusesQuery.data],
  );
  const visibleStatuses = useMemo(() => statuses.filter((status) => !isHiddenBacklogStatus(status)), [statuses]);
  const tasks = Array.isArray(tasksQuery.data) ? tasksQuery.data : [];
  const taskCountByStatusId = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((task) => counts.set(task.statusId, (counts.get(task.statusId) ?? 0) + 1));
    return counts;
  }, [tasks]);

  // Local copy so drag-and-drop can reorder instantly; resynced whenever the server data changes.
  const [orderedStatuses, setOrderedStatuses] = useState<ProjectStatus[]>([]);
  useEffect(() => setOrderedStatuses(statuses), [statuses]);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<StatusFormValues>(emptyForm);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StatusFormValues>(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [savingDefaultId, setSavingDefaultId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProjectStatus | null>(null);
  const [reassignToId, setReassignToId] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  async function invalidateAfterChange() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStatuses(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projectTasks(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.assignedTasks }),
    ]);
  }

  async function handleAddSubmit(event: FormEvent) {
    event.preventDefault();
    const name = addForm.name.trim();
    if (!name) {
      setAddError('Status name is required.');
      return;
    }

    setAddSaving(true);
    setAddError('');
    try {
      await createProjectStatus(projectId, { name, category: addForm.category, color: addForm.color || null });
      await invalidateAfterChange();
      setAddForm(emptyForm);
      setAddOpen(false);
      toast.success('Status created.');
    } catch (error) {
      setAddError(getRequestMessage(error, 'Could not create status.'));
    } finally {
      setAddSaving(false);
    }
  }

  function startEditing(status: ProjectStatus) {
    setEditingId(status.id);
    setEditForm({ name: status.name, category: status.category, color: status.color ?? '' });
    setEditError('');
  }

  function cancelEditing() {
    setEditingId(null);
    setEditError('');
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editingId) return;
    const name = editForm.name.trim();
    if (!name) {
      setEditError('Status name is required.');
      return;
    }

    setEditSaving(true);
    setEditError('');
    try {
      await updateProjectStatus(projectId, editingId, { name, category: editForm.category, color: editForm.color || null });
      await invalidateAfterChange();
      setEditingId(null);
      toast.success('Status updated.');
    } catch (error) {
      setEditError(getRequestMessage(error, 'Could not update status.'));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleSetDefault(status: ProjectStatus, which: 'isBacklogDefault' | 'isSprintDefault') {
    setSavingDefaultId(status.id);
    try {
      await updateProjectStatus(projectId, status.id, { [which]: true });
      await invalidateAfterChange();
      toast.success(
        which === 'isBacklogDefault'
          ? `"${status.name}" is now the creation default.`
          : `"${status.name}" is now the sprint-entry default.`,
      );
    } catch (error) {
      toast.error(getRequestMessage(error, 'Could not update the default status.'));
    } finally {
      setSavingDefaultId(null);
    }
  }

  function openDeleteDialog(status: ProjectStatus) {
    setDeleteTarget(status);
    setReassignToId('');
    setDeleteError('');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const taskCount = taskCountByStatusId.get(deleteTarget.id) ?? 0;
    if (taskCount > 0 && !reassignToId) {
      setDeleteError('Choose a status to move these tasks to.');
      return;
    }

    setDeleting(true);
    setDeleteError('');
    try {
      await deleteProjectStatus(projectId, deleteTarget.id, taskCount > 0 ? reassignToId : undefined);
      await invalidateAfterChange();
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(getRequestMessage(error, 'Could not delete this status.'));
    } finally {
      setDeleting(false);
    }
  }

  function handleDragStart(event: DragEvent<HTMLElement>, id: string) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  }

  function handleDragOver(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!draggedId || draggedId === targetId) return;

    setOrderedStatuses((current) => {
      const from = current.findIndex((status) => status.id === draggedId);
      const to = current.findIndex((status) => status.id === targetId);
      if (from === -1 || to === -1 || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDraggedId(null);
    const orderedIds = orderedStatuses.map((status) => status.id);
    setReordering(true);
    try {
      await reorderProjectStatuses(projectId, orderedIds);
      await invalidateAfterChange();
    } catch {
      setOrderedStatuses(statuses);
      toast.error('Could not save the new order.');
    } finally {
      setReordering(false);
    }
  }

  const reassignOptions = deleteTarget
    ? visibleStatuses.filter((status) => status.id !== deleteTarget.id).map((status) => ({ value: status.id, label: status.name }))
    : [];
  const deleteTaskCount = deleteTarget ? taskCountByStatusId.get(deleteTarget.id) ?? 0 : 0;

  return (
    <section className="app-card settings-section">
      <div className="settings-section-head">
        <div>
          <h2>Workflow statuses</h2>
          <p className="field-help mt-1">Define the board columns tasks move through in this project. Drag rows to reorder.</p>
        </div>
        <Button onClick={() => { setAddForm(emptyForm); setAddError(''); setAddOpen((current) => !current); }}>
          <Icon name="plus" size={16} /> Add status
        </Button>
      </div>

      {addOpen && (
        <form className="invite-panel status-settings-form" onSubmit={handleAddSubmit}>
          <div className="inline-form status-settings-inline-form">
            <Input
              placeholder="Status name"
              value={addForm.name}
              onChange={(event) => setAddForm((current) => ({ ...current, name: event.target.value }))}
              autoFocus
            />
            <Select
              options={categoryOptions}
              value={addForm.category}
              onChange={(event) => setAddForm((current) => ({ ...current, category: event.target.value as StatusCategory }))}
            />
            <input
              type="color"
              className="status-color-input"
              value={addForm.color || defaultColor}
              onChange={(event) => setAddForm((current) => ({ ...current, color: event.target.value }))}
              aria-label="Status color"
            />
            <Button type="submit" loading={addSaving}>Create</Button>
          </div>
          {addError && <p className="field-help field-error">{addError}</p>}
        </form>
      )}

      {statusesQuery.isLoading ? (
        <div className="document-loading"><span>Loading statuses...</span></div>
      ) : (
        <div className="status-settings-list">
          {orderedStatuses.filter((status) => !isHiddenBacklogStatus(status)).map((status) => {
            const isEditing = editingId === status.id;

            return (
              <div
                key={status.id}
                className={`status-settings-row${draggedId === status.id ? ' is-dragging' : ''}`}
                draggable={!isEditing}
                onDragStart={(event) => handleDragStart(event, status.id)}
                onDragOver={(event) => handleDragOver(event, status.id)}
                onDrop={handleDrop}
                onDragEnd={() => setDraggedId(null)}
              >
                {isEditing ? (
                  <form className="status-settings-edit-form" onSubmit={handleEditSubmit}>
                    <Input
                      value={editForm.name}
                      onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                      autoFocus
                    />
                    <Select
                      options={categoryOptions}
                      value={editForm.category}
                      onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value as StatusCategory }))}
                    />
                    <input
                      type="color"
                      className="status-color-input"
                      value={editForm.color || defaultColor}
                      onChange={(event) => setEditForm((current) => ({ ...current, color: event.target.value }))}
                      aria-label="Status color"
                    />
                    <div className="status-settings-edit-actions">
                      <Button type="submit" loading={editSaving}>Save</Button>
                      <Button type="button" variant="ghost" onClick={cancelEditing} disabled={editSaving}>Cancel</Button>
                    </div>
                    {editError && <p className="field-help field-error">{editError}</p>}
                  </form>
                ) : (
                  <>
                    <span className="status-settings-drag-handle" aria-hidden="true"><Icon name="menu" size={14} /></span>
                    <span className="status-color-swatch" style={{ background: status.color ?? 'var(--text-subtle)' }} aria-hidden="true" />
                    <span className="status-settings-name">{status.name}</span>
                    <span className={`status-badge category-${status.category.toLowerCase()}`}>{categoryLabel(status.category)}</span>
                    <span className="status-settings-flags">
                      {status.isBacklogDefault && <span className="status-flag-badge" title="New tasks default to this status">Creation default</span>}
                      {status.isSprintDefault && <span className="status-flag-badge" title="Tasks default to this status when entering a sprint">Sprint default</span>}
                    </span>
                    <span className="status-settings-actions">
                      {!status.isSprintDefault && (
                        <Button variant="ghost" loading={savingDefaultId === status.id} onClick={() => handleSetDefault(status, 'isSprintDefault')}>
                          Set as sprint default
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => startEditing(status)} aria-label={`Edit ${status.name}`}><Icon name="pencil" size={14} /></Button>
                      <Button variant="ghost" onClick={() => openDeleteDialog(status)} aria-label={`Delete ${status.name}`}><Icon name="trash" size={14} /></Button>
                    </span>
                  </>
                )}
              </div>
            );
          })}
          {reordering && <p className="field-help">Saving new order…</p>}
        </div>
      )}

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete status">
        {deleteTarget && (
          <div className="form-stack">
            {deleteTaskCount > 0 ? (
              <>
                <p>
                  <strong>{deleteTaskCount}</strong> task{deleteTaskCount === 1 ? '' : 's'} currently use &quot;{deleteTarget.name}&quot;. Choose a status to move {deleteTaskCount === 1 ? 'it' : 'them'} to before deleting.
                </p>
                {reassignOptions.length > 0 ? (
                  <Select
                    label="Move tasks to"
                    placeholder="Choose a status…"
                    options={reassignOptions}
                    value={reassignToId}
                    onChange={(event) => setReassignToId(event.target.value)}
                  />
                ) : (
                  <div className="alert alert-error">No other status is available to receive these tasks. Create another status first.</div>
                )}
              </>
            ) : (
              <p>Delete &quot;{deleteTarget.name}&quot;? This cannot be undone.</p>
            )}
            {deleteError && <div className="alert alert-error">{deleteError}</div>}
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button
                variant="danger"
                loading={deleting}
                disabled={deleteTaskCount > 0 && (!reassignToId || reassignOptions.length === 0)}
                onClick={confirmDelete}
              >
                <Icon name="trash" size={15} /> Delete status
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
