import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CreateTaskModal from './CreateTaskModal';

const createTask = vi.hoisted(() => vi.fn());

vi.mock('../services/taskService', () => ({ createTask }));

describe('CreateTaskModal', () => {
  beforeEach(() => {
    createTask.mockReset();
    createTask.mockResolvedValue({ id: 'task-1', title: 'Sprint task' });
  });

  it('assigns a board-created task to the active sprint', async () => {
    const user = userEvent.setup();
    render(
      <CreateTaskModal
        isOpen
        projectId="project-1"
        sprintId="sprint-active"
        members={[]}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Task title'), 'Sprint task');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      sprintId: 'sprint-active',
      title: 'Sprint task',
    })));
  });
});
