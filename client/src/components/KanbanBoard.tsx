import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import Icon from './Icon';
import TaskCard from './TaskCard';
import { Button } from './ui';
import type { Task, TaskStatus } from '../services/taskService';
import { updateTaskStatus } from '../services/taskService';

const columns: { status: TaskStatus; label: string }[] = [
  { status: 'TODO', label: 'To do' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'IN_REVIEW', label: 'Review' },
  { status: 'DONE', label: 'Done' },
];

interface KanbanBoardProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  onTaskClick?: (task: Task) => void;
  eyebrow?: string;
  title?: string;
  description?: string;
  headerAction?: ReactNode;
  assignees?: AssigneeOption[];
}

interface AssigneeOption { id: string; name: string; avatarUrl?: string; }
interface FilterOption { value: string; label: string; }

const visibleAssigneeCount = 5;
const unassignedFilterValue = '__unassigned__';

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function formatPriority(priority: string) {
  return priority.toLowerCase();
}

export default function KanbanBoard({
  tasks,
  onTasksChange,
  onTaskClick,
  eyebrow = 'Project',
  title = 'Project board',
  description = 'Move work across the board and keep delivery visible.',
  headerAction,
  assignees: assigneeOptions,
}: KanbanBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [assigneeFilters, setAssigneeFilters] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [openFilterSection, setOpenFilterSection] = useState<FilterSection | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const advancedFiltersRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const boardTasks = useMemo(() => tasks.filter((task) => task.status !== 'BACKLOG'), [tasks]);
  const boardTaskCount = boardTasks.length;
  const taskAssignees = Array.from(new Map(boardTasks
    .map((task) => task.assignee)
    .filter((assignee): assignee is NonNullable<Task['assignee']> => Boolean(assignee))
    .map((assignee) => [assignee.name, assignee])).values());
  const assignees = assigneeOptions?.length ? assigneeOptions : taskAssignees;
  const visibleAssignees = assignees.slice(0, visibleAssigneeCount);
  const hiddenAssignees = assignees.slice(visibleAssigneeCount);
  const labels = Array.from(new Set(boardTasks.flatMap((task) => task.labels ?? [])));
  const priorityOptions: FilterOption[] = [
    { value: '', label: 'All priorities' },
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'URGENT', label: 'Urgent' },
  ];
  const labelOptions = [{ value: '', label: 'All labels' }, ...labels.map((value) => ({ value, label: value }))];
  const assigneeSummary = getAssigneeSummary(assigneeFilters);
  const prioritySummary = priorityOptions.find((option) => option.value === priorityFilter)?.label ?? 'All priorities';
  const labelSummary = labelOptions.find((option) => option.value === labelFilter)?.label ?? 'All labels';
  const assignedTaskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    boardTasks.forEach((task) => {
      const key = task.assignee?.name ?? unassignedFilterValue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [boardTasks]);
  const filteredTasks = useMemo(() => boardTasks.filter((task) => {
    const query = localSearch.toLowerCase().trim();
    const searchableTask = [
      task.title,
      task.description,
      task.priority,
      task.assignee?.name,
      ...(task.labels ?? []),
    ].filter(Boolean).join(' ').toLowerCase();
    const assigneeName = task.assignee?.name ?? unassignedFilterValue;
    return (!query || searchableTask.includes(query))
      && (!assigneeFilters.length || assigneeFilters.includes(assigneeName))
      && (!priorityFilter || task.priority === priorityFilter)
      && (!labelFilter || task.labels?.includes(labelFilter));
  }), [assigneeFilters, boardTasks, labelFilter, localSearch, priorityFilter]);
  const advancedFilterCount = assigneeFilters.length + [priorityFilter, labelFilter].filter(Boolean).length;
  const hasActiveFilters = Boolean(localSearch || assigneeFilters.length || priorityFilter || labelFilter);

  useEffect(() => {
    if (!advancedFiltersOpen && !overflowOpen) return undefined;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (advancedFiltersOpen && !advancedFiltersRef.current?.contains(target)) setAdvancedFiltersOpen(false);
      if (overflowOpen && !overflowRef.current?.contains(target)) setOverflowOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAdvancedFiltersOpen(false);
        setOverflowOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [advancedFiltersOpen, overflowOpen]);

  const handleDragStart = (event: DragEvent<HTMLElement>, taskId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
    setSaveError(false);
  };

  const handleDrop = async (status: TaskStatus) => {
    if (!draggedTaskId) return;
    const taskId = draggedTaskId;
    const previousTasks = tasks;
    const currentTask = tasks.find((task) => task.id === taskId);

    setDropTarget(null);
    if (!currentTask || currentTask.status === status) {
      setDraggedTaskId(null);
      return;
    }

    onTasksChange(tasks.map((task) => task.id === taskId ? { ...task, status } : task));

    try {
      await updateTaskStatus(taskId, status);
    } catch {
      onTasksChange(previousTasks);
      setSaveError(true);
    } finally {
      setDraggedTaskId(null);
    }
  };

  function getAssigneeTitle(name: string) {
    const count = assignedTaskCounts.get(name) ?? 0;
    return `${name === unassignedFilterValue ? 'Unassigned' : name}\n${count} assigned task${count === 1 ? '' : 's'}`;
  }

  function toggleAssigneeFilter(assigneeName: string) {
    setAssigneeFilters((current) => (
      current.includes(assigneeName)
        ? current.filter((name) => name !== assigneeName)
        : [...current, assigneeName]
    ));
  }

  function clearFilters() {
    setLocalSearch('');
    setAssigneeFilters([]);
    setPriorityFilter('');
    setLabelFilter('');
  }

  function clearAdvancedFilters() {
    setAssigneeFilters([]);
    setPriorityFilter('');
    setLabelFilter('');
    setOpenFilterSection(null);
  }

  return (
    <div className="kanban-shell app-card">
      <div className="backlog-toolbar kanban-heading">
        <div>
          <p className="section-kicker">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="kanban-header-actions">
          {headerAction && <div className="backlog-header-action">{headerAction}</div>}
          <span className="kanban-summary"><Icon name="activity" size={15} /> {filteredTasks.length}{filteredTasks.length !== boardTaskCount ? ` of ${boardTaskCount}` : ''} task{filteredTasks.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {saveError && <div className="board-alert" role="alert">The status could not be saved. The task was returned to its previous column.</div>}

      <div className="backlog-compact-toolbar">
        <label className="backlog-local-search" aria-label="Search board tasks">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={localSearch}
            onChange={(event) => setLocalSearch(event.target.value)}
            placeholder="Search board..."
          />
        </label>

        <div className="assignee-quick-filters" aria-label="Filter by assignee">
          <button
            type="button"
            className={`assignee-filter-chip is-unassigned${assigneeFilters.includes(unassignedFilterValue) ? ' is-active' : ''}`}
            onClick={() => toggleAssigneeFilter(unassignedFilterValue)}
            title={getAssigneeTitle(unassignedFilterValue)}
            aria-pressed={assigneeFilters.includes(unassignedFilterValue)}
            aria-label="Filter by unassigned tasks"
          >
            <Icon name="user" size={14} />
          </button>
          {visibleAssignees.map((assignee) => (
            <button
              key={assignee.id}
              type="button"
              className={`assignee-filter-chip${assigneeFilters.includes(assignee.name) ? ' is-active' : ''}`}
              onClick={() => toggleAssigneeFilter(assignee.name)}
              title={getAssigneeTitle(assignee.name)}
              aria-pressed={assigneeFilters.includes(assignee.name)}
              aria-label={`Filter by ${assignee.name}`}
            >
              {assignee.avatarUrl ? <img src={assignee.avatarUrl} alt="" /> : getInitials(assignee.name)}
            </button>
          ))}
          {hiddenAssignees.length > 0 && (
            <div className={`assignee-overflow-root${overflowOpen ? ' is-open' : ''}`} ref={overflowRef}>
              <button
                type="button"
                className="assignee-filter-chip assignee-overflow-chip"
                title={`More assignees (${hiddenAssignees.length})`}
                aria-expanded={overflowOpen}
                onClick={() => setOverflowOpen((current) => !current)}
              >
                +{hiddenAssignees.length}
              </button>
              <div className="assignee-overflow-menu" aria-label="More assignees">
                {hiddenAssignees.map((assignee) => (
                  <button
                    key={assignee.id}
                    type="button"
                    className={`assignee-overflow-item${assigneeFilters.includes(assignee.name) ? ' is-active' : ''}`}
                    onClick={() => toggleAssigneeFilter(assignee.name)}
                    title={getAssigneeTitle(assignee.name)}
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
              <CollapsibleFilterSection
                label="Assignee"
                summary={assigneeSummary}
                open={openFilterSection === 'assignee'}
                active={assigneeFilters.length > 0}
                onToggle={() => setOpenFilterSection((current) => current === 'assignee' ? null : 'assignee')}
              >
                <AssigneeFilterList assignees={assignees} selected={assigneeFilters} onToggle={toggleAssigneeFilter} />
              </CollapsibleFilterSection>
              <CollapsibleFilterSection
                label="Priority"
                summary={prioritySummary}
                open={openFilterSection === 'priority'}
                active={Boolean(priorityFilter)}
                onToggle={() => setOpenFilterSection((current) => current === 'priority' ? null : 'priority')}
              >
                <OptionFilterList options={priorityOptions} value={priorityFilter} onChange={(value) => { setPriorityFilter(value); setOpenFilterSection(null); }} />
              </CollapsibleFilterSection>
              <CollapsibleFilterSection
                label="Label"
                summary={labelSummary}
                open={openFilterSection === 'label'}
                active={Boolean(labelFilter)}
                onToggle={() => setOpenFilterSection((current) => current === 'label' ? null : 'label')}
              >
                <OptionFilterList options={labelOptions} value={labelFilter} onChange={(value) => { setLabelFilter(value); setOpenFilterSection(null); }} />
              </CollapsibleFilterSection>
              <Button variant="primary" className="advanced-filter-close" onClick={() => setAdvancedFiltersOpen(false)}>Close</Button>
            </div>
          )}
        </div>
      </div>

      {hasActiveFilters && <div className="filter-chips">
        {localSearch && <FilterChip label={`Board search: ${localSearch}`} onRemove={() => setLocalSearch('')} />}
        {assigneeFilters.map((assignee) => <FilterChip key={assignee} label={`Assignee: ${assignee === unassignedFilterValue ? 'Unassigned' : assignee}`} onRemove={() => toggleAssigneeFilter(assignee)} />)}
        {priorityFilter && <FilterChip label={`Priority: ${formatPriority(priorityFilter)}`} onRemove={() => setPriorityFilter('')} />}
        {labelFilter && <FilterChip label={`Label: ${labelFilter}`} onRemove={() => setLabelFilter('')} />}
        <button type="button" className="clear-filters-button" onClick={clearFilters}>Clear all</button>
      </div>}

      <div className="kanban-board" aria-label="Project task status board">
        {columns.map((column, index) => {
          const columnTasks = filteredTasks.filter((task) => task.status === column.status);
          const isTarget = dropTarget === column.status && draggedTaskId !== null;

          return (
            <section
              key={column.status}
              className={`kanban-column${isTarget ? ' is-drop-target' : ''}`}
              style={{ '--column-index': index } as CSSProperties}
              onDragEnter={() => setDropTarget(column.status)}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null); }}
              onDrop={() => handleDrop(column.status)}
            >
              <header className="kanban-column-head">
                <span className={`status-marker status-${column.status.toLowerCase()}`} />
                <h3>{column.label}</h3>
                <span className="kanban-count">{columnTasks.length}</span>
              </header>
              <div className="kanban-task-stack">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    dragging={draggedTaskId === task.id}
                    onClick={onTaskClick ? () => onTaskClick(task) : undefined}
                    onDragStart={(event) => handleDragStart(event, task.id)}
                    onDragEnd={() => { setDraggedTaskId(null); setDropTarget(null); }}
                  />
                ))}
                {columnTasks.length === 0 && <div className="kanban-empty"><span />Drop tasks here</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

type FilterSection = 'assignee' | 'priority' | 'label';

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <span className="filter-chip">{label}<button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`}>&times;</button></span>;
}

function getAssigneeSummary(selected: string[]) {
  if (!selected.length) return 'All assignees';
  if (selected.length > 1) return `${selected.length} assignees`;
  return selected[0] === unassignedFilterValue ? 'Unassigned' : selected[0];
}

function CollapsibleFilterSection({
  label,
  summary,
  open,
  active,
  onToggle,
  children,
}: {
  label: string;
  summary: string;
  open: boolean;
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return <div className={`board-filter-section${open ? ' is-open' : ''}`}>
    <button type="button" className={`board-filter-trigger${active ? ' has-value' : ''}`} aria-expanded={open} onClick={onToggle}>
      <span>
        <span className="filter-dropdown-label">{label}</span>
        <span className="filter-dropdown-value">{summary}</span>
      </span>
      <Icon name="chevron-down" size={15} />
    </button>
    {open && <div className="board-filter-panel">{children}</div>}
  </div>;
}

function AssigneeFilterList({ assignees, selected, onToggle }: { assignees: AssigneeOption[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div className="board-assignee-filter" aria-label="Assignee filter options">
    <button
      type="button"
      className={`board-assignee-option${selected.includes(unassignedFilterValue) ? ' is-selected' : ''}`}
      onClick={() => onToggle(unassignedFilterValue)}
    >
      <span className="assignee-filter-chip is-unassigned"><Icon name="user" size={14} /></span>
      <span>Unassigned</span>
      {selected.includes(unassignedFilterValue) && <Icon name="check" size={14} />}
    </button>
    {assignees.map((assignee) => (
      <button
        type="button"
        key={assignee.id}
        className={`board-assignee-option${selected.includes(assignee.name) ? ' is-selected' : ''}`}
        onClick={() => onToggle(assignee.name)}
      >
        <span className="assignee-filter-chip">{assignee.avatarUrl ? <img src={assignee.avatarUrl} alt="" /> : getInitials(assignee.name)}</span>
        <span>{assignee.name}</span>
        {selected.includes(assignee.name) && <Icon name="check" size={14} />}
      </button>
    ))}
  </div>;
}

function OptionFilterList({ options, value, onChange }: { options: FilterOption[]; value: string; onChange: (value: string) => void }) {
  return <div className="board-filter-options" role="listbox">
    {options.map((option) => (
      <button
        key={option.value || 'all'}
        type="button"
        className={`board-filter-option${option.value === value ? ' is-selected' : ''}`}
        role="option"
        aria-selected={option.value === value}
        onClick={() => onChange(option.value)}
      >
        <span>{option.label}</span>
        {option.value === value && <Icon name="check" size={14} />}
      </button>
    ))}
  </div>;
}
