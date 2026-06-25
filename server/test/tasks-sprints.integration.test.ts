import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const taskService = vi.hoisted(() => ({
  createTask: vi.fn(), getProjectTasks: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(),
  getAssignedTasks: vi.fn(), getTaskById: vi.fn(), getTaskDocuments: vi.fn(), updateTaskDocuments: vi.fn(),
}));
const projectsService = vi.hoisted(() => ({
  createSprint: vi.fn(), getSprints: vi.fn(), startSprint: vi.fn(), completeSprint: vi.fn(),
}));

vi.mock('../src/services/task.service', () => taskService);
vi.mock('../src/modules/projects/projects.service', () => ({ projectsService }));
vi.mock('../src/services/realtime.service', () => ({ emitProjectEvent: vi.fn() }));
vi.mock('../src/services/mail.service', () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock('../src/modules/ai/gemini.service', () => ({ geminiService: {} }));

import app from '../src/app';
import { generateAccessToken } from '../src/utils/jwt';

const token = generateAccessToken('user-1', 'ADMIN');
const auth = { Authorization: `Bearer ${token}` };
const task = { id: 'task-1', title: 'Ship tests', status: 'BACKLOG', priority: 'HIGH', projectId: 'project-1' };

describe('task and sprint routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates, lists, updates, and deletes project tasks', async () => {
    taskService.createTask.mockResolvedValue(task);
    taskService.getProjectTasks.mockResolvedValue([task]);
    taskService.updateTask.mockResolvedValue({ ...task, title: 'Ship integration tests', status: 'TODO' });
    taskService.deleteTask.mockResolvedValue(undefined);

    const created = await request(app).post('/tasks').set(auth).send({ title: task.title, projectId: task.projectId, priority: 'HIGH' });
    const listed = await request(app).get(`/tasks/project/${task.projectId}`).set(auth);
    const updated = await request(app).patch(`/tasks/${task.id}`).set(auth).send({ title: 'Ship integration tests', status: 'TODO' });
    const deleted = await request(app).delete(`/tasks/${task.id}`).set(auth);

    expect(created.status).toBe(201);
    expect(taskService.createTask).toHaveBeenCalledWith(expect.objectContaining({ creatorId: 'user-1', title: task.title }));
    expect(listed.body.data).toEqual([task]);
    expect(updated.body.data.status).toBe('TODO');
    expect(deleted.status).toBe(200);
    expect(taskService.deleteTask).toHaveBeenCalledWith(task.id, 'user-1');
  });

  it('creates, lists, starts, and completes sprints', async () => {
    const sprint = { id: 'sprint-1', name: 'Sprint 1', projectId: 'project-1', isActive: false };
    projectsService.createSprint.mockResolvedValue(sprint);
    projectsService.getSprints.mockResolvedValue([sprint]);
    projectsService.startSprint.mockResolvedValue({ ...sprint, isActive: true });
    projectsService.completeSprint.mockResolvedValue({ sprint: { ...sprint, isActive: false }, completedCount: 1, incompleteCount: 0 });
    const body = { name: sprint.name, startDate: '2026-07-01', endDate: '2026-07-14' };

    const created = await request(app).post('/api/projects/project-1/sprints').set(auth).send(body);
    const listed = await request(app).get('/api/projects/project-1/sprints').set(auth);
    const started = await request(app).post('/api/projects/project-1/sprints/start').set(auth).send(body);
    const completed = await request(app).post('/api/projects/project-1/sprints/sprint-1/complete').set(auth).send({ incompleteTaskDestination: 'backlog' });

    expect(created.status).toBe(201);
    expect(listed.body.data).toEqual([sprint]);
    expect(started.body.data.isActive).toBe(true);
    expect(completed.status).toBe(200);
    expect(projectsService.completeSprint).toHaveBeenCalledWith('project-1', 'sprint-1', 'user-1', { incompleteTaskDestination: 'backlog' });
  });
});
