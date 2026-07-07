import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import KanbanBoard from './KanbanBoard';

const statuses = vi.hoisted(() => [
  { id: 'status-backlog', name: 'Backlog', category: 'TODO' as const, order: 0, isBacklogDefault: true, isSprintDefault: false },
  { id: 'status-todo', name: 'To do', category: 'TODO' as const, order: 1, isBacklogDefault: false, isSprintDefault: true },
  { id: 'status-in-progress', name: 'In progress', category: 'IN_PROGRESS' as const, order: 2, isBacklogDefault: false, isSprintDefault: false },
  { id: 'status-review', name: 'Review', category: 'IN_PROGRESS' as const, order: 3, isBacklogDefault: false, isSprintDefault: false },
  { id: 'status-done', name: 'Done', category: 'DONE' as const, order: 4, isBacklogDefault: false, isSprintDefault: false },
]);

vi.mock('../services/taskService', async () => {
  const actual = await vi.importActual<typeof import('../services/taskService')>('../services/taskService');
  return { ...actual, updateTaskStatus: vi.fn(), getProjectStatuses: vi.fn().mockResolvedValue(statuses) };
});

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('KanbanBoard', () => {
  it('renders workflow columns and their task cards', async () => {
    renderWithClient(<KanbanBoard projectId="project-1" activeSprintId="sprint-1" onTasksChange={vi.fn()} tasks={[
      { id: 'task-1', title: 'In progress task', type: 'STORY', statusId: 'status-in-progress', status: statuses[2], priority: 'MEDIUM', labels: [], order: 0, projectId: 'project-1', sprintId: 'sprint-1' },
      { id: 'task-2', title: 'Ready to review', type: 'STORY', statusId: 'status-review', status: statuses[3], priority: 'LOW', labels: [], order: 1, projectId: 'project-1', sprintId: 'sprint-1' },
      { id: 'task-3', title: 'Unsprinted todo', type: 'STORY', statusId: 'status-todo', status: statuses[1], priority: 'LOW', labels: [], order: 2, projectId: 'project-1', sprintId: null },
      { id: 'task-4', title: 'Previous sprint task', type: 'STORY', statusId: 'status-done', status: statuses[4], priority: 'LOW', labels: [], order: 3, projectId: 'project-1', sprintId: 'sprint-0' },
    ]} />);

    expect(screen.queryByRole('heading', { name: 'Backlog' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'To do' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In progress' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByText('In progress task')).toBeInTheDocument();
    expect(screen.getByText('Ready to review')).toBeInTheDocument();
    expect(screen.queryByText('Unsprinted todo')).not.toBeInTheDocument();
    expect(screen.queryByText('Previous sprint task')).not.toBeInTheDocument();
  });
});
