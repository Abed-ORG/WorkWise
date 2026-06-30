export interface SprintLike {
  id: string;
  name: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isOpenSprintMoveTarget(sprint: SprintLike, today = new Date()) {
  if (sprint.isActive) return true;

  const todayStart = startOfLocalDay(today);
  const endDate = parseDate(sprint.endDate);
  const startDate = parseDate(sprint.startDate);

  if (endDate) return startOfLocalDay(endDate).getTime() >= todayStart.getTime();
  if (startDate) return startOfLocalDay(startDate).getTime() >= todayStart.getTime();
  return true;
}

export function isPastSprintMoveTarget(sprint: SprintLike, today = new Date()) {
  return !isOpenSprintMoveTarget(sprint, today);
}
