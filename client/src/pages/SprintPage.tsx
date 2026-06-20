import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import { Button, Input, Modal, Spinner, Textarea } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { createSprint, getProjectById, getProjectSprints } from '../services/projectService';
import type { Project, Sprint } from '../services/projectService';

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', goal: '' });
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

  function closeModal() {
    setCreateOpen(false);
    setFormError('');
    setForm({ name: '', startDate: '', endDate: '', goal: '' });
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
      const sprint = await createSprint(projectId, {
        name: form.name.trim(),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        goal: form.goal.trim() || undefined,
      });
      setSprints((current) => [...current, sprint]);
      closeModal();
      toast.success('Sprint created.');
    } catch (requestError) {
      const message = axios.isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data?.message
        : undefined;
      setFormError(message || 'We could not create that sprint.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Loading sprints...</p></div>;
  if (!project || !projectId) return null;

  const currentMember = project.members?.find((member) => member.user.id === user.id);
  const isAdmin = currentMember?.role === 'ADMIN';

  const today = new Date();
  const activeSprints = sprints.filter((s) => s.isActive);
  const pastSprints = sprints.filter((s) => !s.isActive && !!s.endDate && new Date(s.endDate) < today);
  const upcomingSprints = sprints.filter((s) => !s.isActive && (!s.endDate || new Date(s.endDate) >= today));

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(`/projects/${projectId}`)}><Icon name="arrow-left" size={15} /> Back to project</button>
      <PageHeader
        eyebrow={project.key}
        title="Sprints"
        description="Plan and track the team's delivery cycles."
        actions={isAdmin ? <Button onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> Create sprint</Button> : undefined}
      />

      <div className="settings-stack animate-enter-delay">
        <section className="app-card settings-section">
          <div className="settings-section-head">
            <div><h2>Active</h2><p className="field-help mt-1">The sprint currently in progress.</p></div>
          </div>
          {activeSprints.length > 0 ? (
            <div className="focus-list">
              {activeSprints.map((sprint) => (
                <div className="focus-item" key={sprint.id}>
                  <span className="focus-copy">
                    <strong>{sprint.name}</strong>
                    <span>{formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}</span>
                    {sprint.goal && <span>{sprint.goal}</span>}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="field-help">No active sprint. Use the start sprint flow to activate one.</p>
          )}
        </section>

        <section className="app-card settings-section">
          <div className="settings-section-head">
            <div><h2>Upcoming</h2><p className="field-help mt-1">Sprints scheduled to start in the future.</p></div>
          </div>
          {upcomingSprints.length > 0 ? (
            <div className="focus-list">
              {upcomingSprints.map((sprint) => (
                <div className="focus-item" key={sprint.id}>
                  <span className="focus-copy">
                    <strong>{sprint.name}</strong>
                    <span>{formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}</span>
                    {sprint.goal && <span>{sprint.goal}</span>}
                  </span>
                </div>
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
            <div className="focus-list">
              {pastSprints.map((sprint) => (
                <div className="focus-item" key={sprint.id}>
                  <span className="focus-copy">
                    <strong>{sprint.name}</strong>
                    <span>{formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}</span>
                    {sprint.goal && <span>{sprint.goal}</span>}
                  </span>
                </div>
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
            label="Goal"
            placeholder="What should the team accomplish?"
            rows={3}
            value={form.goal}
            onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))}
          />
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saving}>Create sprint</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
