import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Breadcrumbs from '../components/Breadcrumbs';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import DocumentLinkPicker from '../components/DocumentLinkPicker';
import ProjectStatusSettings from '../components/ProjectStatusSettings';
import { Button, Input, Modal, Select, Spinner, Textarea } from '../components/ui';
import PageSkeleton from '../components/PageSkeleton';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getInitials } from '../utils/initials';
import {
  getProjectById,
  updateProject,
  deleteProject,
  inviteMember,
  getProjectInvitations,
  getSprintDocuments,
  updateMemberRole,
  updateSprintDocuments,
  removeMember,
} from '../services/projectService';
import type { Project, Invitation, ProjectDocument, ActiveSprint } from '../services/projectService';

const roleOptions = [
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'VIEWER', label: 'Viewer' },
];

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'DEVELOPER' });

  useEffect(() => {
    if (!projectId) return;
    Promise.all([getProjectById(projectId), getProjectInvitations(projectId)])
      .then(([projectData, invitationData]) => {
        setProject(projectData);
        setInvitations(Array.isArray(invitationData) ? invitationData : []);
        setForm({ name: projectData.name, description: projectData.description || '' });
      })
      .catch(() => navigate('/projects', { replace: true }))
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

  async function handleSave() {
    if (!projectId || !form.name.trim()) return;
    setSaving(true);
    try {
      const updated = await updateProject(projectId, { name: form.name.trim(), description: form.description.trim() });
      setProject(updated);
      toast.success('Project details updated.');
    } catch {
      toast.error('Failed to update project.');
    } finally {
      setSaving(false);
    }
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId) return;
    try {
      const invitation = await inviteMember(projectId, inviteForm);
      setInvitations((current) => [...current, invitation]);
      setInviteForm({ email: '', role: 'DEVELOPER' });
      setShowInviteForm(false);
      toast.success('Invitation email sent successfully.');
    } catch (requestError: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data?.message : undefined;
      toast.error(message || 'Failed to send invitation.');
    }
  }

  async function refreshProject() {
    if (!projectId) return;
    setProject(await getProjectById(projectId));
  }

  async function handleRoleChange(memberId: string, role: string) {
    if (!projectId) return;
    try {
      await updateMemberRole(projectId, memberId, role);
      await refreshProject();
    } catch {
      toast.error('Failed to update member role.');
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!projectId) return;
    try {
      await removeMember(projectId, memberId);
      await refreshProject();
      toast.success('Member removed.');
    } catch {
      toast.error('Failed to remove member.');
    }
  }

  async function handleDelete() {
    if (!projectId || !project || deleteConfirmName !== project.name) return;
    setDeleting(true);
    try {
      await deleteProject(projectId);
      navigate('/projects');
    } catch {
      toast.error('Failed to delete project.');
      setShowDeleteConfirm(false);
      setDeleteConfirmName('');
      setDeleting(false);
    }
  }

  if (loading) return <PageSkeleton variant="cards" />;
  if (!project) return null;
  const canDeleteProject = deleteConfirmName === project.name;
  const currentMember = project.members?.find((member) => member.user.id === user.id);
  const isAdmin = currentMember?.role === 'ADMIN';

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: project.name, to: `/projects/${projectId}` },
          { label: 'Settings' },
        ]}
      />

      <PageHeader eyebrow={project.key} title="Project settings" description="Manage project details, teammate access, and permanent workspace actions." />

      <div className="settings-stack animate-enter-delay">
        <section className="app-card settings-section">
          <div className="settings-section-head"><div><h2>General details</h2><p className="field-help mt-1">Keep the project name and purpose clear for everyone.</p></div></div>
          <div className="form-stack">
            <Input label="Project name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <Textarea label="Description" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            <Input label="Project key" value={project.key} disabled helperText="The project key cannot be changed after creation." />
            <div><Button loading={saving} onClick={handleSave}>Save changes</Button></div>
          </div>
        </section>

        <section className="app-card settings-section">
          <div className="settings-section-head">
            <div><h2>Members</h2><p className="field-help mt-1">Control who can view and manage this project.</p></div>
            <Button onClick={() => setShowInviteForm((current) => !current)}><Icon name="plus" size={16} /> Invite member</Button>
          </div>

          {showInviteForm && (
            <form className="invite-panel" onSubmit={handleInvite}>
              <div className="inline-form">
                <Input type="email" placeholder="teammate@company.com" value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} required />
                <Select options={roleOptions} value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))} />
                <Button type="submit">Send invite</Button>
              </div>
            </form>
          )}

          <div className="member-list">
            {project.members.map((member) => (
              <div className="member-row" key={member.id}>
                <div className="member-info">
                  <span className="avatar">{getInitials(member.user.name)}</span>
                  <div><strong>{member.user.name}</strong><span>{member.user.email}</span></div>
                </div>
                <div className="member-actions">
                  <Select className="compact-select" options={roleOptions} value={member.role} onChange={(event) => handleRoleChange(member.id, event.target.value)} aria-label={`Role for ${member.user.name}`} />
                  <Button variant="ghost" onClick={() => handleRemoveMember(member.id)}>Remove</Button>
                </div>
              </div>
            ))}
          </div>

          {invitations.length > 0 && (
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <p className="field-label mb-2">Pending invitations</p>
              {invitations.map((invitation) => <div className="member-row" key={invitation.id}><div className="member-info"><span className="avatar"><Icon name="bell" size={15} /></span><div><strong>{invitation.email}</strong><span>Awaiting response</span></div></div><span className="project-key">{invitation.role}</span></div>)}
            </div>
          )}
        </section>

        {isAdmin && <ProjectStatusSettings projectId={project.id} />}

        <section className="app-card settings-section">
          <div className="settings-section-head"><div><h2>Sprint documents</h2><p className="field-help mt-1">Attach project documentation to active sprint planning.</p></div></div>
          {project.sprints?.length ? (
            <div className="sprint-document-stack">
              {project.sprints.map((sprint) => (
                <SprintDocumentLinks key={sprint.id} projectId={project.id} sprint={sprint} />
              ))}
            </div>
          ) : (
            <div className="document-link-empty">No active sprint is available for document links.</div>
          )}
        </section>

        <section className="app-card settings-section danger-card">
          <div className="danger-row">
            <div><h3>Delete this project</h3><p>This permanently removes its tasks, sprints, members, and history.</p></div>
            <Button variant="danger" onClick={() => { setDeleteConfirmName(''); setShowDeleteConfirm(true); }}>Delete project</Button>
          </div>
        </section>
      </div>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteConfirmName(''); }}
        title="Delete project permanently?"
        className="delete-project-modal"
      >
        <div className="delete-warning">
          <span className="delete-warning-icon"><Icon name="trash" size={18} /></span>
          <div>
            <strong>This action is permanent.</strong>
            <p>This will delete <strong>{project.name}</strong>, including its tasks, sprints, members, documents, and history. It cannot be undone.</p>
          </div>
        </div>
        <Input
          label={`Type "${project.name}" to confirm`}
          value={deleteConfirmName}
          onChange={(event) => setDeleteConfirmName(event.target.value)}
          placeholder={project.name}
          autoFocus
        />
        <div className="form-actions mt-6">
          <Button variant="secondary" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmName(''); }}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={!canDeleteProject} loading={deleting}>Delete project permanently</Button>
        </div>
      </Modal>
    </>
  );
}

function SprintDocumentLinks({ projectId, sprint }: { projectId: string; sprint: ActiveSprint }) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSprintDocuments(projectId, sprint.id)
      .then((linkedDocuments) => setDocuments(Array.isArray(linkedDocuments) ? linkedDocuments : []))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [projectId, sprint.id]);

  async function handleChange(documentIds: string[]) {
    const linkedDocuments = await updateSprintDocuments(projectId, sprint.id, documentIds);
    setDocuments(linkedDocuments);
    return linkedDocuments;
  }

  return (
    <div className="sprint-document-panel">
      <div className="sprint-document-head">
        <span className="status-marker status-in_progress" />
        <div><strong>{sprint.name}</strong><span>{sprint.goal || 'Active sprint'}</span></div>
      </div>
      {loading ? <div className="document-loading"><Spinner /><span>Loading sprint documents...</span></div> : (
        <DocumentLinkPicker projectId={projectId} linkedDocuments={documents} onChange={handleChange} />
      )}
    </div>
  );
}
