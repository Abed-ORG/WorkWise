import { useMemo, useState } from 'react';
import Icon from './Icon';
import { Button } from './ui';
import type { Task } from '../services/taskService';

type SortKey = 'title' | 'status' | 'priority' | 'assignee' | 'project';
type SortDirection = 'asc' | 'desc';

interface BacklogListProps {
  tasks: Task[];
  title?: string;
  description?: string;
  showProject?: boolean;
  canDelete?: boolean;
  onDeleteSelected?: (taskIds: string[]) => Promise<void>;
  onTaskClick?: (task: Task) => void;
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

export default function BacklogList({
  tasks,
  title = 'Work queue',
  description = 'Sort tasks by status, priority, assignee, and due date.',
  showProject = false,
  canDelete = false,
  onDeleteSelected,
  onTaskClick,
}: BacklogListProps) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(false);

  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => {
    const aValue = getSortValue(a, sortKey);
    const bValue = getSortValue(b, sortKey);
    return aValue.localeCompare(bValue) * (sortDirection === 'asc' ? 1 : -1);
  }), [tasks, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedTasks = sortedTasks.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
    setPage(1);
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) => current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]);
  }

  function toggleCurrentPageSelection() {
    const currentPageIds = paginatedTasks.map((task) => task.id);
    const allSelected = currentPageIds.every((id) => selectedTaskIds.includes(id));
    setSelectedTaskIds((current) => allSelected
      ? current.filter((id) => !currentPageIds.includes(id))
      : Array.from(new Set([...current, ...currentPageIds])));
  }

  async function handleDelete() {
    if (!onDeleteSelected || !selectedTaskIds.length) return;
    setDeleting(true);
    try {
      await onDeleteSelected(selectedTaskIds);
      setSelectedTaskIds([]);
    } finally {
      setDeleting(false);
    }
  }

  const currentPageAllSelected = paginatedTasks.length > 0 && paginatedTasks.every((task) => selectedTaskIds.includes(task.id));

  return (
    <section className="app-card backlog-card animate-enter-delay">
      <div className="backlog-toolbar">
        <div><p className="section-kicker">Backlog</p><h2>{title}</h2><p>{description}</p></div>
        {canDelete && (
          <div className="backlog-actions" aria-label="Task actions">
            <span className={`selection-count${selectedTaskIds.length ? ' is-visible' : ''}`}>{selectedTaskIds.length} selected</span>
            <Button variant="danger" disabled={!selectedTaskIds.length} loading={deleting} onClick={handleDelete}>Delete selected</Button>
          </div>
        )}
      </div>

      {!tasks.length ? (
        <div className="empty-panel"><span className="empty-icon"><Icon name="tasks" size={24} /></span><h3>No tasks here yet</h3><p>Create the first task from this project to start the workflow.</p></div>
      ) : (
        <div className="backlog-table-wrap">
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
            <tbody>{paginatedTasks.map((task) => (
              <tr key={task.id} className={selectedTaskIds.includes(task.id) ? 'is-selected' : ''} onDoubleClick={() => onTaskClick?.(task)}>
                {canDelete && <td className="checkbox-cell"><input type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={() => toggleTaskSelection(task.id)} aria-label={`Select ${task.title}`} /></td>}
                <td data-label="Task">{onTaskClick
                  ? <button type="button" className="task-table-link" onClick={() => onTaskClick(task)}>{task.title}</button>
                  : <strong className="task-table-title">{task.title}</strong>}</td>
                {showProject && <td data-label="Project"><span className="project-key">{task.project?.key}</span> {task.project?.name}</td>}
                <td data-label="Status"><span className={`status-badge status-${task.status.toLowerCase()}`}>{formatStatus(task.status)}</span></td>
                <td data-label="Priority"><span className={`priority-badge priority-${task.priority.toLowerCase()}`}><span />{task.priority.toLowerCase()}</span></td>
                <td data-label="Assignee"><span className="table-assignee"><span className="mini-avatar">{getInitials(task.assignee?.name)}</span>{task.assignee?.name ?? 'Unassigned'}</span></td>
                <td data-label="Due date"><span className="due-date"><Icon name="calendar" size={14} />{formatDate(task.dueDate)}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tasks.length > 0 && <footer className="backlog-footer">
        <span>Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, sortedTasks.length)} of {sortedTasks.length} tasks</span>
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

interface SortableHeaderProps { label: string; column: SortKey; sortKey: SortKey; sortDirection: SortDirection; onSort: (column: SortKey) => void; }
function SortableHeader({ label, column, sortKey, sortDirection, onSort }: SortableHeaderProps) {
  const active = sortKey === column;
  return <th aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}><button className={`sort-button${active ? ' is-active' : ''}`} type="button" onClick={() => onSort(column)}>{label}<Icon name="chevron-down" size={14} className={active && sortDirection === 'asc' ? 'sort-ascending' : ''} /></button></th>;
}
