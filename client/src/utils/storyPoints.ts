// Story points are Fibonacci-constrained across the app — no free-form effort values.
export const FIBONACCI_STORY_POINTS = [1, 2, 3, 5, 8, 13] as const;
export type FibonacciStoryPoints = typeof FIBONACCI_STORY_POINTS[number];

export const storyPointsSelectOptions = [
  { value: '', label: 'No estimate' },
  ...FIBONACCI_STORY_POINTS.map((points) => ({ value: String(points), label: `${points} pts` })),
];

export function formatStoryPoints(points?: number | null): string {
  if (points === null || points === undefined) return 'No estimate';
  return `${points} pt${points === 1 ? '' : 's'}`;
}
