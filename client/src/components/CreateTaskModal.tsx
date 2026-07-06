import { useState, type FormEvent } from 'react';
import { Button, Input, Modal, Select, Textarea } from './ui';
import type { ProjectMember } from '../services/projectService';
import { createTask } from '../services/taskService';
import type { Task, TaskPriority } from '../services/taskService';
import { storyPointsSelectOptions } from '../utils/storyPoints';

interface CreateTaskModalProps {
  isOpen: boolean;
  projectId: string;
  members: ProjectMember[];
  onClose: () => void;
  onCreated: (task: Task) => void;
}

const initialForm = {
  title: '',
  description: '',
  priority: 'MEDIUM' as TaskPriority,
  assigneeId: '',
  storyPoints: '',
  labels: '',
  dueDate: '',
};

export default function CreateTaskModal({ isOpen, projectId, members, onClose, onCreated }: CreateTaskModalProps) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function close() {
    if (submitting) return;
    setForm(initialForm);
    setError('');
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) { setError('Task title is required.'); return; }
    if (form.dueDate && new Date(`${form.dueDate}T23:59:59`) < new Date()) { setError('Due date cannot be in the past.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const task = await createTask({
        projectId,
        title,
        description: form.description.trim() || undefined,
        storyPoints: form.storyPoints ? Number(form.storyPoints) : undefined,
        priority: form.priority,
        assigneeId: form.assigneeId || undefined,
        labels: form.labels.split(',').map((label) => label.trim()).filter(Boolean),
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : undefined,
      });
      onCreated(task);
      setForm(initialForm);
      onClose();
    } catch {
      setError('The task could not be created. Check the details and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="Create a task" className="max-w-xl">
      <form className="form-stack mt-5" onSubmit={handleSubmit}>
        <Input label="Task title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What needs to be done?" autoFocus />
        <Textarea label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add context, requirements, or a clear outcome." rows={4} />
        <div className="form-grid-2">
          <Select label="Priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })} options={[
            { value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'URGENT', label: 'Urgent' },
          ]} />
          <Select label="Assignee" value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })} options={[
            { value: '', label: 'Unassigned' },
            ...members.map((member) => ({ value: member.user.id, label: `${member.user.name} (${member.role.toLowerCase()})` })),
          ]} />
        </div>
        <div className="form-grid-2">
          <Select label="Story points" value={form.storyPoints} onChange={(event) => setForm({ ...form, storyPoints: event.target.value })} options={storyPointsSelectOptions} />
          <Input label="Labels" value={form.labels} onChange={(event) => setForm({ ...form, labels: event.target.value })} placeholder="frontend, urgent" helperText="Separate labels with commas." />
        </div>
        <div className="form-grid-2">
          <Input label="Due date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
        </div>
        {error && <div className="board-alert" role="alert">{error}</div>}
        <div className="form-actions"><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit" loading={submitting}>Create task</Button></div>
      </form>
    </Modal>
  );
}
