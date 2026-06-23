import { useState, type FormEvent, type CSSProperties } from 'react';
import { Button, Modal, Textarea } from './ui';
import Icon from './Icon';
import { generateTaskBreakdown } from '../services/aiService';
import type { GeneratedTask } from '../services/aiService';
import { createTask } from '../services/taskService';
import type { Task } from '../services/taskService';
import { useToast } from '../hooks/useToast';

interface Props {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onTasksCreated: (tasks: Task[]) => void;
}

interface EditableSuggestion {
  original: GeneratedTask;
  title: string;
  description: string;
  criteria: string[];
  included: boolean;
}

// Pill toggle that uses the app's success/danger CSS vars — no new library.
function StatusPill({
  included,
  disabled,
  onClick,
}: {
  included: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 14px',
    borderRadius: '999px',
    border: `1.5px solid ${included ? 'var(--success)' : 'var(--danger)'}`,
    background: included ? 'var(--success-soft)' : 'var(--danger-soft)',
    color: included ? 'var(--success)' : 'var(--danger)',
    fontSize: '12px',
    fontWeight: 750,
    lineHeight: 1,
    flexShrink: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  };
  return (
    <button
      type="button"
      style={style}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={included}
      aria-label={included ? 'Click to skip this task' : 'Click to keep this task'}
    >
      {included ? <Icon name="check" size={13} /> : <Icon name="close" size={13} />}
      {included ? 'Keeping' : 'Skipping'}
    </button>
  );
}

