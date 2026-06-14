import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from './Icon';
import { Button } from './ui';
import type { Task } from '../services/taskService';

type SortKey = 'title' | 'status' | 'priority' | 'assignee';
type SortDirection = 'asc' | 'desc';

interface FilterOption {
  value: string;
  label: string;
}

interface BacklogTask extends Task {
  description?: string;
  labels?: string[];
  dueDate?: string;
}

const mockTasks: BacklogTask[] = [
  {
    id: 'task-1',
    title: 'Set up authentication system',
    description: 'Create login, register, and protected routes',
    priority: 'HIGH',
    status: 'TODO',
    assignee: { id: '1', name: 'Yehia', email: 'yehia@team1.com' },
    labels: ['auth', 'backend'],
    dueDate: '2026-06-20',
  },
  {
    id: 'task-2',
    title: 'Build Kanban board UI',
    description: 'Create draggable board columns',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assignee: { id: '2', name: 'Hadi', email: 'hadi@team1.com' },
    labels: ['frontend', 'tasks'],
    dueDate: '2026-06-22',
  },
  {
    id: 'task-3',
    title: 'Create backlog list view',
    description: 'Create sortable and paginated backlog table',
    priority: 'MEDIUM',
    status: 'BACKLOG',
    assignee: null,
    labels: ['frontend', 'backlog'],
    dueDate: '2026-06-25',
  },
  {
    id: 'task-4',
    title: 'Add task filtering',
    description: 'Allow filtering by assignee, label, priority, and status',
    priority: 'LOW',
    status: 'BACKLOG',
    assignee: { id: '3', name: 'Taimour', email: 'taimour@team1.com' },
    labels: ['frontend', 'filters'],
    dueDate: '2026-06-28',
  },
];

