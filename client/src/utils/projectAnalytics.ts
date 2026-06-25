import type { Project, ProjectMember, Sprint } from '../services/projectService';
import type { ProjectActivity } from '../services/activityService';
import type { Task } from '../services/taskService';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BurndownPoint {
  label: string;
  ideal: number;
  actual: number;
}

export interface VelocityPoint {
  sprintId: string;
  sprintName: string;
  completed: number;
}

export interface ContributionMetric {
  userId: string;
  name: string;
  role: string;
  tasksCompleted: number;
  commentsMade: number;
  prsMerged: number;
}

export interface ProjectHealth {
  openTasks: number;
  overdueTasks: number;
  sprintProgress: number;
  upcomingDeadlines: Task[];
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isSprintComplete(sprint: Sprint) {
  const endDate = parseDate(sprint.endDate);
  return !sprint.isActive && Boolean(endDate && startOfDay(endDate).getTime() <= startOfDay(new Date()).getTime());
}

export function getSprintDays(sprint: Sprint): Date[] {
  const start = startOfDay(parseDate(sprint.startDate) ?? parseDate(sprint.createdAt) ?? new Date());
  const end = startOfDay(parseDate(sprint.endDate) ?? new Date(start.getTime() + 13 * DAY_MS));
  const days: Date[] = [];
  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
    days.push(new Date(time));
  }
  return days.length > 0 ? days : [start];
}

function completionDateFromActivities(task: Task): Date | null {
  const doneMove = task.activities
    ?.filter((activity) => activity.action === 'TASK_MOVED' && /to\s+DONE/i.test(activity.details ?? ''))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    [0];

  return parseDate(doneMove?.createdAt) ?? (task.status === 'DONE' ? parseDate(task.updatedAt) : null);
}

export function buildBurndownData(sprint: Sprint, tasks: Task[]): BurndownPoint[] {
  const sprintTasks = tasks.filter((task) => task.sprintId === sprint.id);
  const totalTasks = sprintTasks.length;
  const days = getSprintDays(sprint);
  const lastIndex = Math.max(1, days.length - 1);

  return days.map((day, index) => {
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    const completedByDay = sprintTasks.filter((task) => {
      const completedAt = completionDateFromActivities(task);
      return completedAt && completedAt.getTime() <= dayEnd.getTime();
    }).length;

    return {
      label: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ideal: Math.max(0, Math.round(totalTasks - (totalTasks * index) / lastIndex)),
      actual: Math.max(0, totalTasks - completedByDay),
    };
  });
}

export function buildVelocityData(sprints: Sprint[], tasks: Task[]): VelocityPoint[] {
  return sprints
    .filter(isSprintComplete)
    .map((sprint) => ({
      sprintId: sprint.id,
      sprintName: sprint.name,
      completed: tasks.filter((task) => task.sprintId === sprint.id && task.status === 'DONE').length,
    }));
}

export function calculateAverageVelocity(points: VelocityPoint[]) {
  if (points.length === 0) return 0;
  return points.reduce((total, point) => total + point.completed, 0) / points.length;
}

function activityIsWithinRange(activity: ProjectActivity, start?: string, end?: string) {
  const createdAt = parseDate(activity.createdAt);
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!createdAt) return false;
  if (startDate && createdAt.getTime() < startOfDay(startDate).getTime()) return false;
  if (endDate) {
    const endOfDay = new Date(startOfDay(endDate).getTime() + DAY_MS - 1);
    if (createdAt.getTime() > endOfDay.getTime()) return false;
  }
  return true;
}

export function buildContributionMetrics(
  members: ProjectMember[],
  tasks: Task[],
  activities: ProjectActivity[],
  options: { sprintId?: string; startDate?: string; endDate?: string } = {}
): ContributionMetric[] {
  const filteredTasks = tasks.filter((task) => {
    if (options.sprintId && task.sprintId !== options.sprintId) return false;
    const completedAt = completionDateFromActivities(task);
    if (!completedAt) return task.status === 'DONE';
    if (options.startDate && completedAt.getTime() < startOfDay(parseDate(options.startDate) ?? completedAt).getTime()) return false;
    if (options.endDate) {
      const endOfDay = new Date(startOfDay(parseDate(options.endDate) ?? completedAt).getTime() + DAY_MS - 1);
      if (completedAt.getTime() > endOfDay.getTime()) return false;
    }
    return true;
  });

  const filteredActivities = activities.filter((activity) => activityIsWithinRange(activity, options.startDate, options.endDate));

  return members.map((member) => {
    const userId = member.user.id;
    return {
      userId,
      name: member.user.name,
      role: member.role,
      tasksCompleted: filteredTasks.filter((task) => task.status === 'DONE' && task.assignee?.id === userId).length,
      commentsMade: filteredActivities.filter((activity) => activity.user.id === userId && activity.action === 'COMMENT_ADDED').length,
      prsMerged: filteredActivities.filter((activity) => activity.user.id === userId && /PR_MERGED|PULL_REQUEST_MERGED/i.test(activity.action)).length,
    };
  });
}

export function calculateProjectHealth(project: Project, tasks: Task[]): ProjectHealth {
  const today = startOfDay(new Date());
  const nextWeek = new Date(today.getTime() + 7 * DAY_MS);
  const openTasks = tasks.filter((task) => task.status !== 'DONE').length;
  const overdueTasks = tasks.filter((task) => {
    const dueDate = parseDate(task.dueDate);
    return task.status !== 'DONE' && Boolean(dueDate && startOfDay(dueDate).getTime() < today.getTime());
  }).length;

  const activeSprintIds = new Set((project.sprints ?? []).filter((sprint) => sprint.isActive).map((sprint) => sprint.id));
  const activeSprintTasks = tasks.filter((task) => task.sprintId && activeSprintIds.has(task.sprintId));
  const sprintProgress = activeSprintTasks.length
    ? Math.round((activeSprintTasks.filter((task) => task.status === 'DONE').length / activeSprintTasks.length) * 100)
    : 0;

  const upcomingDeadlines = tasks
    .filter((task) => {
      const dueDate = parseDate(task.dueDate);
      return task.status !== 'DONE' && Boolean(dueDate && dueDate >= today && dueDate <= nextWeek);
    })
    .sort((a, b) => (parseDate(a.dueDate)?.getTime() ?? 0) - (parseDate(b.dueDate)?.getTime() ?? 0))
    .slice(0, 6);

  return { openTasks, overdueTasks, sprintProgress, upcomingDeadlines };
}
