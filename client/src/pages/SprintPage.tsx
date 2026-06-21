import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import { Button, Input, Modal, Spinner, Textarea } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { createSprint, getProjectById, getProjectSprints, startSprint } from '../services/projectService';
import type { Project, Sprint } from '../services/projectService';

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysRemaining(endDateStr?: string): number | null {
  if (!endDateStr) return null;
  const diff = new Date(endDateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function dateOnly(value?: string): Date | undefined {
  if (!value) return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

interface SprintCardProps {
  sprint: Sprint;
  variant: 'active' | 'upcoming' | 'past';
  onViewBoard?: () => void;
}

function SprintCard({ sprint, variant, onViewBoard }: SprintCardProps) {
  const days = variant === 'active' ? daysRemaining(sprint.endDate) : null;

  return (
    <div className={`sprint-card sprint-card--${variant}`}>
      <div className="sprint-card-main">
        <div className="sprint-card-identity">
          <span className={`sprint-status-pip sprint-status-pip--${variant}`} />
          <strong className="sprint-card-name">{sprint.name}</strong>
          {variant === 'active' && days !== null && (
            <span className="sprint-days-badge">
              {days === 0 ? 'Last day' : `${days}d left`}
            </span>
          )}
          {variant === 'active' && onViewBoard && (
            <Button className="sprint-card-view-btn" onClick={onViewBoard}>
              <Icon name="board" size={15} /> View board
            </Button>
          )}
        </div>

        <dl className="sprint-card-meta">
          <div className="sprint-card-meta-row">
            <dt><Icon name="calendar" size={12} />Dates</dt>
            <dd>
              {sprint.startDate || sprint.endDate
                ? <><span>{formatDate(sprint.startDate)}</span><span className="sprint-date-sep">→</span><span>{formatDate(sprint.endDate)}</span></>
                : <span className="sprint-date-none">No dates set</span>
              }
            </dd>
          </div>
          {sprint.goal && (
            <div className="sprint-card-meta-row sprint-card-meta-row--goal">
              <dt><Icon name="activity" size={12} />Goal</dt>
              <dd><span className="sprint-goal-text">{sprint.goal}</span></dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

export default function SprintPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', goal: '', activateNow: false });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([getProjectById(projectId), getProjectSprints(projectId)])
      .then(([projectData, sprintData]) => {
        setProject(projectData);
        setSprints(sprintData);
      })
      .catch(() => navigate('/projects', { replace: true }))
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

  const now = new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const activeSprints = sprints.filter((s) => s.isActive);
  const isPastSprint = (sprint: Sprint) => {
    const endDateOnly = dateOnly(sprint.endDate);
    return Boolean(endDateOnly && endDateOnly < todayOnly);
  };
  const pastSprints = sprints.filter((s) => !s.isActive && isPastSprint(s));
  const upcomingSprints = sprints.filter((s) => !s.isActive && !isPastSprint(s));

  function openCreateModal() {
    setForm({ name: '', startDate: '', endDate: '', goal: '', activateNow: activeSprints.length === 0 });
    setFormError('');
    setCreateOpen(true);
  }

  function closeModal() {
    setCreateOpen(false);
    setFormError('');
    setForm({ name: '', startDate: '', endDate: '', goal: '', activateNow: false });
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId) return;
    if (!form.name.trim()) return setFormError('Sprint name is required.');
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      return setFormError('End date must be on or after start date.');
    }
    setSaving(true);
    setFormError('');
    try {
      let sprint: Sprint;
      if (form.activateNow) {
        sprint = await startSprint(projectId, {
          name: form.name.trim(),
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          goal: form.goal.trim() || undefined,
        });
      } else {
        sprint = await createSprint(projectId, {
          name: form.name.trim(),
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          goal: form.goal.trim() || undefined,
        });
      }
      setSprints((current) => [...current, sprint]);
      closeModal();
      toast.success(form.activateNow ? 'Sprint started.' : 'Sprint created.');
    } catch (requestError) {
      const message = axios.isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data?.message
        : undefined;
      setFormError(message || (form.activateNow ? 'Could not start the sprint.' : 'Could not create the sprint.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Loading sprints...</p></div>;
  if (!project || !projectId) return null;

  const currentMember = project.members?.find((member) => member.user.id === user.id);
  const isAdmin = currentMember?.role === 'ADMIN';

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(`/projects/${projectId}`)}><Icon name="arrow-left" size={15} /> Back to project</button>
      <PageHeader
        eyebrow={project.key}
        title="Sprints"
        description="Plan and track the team's delivery cycles."
        actions={isAdmin ? <Button onClick={openCreateModal}><Icon name="plus" size={16} /> Create sprint</Button> : undefined}
      />

      <div className="settings-stack animate-enter-delay">
        <section className="app-card settings-section">
          <div className="settings-section-head">
            <div>
              <h2>Active</h2>
              <p className="field-help mt-1">The sprint currently in progress.</p>
            </div>
          </div>
          {activeSprints.length > 0 ? (
            <div className="sprint-list">
              {activeSprints.map((sprint) => (
                <SprintCard
                  key={sprint.id}
                  sprint={sprint}
                  variant="active"
                  onViewBoard={() => navigate(`/projects/${projectId}/sprints/${sprint.id}/board`)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-panel" style={{ minHeight: 140 }}>
              <span className="empty-icon"><Icon name="activity" size={22} /></span>
              <h3>No active sprint</h3>
              <p>Start a sprint to begin tracking delivery against a goal.</p>
              {isAdmin && (
                <Button onClick={openCreateModal}>
                  <Icon name="activity" size={15} /> Create sprint
                </Button>
              )}
            </div>
          )}
        </section>

        <section className="app-card settings-section">
          <div className="settings-section-head">
            <div><h2>Upcoming</h2><p className="field-help mt-1">Sprints scheduled to start in the future.</p></div>
          </div>
          {upcomingSprints.length > 0 ? (
            <div className="sprint-list">
              {upcomingSprints.map((sprint) => (
                <SprintCard key={sprint.id} sprint={sprint} variant="upcoming" />
              ))}
            </div>
          ) : (
            <p className="field-help">No upcoming sprints.</p>
          )}
        </section>

        <section className="app-card settings-section">
          <div className="settings-section-head">
            <div><h2>Past</h2><p className="field-help mt-1">Completed sprint history.</p></div>
          </div>
          {pastSprints.length > 0 ? (
            <div className="sprint-list">
              {pastSprints.map((sprint) => (
                <SprintCard key={sprint.id} sprint={sprint} variant="past" />
              ))}
            </div>
          ) : (
            <p className="field-help">No completed sprints yet.</p>
          )}
        </section>
      </div>

      <Modal isOpen={createOpen} onClose={closeModal} title="Create sprint">
        <form className="form-stack" onSubmit={handleCreate}>
          <Input
            label="Sprint name"
            placeholder="e.g. Sprint 1"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            autoFocus
          />
          <Input
            label="Start date"
            type="date"
            value={form.startDate}
            onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
          />
          <Input
            label="End date"
            type="date"
            value={form.endDate}
            onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
          />
          <Textarea
            label="Goal (optional)"
            placeholder="What should the team accomplish?"
            rows={3}
            value={form.goal}
            onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))}
          />

          {activeSprints.length === 0 ? (
            <label className="sprint-activate-toggle">
              <input
                type="checkbox"
                checked={form.activateNow}
                onChange={(event) => setForm((current) => ({ ...current, activateNow: event.target.checked }))}
              />
              <span className="sprint-activate-toggle-copy">
                <strong>Start sprint immediately</strong>
                <span>Activates this sprint now. Dates above are used; omitting them defaults to today → 14 days.</span>
              </span>
            </label>
          ) : (
            <p className="field-help">A sprint is already active — this will be added as an upcoming sprint.</p>
          )}

          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saving}>
              {form.activateNow ? 'Start sprint' : 'Create sprint'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
