import type { Project, ProjectMember, Sprint } from '../services/projectService';
import type { ProjectActivity } from '../services/activityService';
import type { Task } from '../services/taskService';
import { isDone } from './taskStatus';

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

export interface CumulativeFlowPoint { label: string; backlog: number; active: number; done: number; }

export function buildCumulativeFlowData(tasks: Task[], days = 14): CumulativeFlowPoint[] {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(today.getTime() - (days - index - 1) * DAY_MS);
    const dayEnd = new Date(day.getTime() + DAY_MS - 1);
    const existing = tasks.filter((task) => !task.createdAt || new Date(task.createdAt).getTime() <= dayEnd.getTime());
    const completed = existing.filter((task) => {
      const completedAt = completionDateFromActivities(task);
      return Boolean(completedAt && completedAt.getTime() <= dayEnd.getTime());
    }).length;
    const backlog = existing.filter((task) => task.status.isBacklogDefault && !completionDateFromActivities(task)).length;
    return { label: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), backlog, active: Math.max(0, existing.length - backlog - completed), done: completed };
  });
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
  if (!isDone(task)) return null;

  // Status names are per-project and user-definable, so activity details can't be text-matched
  // against a fixed "DONE" literal. The TASK_MOVED action itself is the reliable signal — the most
  // recent status change on a task that's currently done is a good approximation of when it finished.
  const lastMove = task.activities
    ?.filter((activity) => activity.action === 'TASK_MOVED')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    [0];

  return parseDate(lastMove?.createdAt) ?? parseDate(task.updatedAt);
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
      completed: tasks.filter((task) => task.sprintId === sprint.id && isDone(task)).length,
    }));
}

export function calculateAverageVelocity(points: VelocityPoint[]) {
  if (points.length === 0) return 0;
  return points.reduce((total, point) => total + point.completed, 0) / points.length;
}

function activityIsWithinRange(activity: ProjectActivity, start?: string, end?: string) {
  const createdAt = parseDate(activity.createdAt);
  return dateIsWithinRange(createdAt, start, end);
}

function dateIsWithinRange(value: Date | null, start?: string, end?: string) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!value) return false;
  if (startDate && value.getTime() < startOfDay(startDate).getTime()) return false;
  if (endDate) {
    const endOfDay = new Date(startOfDay(endDate).getTime() + DAY_MS - 1);
    if (value.getTime() > endOfDay.getTime()) return false;
  }
  return true;
}

function taskMatchesSprint(task: Task, sprintId?: string) {
  return !sprintId || task.sprintId === sprintId;
}

// Reuses the category-aware completion signal from completionDateFromActivities (the most recent
// TASK_MOVED activity on a currently-done task) instead of text-matching activity details against
// a literal "DONE" — status names are per-project and user-definable, so that match would break.
function taskCompletedInFilter(task: Task, options: { sprintId?: string; startDate?: string; endDate?: string }) {
  if (!isDone(task) || !taskMatchesSprint(task, options.sprintId)) return false;
  if (!options.startDate && !options.endDate) return true;

  const completedAt = completionDateFromActivities(task);
  return dateIsWithinRange(completedAt, options.startDate, options.endDate);
}

function activityMatchesSprintTask(activity: ProjectActivity, sprintTasks: Task[], sprintId?: string) {
  if (!sprintId) return true;
  return sprintTasks.some((task) => task.title === activity.target);
}

// MERGE-REVIEW: develop's incoming version of this function changed more than the status check —
// it (1) excludes VIEWER-role members from contribution metrics entirely, (2) switches
// commentsMade from counting COMMENT_ADDED activity-log entries to counting real Comment records
// by author, and (3) scopes the activity feed (and therefore prsMerged) to the given sprint via
// title-matching against sprintTasks. None of these are status-related, so per the merge rules I
// kept develop's structure (the code after this block already references deliveryMembers and
// filteredActivities by name) and only rewired the status/completion check inside
// taskCompletedInFilter to the category model. Please confirm these three behavior changes are
// intended — they weren't present on this branch before the merge.
export function buildContributionMetrics(
  members: ProjectMember[],
  tasks: Task[],
  activities: ProjectActivity[],
  options: { sprintId?: string; startDate?: string; endDate?: string } = {}
): ContributionMetric[] {
  const deliveryMembers = members.filter((member) => member.role !== 'VIEWER');
  const sprintTasks = options.sprintId ? tasks.filter((task) => task.sprintId === options.sprintId) : tasks;
  const completedTasks = tasks.filter((task) => taskCompletedInFilter(task, options));
  const comments = tasks
    .filter((task) => taskMatchesSprint(task, options.sprintId))
    .flatMap((task) => task.comments ?? [])
    .filter((comment) => dateIsWithinRange(parseDate(comment.createdAt), options.startDate, options.endDate));
  const hasHydratedTaskComments = tasks.some((task) => Array.isArray(task.comments));
  const filteredActivities = activities.filter((activity) => (
    activityIsWithinRange(activity, options.startDate, options.endDate)
    && activityMatchesSprintTask(activity, sprintTasks, options.sprintId)
  ));
  const commentActivities = hasHydratedTaskComments
    ? []
    : filteredActivities.filter((activity) => activity.action === 'COMMENT_ADDED');

  return deliveryMembers.map((member) => {
    const userId = member.user.id;
    return {
      userId,
      name: member.user.name,
      role: member.role,
      tasksCompleted: completedTasks.filter((task) => task.assignee?.id === userId).length,
      commentsMade: hasHydratedTaskComments
        ? comments.filter((comment) => comment.author.id === userId).length
        : commentActivities.filter((activity) => activity.user.id === userId).length,
      prsMerged: filteredActivities.filter((activity) => activity.user.id === userId && /PR_MERGED|PULL_REQUEST_MERGED/i.test(activity.action)).length,
    };
  });
}

export function calculateProjectHealth(project: Project, tasks: Task[]): ProjectHealth {
  const today = startOfDay(new Date());
  const nextWeek = new Date(today.getTime() + 7 * DAY_MS);
  const openTasks = tasks.filter((task) => !isDone(task)).length;
  const overdueTasks = tasks.filter((task) => {
    const dueDate = parseDate(task.dueDate);
    return !isDone(task) && Boolean(dueDate && startOfDay(dueDate).getTime() < today.getTime());
  }).length;

  const activeSprintIds = new Set((project.sprints ?? []).filter((sprint) => sprint.isActive).map((sprint) => sprint.id));
  const activeSprintTasks = tasks.filter((task) => task.sprintId && activeSprintIds.has(task.sprintId));
  const sprintProgress = activeSprintTasks.length
    ? Math.round((activeSprintTasks.filter((task) => isDone(task)).length / activeSprintTasks.length) * 100)
    : 0;

  const upcomingDeadlines = tasks
    .filter((task) => {
      const dueDate = parseDate(task.dueDate);
      return !isDone(task) && Boolean(dueDate && dueDate >= today && dueDate <= nextWeek);
    })
    .sort((a, b) => (parseDate(a.dueDate)?.getTime() ?? 0) - (parseDate(b.dueDate)?.getTime() ?? 0))
    .slice(0, 6);

  return { openTasks, overdueTasks, sprintProgress, upcomingDeadlines };
}
