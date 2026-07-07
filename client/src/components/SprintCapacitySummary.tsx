import Icon from './Icon';
import type { SprintCapacity } from '../utils/sprintCapacity';

interface SprintCapacitySummaryProps {
  capacity: SprintCapacity;
  compact?: boolean;
}

export default function SprintCapacitySummary({ capacity, compact = false }: SprintCapacitySummaryProps) {
  const {
    committedPoints,
    unestimatedTaskCount,
    averageVelocity,
    isOverCommitted,
  } = capacity;

  const hasTasks = committedPoints > 0 || unestimatedTaskCount > 0;
  // The bar fill is capped at 100% so it never overflows its track, but the displayed
  // percentage must stay uncapped — otherwise an over-committed sprint (e.g. 5 committed
  // against a 2.5 velocity) reads as "100%", which looks identical to being exactly full.
  const rawPct = averageVelocity !== null && averageVelocity > 0
    ? Math.round((committedPoints / averageVelocity) * 100)
    : 0;
  const barPct = Math.min(100, rawPct);

  return (
    <div className={`sprint-capacity${compact ? ' sprint-capacity--compact' : ''}${isOverCommitted ? ' sprint-capacity--over' : ''}`}>
      <div className="sprint-capacity-head">
        <span className="sprint-capacity-label"><Icon name="team" size={12} /> Sprint capacity</span>
        {isOverCommitted && (
          <span className="sprint-capacity-warning">
            <Icon name="activity" size={12} /> Over committed
          </span>
        )}
      </div>

      {averageVelocity !== null && (
        <div className="sprint-capacity-bar-track">
          <div
            className={`sprint-capacity-bar-fill${isOverCommitted ? ' sprint-capacity-bar-fill--over' : ''}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      )}

      <div className="sprint-capacity-figures">
        {averageVelocity !== null ? (
          <span className="sprint-capacity-figure">
            {committedPoints} pts committed / ~{averageVelocity.toFixed(1)} pts avg velocity
            {` (${rawPct}%)`}
          </span>
        ) : (
          <span className="sprint-capacity-figure">
            {hasTasks ? `${committedPoints} pts committed` : 'No tasks planned yet'}
            <span className="sprint-capacity-hint"> — complete a sprint to start tracking velocity</span>
          </span>
        )}
      </div>

      {unestimatedTaskCount > 0 && (
        <p className="sprint-capacity-unestimated">
          {unestimatedTaskCount} {unestimatedTaskCount === 1 ? 'task has' : 'tasks have'} no story points and {unestimatedTaskCount === 1 ? "isn't" : "aren't"} counted above
        </p>
      )}

      {averageVelocity !== null && (
        <p className="sprint-capacity-note">Velocity is the team's average story points completed per past sprint</p>
      )}
    </div>
  );
}
