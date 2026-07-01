import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, Dispatch, DragEvent, FormEvent, ReactNode, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import Icon from './Icon';
import { Button, Select } from './ui';
import type { SelectOption } from './ui';
import type { Task } from '../services/taskService';
import { parseTaskQuery } from '../services/aiService';
import type { TaskSearchFilters } from '../services/aiService';
import { isOpenSprintMoveTarget } from '../utils/sprintOptions';

type SortKey = 'title' | 'status' | 'priority' | 'assignee' | 'project' | 'dueDate';
type SortDirection = 'asc' | 'desc';
interface SortState { key: SortKey; direction: SortDirection; }
export type BacklogMoveTarget = { type: 'backlog' } | { type: 'sprint'; sprintId: string };

interface FilterOption { value: string; label: string; }
interface AssigneeOption { id: string; name: string; avatarUrl?: string; }
interface SprintOption { id: string; name: string; isActive?: boolean; startDate?: string; endDate?: string; }

interface BacklogListProps {
  tasks: Task[];
  title?: string;
  description?: string;
  eyebrow?: string;
  headerAction?: ReactNode;
  showCardTitle?: boolean;
  showCardKicker?: boolean;
  showProject?: boolean;
  assignees?: AssigneeOption[];
  canDelete?: boolean;
  onDeleteSelected?: (taskIds: string[]) => Promise<void>;
  onMoveTasks?: (taskIds: string[], target: BacklogMoveTarget) => Promise<void>;
  onQuickAddTask?: (title: string) => Promise<void>;
  onTaskClick?: (task: Task) => void;
  projectId?: string;
  sprints?: SprintOption[];
  activeSprint?: SprintOption | null;
}

