import { useEffect, useState } from 'react';
import DocumentLinkPicker from './DocumentLinkPicker';
import Icon from './Icon';
import { Modal, Spinner } from './ui';
import { getTaskById, updateTaskDocuments } from '../services/taskService';
import type { Task } from '../services/taskService';
import type { ProjectDocument } from '../services/projectService';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

function formatStatus(status?: string) {
  if (!status) return 'Unknown';
  return status.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function formatDate(date?: string | null) {
  if (!date) return 'No due date';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

export default function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [linkedDocuments, setLinkedDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setLinkedDocuments([]);
      return;
    }

    setLoading(true);
    setError('');
    getTaskById(taskId)
      .then((taskData) => {
        setTask(taskData);
        setLinkedDocuments(taskData.documents ?? []);
      })
      .catch(() => setError('Task details could not be loaded.'))
      .finally(() => setLoading(false));
  }, [taskId]);

  async function handleDocumentChange(documentIds: string[]) {
    if (!taskId) return linkedDocuments;
    const documents = await updateTaskDocuments(taskId, documentIds);
    setLinkedDocuments(documents);
    setTask((current) => current ? { ...current, documents } : current);
    return documents;
  }

  return (
    <Modal isOpen={Boolean(taskId)} onClose={onClose} className="task-detail-modal">
      {loading ? (
        <div className="task-detail-loading"><Spinner /><span>Loading task details...</span></div>
      ) : error ? (
        <div className="empty-panel"><p>{error}</p></div>
      ) : task ? (
        <div className="task-detail-stack">
          <header className="task-detail-header">
            <div>
              <p className="section-kicker">{task.project?.key ?? 'Task'}{task.sprint ? ` / ${task.sprint.name}` : ''}</p>
              <h2>{task.title}</h2>
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close task details"><Icon name="close" size={18} /></button>
          </header>

          <div className="task-detail-meta">
            <span className={`status-badge status-${task.status.toLowerCase()}`}>{formatStatus(task.status)}</span>
            <span className={`priority-badge priority-${task.priority.toLowerCase()}`}><span />{task.priority.toLowerCase()}</span>
            <span className="due-date"><Icon name="calendar" size={14} />{formatDate(task.dueDate)}</span>
          </div>

          <section className="task-detail-section">
            <h3>Details</h3>
            <div className="task-detail-fields">
              <div><span>Assignee</span><strong>{task.assignee?.name ?? 'Unassigned'}</strong></div>
              <div><span>Reporter</span><strong>{task.creator?.name ?? 'Unknown'}</strong></div>
              <div><span>Project</span><strong>{task.project?.name ?? 'Unknown'}</strong></div>
            </div>
          </section>

          <section className="task-detail-section">
            <h3>Description</h3>
            {task.description ? <p className="task-description">{task.description}</p> : <p className="task-description is-empty">No description provided.</p>}
          </section>

          {task.labels?.length > 0 && (
            <section className="task-detail-section">
              <h3>Labels</h3>
              <div className="task-label-list">{task.labels.map((label) => <span key={label}>{label}</span>)}</div>
            </section>
          )}

          <section className="task-detail-section">
            <h3>Linked documents</h3>
            <DocumentLinkPicker projectId={task.projectId} linkedDocuments={linkedDocuments} onChange={handleDocumentChange} />
          </section>

          <section className="task-detail-section">
            <h3>Comments and activity</h3>
            <div className="activity-summary">
              <span><Icon name="document" size={15} /> {task.comments?.length ?? 0} comments</span>
              <span><Icon name="activity" size={15} /> {task.activities?.length ?? 0} activity events</span>
            </div>
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
