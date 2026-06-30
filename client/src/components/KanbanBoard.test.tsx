import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import KanbanBoard from './KanbanBoard';

vi.mock('../services/taskService', async () => {
  const actual = await vi.importActual<typeof import('../services/taskService')>('../services/taskService');
  return { ...actual, updateTaskStatus: vi.fn() };
});

describe('KanbanBoard', () => {
  it('renders workflow columns and their task cards', () => {
    render(<KanbanBoard onTasksChange={vi.fn()} tasks={[
      { id: 'task-1', title: 'In progress task', status: 'IN_PROGRESS', priority: 'MEDIUM', labels: [], order: 0, projectId: 'project-1', sprintId: 'sprint-1' },
      { id: 'task-2', title: 'Ready to review', status: 'IN_REVIEW', priority: 'LOW', labels: [], order: 1, projectId: 'project-1', sprintId: 'sprint-1' },
      { id: 'task-3', title: 'Unsprinted todo', status: 'TODO', priority: 'LOW', labels: [], order: 2, projectId: 'project-1', sprintId: null },
    ]} />);

    expect(screen.getByRole('heading', { name: 'To do' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In progress' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByText('In progress task')).toBeInTheDocument();
    expect(screen.getByText('Ready to review')).toBeInTheDocument();
    expect(screen.queryByText('Unsprinted todo')).not.toBeInTheDocument();
  });
});