const visibleAssigneeCount = 6;

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function formatStatus(status: string) {
  return status.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function workflowStatus(status: Task['status']) {
  return status === 'BACKLOG' ? 'TODO' : status;
}

function getTaskLocation(task: Task) {
  return task.sprint?.name ?? (task.sprintId ? 'Sprint' : 'Product backlog');
}

function formatDate(date?: string | null) {
  if (!date) return 'No due date';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

function formatSprintDateRange(sprint?: SprintOption | null) {
  if (!sprint?.startDate && !sprint?.endDate) return 'No dates set';
  if (sprint.startDate && sprint.endDate) return `${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}`;
  if (sprint.startDate) return `Starts ${formatDate(sprint.startDate)}`;
  return `Ends ${formatDate(sprint.endDate)}`;
}

function hasAnyFilter(filters: TaskSearchFilters): boolean {
  return Object.values(filters).some((v) => v !== null);
}

export default function BacklogList({
  tasks,
  title = 'Work queue',
  description = 'Sort, filter, and search tasks by status, priority, assignee, and due date.',
  eyebrow = 'Backlog',
  headerAction,
  showCardTitle = true,
  showCardKicker = true,
  showProject = false,
  assignees: assigneeOptions,
  canDelete = false,
  onDeleteSelected,
  onMoveTasks,
  onQuickAddTask,
  onTaskClick,
  projectId,
  sprints = [],
  activeSprint = null,
}: BacklogListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [generalSort, setGeneralSort] = useState<SortState>({ key: 'title', direction: 'asc' });
  const [activeSprintSort, setActiveSprintSort] = useState<SortState>({ key: 'title', direction: 'asc' });
  const [backlogSort, setBacklogSort] = useState<SortState>({ key: 'title', direction: 'asc' });
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ taskIds: string[]; label: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState('backlog');
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [aiSearchOpen, setAiSearchOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeDropOver, setActiveDropOver] = useState(false);
  const [backlogDropOver, setBacklogDropOver] = useState(false);
  const [activeSprintCollapsed, setActiveSprintCollapsed] = useState(false);
  const [productBacklogCollapsed, setProductBacklogCollapsed] = useState(false);
  const advancedFiltersRef = useRef<HTMLDivElement>(null);
  const [dueBefore, setDueBefore] = useState<string | null>(null);
  const [nlInput, setNlInput] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchLabel, setAiSearchLabel] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const search = searchParams.get('q') ?? '';

  const taskAssignees = Array.from(new Map(tasks
    .map((task) => task.assignee)
    .filter((assignee): assignee is NonNullable<Task['assignee']> => Boolean(assignee))
    .map((assignee) => [assignee.name, assignee])).values());
  const assignees = assigneeOptions?.length ? assigneeOptions : taskAssignees;
  const visibleAssignees = assignees.slice(0, visibleAssigneeCount);
  const hiddenAssignees = assignees.slice(visibleAssigneeCount);
  const labels = Array.from(new Set(tasks.flatMap((task) => task.labels ?? [])));
  const statusOptions: FilterOption[] = [
    { value: '', label: 'All workflow statuses' }, { value: 'TODO', label: 'To do' }, { value: 'IN_PROGRESS', label: 'In progress' },
    { value: 'IN_REVIEW', label: 'In review' }, { value: 'DONE', label: 'Done' },
  ];
  const priorityOptions: FilterOption[] = [
    { value: '', label: 'All priorities' }, { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'URGENT', label: 'Urgent' },
  ];
  const assigneeFilterOptions = [
    { value: '', label: 'All assignees' },
    { value: '__unassigned__', label: 'Unassigned' },
    ...assignees.map((assignee) => ({ value: assignee.name, label: assignee.name })),
  ];
  const labelOptions = [{ value: '', label: 'All labels' }, ...labels.map((value) => ({ value, label: value }))];

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const query = search.toLowerCase().trim();
    const localQuery = localSearch.toLowerCase().trim();
    const searchableTask = [
      task.title,
      task.description,
      formatStatus(workflowStatus(task.status)),
      workflowStatus(task.status),
      task.priority,
      task.assignee?.name,
      getTaskLocation(task),
      ...(task.labels ?? []),
      formatDate(task.dueDate),
    ].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !query || task.title.toLowerCase().includes(query) || task.description?.toLowerCase().includes(query);
    const matchesLocalSearch = !localQuery || searchableTask.includes(localQuery);
    const matchesDueBefore = !dueBefore || (task.dueDate != null && new Date(task.dueDate) < new Date(dueBefore));
    return matchesSearch
      && matchesLocalSearch
      && matchesDueBefore
      && (!statusFilter || workflowStatus(task.status) === statusFilter)
      && (!priorityFilter || task.priority === priorityFilter)
      && (!assigneeFilter || (assigneeFilter === '__unassigned__' ? !task.assignee : task.assignee?.name === assigneeFilter))
      && (!labelFilter || task.labels?.includes(labelFilter));
  }), [tasks, search, localSearch, statusFilter, priorityFilter, assigneeFilter, labelFilter, dueBefore]);

  const sortedTasks = useMemo(() => sortTasks(filteredTasks, generalSort), [filteredTasks, generalSort]);

  const advancedFilterCount = [statusFilter, priorityFilter, labelFilter].filter(Boolean).length;
  const hasActiveFilters = Boolean(search || localSearch || statusFilter || priorityFilter || assigneeFilter || labelFilter || dueBefore || aiSearchLabel);
  const showSectionLayout = Boolean(projectId);
  const activeSprintTasks = useMemo(() => (
    activeSprint ? sortTasks(filteredTasks.filter((task) => task.sprintId === activeSprint.id), activeSprintSort) : []
  ), [activeSprint, activeSprintSort, filteredTasks]);
  const productBacklogTasks = useMemo(() => sortTasks(filteredTasks.filter((task) => !task.sprintId), backlogSort), [backlogSort, filteredTasks]);
  const visibleTasks = showSectionLayout ? [...activeSprintTasks, ...productBacklogTasks] : sortedTasks;
  const allVisibleTasksSelected = visibleTasks.length > 0 && visibleTasks.every((task) => selectedTaskIds.includes(task.id));
  const canShowActions = canDelete && Boolean(onDeleteSelected || onMoveTasks);
  const isProcessing = deleting || moving;
  const filteredProductBacklogCount = productBacklogTasks.length;
  const filteredActiveSprintCount = activeSprintTasks.length;
  const destinationOptions: SelectOption[] = useMemo(() => [
    { value: 'backlog', label: 'Product backlog' },
    ...sprints.filter((sprint) => isOpenSprintMoveTarget(sprint)).map((sprint) => ({
      value: `sprint:${sprint.id}`,
      label: `${sprint.name}${sprint.isActive ? ' (active)' : ''}`,
    })),
  ], [sprints]);

  useEffect(() => {
    if (!advancedFiltersOpen) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (!advancedFiltersRef.current?.contains(event.target as Node)) setAdvancedFiltersOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAdvancedFiltersOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [advancedFiltersOpen]);

  useEffect(() => {
    if (!openActionMenu && !moveDialog) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenActionMenu(null);
        if (!isProcessing) setMoveDialog(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProcessing, moveDialog, openActionMenu]);

  function nextSort(current: SortState, key: SortKey): SortState {
    return current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' };
  }
  function handleGeneralSort(key: SortKey) {
    setGeneralSort((current) => nextSort(current, key));
  }
  function handleActiveSprintSort(key: SortKey) {
    setActiveSprintSort((current) => nextSort(current, key));
  }
  function handleBacklogSort(key: SortKey) {
    setBacklogSort((current) => nextSort(current, key));
  }
  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) => current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]);
  }
  function toggleVisibleTaskSelection() {
    const ids = visibleTasks.map((task) => task.id);
    const allSelected = ids.every((id) => selectedTaskIds.includes(id));
    setSelectedTaskIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  }
  function clearFilters() {
    setSearchParams({});
    setLocalSearch('');
    setStatusFilter(''); setPriorityFilter(''); setAssigneeFilter(''); setLabelFilter('');
    setDueBefore(null); setAiSearchLabel(null); setAiError(null);
  }
  function clearAiFilters() {
    setSearchParams({});
    setStatusFilter(''); setPriorityFilter(''); setAssigneeFilter(''); setLabelFilter('');
    setDueBefore(null); setAiSearchLabel(null); setAiError(null);
  }
  function clearAdvancedFilters() {
    setStatusFilter('');
    setPriorityFilter('');
    setLabelFilter('');
  }
  function toggleAssigneeFilter(assigneeName: string) {
    setAssigneeFilter((current) => current === assigneeName ? '' : assigneeName);
  }
  function openMoveDialog(taskIds: string[], label: string) {
    setOpenActionMenu(null);
    setMoveTarget('backlog');
    setMoveDialog({ taskIds, label });
  }
  async function handleMoveSubmit(event: FormEvent) {
    event.preventDefault();
    if (!moveDialog) return;

    const target = parseMoveTarget(moveTarget);
    if (!onMoveTasks) return;
    setMoving(true);
    try {
      await onMoveTasks(moveDialog.taskIds, target);
      setSelectedTaskIds((current) => current.filter((id) => !moveDialog.taskIds.includes(id)));
      setMoveDialog(null);
    } finally {
      setMoving(false);
    }
  }
  async function handleDeleteTasks(taskIds: string[]) {
    if (!onDeleteSelected || !taskIds.length) return;
    const confirmed = window.confirm(`Delete ${taskIds.length === 1 ? 'this task' : `${taskIds.length} selected tasks`}? This cannot be undone.`);
    if (!confirmed) return;
    setOpenActionMenu(null);
    setDeleting(true);
    try {
      await onDeleteSelected(taskIds);
      setSelectedTaskIds((current) => current.filter((id) => !taskIds.includes(id)));
    } finally {
      setDeleting(false);
    }
  }
  function clearSelection() {
    setSelectedTaskIds([]);
    setOpenActionMenu(null);
  }

  async function handleQuickAddSubmit(event: FormEvent) {
    event.preventDefault();
    const title = quickAddTitle.trim();
    if (!title || !onQuickAddTask || quickAdding) return;

    setQuickAdding(true);
    try {
      await onQuickAddTask(title);
      setQuickAddTitle('');
      setQuickAddOpen(false);
    } finally {
      setQuickAdding(false);
    }
  }

  function canDragTask(task: Task) {
    if (!onMoveTasks) return false;
    if (!task.sprintId) return Boolean(activeSprint);
    return task.sprintId === activeSprint?.id;
  }

  function handleRowDragStart(event: DragEvent<HTMLTableRowElement>, task: Task) {
    if (!canDragTask(task)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
    setDraggedTaskId(task.id);
  }

  function handleActiveDropDragOver(event: DragEvent<HTMLDivElement>) {
    const draggedTask = tasks.find((task) => task.id === draggedTaskId);
    if (!activeSprint || !draggedTask || draggedTask.sprintId || !onMoveTasks) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setActiveDropOver(true);
    if (activeSprintCollapsed) setActiveSprintCollapsed(false);
  }

  async function handleActiveSprintDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const taskId = draggedTaskId ?? event.dataTransfer.getData('text/plain');
    const draggedTask = tasks.find((task) => task.id === taskId);
    setActiveDropOver(false);
    setDraggedTaskId(null);
    if (!taskId || !activeSprint || !onMoveTasks || draggedTask?.sprintId) return;
    await onMoveTasks([taskId], { type: 'sprint', sprintId: activeSprint.id });
  }

  function handleBacklogDropDragOver(event: DragEvent<HTMLDivElement>) {
    const draggedTask = tasks.find((task) => task.id === draggedTaskId);
    if (!draggedTask?.sprintId || !onMoveTasks) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setBacklogDropOver(true);
    if (productBacklogCollapsed) setProductBacklogCollapsed(false);
  }

  async function handleBacklogDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const taskId = draggedTaskId ?? event.dataTransfer.getData('text/plain');
    const draggedTask = tasks.find((task) => task.id === taskId);
    setBacklogDropOver(false);
    setDraggedTaskId(null);
    if (!taskId || !draggedTask?.sprintId || !onMoveTasks) return;
    await onMoveTasks([taskId], { type: 'backlog' });
  }

  async function handleNlSearch(e: FormEvent) {
    e.preventDefault();
    const query = nlInput.trim();
    if (!query || !projectId) return;

    setIsAiSearching(true);
    setAiError(null);

    try {
      const filters = await parseTaskQuery(query, projectId);

      if (!hasAnyFilter(filters)) {
        // AI found nothing useful — fall back to text search
        setSearchParams({ q: query });
        setAiSearchLabel(null);
      } else {
        // Apply AI-derived filters, replacing any manually set ones
        setStatusFilter(filters.status === 'BACKLOG' ? 'TODO' : filters.status ?? '');
        setPriorityFilter(filters.priority ?? '');
        setAssigneeFilter(filters.assigneeName ?? '');
        setLabelFilter(filters.label ?? '');
        setDueBefore(filters.dueBefore ?? null);
        if (filters.titleKeyword) {
          setSearchParams({ q: filters.titleKeyword });
        } else {
          setSearchParams({});
        }
        setAiSearchLabel(query);
      }
    } catch {
      // On error, fall back to text search silently
      setSearchParams({ q: query });
      setAiSearchLabel(null);
      setAiError('AI search unavailable — showing text results.');
    } finally {
      setIsAiSearching(false);
    }
  }

  const emptySectionMessage = localSearch ? 'No work items match your search.' : 'No work items match the active filters.';
  const totalVisibleCount = visibleTasks.length;
  const activeSprintDateRange = formatSprintDateRange(activeSprint);

  const renderTaskRows = (sectionTasks: Task[]) => (
    <>
      {sectionTasks.map((task) => <tr
        key={task.id}
        className={`${selectedTaskIds.includes(task.id) ? 'is-selected' : ''}${draggedTaskId === task.id ? ' is-dragging' : ''}`}
        draggable={canDragTask(task)}
        onDragStart={(event) => handleRowDragStart(event, task)}
        onDragEnd={() => { setDraggedTaskId(null); setActiveDropOver(false); setBacklogDropOver(false); }}
      >
        {canDelete && <td className="checkbox-cell"><input className="themed-checkbox" type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={() => toggleTaskSelection(task.id)} aria-label={`Select ${task.title}`} /></td>}
        <td data-label="Task">{onTaskClick ? <button type="button" className="task-table-link" onClick={() => onTaskClick(task)}>{task.title}</button> : <strong className="task-table-title">{task.title}</strong>}</td>
        {showProject && <td data-label="Project"><span className="project-key">{task.project?.key}</span> {task.project?.name}</td>}
        <td data-label="Status"><span className={`status-badge status-${workflowStatus(task.status).toLowerCase()}`}>{formatStatus(workflowStatus(task.status))}</span></td>
        <td data-label="Priority"><span className={`priority-badge priority-${task.priority.toLowerCase()}`}><span />{task.priority.toLowerCase()}</span></td>
        <td data-label="Assignee"><span className="table-assignee"><span className="mini-avatar">{getInitials(task.assignee?.name)}</span>{task.assignee?.name ?? 'Unassigned'}</span></td>
        <td data-label="Due date"><span className="due-date"><Icon name="calendar" size={14} />{formatDate(task.dueDate)}</span></td>
        {canShowActions && (
          <td className="backlog-actions-cell" data-label="Actions">
            <ActionMenuRoot
              id={task.id}
              openActionMenu={openActionMenu}
              setOpenActionMenu={setOpenActionMenu}
              disabled={isProcessing}
              label={`More actions for ${task.title}`}
            >
              {onMoveTasks && (
                <button type="button" role="menuitem" className="backlog-action-menu-item" disabled={isProcessing} onClick={() => openMoveDialog([task.id], task.title)}>
                  <Icon name="board" size={14} /> Move work item
                </button>
              )}
              {onDeleteSelected && (
                <button type="button" role="menuitem" className="backlog-action-menu-item is-danger" disabled={isProcessing} onClick={() => handleDeleteTasks([task.id])}>
                  <Icon name="trash" size={14} /> Delete
                </button>
              )}
            </ActionMenuRoot>
          </td>
        )}
      </tr>)}
    </>
  );

  const renderBacklogTable = (sectionTasks: Task[], emptyMessage: string, sortState: SortState, onSort: (column: SortKey) => void) => (
    <div className="backlog-table-wrap">
      <table className="backlog-table">
        <thead><tr>
          {canDelete && <th className="checkbox-cell"><input className="themed-checkbox" type="checkbox" checked={allVisibleTasksSelected} onChange={toggleVisibleTaskSelection} aria-label="Select all visible tasks" /></th>}
          <SortableHeader label="Task" column="title" sortState={sortState} onSort={onSort} />
          {showProject && <SortableHeader label="Project" column="project" sortState={sortState} onSort={onSort} />}
          <SortableHeader label="Status" column="status" sortState={sortState} onSort={onSort} />
          <SortableHeader label="Priority" column="priority" sortState={sortState} onSort={onSort} />
          <SortableHeader label="Assignee" column="assignee" sortState={sortState} onSort={onSort} />
          <SortableHeader label="Due date" column="dueDate" sortState={sortState} onSort={onSort} />
          {canShowActions && <th className="backlog-actions-heading"><span className="sr-only">Actions</span></th>}
        </tr></thead>
        <tbody>
          {renderTaskRows(sectionTasks)}
          {!sectionTasks.length && <tr><td colSpan={6 + Number(showProject) + Number(canDelete) + Number(canShowActions)} className="empty-state-cell">{emptyMessage}</td></tr>}
        </tbody>
      </table>
    </div>
  );

  const overlayRoot = typeof document === 'undefined' ? null : document.body;
  const overlays = (
    <>
      {canShowActions && selectedTaskIds.length > 0 && (
        <div className="backlog-bottom-actions" aria-label="Selected task actions">
          <span className="backlog-bottom-count">{selectedTaskIds.length} selected</span>
          {onMoveTasks && (
            <button
              type="button"
              className="backlog-bottom-action"
              disabled={isProcessing}
              onClick={() => openMoveDialog(selectedTaskIds, `${selectedTaskIds.length} work item${selectedTaskIds.length === 1 ? '' : 's'} selected`)}
            >
              <Icon name="board" size={15} /> Move work item
            </button>
          )}
          {onDeleteSelected && (
            <button type="button" className="backlog-bottom-action is-danger" disabled={isProcessing} onClick={() => handleDeleteTasks(selectedTaskIds)}>
              <Icon name="trash" size={15} /> Delete
            </button>
          )}
          <button type="button" className="icon-button backlog-bottom-clear" disabled={isProcessing} onClick={clearSelection} aria-label="Clear selection">
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      {moveDialog && (
        <div className="backlog-move-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isProcessing) setMoveDialog(null);
        }}>
          <form className="backlog-move-dialog" role="dialog" aria-modal="true" aria-labelledby="backlog-move-title" onSubmit={handleMoveSubmit}>
            <div className="backlog-move-head">
              <div>
                <p className="section-kicker">{moveDialog.label}</p>
                <h3 id="backlog-move-title">Move work item</h3>
              </div>
              <button type="button" className="icon-button backlog-move-close" disabled={isProcessing} onClick={() => setMoveDialog(null)} aria-label="Close move dialog">
                <Icon name="close" size={16} />
              </button>
            </div>
            <Select
              label="Destination"
              options={destinationOptions}
              value={moveTarget}
              disabled={isProcessing}
              onChange={(event) => setMoveTarget(event.target.value)}
            />
            <div className="backlog-move-actions">
              <Button type="button" variant="ghost" disabled={isProcessing} onClick={() => setMoveDialog(null)}>Cancel</Button>
              <Button type="submit" loading={moving} disabled={deleting}>Move</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );

  return (
    <>
    <section className="app-card backlog-card animate-enter-delay">
      <div className="backlog-toolbar">
        <div>
          {showCardKicker && <p className="section-kicker">{eyebrow}</p>}
          {showCardTitle && <><h2>{title}</h2><p>{description}</p></>}
        </div>
      </div>

      {false && projectId && (
        <form className="nl-search-form" onSubmit={handleNlSearch} role="search">
          <div className="nl-search-wrap">
            <Icon name="sparkles" size={16} className="nl-search-icon" />
            <input
              className="nl-search-input"
              type="text"
              placeholder='Search with AI — try "overdue tasks assigned to John" or "high priority bugs"'
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              disabled={isAiSearching}
              aria-label="Natural language task search"
            />
            {isAiSearching
              ? <span className="nl-search-spinner" aria-label="Searching…" />
              : <button type="submit" className="nl-search-btn" disabled={!nlInput.trim()} aria-label="Run AI search">
                  <Icon name="arrow-right" size={14} />
                </button>
            }
          </div>
          {aiError && <p className="nl-search-error">{aiError}</p>}
        </form>
      )}

      {false && onQuickAddTask && (
        <form className="backlog-quick-add" onSubmit={handleQuickAddSubmit}>
          <Icon name="plus" size={16} />
          <input
            type="text"
            value={quickAddTitle}
            onChange={(event) => setQuickAddTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuickAddTitle('');
            }}
            placeholder="New task"
            aria-label="New task title"
            disabled={quickAdding}
          />
          <Button type="submit" disabled={!quickAddTitle.trim()} loading={quickAdding}>Add</Button>
        </form>
      )}

      <div className="backlog-compact-toolbar">
        <label className="backlog-local-search" aria-label="Search backlog tasks">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={localSearch}
            onChange={(event) => {
              setLocalSearch(event.target.value);
            }}
            placeholder="Search backlog"
          />
        </label>

        <div className="assignee-quick-filters" aria-label="Filter by assignee">
          <button
            type="button"
            className={`assignee-filter-chip is-unassigned${assigneeFilter === '__unassigned__' ? ' is-active' : ''}`}
            onClick={() => toggleAssigneeFilter('__unassigned__')}
            title="Unassigned"
            aria-pressed={assigneeFilter === '__unassigned__'}
            aria-label="Filter by unassigned tasks"
          >
            <Icon name="user" size={14} />
          </button>
          {visibleAssignees.map((assignee) => (
            <button
              key={assignee.id}
              type="button"
              className={`assignee-filter-chip${assigneeFilter === assignee.name ? ' is-active' : ''}`}
              onClick={() => toggleAssigneeFilter(assignee.name)}
              title={assignee.name}
              aria-pressed={assigneeFilter === assignee.name}
              aria-label={`Filter by ${assignee.name}`}
            >
              {assignee.avatarUrl ? <img src={assignee.avatarUrl} alt="" /> : getInitials(assignee.name)}
            </button>
          ))}
          {hiddenAssignees.length > 0 && (
            <div className="assignee-overflow-root">
              <button type="button" className="assignee-filter-chip assignee-overflow-chip" title={`More assignees (${hiddenAssignees.length})`}>
                +{hiddenAssignees.length}
              </button>
              <div className="assignee-overflow-menu" aria-label="More assignees">
                {hiddenAssignees.map((assignee) => (
                  <button
                    key={assignee.id}
                    type="button"
                    className={`assignee-overflow-item${assigneeFilter === assignee.name ? ' is-active' : ''}`}
                    onClick={() => toggleAssigneeFilter(assignee.name)}
                  >
                    <span className="assignee-filter-chip">{assignee.avatarUrl ? <img src={assignee.avatarUrl} alt="" /> : getInitials(assignee.name)}</span>
                    <span>{assignee.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="advanced-filter-root" ref={advancedFiltersRef}>
          <Button variant="secondary" className="advanced-filter-button" onClick={() => setAdvancedFiltersOpen((current) => !current)} aria-expanded={advancedFiltersOpen}>
            <Icon name="settings" size={15} /> Filter
            {advancedFilterCount > 0 && <span className="filter-count-badge">{advancedFilterCount}</span>}
          </Button>
          {advancedFiltersOpen && (
            <div className="advanced-filter-popover">
              <div className="advanced-filter-head">
                <strong>Filters</strong>
                <button type="button" className="document-selection-clear" onClick={clearAdvancedFilters}>Reset</button>
              </div>
              <FilterDropdown label="Status" value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
              <FilterDropdown label="Assignee" value={assigneeFilter} options={assigneeFilterOptions} onChange={setAssigneeFilter} />
              <FilterDropdown label="Priority" value={priorityFilter} options={priorityOptions} onChange={setPriorityFilter} />
              <FilterDropdown label="Label" value={labelFilter} options={labelOptions} onChange={setLabelFilter} />
              <Button variant="primary" className="advanced-filter-close" onClick={() => setAdvancedFiltersOpen(false)}>Close</Button>
            </div>
          )}
        </div>

        {projectId && (
          <Button variant="secondary" className="backlog-toolbar-button" onClick={() => setAiSearchOpen((current) => !current)} aria-expanded={aiSearchOpen}>
            <Icon name="sparkles" size={15} /> AI search
          </Button>
        )}
        {headerAction
          ? <div className="backlog-header-action">{headerAction}</div>
          : onQuickAddTask && (
            <Button variant="primary" className="backlog-toolbar-button" onClick={() => setQuickAddOpen((current) => !current)} aria-expanded={quickAddOpen}>
              <Icon name="plus" size={15} /> Quick add
            </Button>
          )}
      </div>

      {projectId && aiSearchOpen && (
        <form className="nl-search-form" onSubmit={handleNlSearch} role="search">
          <div className="nl-search-wrap">
            <Icon name="sparkles" size={16} className="nl-search-icon" />
            <input
              className="nl-search-input"
              type="text"
              placeholder='AI search, for example "overdue tasks assigned to John"'
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              disabled={isAiSearching}
              aria-label="Natural language task search"
            />
            {isAiSearching
              ? <span className="nl-search-spinner" aria-label="Searching" />
              : <button type="submit" className="nl-search-btn" disabled={!nlInput.trim()} aria-label="Run AI search">
                  <Icon name="arrow-right" size={14} />
                </button>
            }
          </div>
          {aiError && <p className="nl-search-error">{aiError}</p>}
        </form>
      )}

      {onQuickAddTask && quickAddOpen && !headerAction && (
        <form className="backlog-quick-add" onSubmit={handleQuickAddSubmit}>
          <Icon name="plus" size={16} />
          <input
            type="text"
            value={quickAddTitle}
            onChange={(event) => setQuickAddTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuickAddTitle('');
                setQuickAddOpen(false);
              }
            }}
            placeholder="New task"
            aria-label="New task title"
            disabled={quickAdding}
          />
          <Button type="submit" disabled={!quickAddTitle.trim()} loading={quickAdding}>Add</Button>
        </form>
      )}

      {hasActiveFilters && <div className="filter-chips">
        {aiSearchLabel && <FilterChip label={`AI: ${aiSearchLabel}`} isAi onRemove={clearAiFilters} />}
        {!aiSearchLabel && search && <FilterChip label={`Search: ${search}`} onRemove={() => setSearchParams({})} />}
        {!aiSearchLabel && localSearch && <FilterChip label={`Backlog search: ${localSearch}`} onRemove={() => setLocalSearch('')} />}
        {!aiSearchLabel && statusFilter && <FilterChip label={`Status: ${formatStatus(statusFilter)}`} onRemove={() => setStatusFilter('')} />}
        {!aiSearchLabel && priorityFilter && <FilterChip label={`Priority: ${priorityFilter.toLowerCase()}`} onRemove={() => setPriorityFilter('')} />}
        {!aiSearchLabel && assigneeFilter && <FilterChip label={`Assignee: ${assigneeFilter === '__unassigned__' ? 'Unassigned' : assigneeFilter}`} onRemove={() => setAssigneeFilter('')} />}
        {!aiSearchLabel && labelFilter && <FilterChip label={`Label: ${labelFilter}`} onRemove={() => setLabelFilter('')} />}
        {!aiSearchLabel && dueBefore && <FilterChip label={`Due before: ${dueBefore}`} onRemove={() => setDueBefore(null)} />}
        <button type="button" className="clear-filters-button" onClick={clearFilters}>Clear all</button>
      </div>}

      {!tasks.length ? <div className="empty-panel"><span className="empty-icon"><Icon name="tasks" size={24} /></span><h3>No tasks here yet</h3><p>Create the first task from this project to start the workflow.</p></div> : showSectionLayout ? (
        <div className="backlog-sections">
          <section
            className={`backlog-section${activeDropOver ? ' is-drop-over' : ''}${activeSprint ? '' : ' is-disabled'}${activeSprintCollapsed ? ' is-collapsed' : ''}`}
            onDragOver={handleActiveDropDragOver}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setActiveDropOver(false);
            }}
            onDrop={handleActiveSprintDrop}
            aria-disabled={!activeSprint}
          >
            <div className="backlog-section-header">
              <button
                type="button"
                className="backlog-section-collapse"
                aria-label={`${activeSprintCollapsed ? 'Expand' : 'Collapse'} active sprint section`}
                aria-expanded={!activeSprintCollapsed}
                onClick={() => setActiveSprintCollapsed((current) => !current)}
              >
                <Icon name="chevron-down" size={15} />
              </button>
              <div>
                <h3>{activeSprint ? activeSprint.name : 'No active sprint'}</h3>
                <span>{activeSprintDateRange}</span>
              </div>
              <strong>{filteredActiveSprintCount} work item{filteredActiveSprintCount === 1 ? '' : 's'}</strong>
            </div>
            {!activeSprintCollapsed && renderBacklogTable(activeSprintTasks, activeSprint ? emptySectionMessage : 'Start a sprint to collect active work here.', activeSprintSort, handleActiveSprintSort)}
          </section>

          <section
            className={`backlog-section${backlogDropOver ? ' is-drop-over' : ''}${productBacklogCollapsed ? ' is-collapsed' : ''}`}
            onDragOver={handleBacklogDropDragOver}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setBacklogDropOver(false);
            }}
            onDrop={handleBacklogDrop}
          >
            <div className="backlog-section-header">
              <button
                type="button"
                className="backlog-section-collapse"
                aria-label={`${productBacklogCollapsed ? 'Expand' : 'Collapse'} backlog section`}
                aria-expanded={!productBacklogCollapsed}
                onClick={() => setProductBacklogCollapsed((current) => !current)}
              >
                <Icon name="chevron-down" size={15} />
              </button>
              <div>
                <h3>Backlog</h3>
                <span>Product backlog</span>
              </div>
              <strong>{filteredProductBacklogCount} work item{filteredProductBacklogCount === 1 ? '' : 's'}</strong>
            </div>
            {!productBacklogCollapsed && renderBacklogTable(productBacklogTasks, emptySectionMessage, backlogSort, handleBacklogSort)}
          </section>
        </div>
      ) : renderBacklogTable(sortedTasks, localSearch ? 'No backlog tasks match your search.' : 'No tasks match the active filters.', generalSort, handleGeneralSort)}

      {tasks.length > 0 && <footer className="backlog-footer">
        <span>Showing {totalVisibleCount} work item{totalVisibleCount === 1 ? '' : 's'}</span>
      </footer>}
    </section>
    {overlayRoot ? createPortal(overlays, overlayRoot) : overlays}
    </>
  );
}

