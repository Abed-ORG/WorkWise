import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { Button, Card, Input, Textarea } from '../components/ui';
import { createProject } from '../services/projectService';

function generateProjectKey(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .flatMap((word) => {
      const letters = word.replace(/[^A-Za-z]/g, '');
      if (!letters) return [];
      return /^[A-Z]{2,3}$/.test(letters) ? letters.split('') : [letters[0]];
    })
    .join('')
    .toUpperCase()
    .slice(0, 5);
}

function sanitizeProjectKey(key: string) {
  return key.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
}

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', key: '', description: '' });
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);

  function handleNameChange(name: string) {
    const autoKey = generateProjectKey(name);
    setForm((current) => ({ ...current, name, key: keyManuallyEdited ? current.key : autoKey }));
  }

  function handleKeyChange(key: string) {
    const nextKey = sanitizeProjectKey(key);
    setKeyManuallyEdited(nextKey.length > 0);
    setForm((current) => ({ ...current, key: nextKey.length > 0 ? nextKey : generateProjectKey(current.name) }));
  }

  function resetProjectKey() {
    setKeyManuallyEdited(false);
    setForm((current) => ({ ...current, key: generateProjectKey(current.name) }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Project name is required.');
    if (!/^[A-Z]{2,5}$/.test(form.key)) return setError('Project key must contain 2 to 5 uppercase letters.');

    setLoading(true);
    try {
      const project = await createProject({ name: form.name.trim(), key: form.key, description: form.description.trim() || undefined });
      const onboardingQuery = searchParams.get('onboarding') === 'true' ? '?onboarding=true' : '';
      navigate(`/projects/${project.id}${onboardingQuery}`);
    } catch (requestError: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(requestError) ? requestError.response?.data?.message : undefined;
      setError(message === 'Project key already exists' ? 'That project key is already in use.' : 'We could not create the project. Please try again.');
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
            <div className="project-key-field">
              <Input label="Project key" placeholder="AIPMH" value={form.key} onChange={(event) => handleKeyChange(event.target.value)} helperText="2-5 uppercase letters. This becomes the task prefix, such as AIPMH-24." maxLength={5} />
              {keyManuallyEdited && (
                <Button type="button" variant="ghost" className="project-key-reset" onClick={resetProjectKey}>Reset key</Button>
              )}
            </div>
            <div className="project-key-preview" aria-live="polite">
              <span>Project key preview</span>
              <strong>{form.key || 'KEY'}</strong>
              <small>{keyManuallyEdited ? 'Manual key override is active.' : 'Updates automatically from the project name.'}</small>
            </div>
            <Textarea label="Description" placeholder="What is this project trying to achieve?" rows={5} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} helperText="Optional, but useful context for teammates and AI planning." />
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
