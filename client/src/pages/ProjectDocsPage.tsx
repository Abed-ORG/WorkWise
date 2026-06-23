import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import RichTextEditor from '../components/RichTextEditor';
import { Button, Spinner } from '../components/ui';
import {
  createProjectDocument,
  deleteProjectDocument,
  getProjectById,
  getProjectDocuments,
  updateProjectDocument,
} from '../services/projectService';
import type { Project, ProjectDocument } from '../services/projectService';

export default function ProjectDocsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [documentLoading, setDocumentLoading] = useState(true);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentDeleting, setDocumentDeleting] = useState(false);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentDraftOpen, setDocumentDraftOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [documentMessage, setDocumentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!projectId) return;

    getProjectById(projectId)
      .then(setProject)
      .catch(() => navigate('/projects', { replace: true }))
      .finally(() => setProjectLoading(false));
  }, [projectId, navigate]);

  useEffect(() => {
    if (!projectId) return;

    let active = true;

    setDocumentLoading(true);
    getProjectDocuments(projectId)
      .then((projectDocuments) => {
        if (!active) return;

        const loadedDocuments = Array.isArray(projectDocuments) ? projectDocuments : [];
        const firstDocument = loadedDocuments[0] ?? null;
        setDocuments(loadedDocuments);
        setSelectedDocumentId(firstDocument?.id ?? null);
        setDocumentDraftOpen(false);
        setDocumentTitle(firstDocument?.title ?? '');
        setDocumentContent(firstDocument?.content || '');
      })
      .catch(() => {
        if (active) setDocumentMessage({ type: 'error', text: 'Documentation could not be loaded.' });
      })
      .finally(() => {
        if (active) setDocumentLoading(false);
      });

    return () => { active = false; };
  }, [projectId]);

  if (projectLoading) return <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Opening documentation...</p></div>;
  if (!project || !projectId) return null;

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
      <button type="button" className="back-link" onClick={() => navigate(`/projects/${projectId}`)}><Icon name="arrow-left" size={15} /> Back to project</button>
      <PageHeader
        eyebrow={project.key}
        title="Documentation"
        description="Capture the project brief, decisions, implementation notes, and sprint context."
        actions={<div className="page-actions">
          <Button variant="secondary" onClick={() => navigate(`/projects/${projectId}/board`)}><Icon name="board" size={16} /> Board</Button>
          <Button variant="secondary" onClick={() => navigate(`/projects/${projectId}/backlog`)}><Icon name="tasks" size={16} /> Backlog</Button>
        </div>}
      />

      <section className="app-card card-padding animate-enter-delay project-document-card">
        <div className="section-heading">
          <div>
            <h2>Project documentation</h2>
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
    </>
  );
}
