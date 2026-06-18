import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BacklogList from '../components/BacklogList';
import CreateTaskModal from '../components/CreateTaskModal';
import Icon from '../components/Icon';
import KanbanBoard from '../components/KanbanBoard';
import PageHeader from '../components/PageHeader';
import RichTextEditor from '../components/RichTextEditor';
import TaskDetailModal from '../components/TaskDetailModal';
import { Button, Spinner } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  createProjectDocument,
  deleteProjectDocument,
  getProjectById,
  getProjectDocuments,
  updateProjectDocument,
} from '../services/projectService';
import type { Project, ProjectDocument } from '../services/projectService';
import { deleteTask, getProjectTasks } from '../services/taskService';
import type { Task } from '../services/taskService';

export default function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(true);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentDeleting, setDocumentDeleting] = useState(false);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentDraftOpen, setDocumentDraftOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [documentMessage, setDocumentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([getProjectById(projectId), getProjectTasks(projectId)])
      .then(([projectData, taskData]) => { setProject(projectData); setTasks(taskData); })
      .catch(() => navigate('/projects', { replace: true }))
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

  useEffect(() => {
    if (!projectId) return;
    setDocumentLoading(true);
    setDocumentMessage(null);

    getProjectDocuments(projectId)
      .then((projectDocuments) => {
        const loadedDocuments = Array.isArray(projectDocuments) ? projectDocuments : [];
        const firstDocument = loadedDocuments[0] ?? null;
        setDocuments(loadedDocuments);
        setSelectedDocumentId(firstDocument?.id ?? null);
        setDocumentDraftOpen(false);
        setDocumentTitle(firstDocument?.title ?? '');
        setDocumentContent(firstDocument?.content || '');
      })
      .catch(() => setDocumentMessage({ type: 'error', text: 'Documentation could not be loaded.' }))
      .finally(() => setDocumentLoading(false));
  }, [projectId]);

  if (loading) return <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Opening project...</p></div>;
  if (!project || !projectId) return null;

  const currentMember = project.members?.find((member) => member.user.id === user.id);
  const isAdmin = currentMember?.role === 'ADMIN';
  const openTaskCount = tasks.filter((task) => task.status !== 'DONE').length;

  async function handleDeleteSelected(taskIds: string[]) {
    try {
      await Promise.all(taskIds.map(deleteTask));
      setTasks((current) => current.filter((task) => !taskIds.includes(task.id)));
      toast.success(`${taskIds.length} task${taskIds.length === 1 ? '' : 's'} deleted.`);
    } catch {
      toast.error('One or more tasks could not be deleted.');
    }
  }

  async function handleSaveDocument() {
    if (!projectId) return;

    const trimmedTitle = documentTitle.trim();
    if (!trimmedTitle) {
      setDocumentMessage({ type: 'error', text: 'Add a title before saving.' });
      return;
    }

    setDocumentSaving(true);
    setDocumentMessage(null);

    try {
      const payload = {
        title: trimmedTitle,
        content: documentContent,
      };
      const savedDocument = selectedDocumentId
        ? await updateProjectDocument(projectId, selectedDocumentId, payload)
        : await createProjectDocument(projectId, payload);

      setDocuments((current) => {
        const existing = current.some((document) => document.id === savedDocument.id);
        if (existing) {
          return current.map((document) => document.id === savedDocument.id ? savedDocument : document);
        }
        return [savedDocument, ...current];
      });
      setSelectedDocumentId(savedDocument.id);
      setDocumentDraftOpen(false);
      setDocumentTitle(savedDocument.title);
      setDocumentContent(savedDocument.content || '');
      setDocumentMessage({ type: 'success', text: 'Document saved.' });
    } catch {
      setDocumentMessage({ type: 'error', text: 'Document could not be saved.' });
    } finally {
      setDocumentSaving(false);
    }
  }

  function handleNewDocument() {
    setSelectedDocumentId(null);
    setDocumentDraftOpen(true);
    setDocumentTitle('');
    setDocumentContent('');
    setDocumentMessage(null);
  }

  function handleSelectDocument(document: ProjectDocument) {
    setSelectedDocumentId(document.id);
    setDocumentDraftOpen(false);
    setDocumentTitle(document.title);
    setDocumentContent(document.content || '');
    setDocumentMessage(null);
  }

  async function handleDeleteDocument() {
    if (!projectId || !selectedDocumentId) return;

    const confirmed = window.confirm('Delete this document? This cannot be undone.');
    if (!confirmed) return;

    setDocumentDeleting(true);
    setDocumentMessage(null);

    try {
      await deleteProjectDocument(projectId, selectedDocumentId);
      const nextDocuments = documents.filter((document) => document.id !== selectedDocumentId);
      const nextDocument = nextDocuments[0] ?? null;
      setDocuments(nextDocuments);
      setSelectedDocumentId(nextDocument?.id ?? null);
      setDocumentDraftOpen(false);
      setDocumentTitle(nextDocument?.title ?? '');
      setDocumentContent(nextDocument?.content || '');
      setDocumentMessage({ type: 'success', text: 'Document deleted.' });
    } catch {
      setDocumentMessage({ type: 'error', text: 'Document could not be deleted.' });
    } finally {
      setDocumentDeleting(false);
    }
  }

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate('/projects')}><Icon name="arrow-left" size={15} /> All projects</button>
      <PageHeader
        eyebrow={project.key}
        title={project.name}
        description={project.description || 'A shared workspace for planning, prioritizing, and delivering the next milestone.'}
        actions={<div className="page-actions">
          {isAdmin && <Button onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> Create task</Button>}
          {isAdmin && <Button variant="secondary" onClick={() => navigate(`/projects/${project.id}/settings`)}><Icon name="settings" size={16} /> Project settings</Button>}
        </div>}
      />

      <section className="stats-grid animate-enter-delay">
        <article className="app-card stat-card"><div className="stat-head"><span>Open tasks</span><span className="stat-icon"><Icon name="tasks" size={18} /></span></div><p className="stat-value">{openTaskCount}</p><p className="stat-label">Ready to prioritize</p></article>
        <article className="app-card stat-card"><div className="stat-head"><span>Members</span><span className="stat-icon"><Icon name="team" size={18} /></span></div><p className="stat-value">{project.members?.length ?? 0}</p><p className="stat-label">Collaborating here</p></article>
        <article className="app-card stat-card"><div className="stat-head"><span>Active sprints</span><span className="stat-icon"><Icon name="activity" size={18} /></span></div><p className="stat-value">{project.sprints?.length ?? 0}</p><p className="stat-label">Current delivery cycles</p></article>
        <article className="app-card stat-card"><div className="stat-head"><span>Project key</span><span className="stat-icon"><Icon name="board" size={18} /></span></div><p className="stat-value text-xl">{project.key}</p><p className="stat-label">Task identifier prefix</p></article>
      </section>

      <section className="animate-enter-delay"><KanbanBoard tasks={tasks} onTasksChange={setTasks} onTaskClick={(task) => setSelectedTaskId(task.id)} /></section>
      <BacklogList tasks={tasks} title="Project backlog" description="All tasks belonging to this project." canDelete={isAdmin} onDeleteSelected={handleDeleteSelected} onTaskClick={(task) => setSelectedTaskId(task.id)} />

      <section className="app-card card-padding animate-enter-delay project-document-card">
        <div className="section-heading">
          <div>
            <h2>Documentation</h2>
            <p>Capture the project brief, decisions, and implementation notes.</p>
          </div>
          <Button onClick={handleNewDocument} disabled={documentLoading || documentSaving || documentDeleting}>
            <Icon name="plus" size={16} /> New document
          </Button>
        </div>

        {documentLoading ? (
          <div className="document-loading"><Spinner /><span>Loading documentation...</span></div>
        ) : documents.length === 0 && selectedDocumentId === null && !documentDraftOpen ? (
          <div className="document-empty-state">
            <span className="empty-icon"><Icon name="document" size={26} /></span>
            <h3>No documents yet</h3>
            <p>Create the first project document for decisions, specs, meeting notes, or implementation details.</p>
            <Button onClick={handleNewDocument}><Icon name="plus" size={16} /> Create document</Button>
            {documentMessage && (
              <p className={`document-message document-message-${documentMessage.type}`}>{documentMessage.text}</p>
            )}
          </div>
        ) : (
          <div className="document-workspace">
            <aside className="document-sidebar" aria-label="Project documents">
              <div className="document-tree-label">Documents</div>
              <div className="document-tree">
                {documents.map((document) => (
                  <button
                    type="button"
                    key={document.id}
                    className={`document-tree-item${document.id === selectedDocumentId ? ' is-active' : ''}`}
                    onClick={() => handleSelectDocument(document)}
                    disabled={documentSaving || documentDeleting}
                  >
                    <Icon name="document" size={15} />
                    <span>{document.title}</span>
                  </button>
                ))}
                {selectedDocumentId === null && (
                  <button type="button" className="document-tree-item is-active" disabled>
                    <Icon name="document" size={15} />
                    <span>Untitled document</span>
                  </button>
                )}
              </div>
            </aside>

            <div className="document-editor-stack">
              <label className="field">
                <span className="field-label">Title</span>
                <input
                  className="field-control"
                  value={documentTitle}
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  disabled={documentSaving || documentDeleting}
                  placeholder="Project documentation"
                />
              </label>
              <RichTextEditor value={documentContent} onChange={setDocumentContent} disabled={documentSaving || documentDeleting} />
              <div className="document-actions">
                <Button onClick={handleSaveDocument} loading={documentSaving} disabled={documentDeleting}>
                  <Icon name="check" size={16} /> Save
                </Button>
                {selectedDocumentId && (
                  <Button variant="danger" onClick={handleDeleteDocument} loading={documentDeleting} disabled={documentSaving}>
                    <Icon name="trash" size={16} /> Delete
                  </Button>
                )}
              </div>
              {documentMessage && (
                <p className={`document-message document-message-${documentMessage.type}`}>{documentMessage.text}</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="app-card card-padding animate-enter-delay project-team-card">
        <div className="section-heading"><div><h2>Project team</h2><p>People who can collaborate in this workspace.</p></div></div>
        <div className="focus-list">{project.members?.map((member) => <div className="focus-item" key={member.id}><span className="avatar">{member.user.name.slice(0, 2).toUpperCase()}</span><span className="focus-copy"><strong>{member.user.name}</strong><span>{member.role.toLowerCase()}</span></span></div>)}</div>
      </section>

      <CreateTaskModal isOpen={createOpen} projectId={projectId} members={project.members ?? []} onClose={() => setCreateOpen(false)} onCreated={(task) => { setTasks((current) => [task, ...current]); toast.success('Task created successfully.'); }} />
      <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </>
  );
}
