import Icon from './Icon';
import type { ProjectHealth, BurndownPoint, ContributionMetric, VelocityPoint, CumulativeFlowPoint } from '../utils/projectAnalytics';

interface BurndownChartProps {
  points: BurndownPoint[];
}

interface VelocityChartProps {
  points: VelocityPoint[];
  average: number;
}

interface ContributionMetricsProps {
  metrics: ContributionMetric[];
}

interface ProjectHealthOverviewProps {
  health: ProjectHealth;
}

function polyline(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

export function BurndownChart({ points }: BurndownChartProps) {
  const maxValue = Math.max(1, ...points.map((point) => Math.max(point.ideal, point.actual)));
  const width = 720;
  const height = 260;
  const padding = 34;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const xFor = (index: number) => padding + (points.length <= 1 ? 0 : (chartWidth * index) / (points.length - 1));
  const yFor = (value: number) => padding + chartHeight - (chartHeight * value) / maxValue;
  const idealPoints = points.map((point, index) => ({ x: xFor(index), y: yFor(point.ideal) }));
  const actualPoints = points.map((point, index) => ({ x: xFor(index), y: yFor(point.actual) }));

  return (
    <div className="analytics-chart">
      <div className="analytics-chart-legend">
        <span><i className="legend-dot legend-dot-ideal" /> Ideal</span>
        <span><i className="legend-dot legend-dot-actual" /> Actual</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sprint burndown chart">
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="chart-axis" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line key={ratio} x1={padding} x2={width - padding} y1={padding + chartHeight * ratio} y2={padding + chartHeight * ratio} className="chart-gridline" />
        ))}
        <polyline points={polyline(idealPoints)} className="chart-line chart-line-ideal" />
        <polyline points={polyline(actualPoints)} className="chart-line chart-line-actual" />
        {actualPoints.map((point, index) => (
          <circle key={`${points[index].label}-${point.x}`} cx={point.x} cy={point.y} r="4" className="chart-point">
            <title>{`${points[index].label}: ${points[index].actual} tasks remaining`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-x-labels">
        {points.map((point) => <span key={point.label}>{point.label}</span>)}
      </div>
    </div>
  );
}

export function VelocityChart({ points, average }: VelocityChartProps) {
  const maxValue = Math.max(1, ...points.map((point) => point.completed), Math.ceil(average));

  return (
    <div className="velocity-chart" role="img" aria-label="Velocity chart">
      {points.length === 0 ? (
        <div className="analytics-empty">
          <Icon name="activity" size={22} />
          <h3>No completed sprints yet</h3>
          <p>Complete a sprint to start seeing delivery capacity over time.</p>
        </div>
      ) : (
        <>
          <div className="velocity-bars">
            {points.map((point) => (
              <div className="velocity-bar-wrap" key={point.sprintId}>
                <div className="velocity-bar" style={{ height: `${Math.max(8, (point.completed / maxValue) * 100)}%` }}>
                  <span className="velocity-tooltip">{point.sprintName}: {point.completed}</span>
                </div>
                <span>{point.sprintName}</span>
              </div>
            ))}
            <div className="velocity-average-line" style={{ bottom: `${(average / maxValue) * 100}%` }}>
              <span>Avg {average.toFixed(1)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ContributionMetrics({ metrics }: ContributionMetricsProps) {
  const maxValue = Math.max(1, ...metrics.map((metric) => metric.tasksCompleted + metric.commentsMade + metric.prsMerged));
  const totalActivity = metrics.reduce((total, metric) => total + metric.tasksCompleted + metric.commentsMade + metric.prsMerged, 0);

  if (metrics.length === 0 || totalActivity === 0) {
    return (
      <div className="analytics-empty">
        <Icon name="team" size={22} />
        <h3>No team contribution activity yet</h3>
        <p>Delivery contributors will appear here after completed tasks, comments, or recorded PR merge activity match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="contribution-grid">
      {metrics.map((metric) => {
        const total = metric.tasksCompleted + metric.commentsMade + metric.prsMerged;
        return (
          <article className="contribution-card" key={metric.userId}>
            <div className="contribution-head">
              <span className="avatar">{metric.name.slice(0, 2).toUpperCase()}</span>
              <span><strong>{metric.name}</strong><small>{metric.role.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())}</small></span>
            </div>
            <div className="contribution-bar"><i style={{ width: `${Math.max(4, (total / maxValue) * 100)}%` }} /></div>
            <dl className="contribution-stats">
              <div><dt>Tasks done</dt><dd>{metric.tasksCompleted}</dd></div>
              <div><dt>Comments</dt><dd>{metric.commentsMade}</dd></div>
              <div><dt>PRs merged</dt><dd>{metric.prsMerged}</dd></div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

export function ProjectHealthOverview({ health }: ProjectHealthOverviewProps) {
  return (
    <section className="app-card card-padding project-health-card">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Project health</p>
          <h2>Delivery pulse</h2>
          <p>Live metrics for workload, risk, sprint progress, and nearby deadlines.</p>
          <p className="analytics-guidance">Use this snapshot to catch delivery pressure early: open work shows load, overdue tasks show risk, and sprint progress shows current momentum.</p>
        </div>
      </div>

      <div className="health-grid">
        <article><span>Open tasks</span><strong>{health.openTasks}</strong><small>Still moving</small></article>
        <article><span>Overdue tasks</span><strong>{health.overdueTasks}</strong><small>{health.overdueTasks ? 'Needs attention' : 'Clear'}</small></article>
        <article><span>Sprint progress</span><strong>{health.sprintProgress}%</strong><small>Done in active sprint</small></article>
      </div>

      <div className="deadline-list">
        <h3>Upcoming deadlines</h3>
        {health.upcomingDeadlines.length > 0 ? (
          health.upcomingDeadlines.map((task) => (
            <div className="deadline-item" key={task.id}>
              <span><Icon name="calendar" size={14} /> {task.title}</span>
              <small>{task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}</small>
            </div>
          ))
        ) : (
          <p className="field-help">No task deadlines in the next 7 days.</p>
        )}
      </div>
    </section>
  );
}

export function CumulativeFlowChart({ points }: { points: CumulativeFlowPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.backlog + point.active + point.done));
  return <div className="cfd-chart" role="img" aria-label="Cumulative flow diagram">
    <div className="analytics-chart-legend"><span><i className="legend-dot cfd-backlog" /> Backlog</span><span><i className="legend-dot cfd-active" /> Active</span><span><i className="legend-dot cfd-done" /> Done</span></div>
    <div className="cfd-columns">{points.map((point) => <div className="cfd-column" key={point.label} title={`${point.label}: ${point.backlog} backlog, ${point.active} active, ${point.done} done`}><div className="cfd-segment cfd-done" style={{ height: `${(point.done / max) * 100}%` }} /><div className="cfd-segment cfd-active" style={{ height: `${(point.active / max) * 100}%` }} /><div className="cfd-segment cfd-backlog" style={{ height: `${(point.backlog / max) * 100}%` }} /><span>{point.label}</span></div>)}</div>
  </div>;
}
