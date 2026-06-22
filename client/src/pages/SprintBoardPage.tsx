import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CompleteSprintModal from '../components/CompleteSprintModal';
import Icon from '../components/Icon';
import KanbanBoard from '../components/KanbanBoard';
import SprintBacklogPanel from '../components/SprintBacklogPanel';
import { Button, Spinner } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getProjectById, getSprintById } from '../services/projectService';
import type { Project, SprintWithCount } from '../services/projectService';
import { getProjectTasks } from '../services/taskService';
import type { Task } from '../services/taskService';

type Tab = 'board' | 'backlog';

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

  const [project, setProject] = useState<Project | null>(null);
  const [sprint, setSprint] = useState<SprintWithCount | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('board');
  const [completeOpen, setCompleteOpen] = useState(false);

  useEffect(() => {
    if (!projectId || !sprintId) return;
    Promise.all([
      getProjectById(projectId),
      getSprintById(projectId, sprintId),
      getProjectTasks(projectId),
    ])
      .then(([projectData, sprintData, taskData]) => {
        setProject(projectData);
        setSprint(sprintData);
        setAllTasks(taskData);
      })
      .catch(() => navigate(`/projects/${projectId}/sprints`, { replace: true }))
      .finally(() => setLoading(false));
  }, [projectId, sprintId, navigate]);

  if (loading) {
    return <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Loading sprint board...</p></div>;
  }
  if (!project || !sprint || !projectId || !sprintId) return null;

  const currentMember = project.members?.find((m) => m.user.id === user.id);
  const isAdmin = currentMember?.role === 'ADMIN';

  const sprintTasks = allTasks.filter((t) => t.sprintId === sprintId);
  const days = daysRemaining(sprint.endDate);

  function handleSprintCompleted() {
    setCompleteOpen(false);
    toast.success('Sprint completed. Tasks have been moved and the sprint is now in history.');
    navigate(`/projects/${projectId}/sprints`);
  }

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(`/projects/${projectId}/sprints`)}>
        <Icon name="arrow-left" size={15} /> Back to sprints
      </button>

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
      </div>

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
        <>
          {sprintTasks.length === 0 ? (
            <div className="app-card sprint-empty-state">
              <span className="empty-icon"><Icon name="board" size={24} /></span>
              <h3>This sprint has no tasks yet</h3>
              <p>Switch to the <strong>Sprint backlog</strong> tab to add tasks from the product backlog into this sprint.</p>
              <Button variant="secondary" onClick={() => setActiveTab('backlog')}>
                <Icon name="tasks" size={15} /> Open sprint backlog
              </Button>
            </div>
          ) : (
            <KanbanBoard
              tasks={sprintTasks}
              onTasksChange={(updated) =>
                setAllTasks((current) =>
                  current.map((t) => updated.find((u) => u.id === t.id) ?? t)
                )
              }
            />
          )}
        </>
      )}

      {/* Backlog tab */}
      {activeTab === 'backlog' && (
        <SprintBacklogPanel
          sprintId={sprintId}
          projectId={projectId}
          allTasks={allTasks}
          onTasksChange={setAllTasks}
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