const pageSize = 3;

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function formatStatus(status: string) {
  return status.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function formatDate(date?: string) {
  if (!date) return 'No due date';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
}

export default function BacklogList() {
  const [tasks] = useState<BacklogTask[]>(mockTasks);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);

  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');

  const assignees = Array.from(new Set(tasks.map((task) => task.assignee?.name).filter((name): name is string => Boolean(name))));
  const labels = Array.from(new Set(tasks.flatMap((task) => task.labels ?? [])));

  const statusOptions: FilterOption[] = [
    { value: '', label: 'All statuses' },
    { value: 'BACKLOG', label: 'Backlog' },
    { value: 'TODO', label: 'To Do' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'IN_REVIEW', label: 'In Review' },
    { value: 'DONE', label: 'Done' },
  ];

  const priorityOptions: FilterOption[] = [
    { value: '', label: 'All priorities' },
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'URGENT', label: 'Urgent' },
  ];

  const assigneeOptions: FilterOption[] = [
    { value: '', label: 'All assignees' },
    ...assignees.map((assignee) => ({ value: assignee, label: assignee })),
  ];

  const labelOptions: FilterOption[] = [
    { value: '', label: 'All labels' },
    ...labels.map((label) => ({ value: label, label })),
  ];

  function resetPage() {
    setPage(1);
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const normalizedSearch = search.toLowerCase().trim();

      const matchesSearch =
        !normalizedSearch ||
        task.title.toLowerCase().includes(normalizedSearch) ||
        task.description?.toLowerCase().includes(normalizedSearch);

      const matchesStatus = !statusFilter || task.status === statusFilter;
      const matchesPriority = !priorityFilter || task.priority === priorityFilter;
      const matchesAssignee = !assigneeFilter || task.assignee?.name === assigneeFilter;
      const matchesLabel = !labelFilter || task.labels?.includes(labelFilter);

      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesLabel;
    });
  }, [tasks, search, statusFilter, priorityFilter, assigneeFilter, labelFilter]);

  const sortedTasks = useMemo(() => [...filteredTasks].sort((a, b) => {
    const aValue = getSortValue(a, sortKey);
    const bValue = getSortValue(b, sortKey);
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  }), [filteredTasks, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / pageSize));
  const paginatedTasks = sortedTasks.slice((page - 1) * pageSize, page * pageSize);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDirection('asc');
    }
    resetPage();
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) => current.includes(taskId)
      ? current.filter((id) => id !== taskId)
      : [...current, taskId]);
  }

  function toggleCurrentPageSelection() {
    const currentPageIds = paginatedTasks.map((task) => task.id);
    const allSelected = currentPageIds.every((id) => selectedTaskIds.includes(id));
    setSelectedTaskIds((current) => allSelected
      ? current.filter((id) => !currentPageIds.includes(id))
      : Array.from(new Set([...current, ...currentPageIds])));
  }

  function clearFilters() {
    setSearchParams({});
    setStatusFilter('');
    setPriorityFilter('');
    setAssigneeFilter('');
    setLabelFilter('');
    resetPage();
  }

  const currentPageAllSelected = paginatedTasks.length > 0
    && paginatedTasks.every((task) => selectedTaskIds.includes(task.id));

  const hasActiveFilters = Boolean(search || statusFilter || priorityFilter || assigneeFilter || labelFilter);

  return (
    <section className="app-card backlog-card animate-enter-delay">
      <div className="backlog-toolbar">
        <div>
          <p className="section-kicker">Backlog</p>
          <h2>Work queue</h2>
          <p>Sort, filter, search, and select tasks across your current workspace.</p>
        </div>

        <div className="backlog-actions" aria-label="Bulk task actions">
          <span className={`selection-count${selectedTaskIds.length ? ' is-visible' : ''}`}>
            {selectedTaskIds.length} selected
          </span>
          <Button variant="secondary" disabled={!selectedTaskIds.length}><Icon name="activity" size={15} /> Move</Button>
          <Button variant="secondary" disabled={!selectedTaskIds.length}><Icon name="user" size={15} /> Assign</Button>
          <Button variant="danger" disabled={!selectedTaskIds.length}>Delete</Button>
        </div>
      </div>

      <div className="backlog-filters">
        <FilterDropdown
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={(value) => { setStatusFilter(value); resetPage(); }}
        />

        <FilterDropdown
          label="Priority"
          value={priorityFilter}
          options={priorityOptions}
          onChange={(value) => { setPriorityFilter(value); resetPage(); }}
        />

        <FilterDropdown
          label="Assignee"
          value={assigneeFilter}
          options={assigneeOptions}
          onChange={(value) => { setAssigneeFilter(value); resetPage(); }}
        />

        <FilterDropdown
          label="Label"
          value={labelFilter}
          options={labelOptions}
          onChange={(value) => { setLabelFilter(value); resetPage(); }}
        />
      </div>

      {hasActiveFilters && (
        <div className="filter-chips">
          {search && (
            <FilterChip
              label={`Search: ${search}`}
              onRemove={() => setSearchParams({})}
            />
        )}
          {statusFilter && <FilterChip label={`Status: ${formatStatus(statusFilter)}`} onRemove={() => setStatusFilter('')} />}
          {priorityFilter && <FilterChip label={`Priority: ${priorityFilter.toLowerCase()}`} onRemove={() => setPriorityFilter('')} />}
          {assigneeFilter && <FilterChip label={`Assignee: ${assigneeFilter}`} onRemove={() => setAssigneeFilter('')} />}
          {labelFilter && <FilterChip label={`Label: ${labelFilter}`} onRemove={() => setLabelFilter('')} />}
          <button type="button" className="clear-filters-button" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      )}

      <div className="backlog-table-wrap">
        <table className="backlog-table">
          <thead>
            <tr>
              <th className="checkbox-cell">
                <input type="checkbox" checked={currentPageAllSelected} onChange={toggleCurrentPageSelection} aria-label="Select all tasks on current page" />
              </th>
              <SortableHeader label="Task" column="title" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label="Status" column="status" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label="Priority" column="priority" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label="Assignee" column="assignee" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              <th>Due date</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTasks.map((task) => {
              const selected = selectedTaskIds.includes(task.id);
              return (
                <tr key={task.id} className={selected ? 'is-selected' : ''}>
                  <td className="checkbox-cell">
                    <input type="checkbox" checked={selected} onChange={() => toggleTaskSelection(task.id)} aria-label={`Select ${task.title}`} />
                  </td>
                  <td data-label="Task"><strong className="task-table-title">{task.title}</strong></td>
                  <td data-label="Status"><span className={`status-badge status-${task.status.toLowerCase()}`}>{formatStatus(task.status)}</span></td>
                  <td data-label="Priority"><span className={`priority-badge priority-${task.priority.toLowerCase()}`}><span />{task.priority.toLowerCase()}</span></td>
                  <td data-label="Assignee">
                    <span className="table-assignee"><span className="mini-avatar">{getInitials(task.assignee?.name)}</span>{task.assignee?.name ?? 'Unassigned'}</span>
                  </td>
                  <td data-label="Due date"><span className="due-date"><Icon name="calendar" size={14} />{formatDate(task.dueDate)}</span></td>
                </tr>
              );
            })}

            {paginatedTasks.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state-cell">
                  No tasks match the active filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="backlog-footer">
        <span>Showing {sortedTasks.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, sortedTasks.length)} of {sortedTasks.length} tasks</span>
        <div className="pagination-controls">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
          <span className="page-number">{page} / {totalPages}</span>
          <Button variant="secondary" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</Button>
        </div>
      </footer>
    </section>
  );
}

function getSortValue(task: BacklogTask, key: SortKey): string {
  if (key === 'assignee') return task.assignee?.name ?? '';
  return String(task[key] ?? '');
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="filter-chip">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`}>
        &times;
      </button>
    </span>
  );
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const menuId = `${label.toLowerCase()}-filter-menu`;

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`filter-dropdown${open ? ' is-open' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        className={`filter-dropdown-trigger${value ? ' has-value' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <span className="filter-dropdown-label">{label}</span>
          <span className="filter-dropdown-value">{selectedOption?.label}</span>
        </span>
        <Icon name="chevron-down" size={15} />
      </button>

      {open && (
        <div className="filter-dropdown-menu" id={menuId} role="listbox" aria-label={`${label} filter`}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value || 'all'}
                type="button"
                className={`filter-dropdown-option${selected ? ' is-selected' : ''}`}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {selected && <Icon name="check" size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (column: SortKey) => void;
}

function SortableHeader({ label, column, sortKey, sortDirection, onSort }: SortableHeaderProps) {
  const active = sortKey === column;
  return (
    <th aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className={`sort-button${active ? ' is-active' : ''}`} type="button" onClick={() => onSort(column)}>
        {label}
        <Icon name="chevron-down" size={14} className={active && sortDirection === 'asc' ? 'sort-ascending' : ''} />
      </button>
    </th>
  );
}