export default function AITaskBreakdownModal({ isOpen, projectId, onClose, onTasksCreated }: Props) {
  const toast = useToast();
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [featureDescription, setFeatureDescription] = useState('');
  const [projectContext, setProjectContext] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [suggestions, setSuggestions] = useState<EditableSuggestion[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    if (generating || submitting) return;
    setStep('input');
    setFeatureDescription('');
    setProjectContext('');
    setDescriptionError('');
    setGenerateError('');
    setSuggestions([]);
    onClose();
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    const trimmed = featureDescription.trim();
    if (!trimmed) {
      setDescriptionError('Feature description is required.');
      return;
    }
    setDescriptionError('');
    setGenerateError('');
    setGenerating(true);
    try {
      const result = await generateTaskBreakdown(trimmed, projectContext);
      setSuggestions(
        result.tasks.map((task) => ({
          original: task,
          title: task.title,
          description: task.description,
          criteria: [...task.acceptanceCriteria],
          included: true,
        })),
      );
      setStep('review');
    } catch {
      setGenerateError('Could not generate tasks. Check your connection and try again.');
    } finally {
      setGenerating(false);
    }
  }

  function toggleIncluded(index: number) {
    setSuggestions((current) =>
      current.map((s, i) => (i === index ? { ...s, included: !s.included } : s)),
    );
  }

  function setAllIncluded(included: boolean) {
    setSuggestions((current) => current.map((s) => ({ ...s, included })));
  }

  function updateTitle(index: number, value: string) {
    setSuggestions((current) =>
      current.map((s, i) => (i === index ? { ...s, title: value } : s)),
    );
  }

  function updateDescription(index: number, value: string) {
    setSuggestions((current) =>
      current.map((s, i) => (i === index ? { ...s, description: value } : s)),
    );
  }

  function updateCriteria(index: number, lines: string[]) {
    setSuggestions((current) =>
      current.map((s, i) => (i === index ? { ...s, criteria: lines } : s)),
    );
  }

  async function handleAddToBacklog() {
    const toCreate = suggestions.filter((s) => s.included && s.title.trim());
    if (toCreate.length === 0) {
      toast.error('Keep at least one task before adding to the backlog.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await Promise.all(
        toCreate.map((s) =>
          createTask({
            projectId,
            title: s.title.trim(),
            description: s.description.trim() || undefined,
            priority: s.original.priority,
            acceptanceCriteria: s.criteria.filter((c) => c.trim()).join('\n') || undefined,
          }),
        ),
      );
      onTasksCreated(created);
      toast.success(
        `${created.length} task${created.length === 1 ? '' : 's'} added to the backlog.`,
      );
      handleClose();
    } catch {
      toast.error('One or more tasks could not be created. Check the details and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const keptCount = suggestions.filter((s) => s.included).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="AI task breakdown"
      className="max-w-5xl!"
    >
      {step === 'input' ? (
        <form onSubmit={handleGenerate} noValidate>
          <p className="field-help mb-6">
            Describe a feature and the AI will suggest a set of backlog tasks with priorities,
            acceptance criteria, and time estimates for your review.
          </p>

          <div className="flex flex-col gap-6">
            <Textarea
              label="Feature description"
              placeholder="e.g. Add OAuth login with Google so users can sign in without a password…"
              value={featureDescription}
              onChange={(e) => setFeatureDescription(e.target.value)}
              rows={7}
              maxLength={4000}
              error={descriptionError}
              disabled={generating}
            />

            <Textarea
              label="Project context (optional)"
              placeholder="e.g. React + Node.js SaaS, uses JWT auth, Postgres via Prisma…"
              value={projectContext}
              onChange={(e) => setProjectContext(e.target.value)}
              rows={4}
              maxLength={4000}
              disabled={generating}
            />
          </div>

          {generateError && (
            <p className="field-help field-error mt-3">{generateError}</p>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={handleClose} disabled={generating}>
              Cancel
            </Button>
            {/* loading prop renders Button's own spinner — no manual <Spinner> here */}
            <Button type="submit" loading={generating}>
              {generating ? 'Generating…' : (
                <>
                  <Icon name="sparkles" size={16} />
                  Generate tasks
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div>
          {/* Review header */}
          <div className="flex items-center justify-between mb-5">
            <p className="field-help">
              <strong style={{ color: 'var(--text)' }}>{keptCount}</strong>{' '}
              of {suggestions.length} tasks will be added — edit anything before confirming.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-link"
                style={{ fontSize: '12px' }}
                onClick={() => setAllIncluded(true)}
                disabled={submitting}
              >
                Keep all
              </button>
              <span className="field-help" aria-hidden="true">·</span>
              <button
                type="button"
                className="text-link"
                style={{ fontSize: '12px' }}
                onClick={() => setAllIncluded(false)}
                disabled={submitting}
              >
                Skip all
              </button>
            </div>
          </div>

          {/* Suggestion cards */}
          <div className="flex flex-col gap-6">
            {suggestions.map((suggestion, index) => {
              const cardStyle: CSSProperties = suggestion.included
                ? {}
                : { opacity: 0.52 };

              return (
                <div key={index} className="app-card card-padding" style={cardStyle}>
                  {/* Card header: priority + estimate + keep/skip toggle */}
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`task-priority-dot priority-${suggestion.original.priority.toLowerCase()}`}
                        aria-hidden="true"
                      />
                      <span className="task-priority-label">
                        {suggestion.original.priority.toLowerCase()}
                      </span>
                      <span className="field-help" aria-hidden="true">·</span>
                      <span className="field-help">~{suggestion.original.estimatedHours}h estimated</span>
                    </div>
                    <StatusPill
                      included={suggestion.included}
                      disabled={submitting}
                      onClick={() => toggleIncluded(index)}
                    />
                  </div>

                  {/* Editable title */}
                  <div className="field mb-3">
                    <label htmlFor={`ai-title-${index}`} className="field-label">
                      Title
                    </label>
                    <input
                      id={`ai-title-${index}`}
                      className="field-control"
                      value={suggestion.title}
                      onChange={(e) => updateTitle(index, e.target.value)}
                      disabled={!suggestion.included || submitting}
                      maxLength={200}
                    />
                  </div>

                  {/* Editable description */}
                  <div className="field mb-3">
                    <label htmlFor={`ai-desc-${index}`} className="field-label">
                      Description
                    </label>
                    <textarea
                      id={`ai-desc-${index}`}
                      className="field-control"
                      value={suggestion.description}
                      onChange={(e) => updateDescription(index, e.target.value)}
                      rows={3}
                      disabled={!suggestion.included || submitting}
                      maxLength={4000}
                    />
                  </div>

                  {/* Editable acceptance criteria — one line per criterion */}
                  <div className="field">
                    <label htmlFor={`ai-criteria-${index}`} className="field-label">
                      Acceptance criteria
                    </label>
                    <textarea
                      id={`ai-criteria-${index}`}
                      className="field-control"
                      value={suggestion.criteria.join('\n')}
                      onChange={(e) => updateCriteria(index, e.target.value.split('\n'))}
                      rows={Math.max(2, suggestion.criteria.length + 1)}
                      disabled={!suggestion.included || submitting}
                      placeholder="One criterion per line…"
                    />
                    <p className="field-help">One criterion per line.</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-3 mt-5">
            <Button variant="ghost" onClick={() => setStep('input')} disabled={submitting}>
              <Icon name="arrow-left" size={16} />
              Back
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleAddToBacklog}
                loading={submitting}
                disabled={keptCount === 0}
              >
                <Icon name="plus" size={16} />
                {keptCount > 0 ? `Add ${keptCount} to backlog` : 'Add to backlog'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
