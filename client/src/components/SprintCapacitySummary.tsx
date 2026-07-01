import Icon from './Icon';
import { ASSUMED_HOURS_PER_DAY } from '../utils/sprintCapacity';
import type { SprintCapacity } from '../utils/sprintCapacity';

interface SprintCapacitySummaryProps {
  capacity: SprintCapacity;
  compact?: boolean;
}

function formatHours(hours: number) {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export default function SprintCapacitySummary({ capacity, compact = false }: SprintCapacitySummaryProps) {
  const {
    demandHours,
    unestimatedTaskCount,
    capacityHours,
    utilizationPct,
    isOverCapacity,
  } = capacity;

  const hasTasks = demandHours > 0 || unestimatedTaskCount > 0;
  const barPct = utilizationPct !== null ? Math.min(100, Math.round(utilizationPct)) : 0;

  return (
    <div className={`sprint-capacity${compact ? ' sprint-capacity--compact' : ''}${isOverCapacity ? ' sprint-capacity--over' : ''}`}>
      <div className="sprint-capacity-head">
        <span className="sprint-capacity-label"><Icon name="team" size={12} /> Sprint capacity</span>
        {isOverCapacity && (
          <span className="sprint-capacity-warning">
            <Icon name="activity" size={12} /> Over capacity
          </span>
        )}
      </div>

      <div className="sprint-capacity-bar-track">
        <div
          className={`sprint-capacity-bar-fill${isOverCapacity ? ' sprint-capacity-bar-fill--over' : ''}`}
          style={{ width: capacityHours !== null ? `${barPct}%` : '0%' }}
        />
      </div>

      <div className="sprint-capacity-figures">
        {capacityHours !== null ? (
          <span className="sprint-capacity-figure">
            {formatHours(demandHours)} planned / ~{formatHours(capacityHours)} capacity
            {utilizationPct !== null && ` (${Math.round(utilizationPct)}%)`}
          </span>
        ) : (
          <span className="sprint-capacity-figure">
            {hasTasks ? `${formatHours(demandHours)} planned` : 'No tasks planned yet'}
            <span className="sprint-capacity-hint"> — add sprint dates and team members to estimate capacity</span>
          </span>
        )}
      </div>

      {unestimatedTaskCount > 0 && (
        <p className="sprint-capacity-unestimated">
          {unestimatedTaskCount} {unestimatedTaskCount === 1 ? 'task has' : 'tasks have'} no estimate and {unestimatedTaskCount === 1 ? "isn't" : "aren't"} counted above
        </p>
      )}

      {capacityHours !== null && (
        <p className="sprint-capacity-note">Capacity estimated from team size × sprint length (~{ASSUMED_HOURS_PER_DAY}h/day per person)</p>
      )}
    </div>
  );
}