function parseMoveTarget(value: string): BacklogMoveTarget {
  if (value.startsWith('sprint:')) return { type: 'sprint', sprintId: value.slice('sprint:'.length) };
  return { type: 'backlog' };
}

interface ActionMenuRootProps {
  id: string;
  openActionMenu: string | null;
  setOpenActionMenu: Dispatch<SetStateAction<string | null>>;
  disabled: boolean;
  label: string;
  children: ReactNode;
}

const actionMenuWidth = 210;
const actionMenuEstimatedHeight = 92;
const actionMenuGap = 6;
const actionMenuViewportPadding = 8;

function getActionMenuPosition(anchor: DOMRect): CSSProperties {
  const availableWidth = window.innerWidth;
  const availableHeight = window.innerHeight;
  const opensUp = anchor.bottom + actionMenuGap + actionMenuEstimatedHeight > availableHeight - actionMenuViewportPadding
    && anchor.top - actionMenuGap - actionMenuEstimatedHeight >= actionMenuViewportPadding;
  const rawTop = opensUp
    ? anchor.top - actionMenuGap - actionMenuEstimatedHeight
    : anchor.bottom + actionMenuGap;
  const top = Math.min(
    Math.max(rawTop, actionMenuViewportPadding),
    availableHeight - actionMenuEstimatedHeight - actionMenuViewportPadding,
  );
  const left = Math.min(
    Math.max(anchor.right - actionMenuWidth, actionMenuViewportPadding),
    availableWidth - actionMenuWidth - actionMenuViewportPadding,
  );

  return {
    position: 'fixed',
    top,
    left,
    right: 'auto',
    width: actionMenuWidth,
  };
}

