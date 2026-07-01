import type { ProjectMember, Sprint } from '../services/projectService';
import type { Task } from '../services/taskService';

// Assumption: a team member is assumed to have this many focused hours per sprint day.
// There is no persisted per-member capacity in the schema, so this is a rough, labeled estimate.
export const ASSUMED_HOURS_PER_DAY = 6;

export interface SprintCapacity {
  demandHours: number;
  estimatedTaskCount: number;
  unestimatedTaskCount: number;
  activeMemberCount: number;
  durationDays: number | null;
  capacityHours: number | null;
  utilizationPct: number | null;
  isOverCapacity: boolean;
}

function parseDateOnly(value?: string | null): Date | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function getSprintDurationDays(sprint: Pick<Sprint, 'startDate' | 'endDate'>): number | null {
  const start = parseDateOnly(sprint.startDate);
  const end = parseDateOnly(sprint.endDate);
  if (!start || !end) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return days > 0 ? days : null;
}

export function computeSprintCapacity(
  sprint: Pick<Sprint, 'startDate' | 'endDate'>,
  members: ProjectMember[],
  sprintTasks: Task[],
  assumedHoursPerDay: number = ASSUMED_HOURS_PER_DAY,
): SprintCapacity {
  const estimatedTasks = sprintTasks.filter((task) => typeof task.estimatedHours === 'number');
  const demandHours = estimatedTasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);

  const activeMemberCount = members.filter((member) => member.role !== 'VIEWER').length;
  const durationDays = getSprintDurationDays(sprint);
  const capacityHours = activeMemberCount > 0 && durationDays !== null
    ? activeMemberCount * durationDays * assumedHoursPerDay
    : null;

  const utilizationPct = capacityHours && capacityHours > 0
    ? (demandHours / capacityHours) * 100
    : null;

  return {
    demandHours,
    estimatedTaskCount: estimatedTasks.length,
    unestimatedTaskCount: sprintTasks.length - estimatedTasks.length,
    activeMemberCount,
    durationDays,
    capacityHours,
    utilizationPct,
    isOverCapacity: capacityHours !== null && demandHours > capacityHours,
  };
}
