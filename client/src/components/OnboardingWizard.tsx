import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Icon from './Icon';
import { Button, Input, Modal, Select, Textarea } from './ui';
import { getMyProfile, updateOnboardingStatus } from '../services/userService';
import { getUserProjects, inviteMember, startSprint } from '../services/projectService';
import type { Project } from '../services/projectService';
import { createTask } from '../services/taskService';
import { useToast } from '../hooks/useToast';

const steps = [
  { title: 'Create a task', description: 'Turn the next piece of work into a clear, prioritized task.', icon: 'tasks' as const },
  { title: 'Invite a teammate', description: 'Bring someone into the project with the right access level.', icon: 'team' as const },
  { title: 'Start a sprint', description: 'Give the team a focused two-week delivery window.', icon: 'activity' as const },
];

const projectOptions = (projects: Project[]) => projects.map((project) => ({ value: project.id, label: `${project.key} - ${project.name}` }));

export default function OnboardingWizard() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userId, setUserId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM' });
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'DEVELOPER' });
  const [sprintForm, setSprintForm] = useState({ name: 'Sprint 1', goal: '' });

  useEffect(() => {
    let active = true;
    Promise.all([getMyProfile(), getUserProjects()])
      .then(([profile, projectData]) => {
        if (!active) return;
        const availableProjects = Array.isArray(projectData) ? projectData : [];
        setProjects(availableProjects);
        setUserId(profile.id);
        setProjectId((current) => current || availableProjects[0]?.id || '');

        const requested = new URLSearchParams(location.search).get('onboarding') === 'true';
        const isCreatingProject = location.pathname === '/projects/create';
        if (!isCreatingProject && (requested || (!profile.onboardingCompleted && !profile.onboardingDismissed))) {
          setIsOpen(true);
        }
      })
      .catch(() => undefined);

    return () => { active = false; };
  }, [location.pathname, location.search]);

  const adminProjects = useMemo(() => projects.filter((project) =>
    project.members?.some((member) => member.user.id === userId && member.role === 'ADMIN')
  ), [projects, userId]);

  const selectedAdminProject = adminProjects.find((project) => project.id === projectId) ?? adminProjects[0];

  function clearRequestedOpen() {
    if (new URLSearchParams(location.search).has('onboarding')) {
      navigate({ pathname: location.pathname, search: '' }, { replace: true });
    }
  }

  async function dismissWizard() {
    try { await updateOnboardingStatus('DISMISSED'); } catch { /* Dismiss locally if the request fails. */ }
    setIsOpen(false);
    clearRequestedOpen();
  }

  function nextStep() {
    setError('');
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function completeWizard() {
    setLoading(true);
    try {
      await updateOnboardingStatus('COMPLETED');
      setIsOpen(false);
      clearRequestedOpen();
      toast.success('You are ready to move work forward.');
    } catch {
      setError('We could not save your onboarding progress.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTaskSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId || !taskForm.title.trim()) return setError('Choose a project and enter a task title.');
    setLoading(true); setError('');
    try {
      await createTask({
        projectId,
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        priority: taskForm.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
      });
      toast.success('Your first task was created.');
      nextStep();
    } catch { setError('We could not create that task.'); }
    finally { setLoading(false); }
  }

  async function handleInviteSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedAdminProject || !inviteForm.email.trim()) return setError('Choose an admin project and enter an email.');
    setLoading(true); setError('');
    try {
      const invitation = await inviteMember(selectedAdminProject.id, { email: inviteForm.email.trim(), role: inviteForm.role });
      if (invitation.emailDeliveryStatus === 'FAILED') {
        toast.info('Invitation saved, but the email could not be delivered. Ask them to sign in with this email to accept it.');
      } else {
        toast.success('Invitation email sent.');
      }
      nextStep();
    } catch (requestError) {
      const message = axios.isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data?.message : undefined;
      setError(message || 'We could not send that invitation.');
    } finally { setLoading(false); }
  }

  async function handleSprintSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedAdminProject || !sprintForm.name.trim()) return setError('Choose an admin project and enter a sprint name.');
    setLoading(true); setError('');
    try {
      await startSprint(selectedAdminProject.id, { name: sprintForm.name.trim(), goal: sprintForm.goal.trim() || undefined });
      toast.success('Your first sprint is active.');
      await completeWizard();
    } catch (requestError) {
      const message = axios.isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data?.message : undefined;
      setError(message || 'We could not start that sprint.');
      setLoading(false);
    }
  }

  function createProjectFirst() {
    setIsOpen(false);
    navigate('/projects/create?onboarding=true');
  }

  const selectableProjects = step === 0 ? projects : adminProjects;
  const options = projectOptions(selectableProjects);

  return (
    <Modal isOpen={isOpen} onClose={dismissWizard} className="onboarding-modal">
      <div className="onboarding-header">
        <div><p className="auth-kicker">Welcome to WorkWise</p><h2>Let&apos;s set up your workspace</h2><p>Three small steps, then you are ready to plan with your team.</p></div>
        <button type="button" className="icon-button" aria-label="Close onboarding" onClick={dismissWizard}><Icon name="close" size={18} /></button>
      </div>

      <div className="onboarding-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((item, index) => (
          <div className={`onboarding-step ${index === step ? 'is-active' : ''} ${index < step ? 'is-complete' : ''}`} key={item.title}>
            <span>{index < step ? <Icon name="check" size={14} /> : index + 1}</span>
            <small>{item.title}</small>
          </div>
        ))}
      </div>

      <section className="onboarding-content">
        <span className="onboarding-icon"><Icon name={steps[step].icon} size={24} /></span>
        <p className="auth-kicker">Step {step + 1} of 3</p>
        <h3>{steps[step].title}</h3>
        <p>{steps[step].description}</p>

        {!projects.length ? (
          <div className="onboarding-prerequisite">
            <strong>Create a project first</strong>
            <p>Tasks, teammates, and sprints all live inside a project.</p>
            <Button onClick={createProjectFirst}>Create your first project <Icon name="arrow-right" size={16} /></Button>
          </div>
        ) : step === 0 ? (
          <form className="form-stack" onSubmit={handleTaskSubmit}>
            <Select label="Project" options={options} value={projectId} onChange={(event) => setProjectId(event.target.value)} />
            <Input label="Task title" placeholder="Define the first deliverable" value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} autoFocus />
            <Textarea label="Description" placeholder="What does done look like?" rows={3} value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} />
            <Select label="Priority" options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'URGENT', label: 'Urgent' }]} value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))} />
            <Button type="submit" loading={loading}>Create task and continue <Icon name="arrow-right" size={16} /></Button>
          </form>
        ) : step === 1 ? (
          adminProjects.length ? <form className="form-stack" onSubmit={handleInviteSubmit}>
            <Select label="Project" options={options} value={selectedAdminProject?.id || adminProjects[0]?.id || ''} onChange={(event) => setProjectId(event.target.value)} />
            <Input label="Teammate email" type="email" placeholder="teammate@company.com" value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} autoFocus />
            <Select label="Role" options={[{ value: 'DEVELOPER', label: 'Developer' }, { value: 'VIEWER', label: 'Viewer' }, { value: 'ADMIN', label: 'Admin' }]} value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))} />
            <Button type="submit" loading={loading}>Send invitation and continue <Icon name="arrow-right" size={16} /></Button>
          </form> : <p className="alert alert-error">You need admin access to invite project members.</p>
        ) : (
          adminProjects.length ? <form className="form-stack" onSubmit={handleSprintSubmit}>
            <Select label="Project" options={options} value={selectedAdminProject?.id || adminProjects[0]?.id || ''} onChange={(event) => setProjectId(event.target.value)} />
            <Input label="Sprint name" value={sprintForm.name} onChange={(event) => setSprintForm((current) => ({ ...current, name: event.target.value }))} autoFocus />
            <Textarea label="Sprint goal" placeholder="What should the team accomplish in the next two weeks?" rows={3} value={sprintForm.goal} onChange={(event) => setSprintForm((current) => ({ ...current, goal: event.target.value }))} />
            <Button type="submit" loading={loading}>Start sprint and finish <Icon name="check" size={16} /></Button>
          </form> : <p className="alert alert-error">You need admin access to start a sprint.</p>
        )}

        {(selectedAdminProject?.sprints?.length ?? 0) > 0 && step === 2 && <p className="field-help">This project already has an active sprint. Choose another project or skip this step.</p>}
        {error && <div className="alert alert-error">{error}</div>}
      </section>

      <div className="onboarding-actions">
        <Button variant="ghost" onClick={dismissWizard}>Skip for now</Button>
        <div className="flex gap-2">
          {step > 0 && <Button variant="secondary" onClick={() => { setError(''); setStep((current) => current - 1); }}>Back</Button>}
          {projects.length > 0 && <Button variant="secondary" onClick={step === steps.length - 1 ? completeWizard : nextStep} loading={loading}>{step === steps.length - 1 ? 'Finish later' : 'Skip this step'}</Button>}
        </div>
      </div>
    </Modal>
  );
}