function ActionMenuRoot({ id, openActionMenu, setOpenActionMenu, disabled, label, children }: ActionMenuRootProps) {
  const isOpen = openActionMenu === id;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuId = `backlog-action-menu-${id}`;

  useEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    function updatePosition() {
      const anchor = buttonRef.current?.getBoundingClientRect();
      if (anchor) setMenuStyle(getActionMenuPosition(anchor));
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpenActionMenu(null);
    }

    updatePosition();
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, setOpenActionMenu]);

  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    menuRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
  }, [isOpen, menuStyle]);

  const overlayRoot = typeof document === 'undefined' ? null : document.body;

  return (
    <div className={`backlog-action-root${isOpen ? ' is-open' : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-button backlog-row-action-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpenActionMenu((current) => (current === id ? null : id));
        }}
      >
        <Icon name="more-horizontal" size={17} />
      </button>
      {isOpen && overlayRoot && menuStyle && createPortal(
        <div
          id={menuId}
          className="backlog-action-menu"
          role="menu"
          ref={menuRef}
          style={menuStyle}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>,
        overlayRoot,
      )}
    </div>
  );
}

function getSortValue(task: Task, key: SortKey): string {
  if (key === 'assignee') return task.assignee?.name ?? '';
  if (key === 'project') return task.project?.name ?? '';
  if (key === 'status') return workflowStatus(task.status);
  if (key === 'dueDate') return task.dueDate ?? '';
  return String(task[key] ?? '');
}

function sortTasks(tasks: Task[], sortState: SortState): Task[] {
  return [...tasks].sort((a, b) => {
    const comparison = getSortValue(a, sortState.key).localeCompare(getSortValue(b, sortState.key));
    return comparison * (sortState.direction === 'asc' ? 1 : -1);
  });
}

interface FilterChipProps { label: string; onRemove: () => void; isAi?: boolean; }
function FilterChip({ label, onRemove, isAi }: FilterChipProps) {
  return (
    <span className={`filter-chip${isAi ? ' filter-chip--ai' : ''}`}>
      {isAi && <Icon name="sparkles" size={12} />}
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`}>&times;</button>
    </span>
  );
}

