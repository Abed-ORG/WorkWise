import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from './Icon';
import { Button } from './ui';
import type { Task } from '../services/taskService';
import { parseTaskQuery } from '../services/aiService';
import type { TaskSearchFilters } from '../services/aiService';

type SortKey = 'title' | 'status' | 'priority' | 'assignee' | 'project';
type SortDirection = 'asc' | 'desc';

interface FilterOption { value: string; label: string; }

interface BacklogListProps {
  tasks: Task[];
  title?: string;
  description?: string;
  showProject?: boolean;
  canDelete?: boolean;
  onDeleteSelected?: (taskIds: string[]) => Promise<void>;
  onTaskClick?: (task: Task) => void;
  projectId?: string;
}

const pageSize = 8;

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
  showProject = false,
  canDelete = false,
  onDeleteSelected,
  onTaskClick,
  projectId,
}: BacklogListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [dueBefore, setDueBefore] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(false);

  // NL search state
  const [nlInput, setNlInput] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchLabel, setAiSearchLabel] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const search = searchParams.get('q') ?? '';

  const assignees = Array.from(new Set(tasks.map((task) => task.assignee?.name).filter((name): name is string => Boolean(name))));
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
  const assigneeOptions = [{ value: '', label: 'All assignees' }, ...assignees.map((value) => ({ value, label: value }))];
  const labelOptions = [{ value: '', label: 'All labels' }, ...labels.map((value) => ({ value, label: value }))];

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const query = search.toLowerCase().trim();
    const matchesSearch = !query || task.title.toLowerCase().includes(query) || task.description?.toLowerCase().includes(query);
    const matchesDueBefore = !dueBefore || (task.dueDate != null && new Date(task.dueDate) < new Date(dueBefore));
    return matchesSearch
      && matchesDueBefore
      && (!statusFilter || task.status === statusFilter)
      && (!priorityFilter || task.priority === priorityFilter)
      && (!assigneeFilter || task.assignee?.name === assigneeFilter)
      && (!labelFilter || task.labels?.includes(labelFilter));
  }), [tasks, search, statusFilter, priorityFilter, assigneeFilter, labelFilter, dueBefore]);

  const sortedTasks = useMemo(() => [...filteredTasks].sort((a, b) => {
    const comparison = getSortValue(a, sortKey).localeCompare(getSortValue(b, sortKey));
    return comparison * (sortDirection === 'asc' ? 1 : -1);
  }), [filteredTasks, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedTasks = sortedTasks.slice((safePage - 1) * pageSize, safePage * pageSize);
  const hasActiveFilters = Boolean(search || statusFilter || priorityFilter || assigneeFilter || labelFilter || dueBefore || aiSearchLabel);
  const currentPageAllSelected = paginatedTasks.length > 0 && paginatedTasks.every((task) => selectedTaskIds.includes(task.id));

  function resetPage() { setPage(1); }
  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
    resetPage();
  }
  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) => current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]);
  }
  function toggleCurrentPageSelection() {
    const ids = paginatedTasks.map((task) => task.id);
    const allSelected = ids.every((id) => selectedTaskIds.includes(id));
    setSelectedTaskIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  }
  function clearFilters() {
    setSearchParams({});
    setStatusFilter(''); setPriorityFilter(''); setAssigneeFilter(''); setLabelFilter('');
    setDueBefore(null); setAiSearchLabel(null); setAiError(null);
    resetPage();
  }
  function clearAiFilters() {
    setSearchParams({});
    setStatusFilter(''); setPriorityFilter(''); setAssigneeFilter(''); setLabelFilter('');
    setDueBefore(null); setAiSearchLabel(null); setAiError(null);
    resetPage();
  }
  async function handleDelete() {
    if (!onDeleteSelected || !selectedTaskIds.length) return;
    setDeleting(true);
    try { await onDeleteSelected(selectedTaskIds); setSelectedTaskIds([]); }
    finally { setDeleting(false); }
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
      resetPage();
    } catch {
      // On error, fall back to text search silently
      setSearchParams({ q: query });
      setAiSearchLabel(null);
      setAiError('AI search unavailable — showing text results.');
      resetPage();
    } finally {
      setIsAiSearching(false);
    }
  }

  return (
    <section className="app-card backlog-card animate-enter-delay">
      <div className="backlog-toolbar">
        <div><p className="section-kicker">Backlog</p><h2>{title}</h2><p>{description}</p></div>
        {canDelete && <div className="backlog-actions" aria-label="Task actions">
          <span className={`selection-count${selectedTaskIds.length ? ' is-visible' : ''}`}>{selectedTaskIds.length} selected</span>
          <Button variant="danger" disabled={!selectedTaskIds.length} loading={deleting} onClick={handleDelete}>Delete selected</Button>
        </div>}
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

      <div className="backlog-filters">
        <FilterDropdown label="Status" value={statusFilter} options={statusOptions} onChange={(value) => { setStatusFilter(value); resetPage(); }} />
        <FilterDropdown label="Priority" value={priorityFilter} options={priorityOptions} onChange={(value) => { setPriorityFilter(value); resetPage(); }} />
        <FilterDropdown label="Assignee" value={assigneeFilter} options={assigneeOptions} onChange={(value) => { setAssigneeFilter(value); resetPage(); }} />
        <FilterDropdown label="Label" value={labelFilter} options={labelOptions} onChange={(value) => { setLabelFilter(value); resetPage(); }} />
      </div>

      {hasActiveFilters && <div className="filter-chips">
        {aiSearchLabel && <FilterChip label={`AI: ${aiSearchLabel}`} isAi onRemove={clearAiFilters} />}
        {!aiSearchLabel && search && <FilterChip label={`Search: ${search}`} onRemove={() => setSearchParams({})} />}
        {!aiSearchLabel && statusFilter && <FilterChip label={`Status: ${formatStatus(statusFilter)}`} onRemove={() => setStatusFilter('')} />}
        {!aiSearchLabel && priorityFilter && <FilterChip label={`Priority: ${priorityFilter.toLowerCase()}`} onRemove={() => setPriorityFilter('')} />}
        {!aiSearchLabel && assigneeFilter && <FilterChip label={`Assignee: ${assigneeFilter}`} onRemove={() => setAssigneeFilter('')} />}
        {!aiSearchLabel && labelFilter && <FilterChip label={`Label: ${labelFilter}`} onRemove={() => setLabelFilter('')} />}
        {!aiSearchLabel && dueBefore && <FilterChip label={`Due before: ${dueBefore}`} onRemove={() => setDueBefore(null)} />}
        <button type="button" className="clear-filters-button" onClick={clearFilters}>Clear all</button>
      </div>}

      {!tasks.length ? <div className="empty-panel"><span className="empty-icon"><Icon name="tasks" size={24} /></span><h3>No tasks here yet</h3><p>Create the first task from this project to start the workflow.</p></div> : <div className="backlog-table-wrap">
        <table className="backlog-table">
          <thead><tr>
            {canDelete && <th className="checkbox-cell"><input type="checkbox" checked={currentPageAllSelected} onChange={toggleCurrentPageSelection} aria-label="Select all tasks on this page" /></th>}
            <SortableHeader label="Task" column="title" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
            {showProject && <SortableHeader label="Project" column="project" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />}
            <SortableHeader label="Status" column="status" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader label="Priority" column="priority" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader label="Assignee" column="assignee" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
            <th>Due date</th>
          </tr></thead>
          <tbody>
            {paginatedTasks.map((task) => <tr key={task.id} className={selectedTaskIds.includes(task.id) ? 'is-selected' : ''}>
              {canDelete && <td className="checkbox-cell"><input type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={() => toggleTaskSelection(task.id)} aria-label={`Select ${task.title}`} /></td>}
              <td data-label="Task">{onTaskClick ? <button type="button" className="task-table-link" onClick={() => onTaskClick(task)}>{task.title}</button> : <strong className="task-table-title">{task.title}</strong>}</td>
              {showProject && <td data-label="Project"><span className="project-key">{task.project?.key}</span> {task.project?.name}</td>}
              <td data-label="Status"><span className={`status-badge status-${task.status.toLowerCase()}`}>{formatStatus(task.status)}</span></td>
              <td data-label="Priority"><span className={`priority-badge priority-${task.priority.toLowerCase()}`}><span />{task.priority.toLowerCase()}</span></td>
              <td data-label="Assignee"><span className="table-assignee"><span className="mini-avatar">{getInitials(task.assignee?.name)}</span>{task.assignee?.name ?? 'Unassigned'}</span></td>
              <td data-label="Due date"><span className="due-date"><Icon name="calendar" size={14} />{formatDate(task.dueDate)}</span></td>
            </tr>)}
            {!paginatedTasks.length && <tr><td colSpan={6 + Number(showProject) + Number(canDelete)} className="empty-state-cell">No tasks match the active filters.</td></tr>}
          </tbody>
        </table>
      </div>}

      {tasks.length > 0 && <footer className="backlog-footer">
        <span>Showing {sortedTasks.length ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, sortedTasks.length)} of {sortedTasks.length} tasks</span>
        <div className="pagination-controls"><Button variant="secondary" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button><span className="page-number">{safePage} / {totalPages}</span><Button variant="secondary" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</Button></div>
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
