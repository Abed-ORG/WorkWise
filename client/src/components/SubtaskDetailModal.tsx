import { useEffect, useState, type FormEvent } from 'react';
import { Button, Input, Modal, Select, Textarea } from './ui';
import type { ProjectMember } from '../services/projectService';
import { updateTaskSubtask } from '../services/taskService';
import type { TaskChecklistItem } from '../services/taskService';

interface SubtaskDetailModalProps {
  subtask: TaskChecklistItem | null;
  members: ProjectMember[];
  onClose: () => void;
  onUpdated: (subtask: TaskChecklistItem) => void;
}

export default function SubtaskDetailModal({ subtask, members, onClose, onUpdated }: SubtaskDetailModalProps) {
  const [text, setText] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!subtask) return;
    setText(subtask.text);
    setDescription(subtask.description ?? '');
    setAssigneeId(subtask.assigneeId ?? '');
    setError('');
  }, [subtask]);

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!subtask) return;
    const trimmedText = text.trim();
    if (!trimmedText) { setError('Subtask title is required.'); return; }

    setSaving(true);
    setError('');
    try {
      const updated = await updateTaskSubtask(subtask.id, {
        text: trimmedText,
        description: description.trim() || null,
        assigneeId: assigneeId || null,
      });
      onUpdated(updated);
      onClose();
    } catch {
      setError('The subtask could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={Boolean(subtask)} onClose={close} title="Subtask details" className="max-w-lg">
      <form className="form-stack mt-5" onSubmit={handleSubmit}>
        <Input label="Title" value={text} onChange={(event) => setText(event.target.value)} placeholder="Subtask title" autoFocus />
        <Textarea
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Add more detail about this subtask..."
          rows={4}
        />
        <Select
          label="Assignee"
          value={assigneeId}
          onChange={(event) => setAssigneeId(event.target.value)}
          options={[
            { value: '', label: 'Unassigned' },
            ...members.map((member) => ({ value: member.user.id, label: `${member.user.name} (${member.role.toLowerCase()})` })),
          ]}
          helperText="Assign this subtask to a project member."
        />
        {error && <div className="board-alert" role="alert">{error}</div>}
        <div className="form-actions">
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" loading={saving}>Save subtask</Button>
        </div>
      </form>
    </Modal>
  );
}
