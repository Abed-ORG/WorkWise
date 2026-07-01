import { useEffect, useMemo, useState, type DragEvent } from 'react';
import Icon from './Icon';
import { Button, Spinner } from './ui';
import { useToast } from '../hooks/useToast';
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
  if (s === 'BACKLOG') return 'Product backlog';
  return s.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}
function sprintAssignedTask(task: Task, sprintId: string): Task {
  return { ...task, sprintId, status: task.status === 'BACKLOG' ? 'TODO' : task.status };
}

export default function SprintBacklogPanel({
  sprintId,
  projectId,
  allTasks,
  onTasksChange,
}: SprintBacklogPanelProps) {
  const toast = useToast();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<SprintSuggestionResult | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<'add' | 'remove' | null>(null);
  const [backlogSelectionMode, setBacklogSelectionMode] = useState(false);
  const [sprintSelectionMode, setSprintSelectionMode] = useState(false);
  const [selectedBacklogIds, setSelectedBacklogIds] = useState<string[]>([]);
  const [selectedSprintIds, setSelectedSprintIds] = useState<string[]>([]);
  const [backlogSearch, setBacklogSearch] = useState('');
  const [sprintSearch, setSprintSearch] = useState('');
  const [dropZone, setDropZone] = useState<'backlog' | 'sprint' | null>(null);

  const sprintTasks = useMemo(() => [...allTasks.filter((t) => t.sprintId === sprintId)]
    .sort((a, b) => a.order - b.order), [allTasks, sprintId]);
  const backlogTasks = useMemo(() => [...allTasks.filter((t) => !t.sprintId)]
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)), [allTasks]);
  const filteredBacklogTasks = useMemo(() => filterTasks(backlogTasks, backlogSearch), [backlogSearch, backlogTasks]);
  const filteredSprintTasks = useMemo(() => filterTasks(sprintTasks, sprintSearch), [sprintSearch, sprintTasks]);
  const isProcessing = Boolean(busy || bulkAction || suggesting);
  const allBacklogSelected = filteredBacklogTasks.length > 0 && filteredBacklogTasks.every((task) => selectedBacklogIds.includes(task.id));
  const allSprintSelected = filteredSprintTasks.length > 0 && filteredSprintTasks.every((task) => selectedSprintIds.includes(task.id));
  const selectionModeActive = backlogSelectionMode || sprintSelectionMode;

  useEffect(() => {
    setSelectedBacklogIds((current) => current.filter((taskId) => backlogTasks.some((task) => task.id === taskId)));
    setSelectedSprintIds((current) => current.filter((taskId) => sprintTasks.some((task) => task.id === taskId)));
  }, [backlogTasks, sprintTasks]);

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

  async function moveBacklogTaskToSprint(task: Task) {
    setBusy(task.id);
    const nextOrder = sprintTasks.length > 0 ? Math.max(...sprintTasks.map((item) => item.order)) + 1 : 0;
    const optimistic = allTasks.map((t) => t.id === task.id ? { ...sprintAssignedTask(t, sprintId), order: nextOrder } : t);
    onTasksChange(optimistic);
    try {
      const updated = await moveTaskToSprint(task.id, sprintId);
      onTasksChange(allTasks.map((t) => t.id === updated.id ? { ...sprintAssignedTask(updated, sprintId), order: nextOrder } : t));
      toast.success('Task added to the sprint backlog.');
    } catch {
      onTasksChange(allTasks);
      toast.error('Task could not be added to the sprint.');
    } finally {
      setBusy(null);
    }
  }

  async function moveSprintTaskToBacklog(task: Task) {
    setBusy(task.id);
    const optimistic = allTasks.map((t) => t.id === task.id ? { ...t, sprintId: null } : t);
    onTasksChange(optimistic);
    try {
      const updated = await moveTaskToSprint(task.id, null);
      onTasksChange(allTasks.map((t) => t.id === updated.id ? updated : t));
      toast.success('Task moved back to the product backlog.');
    } catch {
      onTasksChange(allTasks);
      toast.error('Task could not be removed from the sprint.');
    } finally {
      setBusy(null);
    }
  }

  function toggleBacklogTask(taskId: string) {
    if (isProcessing || !backlogSelectionMode) return;
    setSelectedBacklogIds((current) => current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]);
  }

  function toggleSprintTask(taskId: string) {
    if (isProcessing || !sprintSelectionMode) return;
    setSelectedSprintIds((current) => current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]);
  }

  function toggleAllBacklogTasks() {
    if (isProcessing || !backlogSelectionMode) return;
    setSelectedBacklogIds((current) => (
      filteredBacklogTasks.every((task) => current.includes(task.id))
        ? current.filter((taskId) => !filteredBacklogTasks.some((task) => task.id === taskId))
        : Array.from(new Set([...current, ...filteredBacklogTasks.map((task) => task.id)]))
    ));
  }

  function toggleAllSprintTasks() {
    if (isProcessing || !sprintSelectionMode) return;
    setSelectedSprintIds((current) => (
      filteredSprintTasks.every((task) => current.includes(task.id))
        ? current.filter((taskId) => !filteredSprintTasks.some((task) => task.id === taskId))
        : Array.from(new Set([...current, ...filteredSprintTasks.map((task) => task.id)]))
    ));
  }

  function startBacklogSelection() {
    setBacklogSelectionMode(true);
    setSprintSelectionMode(false);
    setSelectedSprintIds([]);
  }

  function cancelBacklogSelection() {
    setBacklogSelectionMode(false);
    setSelectedBacklogIds([]);
  }

  function startSprintSelection() {
    setSprintSelectionMode(true);
    setBacklogSelectionMode(false);
    setSelectedBacklogIds([]);
  }

  function cancelSprintSelection() {
    setSprintSelectionMode(false);
    setSelectedSprintIds([]);
  }

  async function handleBulkAddToSprint() {
    const selectedIds = selectedBacklogIds.filter((taskId) => backlogTasks.some((task) => task.id === taskId));
    if (!selectedIds.length) return;

    setBulkAction('add');
    const previousTasks = allTasks;
    const selectedOrder = selectedIds.reduce<Record<string, number>>((orders, taskId, index) => {
      orders[taskId] = sprintTasks.length + index;
      return orders;
    }, {});
    onTasksChange(allTasks.map((task) => (
      selectedIds.includes(task.id)
        ? { ...sprintAssignedTask(task, sprintId), order: selectedOrder[task.id] ?? task.order }
        : task
    )));

    try {
      const updatedTasks = await Promise.all(selectedIds.map((taskId) => moveTaskToSprint(taskId, sprintId)));
      onTasksChange(previousTasks.map((task) => {
        const updated = updatedTasks.find((item) => item.id === task.id);
        return updated ? { ...sprintAssignedTask(updated, sprintId), order: selectedOrder[updated.id] ?? updated.order } : task;
      }));
      setSelectedBacklogIds([]);
      setBacklogSelectionMode(false);
      toast.success(`${updatedTasks.length} task${updatedTasks.length === 1 ? '' : 's'} added to the sprint.`);
    } catch {
      onTasksChange(previousTasks);
      toast.error('One or more tasks could not be added to the sprint.');
    } finally {
      setBulkAction(null);
    }
  }

  async function handleBulkRemoveFromSprint() {
    const selectedIds = selectedSprintIds.filter((taskId) => sprintTasks.some((task) => task.id === taskId));
    if (!selectedIds.length) return;

    setBulkAction('remove');
    const previousTasks = allTasks;
    onTasksChange(allTasks.map((task) => selectedIds.includes(task.id) ? { ...task, sprintId: null } : task));

    try {
      const updatedTasks = await Promise.all(selectedIds.map((taskId) => moveTaskToSprint(taskId, null)));
      onTasksChange(previousTasks.map((task) => updatedTasks.find((updated) => updated.id === task.id) ?? task));
      setSelectedSprintIds([]);
      setSprintSelectionMode(false);
      toast.success(`${updatedTasks.length} task${updatedTasks.length === 1 ? '' : 's'} removed from the sprint.`);
    } catch {
      onTasksChange(previousTasks);
      toast.error('One or more tasks could not be removed from the sprint.');
    } finally {
      setBulkAction(null);
    }
  }

  function handleDragStart(event: DragEvent<HTMLElement>, taskId: string) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);
    setDraggedId(taskId);
  }

  function handleSprintDragOver(event: DragEvent<HTMLElement>, index?: number) {
    if (selectionModeActive) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropZone('sprint');
    if (typeof index === 'number') setDropIndex(index);
    autoScrollPage(event.clientY);
  }

  function handleBacklogDragOver(event: DragEvent<HTMLElement>) {
    if (selectionModeActive) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropZone('backlog');
    autoScrollPage(event.clientY);
  }

  function clearDragState() {
    setDraggedId(null);
    setDropIndex(null);
    setDropZone(null);
  }

  async function handleSprintDrop(event: DragEvent<HTMLElement>, targetIndex = filteredSprintTasks.length) {
    event.preventDefault();
    if (isProcessing || selectionModeActive) return;
    const sourceId = draggedId ?? event.dataTransfer.getData('text/plain');
    if (!sourceId) return;
    const backlogTask = backlogTasks.find((task) => task.id === sourceId);
    if (backlogTask) {
      clearDragState();
      await moveBacklogTaskToSprint(backlogTask);
      return;
    }

    await handleSprintReorder(sourceId, targetIndex);
  }

  async function handleBacklogDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (isProcessing || selectionModeActive) return;
    const sourceId = draggedId ?? event.dataTransfer.getData('text/plain');
    const sprintTask = sprintTasks.find((task) => task.id === sourceId);
    clearDragState();
    if (!sprintTask) return;
    await moveSprintTaskToBacklog(sprintTask);
  }

  async function handleSprintReorder(taskId: string, targetIndex: number) {
    const sourceTask = sprintTasks.find((t) => t.id === taskId);
    if (!sourceTask) return;

    const targetTask = filteredSprintTasks[targetIndex];
    const resolvedTargetIndex = targetTask ? sprintTasks.findIndex((task) => task.id === targetTask.id) : targetIndex;
    const reordered = sprintTasks.filter((t) => t.id !== taskId);
    reordered.splice(Math.max(0, resolvedTargetIndex), 0, sourceTask);

    // Assign order values 0, 1, 2… — global order field, no migration needed
    const updated = reordered.map((t, i) => ({ ...t, order: i }));
    onTasksChange(allTasks.map((t) => updated.find((u) => u.id === t.id) ?? t));

    clearDragState();

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
              <p>Drag tasks into the Sprint Backlog or use Select for bulk planning.</p>
            </div>
            <div className="sprint-backlog-head-actions">
              {backlogTasks.length > 0 && (
                <Button
                  variant={backlogSelectionMode ? 'ghost' : 'secondary'}
                  className="sprint-select-toggle"
                  disabled={isProcessing}
                  onClick={backlogSelectionMode ? cancelBacklogSelection : startBacklogSelection}
                >
                  {backlogSelectionMode ? 'Cancel' : 'Select'}
                </Button>
              )}
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
            <div
              className={`sprint-backlog-empty${dropZone === 'backlog' ? ' is-drop-target' : ''}`}
              onDragOver={handleBacklogDragOver}
              onDragLeave={() => setDropZone(null)}
              onDrop={handleBacklogDrop}
            >
              <span className="sprint-backlog-empty-icon"><Icon name="check" size={20} /></span>
              <p>No tasks remain in the Product Backlog.</p>
            </div>
          ) : (
            <>
              <div className="sprint-ai-helper-row">
                <Button
                  variant="secondary"
                  className="sprint-suggest-btn"
                  disabled={suggesting}
                  onClick={handleSuggest}
                  title="Ask AI to suggest tasks for this sprint"
                >
                  {suggesting ? <Spinner size="sm" /> : <Icon name="sparkles" size={14} />}
                  {suggesting ? 'Suggesting...' : 'Suggest tasks with AI'}
                </Button>
              </div>
              <label className="sprint-task-search" aria-label="Search product backlog tasks">
                <Icon name="search" size={14} />
                <input
                  type="search"
                  value={backlogSearch}
                  onChange={(event) => setBacklogSearch(event.target.value)}
                  placeholder="Search tasks..."
                />
              </label>
              {backlogSelectionMode && (
                <label className="sprint-task-select-all">
                  <input
                    className="themed-checkbox"
                    type="checkbox"
                    checked={allBacklogSelected}
                    disabled={isProcessing}
                    onChange={toggleAllBacklogTasks}
                  />
                  <span>Select all tasks</span>
                </label>
              )}
              {backlogSelectionMode && (
                <div className="sprint-bulk-actions" aria-label="Selected product backlog task actions">
                  <span className="selection-count is-visible">{selectedBacklogIds.length} selected</span>
                  <Button variant="secondary" className="bulk-action-button" loading={bulkAction === 'add'} disabled={bulkAction === 'remove' || selectedBacklogIds.length === 0} onClick={handleBulkAddToSprint}>
                    <Icon name="tasks" size={15} /> Add selected to sprint
                  </Button>
                  <Button variant="ghost" className="bulk-action-button" disabled={isProcessing} onClick={() => setSelectedBacklogIds([])}>Clear</Button>
                </div>
              )}
              <ul
                className={`sprint-task-list sprint-task-drop-list${dropZone === 'backlog' ? ' is-drop-target' : ''}`}
                onDragOver={handleBacklogDragOver}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropZone(null);
                }}
                onDrop={handleBacklogDrop}
              >
                {filteredBacklogTasks.map((task) => (
                  <li
                    key={task.id}
                    className={`sprint-task-row${draggedId === task.id ? ' is-dragging' : ''}${selectedBacklogIds.includes(task.id) ? ' is-selected' : ''}${backlogSelectionMode ? ' is-selection-mode' : ''}`}
                    draggable={!isProcessing && !backlogSelectionMode}
                    onDragStart={(event) => handleDragStart(event, task.id)}
                    onDragEnd={clearDragState}
                  >
                    {backlogSelectionMode && (
                      <input
                        className="themed-checkbox"
                        type="checkbox"
                        checked={selectedBacklogIds.includes(task.id)}
                        disabled={isProcessing}
                        onChange={() => toggleBacklogTask(task.id)}
                        aria-label={`Select ${task.title}`}
                      />
                    )}
                    {!backlogSelectionMode && (
                      <span className="sprint-task-drag-handle" aria-hidden="true">
                        <Icon name="menu" size={14} />
                      </span>
                    )}
                    <span className={`task-priority-dot priority-${task.priority.toLowerCase()}`} />
                    <span className="sprint-task-info">
                      <span className="sprint-task-title">{task.title}</span>
                      <span className="sprint-task-meta">
                        <span className={`status-badge status-${task.status.toLowerCase()}`}>{formatStatus(task.status)}</span>
                        <span className="sprint-task-priority">{priorityLabel(task.priority)}</span>
                        {task.assignee && <span className="sprint-task-assignee">{task.assignee.name}</span>}
                      </span>
                    </span>
                  </li>
                ))}
                {filteredBacklogTasks.length === 0 && (
                  <li className="sprint-task-empty-row">No product backlog tasks match your search.</li>
                )}
              </ul>
            </>
          )}
        </div>

        {/* RIGHT — Sprint tasks (destination) */}
        <div className="app-card sprint-backlog-col">
          <div className="sprint-backlog-col-head">
            <div>
              <p className="section-kicker">Sprint backlog</p>
              <h2>In this sprint</h2>
              <p>Drag tasks to reorder them, move them back, or use Select for bulk changes.</p>
            </div>
            <div className="sprint-backlog-head-actions">
              {sprintTasks.length > 0 && (
                <Button
                  variant={sprintSelectionMode ? 'ghost' : 'secondary'}
                  className="sprint-select-toggle"
                  disabled={isProcessing}
                  onClick={sprintSelectionMode ? cancelSprintSelection : startSprintSelection}
                >
                  {sprintSelectionMode ? 'Cancel' : 'Select'}
                </Button>
              )}
              <span className="kanban-summary">
                <Icon name="tasks" size={14} />
                {sprintTasks.length}
              </span>
            </div>
          </div>

          {sprintTasks.length === 0 ? (
            <div
              className={`sprint-backlog-empty${dropZone === 'sprint' ? ' is-drop-target' : ''}`}
              onDragOver={(event) => handleSprintDragOver(event)}
              onDragLeave={() => setDropZone(null)}
              onDrop={(event) => handleSprintDrop(event)}
            >
              <span className="sprint-backlog-empty-icon"><Icon name="tasks" size={20} /></span>
              <p>Drop tasks here to start planning this sprint.</p>
            </div>
          ) : (
            <>
              <label className="sprint-task-search" aria-label="Search sprint backlog tasks">
                <Icon name="search" size={14} />
                <input
                  type="search"
                  value={sprintSearch}
                  onChange={(event) => setSprintSearch(event.target.value)}
                  placeholder="Search tasks..."
                />
              </label>
              {sprintSelectionMode && (
                <label className="sprint-task-select-all">
                  <input
                    className="themed-checkbox"
                    type="checkbox"
                    checked={allSprintSelected}
                    disabled={isProcessing}
                    onChange={toggleAllSprintTasks}
                  />
                  <span>Select all tasks</span>
                </label>
              )}
              {sprintSelectionMode && (
                <div className="sprint-bulk-actions" aria-label="Selected sprint task actions">
                  <span className="selection-count is-visible">{selectedSprintIds.length} selected</span>
                  <Button variant="secondary" className="bulk-action-button" loading={bulkAction === 'remove'} disabled={bulkAction === 'add' || selectedSprintIds.length === 0} onClick={handleBulkRemoveFromSprint}>
                    <Icon name="tasks" size={15} /> Remove selected from sprint
                  </Button>
                  <Button variant="ghost" className="bulk-action-button" disabled={isProcessing} onClick={() => setSelectedSprintIds([])}>Clear</Button>
                </div>
              )}
              <ul
                className={`sprint-task-list sprint-task-drop-list${dropZone === 'sprint' ? ' is-drop-target' : ''}`}
                onDragOver={(event) => handleSprintDragOver(event)}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    setDropIndex(null);
                    setDropZone(null);
                  }
                }}
                onDrop={(event) => handleSprintDrop(event)}
              >
                {filteredSprintTasks.map((task, index) => (
                  <li
                    key={task.id}
                    className={`sprint-task-row${draggedId === task.id ? ' is-dragging' : ''}${dropIndex === index && draggedId !== task.id ? ' is-drop-target' : ''}${selectedSprintIds.includes(task.id) ? ' is-selected' : ''}${sprintSelectionMode ? ' is-selection-mode' : ''}`}
                    draggable={!isProcessing && !sprintSelectionMode}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={clearDragState}
                    onDragOver={(e) => handleSprintDragOver(e, index)}
                    onDrop={(e) => handleSprintDrop(e, index)}
                  >
                    {sprintSelectionMode && (
                      <input
                        className="themed-checkbox"
                        type="checkbox"
                        checked={selectedSprintIds.includes(task.id)}
                        disabled={isProcessing}
                        onChange={() => toggleSprintTask(task.id)}
                        aria-label={`Select ${task.title}`}
                      />
                    )}
                    {!sprintSelectionMode && (
                      <span className="sprint-task-drag-handle" aria-hidden="true">
                        <Icon name="menu" size={14} />
                      </span>
                    )}
                    <span className={`task-priority-dot priority-${task.priority.toLowerCase()}`} />
                    <span className="sprint-task-info">
                      <span className="sprint-task-title">{task.title}</span>
                      <span className="sprint-task-meta">
                        <span className={`status-badge status-${task.status.toLowerCase()}`}>{formatStatus(task.status)}</span>
                        <span className="sprint-task-priority">{priorityLabel(task.priority)}</span>
                        {task.assignee && <span className="sprint-task-assignee">{task.assignee.name}</span>}
                      </span>
                    </span>
                  </li>
                ))}
                {filteredSprintTasks.length === 0 && (
                  <li className="sprint-task-empty-row">No sprint tasks match your search.</li>
                )}
              </ul>
            </>
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

function autoScrollPage(pointerY: number) {
  const threshold = 44;
  const maxStep = 18;
  if (pointerY < threshold) {
    const intensity = (threshold - pointerY) / threshold;
    window.scrollBy({ top: -Math.ceil(maxStep * intensity), behavior: 'auto' });
  } else if (pointerY > window.innerHeight - threshold) {
    const intensity = (pointerY - (window.innerHeight - threshold)) / threshold;
    window.scrollBy({ top: Math.ceil(maxStep * intensity), behavior: 'auto' });
  }
}

function filterTasks(tasks: Task[], search: string) {
  const query = search.toLowerCase().trim();
  if (!query) return tasks;

  return tasks.filter((task) => [
    task.title,
    formatStatus(task.status),
    task.status,
    priorityLabel(task.priority),
    task.priority,
    task.assignee?.name,
    ...(task.labels ?? []),
  ].filter(Boolean).join(' ').toLowerCase().includes(query));
}
