import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Breadcrumbs from '../components/Breadcrumbs';
import CompleteSprintModal from '../components/CompleteSprintModal';
import Icon from '../components/Icon';
import KanbanBoard from '../components/KanbanBoard';
import { BurndownChart } from '../components/ProjectAnalyticsWidgets';
import SprintBacklogPanel from '../components/SprintBacklogPanel';
import SprintCapacitySummary from '../components/SprintCapacitySummary';
import { Button, Spinner } from '../components/ui';
import PageSkeleton from '../components/PageSkeleton';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getProjectById, getProjectSprints, getSprintById } from '../services/projectService';
import { createTask, getProjectTasks } from '../services/taskService';
import type { Task } from '../services/taskService';
import { queryKeys, queryTimes } from '../services/queryOptions';
import { buildBurndownData, isSprintComplete } from '../utils/projectAnalytics';
import { computeAverageVelocity, computeSprintCapacity } from '../utils/sprintCapacity';
import { getSprintRisk } from '../services/aiService';
import type { SprintRiskResult } from '../services/aiService';

type Tab = 'board' | 'backlog';

function upsertTask(tasks: Task[], nextTask: Task) {
  const exists = tasks.some((task) => task.id === nextTask.id);
  if (exists) return tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
  return [nextTask, ...tasks];
}

function daysRemaining(endDateStr?: string): number | null {
  const match = endDateStr && /^(\d{4})-(\d{2})-(\d{2})/.exec(endDateStr);
  if (!match) return null;
  const endDate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((endDate.getTime() - today.getTime()) / 86400000));
}

