import { useState, type FormEvent } from 'react';
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

export default function AITaskBreakdownModal({ isOpen, projectId, onClose, onTasksCreated }: Props) {
  const toast = useToast();
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [featureDescription, setFeatureDescription] = useState('');
  const [projectContext, setProjectContext] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [suggestions, setSuggestions] = useState<EditableSuggestion[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    if (generating || submitting) return;
    setStep('input');
    setFeatureDescription('');
    setProjectContext('');
    setDescriptionError('');
    setGenerateError('');
    setSuggestions([]);
    setSelectionMode(false);
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
      setSelectionMode(false);
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

  function startSelection() {
    setSuggestions((current) => current.map((s) => ({ ...s, included: true })));
    setSelectionMode(true);
  }

  function cancelSelection() {
    setSuggestions((current) => current.map((s) => ({ ...s, included: true })));
    setSelectionMode(false);
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
      toast.error('Select at least one task before adding to the backlog.');
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
            <Button
              variant={selectionMode ? 'ghost' : 'secondary'}
              className="ai-breakdown-select-btn"
              onClick={selectionMode ? cancelSelection : startSelection}
              disabled={submitting}
            >
              {selectionMode ? 'Cancel selection' : 'Select'}
            </Button>
          </div>

          {/* Suggestion cards */}
          <div className="flex flex-col gap-6">
            {suggestions.map((suggestion, index) => {
              const isSelected = suggestion.included;
              const cardClassName = [
                'app-card',
                'card-padding',
                'ai-breakdown-card',
                selectionMode ? 'is-selection-mode' : '',
                selectionMode && isSelected ? 'is-selected' : '',
              ].filter(Boolean).join(' ');

              return (
                <div key={index} className={cardClassName}>
                  {selectionMode && (
                    <input
                      className="themed-checkbox ai-breakdown-card-checkbox"
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleIncluded(index)}
                      disabled={submitting}
                      aria-label={`Select ${suggestion.title || `generated task ${index + 1}`}`}
                    />
                  )}
                  <div className="ai-breakdown-card-body">
                    {/* Card header: priority + estimate */}
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`task-priority-dot priority-${suggestion.original.priority.toLowerCase()}`}
                          aria-hidden="true"
                        />
                        <span className="task-priority-label">
                          {suggestion.original.priority.toLowerCase()}
                        </span>
                        <span className="field-help">~{suggestion.original.estimatedHours}h estimated</span>
                      </div>
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
                        disabled={submitting}
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
                      disabled={submitting}
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
                      disabled={submitting}
                      placeholder="One criterion per line…"
                    />
                    <p className="field-help">One criterion per line.</p>
                  </div>
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
                Add {keptCount} {keptCount === 1 ? 'task' : 'tasks'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