interface FilterDropdownProps { label: string; value: string; options: FilterOption[]; onChange: (value: string) => void; }
function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const menuId = `${label.toLowerCase()}-filter-menu`;

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event: PointerEvent) { if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false); }
    function handleKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false); }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('pointerdown', handlePointerDown); document.removeEventListener('keydown', handleKeyDown); };
  }, [open]);

  return <div className={`filter-dropdown${open ? ' is-open' : ''}`} ref={dropdownRef}>
    <button type="button" className={`filter-dropdown-trigger${value ? ' has-value' : ''}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((current) => !current)}>
      <span><span className="filter-dropdown-label">{label}</span><span className="filter-dropdown-value">{selectedOption.label}</span></span><Icon name="chevron-down" size={15} />
    </button>
    {open && <div className="filter-dropdown-menu" id={menuId} role="listbox" aria-label={`${label} filter`}>
      {options.map((option) => <button key={option.value || 'all'} type="button" className={`filter-dropdown-option${option.value === value ? ' is-selected' : ''}`} role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span>{option.value === value && <Icon name="check" size={14} />}</button>)}
    </div>}
  </div>;
}

interface SortableHeaderProps { label: string; column: SortKey; sortState: SortState; onSort: (column: SortKey) => void; }
function SortableHeader({ label, column, sortState, onSort }: SortableHeaderProps) {
  const active = sortState.key === column;
  return <th aria-sort={active ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button className={`sort-button${active ? ' is-active' : ''}`} type="button" onClick={() => onSort(column)}>{label}<Icon name="chevron-down" size={14} className={active && sortState.direction === 'asc' ? 'sort-ascending' : ''} /></button></th>;
}
