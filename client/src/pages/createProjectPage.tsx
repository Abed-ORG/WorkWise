import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { Button, Card, Input, Textarea } from '../components/ui';
import { createProject } from '../services/projectService';
import { useToast } from '../hooks/useToast';
import { saveProjectIcon } from '../services/projectIconStorage';

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', key: '', description: '', icon: '📁' });
  const projectIcons = ['📁', '🚀', '💻', '🧭', '⚡', '🛠️', '🎯', '🧪'];

  function handleNameChange(name: string) {
    const autoKey = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
    setForm((current) => ({ ...current, name, key: current.key ? current.key : autoKey }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Project name is required.');
    if (form.key.length < 2) return setError('Project key must contain 2 to 5 letters.');

    setLoading(true);
    try {
      const project = await createProject({ name: form.name.trim(), key: form.key, description: form.description.trim() || undefined, icon: form.icon });
      saveProjectIcon(project.id, form.icon);
      const onboardingQuery = searchParams.get('onboarding') === 'true' ? '?onboarding=true' : '';
      navigate(`/projects/${project.id}${onboardingQuery}`);
    } catch (requestError: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data?.message : undefined;
      const errorText = message === 'Project key already exists' ? 'That project key is already in use.' : 'We could not create the project. Please try again.';
      setError(errorText);
      toast.error(errorText);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate('/projects')}><Icon name="arrow-left" size={15} /> Back to projects</button>
      <PageHeader eyebrow="New workspace" title="Create a project" description="Set up the essentials now. You can invite teammates and shape the workflow next." />
      <div className="form-layout animate-enter-delay">
        <Card>
          <form className="form-stack" onSubmit={handleSubmit}>
            <Input label="Project name" placeholder="e.g. AI Project Management Hub" value={form.name} onChange={(event) => handleNameChange(event.target.value)} autoFocus />
            <Input label="Project key" placeholder="AIPM" value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) }))} helperText="2-5 uppercase letters. This becomes the task prefix, such as AIPM-24." maxLength={5} />
            <Textarea label="Description" placeholder="What is this project trying to achieve?" rows={5} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} helperText="Optional, but useful context for teammates and AI planning." />
            <fieldset className="project-icon-picker"><legend>Project icon</legend><div>{projectIcons.map((icon) => <button type="button" key={icon} className={form.icon === icon ? 'is-selected' : ''} onClick={() => setForm((current) => ({ ...current, icon }))} aria-label={`Use ${icon} as project icon`}>{icon}</button>)}</div></fieldset>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate('/projects')}>Cancel</Button><Button type="submit" loading={loading}>Create project <Icon name="arrow-right" size={16} /></Button></div>
          </form>
        </Card>
        <aside className="app-card tip-card">
          <span className="stat-icon"><Icon name="sparkles" size={18} /></span>
          <h3>Start simple, then shape the system.</h3>
          <p>A clear project name and short purpose give your team enough context to begin.</p>
          <div className="tip-list"><div className="tip-item"><span className="tip-dot" />Use a short, memorable project key.</div><div className="tip-item"><span className="tip-dot" />Describe the outcome, not every implementation detail.</div><div className="tip-item"><span className="tip-dot" />Invite teammates after the project is created.</div></div>
        </aside>
      </div>
    </>
  );
}