export default function SprintBoardPage() {
  const { projectId, sprintId } = useParams<{ projectId: string; sprintId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('board');
  const [completeOpen, setCompleteOpen] = useState(false);
  const [riskResult, setRiskResult] = useState<SprintRiskResult | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskPanelOpen, setRiskPanelOpen] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId ?? ''),
    queryFn: () => getProjectById(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.projectDetail,
  });
  const sprintQuery = useQuery({
    queryKey: queryKeys.sprint(projectId ?? '', sprintId ?? ''),
    queryFn: () => getSprintById(projectId!, sprintId!),
    enabled: Boolean(projectId && sprintId),
    staleTime: queryTimes.sprints,
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.projectTasks(projectId ?? ''),
    queryFn: () => getProjectTasks(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.tasks,
  });
  const sprintsListQuery = useQuery({
    queryKey: queryKeys.projectSprints(projectId ?? ''),
    queryFn: () => getProjectSprints(projectId!),
    enabled: Boolean(projectId),
    staleTime: queryTimes.sprints,
  });

  useEffect(() => {
    if (projectQuery.isError || sprintQuery.isError || tasksQuery.isError) navigate(`/projects/${projectId}/sprints`, { replace: true });
  }, [navigate, projectId, projectQuery.isError, sprintQuery.isError, tasksQuery.isError]);

  const project = projectQuery.data ?? null;
  const sprint = sprintQuery.data ?? null;
  const allTasks = Array.isArray(tasksQuery.data) ? tasksQuery.data : [];
  const loading = projectQuery.isLoading || sprintQuery.isLoading || tasksQuery.isLoading;

  function setAllTasks(nextTasks: Task[] | ((current: Task[]) => Task[])) {
    if (!projectId) return;
    queryClient.setQueryData<Task[]>(queryKeys.projectTasks(projectId), (current = []) => (
      typeof nextTasks === 'function' ? nextTasks(current) : nextTasks
    ));
  }

  if (loading) {
    return <PageSkeleton variant="board" />;
  }
  if (!project || !sprint || !projectId || !sprintId) return null;

  const currentMember = project.members?.find((m) => m.user.id === user.id);
  const isAdmin = currentMember?.role === 'ADMIN';

  const sprintTasks = allTasks.filter((t) => t.sprintId === sprintId);
  const days = daysRemaining(sprint.endDate);
  const burndownPoints = buildBurndownData(sprint, allTasks);
  const allSprints = Array.isArray(sprintsListQuery.data) ? sprintsListQuery.data : [];
  const completedSprints = allSprints.filter(isSprintComplete);
  const averageVelocity = computeAverageVelocity(completedSprints, allTasks);
  const sprintCapacity = computeSprintCapacity(sprintTasks, averageVelocity);

  async function handleAnalyzeRisk() {
    if (!projectId || !sprintId || riskLoading) return;
    setRiskLoading(true);
    setRiskError(null);
    try {
      const result = await getSprintRisk(projectId, sprintId);
      setRiskResult(result);
      setRiskPanelOpen(true);
    } catch {
      setRiskError('Could not complete risk analysis. Please try again.');
    } finally {
      setRiskLoading(false);
    }
  }

  function handleSprintCompleted() {
    setCompleteOpen(false);
    toast.success('Sprint completed. Tasks have been moved and the sprint is now in history.');
    navigate(`/projects/${projectId}/sprints`);
  }

  async function handleBoardQuickAdd(input: { title: string; statusId: string; sprintId: string }) {
    if (!projectId) throw new Error('Project not found');
    try {
      const task = await createTask({
        projectId,
        title: input.title,
        statusId: input.statusId,
        sprintId: input.sprintId,
      });
      setAllTasks((current) => upsertTask(current, task));
      queryClient.setQueryData(queryKeys.task(task.id), task);
      toast.success('Task added to the sprint.');
      return task;
    } catch {
      toast.error('Task could not be created.');
      throw new Error('Create failed');
    }
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: project.name, to: `/projects/${projectId}` },
          { label: 'Sprints', to: `/projects/${projectId}/sprints` },
          { label: sprint.name },
        ]}
      />

      {/* Sprint board header */}
      <div className="sprint-board-header app-card">
        {/* Top row: eyebrow context + complete action */}
        <div className="sprint-board-header-top">
          <p className="page-eyebrow">{project.key} · Active sprint</p>
          {isAdmin && (
            <Button variant="secondary" className="sprint-board-complete-btn" onClick={() => setCompleteOpen(true)}>
              <Icon name="check" size={14} /> Complete sprint
            </Button>
          )}
        </div>
        {/* Title row: sprint name + days remaining */}
        <div className="sprint-board-header-title-row">
          <h1 className="sprint-board-title">{sprint.name}</h1>
          {days !== null && (
            <span className={`sprint-days-badge sprint-days-badge--lg${days <= 2 ? ' sprint-days-badge--urgent' : ''}`}>
              {days === 0 ? 'Last day' : `${days}d remaining`}
            </span>
          )}
        </div>
        {/* Goal block */}
        {sprint.goal && (
          <div className="sprint-board-goal">
            <span className="sprint-board-goal-label"><Icon name="activity" size={12} /> Sprint goal</span>
            <p>{sprint.goal}</p>
          </div>
        )}

        {/* Capacity summary */}
        <SprintCapacitySummary capacity={sprintCapacity} />

        {/* Risk analysis */}
        <div className="sprint-risk-section">
          {!riskResult && !riskLoading && (
            <div className="sprint-risk-idle">
              <Button variant="secondary" onClick={handleAnalyzeRisk}>
                <Icon name="sparkles" size={14} /> Analyze sprint risk
              </Button>
              {riskError && <p className="sprint-risk-error">{riskError}</p>}
            </div>
          )}

          {riskLoading && (
            <div className="sprint-risk-loading">
              <Spinner size="sm" />
              <span>Analyzing sprint risk…</span>
            </div>
          )}

          {riskResult && !riskLoading && (
            <div className="sprint-risk-result">
              <div className="sprint-risk-result-row">
                <span className={`risk-badge risk-badge--${riskResult.riskLevel}`}>
                  {riskResult.riskLevel === 'low' ? 'Low risk' : riskResult.riskLevel === 'medium' ? 'Medium risk' : 'High risk'}
                </span>
                <p className="sprint-risk-summary">{riskResult.summary}</p>
              </div>
              <div className="sprint-risk-controls">
                <button
                  type="button"
                  className="sprint-risk-toggle"
                  onClick={() => setRiskPanelOpen((prev) => !prev)}
                >
                  {riskPanelOpen ? 'Hide details' : 'View details'}
                  <Icon name="chevron-down" size={13} className={riskPanelOpen ? 'sort-ascending' : ''} />
                </button>
                <button type="button" className="sprint-risk-rerun" onClick={handleAnalyzeRisk}>
                  <Icon name="sparkles" size={12} /> Re-analyze
                </button>
              </div>

              {riskPanelOpen && (
                <div className="sprint-risk-detail">
                  {riskResult.risks.length > 0 && (
                    <div className="sprint-risk-block">
                      <p className="sprint-risk-block-label">Flagged risks</p>
                      <ul className="sprint-risk-list">
                        {riskResult.risks.map((risk, i) => (
                          <li key={i} className="sprint-risk-item">
                            <strong>{risk.title}</strong>
                            <span>{risk.explanation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {riskResult.suggestions.length > 0 && (
                    <div className="sprint-risk-block">
                      <p className="sprint-risk-block-label">Suggested adjustments</p>
                      <ul className="sprint-risk-list sprint-risk-list--suggestions">
                        {riskResult.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {riskResult.risks.length === 0 && riskResult.suggestions.length === 0 && (
                    <p className="sprint-risk-empty">No specific issues flagged — sprint looks healthy.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="app-card card-padding sprint-burndown-card">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Sprint burndown</p>
            <h2>Ideal pace vs actual work</h2>
            <p>Remaining tasks across the sprint timeline. This updates when tasks move to done.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate(`/projects/${projectId}/analytics`)}>
            <Icon name="activity" size={15} /> Analytics
          </Button>
        </div>
        <BurndownChart points={burndownPoints} />
      </section>

      {/* Tab bar */}
      <div className="sprint-board-tabs">
        <button
          type="button"
          className={`sprint-board-tab${activeTab === 'board' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('board')}
        >
          <Icon name="board" size={15} /> Board
        </button>
        <button
          type="button"
          className={`sprint-board-tab${activeTab === 'backlog' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('backlog')}
        >
          <Icon name="tasks" size={15} /> Manage tasks
          <span className="sprint-board-tab-count">{sprintTasks.length}</span>
        </button>
      </div>

      {/* Board tab */}
      {activeTab === 'board' && (
        <KanbanBoard
          tasks={sprintTasks}
          projectId={projectId}
          onTasksChange={(updated) =>
            setAllTasks((current) =>
              current.map((t) => updated.find((u) => u.id === t.id) ?? t)
            )
          }
          activeSprintId={sprintId}
          onCreateTask={handleBoardQuickAdd}
        />
      )}

      {/* Backlog tab */}
      {activeTab === 'backlog' && (
        <SprintBacklogPanel
          sprintId={sprintId}
          projectId={projectId}
          allTasks={allTasks}
          onTasksChange={setAllTasks}
          averageVelocity={averageVelocity}
        />
      )}

      {/* Complete sprint modal (SCRUM-114) */}
      <CompleteSprintModal
        isOpen={completeOpen}
        projectId={projectId}
        sprintId={sprintId}
        sprintName={sprint.name}
        sprintTasks={sprintTasks}
        onClose={() => setCompleteOpen(false)}
        onCompleted={handleSprintCompleted}
      />
    </>
  );
}
