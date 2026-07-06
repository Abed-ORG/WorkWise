export const HOURS_PER_ESTIMATE_DAY = 8;

export function estimateDaysToHours(days: number) {
  return days * HOURS_PER_ESTIMATE_DAY;
}

export function estimateHoursToDays(hours: number) {
  return hours / HOURS_PER_ESTIMATE_DAY;
}
