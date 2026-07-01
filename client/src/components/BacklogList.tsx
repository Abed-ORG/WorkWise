import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from './Icon';
import { Button } from './ui';
import type { Task, TaskPriority, TaskStatus } from '../services/taskService';
import { parseTaskQuery } from '../services/aiService';
import type { TaskSearchFilters } from '../services/aiService';

type SortKey = 'title' | 'status' | 'priority' | 'assignee' | 'project';
type SortDirection = 'asc' | 'desc';

interface FilterOption { value: string; label: string; }
interface AssigneeOption { id: string; name: string; avatarUrl?: string; }

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
  onMoveSelectedToBoard?: (taskIds: string[]) => Promise<void>;
  onTaskClick?: (task: Task) => void;
  onTaskUpdate?: (task: Task, changes: { title?: string; priority?: TaskPriority; assigneeId?: string | null }) => Promise<void>;
  onReorder?: (taskId: string, order: number) => Promise<void>;
  onBulkUpdate?: (taskIds: string[], changes: { status?: TaskStatus; priority?: TaskPriority; assigneeId?: string | null }) => Promise<void>;
  projectId?: string;
}

const visibleAssigneeCount = 6;

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function formatStatus(status: string) {
  return status.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function formatDate(date?: string | null) {
  if (!date) return 'No due date';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
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
  onMoveSelectedToBoard,
  onTaskClick,
  onTaskUpdate,
  onReorder,
  onBulkUpdate,
  projectId,
}: BacklogListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: 'title' | 'priority' | 'assignee' } | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    { value: '', label: 'All statuses' }, { value: 'BACKLOG', label: 'Backlog' },
    { value: 'TODO', label: 'To do' }, { value: 'IN_PROGRESS', label: 'In progress' },
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
      formatStatus(task.status),
      task.status,
      task.priority,
      task.assignee?.name,
      ...(task.labels ?? []),
      formatDate(task.dueDate),
    ].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !query || task.title.toLowerCase().includes(query) || task.description?.toLowerCase().includes(query);
    const matchesLocalSearch = !localQuery || searchableTask.includes(localQuery);
    const matchesDueBefore = !dueBefore || (task.dueDate != null && new Date(task.dueDate) < new Date(dueBefore));
    return matchesSearch
      && matchesLocalSearch
      && matchesDueBefore
      && (!statusFilter || task.status === statusFilter)
      && (!priorityFilter || task.priority === priorityFilter)
      && (!assigneeFilter || (assigneeFilter === '__unassigned__' ? !task.assignee : task.assignee?.name === assigneeFilter))
      && (!labelFilter || task.labels?.includes(labelFilter));
  }), [tasks, search, localSearch, statusFilter, priorityFilter, assigneeFilter, labelFilter, dueBefore]);

  const sortedTasks = useMemo(() => [...filteredTasks].sort((a, b) => {
    const comparison = getSortValue(a, sortKey).localeCompare(getSortValue(b, sortKey));
    return comparison * (sortDirection === 'asc' ? 1 : -1);
  }), [filteredTasks, sortKey, sortDirection]);

  const advancedFilterCount = [statusFilter, priorityFilter, labelFilter].filter(Boolean).length;
  const hasActiveFilters = Boolean(search || localSearch || statusFilter || priorityFilter || assigneeFilter || labelFilter || dueBefore || aiSearchLabel);
  const allVisibleTasksSelected = sortedTasks.length > 0 && sortedTasks.every((task) => selectedTaskIds.includes(task.id));

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

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
  }
  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) => current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]);
  }
  function toggleVisibleTaskSelection() {
    const ids = sortedTasks.map((task) => task.id);
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
  async function handleDelete() {
    if (!onDeleteSelected || !selectedTaskIds.length) return;
    const confirmed = window.confirm(`Delete ${selectedTaskIds.length} selected task${selectedTaskIds.length === 1 ? '' : 's'}? This cannot be undone.`);
    if (!confirmed) return;
    setDeleting(true);
    try { await onDeleteSelected(selectedTaskIds); setSelectedTaskIds([]); }
    finally { setDeleting(false); }
  }
  async function handleMoveToBoard() {
    if (!onMoveSelectedToBoard || !selectedTaskIds.length) return;
    setMoving(true);
    try { await onMoveSelectedToBoard(selectedTaskIds); setSelectedTaskIds([]); }
    catch { /* The page-level handler owns the user-facing error toast. */ }
    finally { setMoving(false); }
  }
  function clearSelection() {
    setSelectedTaskIds([]);
  }
  async function applyBulkUpdate() {
    if (!onBulkUpdate || !selectedTaskIds.length) return;
    const changes = {
      ...(bulkStatus && { status: bulkStatus as TaskStatus }),
      ...(bulkPriority && { priority: bulkPriority as TaskPriority }),
      ...(bulkAssignee && { assigneeId: bulkAssignee === '__unassigned__' ? null : bulkAssignee }),
    };
    if (!Object.keys(changes).length) return;
    setMoving(true);
    try { await onBulkUpdate(selectedTaskIds, changes); setSelectedTaskIds([]); setBulkStatus(''); setBulkPriority(''); setBulkAssignee(''); }
    finally { setMoving(false); }
  }

  function handleTitleClick(e: React.MouseEvent, task: Task) {
    if (e.detail === 2 && onTaskUpdate) {
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      setEditingCell({ taskId: task.id, field: 'title' });
      return;
    }
    if (e.detail === 1 && onTaskClick) {
      if (onTaskUpdate) {
        clickTimerRef.current = setTimeout(() => { clickTimerRef.current = null; onTaskClick(task); }, 250);
      } else {
        onTaskClick(task);
      }
    }
  }

  async function handleNlSearch(e: React.FormEvent) {
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
        setStatusFilter(filters.status ?? '');
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

  return (
    <section className="app-card backlog-card animate-enter-delay">
      <div className="backlog-toolbar">
        <div>
          {showCardKicker && <p className="section-kicker">{eyebrow}</p>}
          {showCardTitle && <><h2>{title}</h2><p>{description}</p></>}
        </div>
        {headerAction && <div className="backlog-header-action">{headerAction}</div>}
      </div>

      {projectId && (
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
      </div>

      {canDelete && selectedTaskIds.length > 0 && <div className="backlog-bulk-actions" aria-label="Selected task actions">
        <span className="selection-count is-visible">{selectedTaskIds.length} selected</span>
        {onMoveSelectedToBoard && <Button variant="secondary" className="bulk-action-button" loading={moving} disabled={deleting} onClick={handleMoveToBoard}>
          <Icon name="board" size={15} /> Move to board
        </Button>}
        {onDeleteSelected && <Button variant="danger" className="bulk-action-button" loading={deleting} disabled={moving} onClick={handleDelete}>
          <Icon name="trash" size={15} /> Delete selected
        </Button>}
        {onBulkUpdate && <>
          <select aria-label="Bulk status" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}><option value="">— status —</option>{statusOptions.slice(1).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <select aria-label="Bulk priority" value={bulkPriority} onChange={(event) => setBulkPriority(event.target.value)}><option value="">— priority —</option>{priorityOptions.slice(1).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <select aria-label="Bulk assignee" value={bulkAssignee} onChange={(event) => setBulkAssignee(event.target.value)}><option value="">— assignee —</option><option value="__unassigned__">Unassigned</option>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}</select>
          <Button variant="secondary" loading={moving} onClick={applyBulkUpdate}>Apply changes</Button>
        </>}
        <Button variant="ghost" className="bulk-action-button" disabled={deleting || moving} onClick={clearSelection}>Clear selection</Button>
      </div>}

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

      {!tasks.length ? <div className="empty-panel"><span className="empty-icon"><Icon name="tasks" size={24} /></span><h3>No tasks here yet</h3><p>Create the first task from this project to start the workflow.</p></div> : <div className="backlog-table-wrap">
        <table className="backlog-table">
          <thead><tr>
            {canDelete && <th className="checkbox-cell"><input className="themed-checkbox" type="checkbox" checked={allVisibleTasksSelected} onChange={toggleVisibleTaskSelection} aria-label="Select all visible tasks" /></th>}
            <SortableHeader label="Task" column="title" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
            {showProject && <SortableHeader label="Project" column="project" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />}
            <SortableHeader label="Status" column="status" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader label="Priority" column="priority" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader label="Assignee" column="assignee" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
            <th>Due date</th>
          </tr></thead>
          <tbody>
            {sortedTasks.map((task, rowIndex) => <tr key={task.id} draggable={Boolean(onReorder)} onDragStart={() => setDraggedRowId(task.id)} onDragOver={(event) => onReorder && event.preventDefault()} onDrop={() => { if (draggedRowId && draggedRowId !== task.id) void onReorder?.(draggedRowId, task.order ?? rowIndex); setDraggedRowId(null); }} className={`${selectedTaskIds.includes(task.id) ? 'is-selected ' : ''}${draggedRowId === task.id ? 'is-dragging' : ''}`}>
              {canDelete && <td className="checkbox-cell"><input className="themed-checkbox" type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={() => toggleTaskSelection(task.id)} aria-label={`Select ${task.title}`} /></td>}
              <td data-label="Task">{editingCell?.taskId === task.id && editingCell?.field === 'title' ? <input className="backlog-inline-input" defaultValue={task.title} autoFocus aria-label={`Edit title for ${task.title}`} onClick={(e) => e.stopPropagation()} onBlur={(event) => { const title = event.target.value.trim(); if (title && title !== task.title) void onTaskUpdate!(task, { title }); setEditingCell(null); }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setEditingCell(null); }} /> : (onTaskClick || onTaskUpdate) ? <button type="button" className="task-table-link" onClick={(e) => handleTitleClick(e, task)} title={onTaskUpdate ? 'Double-click to edit' : undefined}>{task.title}</button> : <strong className="task-table-title">{task.title}</strong>}</td>
              {showProject && <td data-label="Project"><span className="project-key">{task.project?.key}</span> {task.project?.name}</td>}
              <td data-label="Status"><span className={`status-badge status-${task.status.toLowerCase()}`}>{formatStatus(task.status)}</span></td>
              <td data-label="Priority">{editingCell?.taskId === task.id && editingCell?.field === 'priority' && onTaskUpdate ? <select className="backlog-inline-select" value={task.priority} autoFocus aria-label={`Edit priority for ${task.title}`} onChange={(event) => { void onTaskUpdate(task, { priority: event.target.value as TaskPriority }); setEditingCell(null); }} onBlur={() => setEditingCell(null)}>{priorityOptions.slice(1).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <span className={`priority-badge priority-${task.priority.toLowerCase()}`} onDoubleClick={() => onTaskUpdate && setEditingCell({ taskId: task.id, field: 'priority' })} style={onTaskUpdate ? { cursor: 'pointer' } : undefined}><span />{task.priority.toLowerCase()}</span>}</td>
              <td data-label="Assignee">{editingCell?.taskId === task.id && editingCell?.field === 'assignee' && onTaskUpdate ? <select className="backlog-inline-select" value={task.assignee?.id ?? ''} autoFocus aria-label={`Edit assignee for ${task.title}`} onChange={(event) => { void onTaskUpdate(task, { assigneeId: event.target.value || null }); setEditingCell(null); }} onBlur={() => setEditingCell(null)}><option value="">Unassigned</option>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}</select> : <span className="table-assignee" onDoubleClick={() => onTaskUpdate && setEditingCell({ taskId: task.id, field: 'assignee' })} style={onTaskUpdate ? { cursor: 'pointer' } : undefined}><span className="mini-avatar">{getInitials(task.assignee?.name)}</span>{task.assignee?.name ?? 'Unassigned'}</span>}</td>
              <td data-label="Due date"><span className="due-date"><Icon name="calendar" size={14} />{formatDate(task.dueDate)}</span></td>
            </tr>)}
            {!sortedTasks.length && <tr><td colSpan={6 + Number(showProject) + Number(canDelete)} className="empty-state-cell">{localSearch ? 'No backlog tasks match your search.' : 'No tasks match the active filters.'}</td></tr>}
          </tbody>
        </table>
      </div>}

      {tasks.length > 0 && <footer className="backlog-footer">
        <span>Showing {sortedTasks.length} task{sortedTasks.length === 1 ? '' : 's'}</span>
      </footer>}
    </section>
  );
}

function getSortValue(task: Task, key: SortKey): string {
  if (key === 'assignee') return task.assignee?.name ?? '';
  if (key === 'project') return task.project?.name ?? '';
  return String(task[key] ?? '');
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

interface SortableHeaderProps { label: string; column: SortKey; sortKey: SortKey; sortDirection: SortDirection; onSort: (column: SortKey) => void; }
function SortableHeader({ label, column, sortKey, sortDirection, onSort }: SortableHeaderProps) {
  const active = sortKey === column;
  return <th aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}><button className={`sort-button${active ? ' is-active' : ''}`} type="button" onClick={() => onSort(column)}>{label}<Icon name="chevron-down" size={14} className={active && sortDirection === 'asc' ? 'sort-ascending' : ''} /></button></th>;
}
