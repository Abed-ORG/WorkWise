import type { Sprint } from '../services/projectService';
import type { Task } from '../services/taskService';
import { isDone } from './taskStatus';
import { isSprintComplete } from './projectAnalytics';

export interface SprintCapacity {
  committedPoints: number;
  estimatedTaskCount: number;
  unestimatedTaskCount: number;
  averageVelocity: number | null;
  isOverCommitted: boolean;
}

// Velocity = average story points completed (status category DONE) per past completed sprint.
// Returns null when there's no completed-sprint history yet, so callers can show committed
// points alone rather than a misleading comparison against zero.
export function computeAverageVelocity(completedSprints: Sprint[], allTasks: Task[]): number | null {
  if (completedSprints.length === 0) return null;

  const totalCompletedPoints = completedSprints.reduce((sum, sprint) => {
    const sprintPoints = allTasks
      .filter((task) => task.sprintId === sprint.id && isDone(task))
      .reduce((taskSum, task) => taskSum + (task.storyPoints ?? 0), 0);
    return sum + sprintPoints;
  }, 0);

  return totalCompletedPoints / completedSprints.length;
}

export function computeSprintCapacity(
  sprintTasks: Task[],
  averageVelocity: number | null,
): SprintCapacity {
  const estimatedTasks = sprintTasks.filter((task) => typeof task.storyPoints === 'number');
  const committedPoints = estimatedTasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);

  return {
    committedPoints,
    estimatedTaskCount: estimatedTasks.length,
    unestimatedTaskCount: sprintTasks.length - estimatedTasks.length,
    averageVelocity,
    isOverCommitted: averageVelocity !== null && committedPoints > averageVelocity,
  };
}

export { isSprintComplete };
