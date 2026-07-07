import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TaskCard from './TaskCard';

describe('TaskCard', () => {
  it('renders a task title, status context, and assignee', () => {
    render(<TaskCard task={{
      id: 'task-1', title: 'Write tests', type: 'STORY', priority: 'HIGH', labels: [], order: 0, projectId: 'project-1',
      statusId: 'status-in-progress',
      status: { id: 'status-in-progress', name: 'in progress', category: 'IN_PROGRESS', order: 1, isBacklogDefault: false, isSprintDefault: false },
      assignee: { id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com' },
    }} onDragStart={vi.fn()} onDragEnd={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Write tests' })).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('in progress')).toBeInTheDocument();
    expect(screen.getByTitle('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByLabelText(/Write tests, high priority/i)).toBeInTheDocument();
  });
});
