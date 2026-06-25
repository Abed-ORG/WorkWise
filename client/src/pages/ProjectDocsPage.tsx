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
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [documentMode, setDocumentMode] = useState<'view' | 'edit'>('view');
  const [draftReturnDocumentId, setDraftReturnDocumentId] = useState<string | null>(null);
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
        setSelectedDocumentIds([]);
        setSelectionMode(false);
        setDocumentMode('view');
        setDraftReturnDocumentId(null);
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

  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;
  const isDraft = documentMode === 'edit' && selectedDocument === null;
  const hasUnsavedChanges = documentMode === 'edit' && (
    selectedDocument
      ? documentTitle !== selectedDocument.title || documentContent !== (selectedDocument.content || '')
      : Boolean(documentTitle.trim() || documentContent.trim())
  );

  function confirmDiscardChanges() {
    return !hasUnsavedChanges || window.confirm('Discard unsaved changes?');
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
      setDocumentMode('view');
      setDraftReturnDocumentId(null);
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
    if (!confirmDiscardChanges()) return;

    setDraftReturnDocumentId(selectedDocumentId);
    setSelectedDocumentId(null);
    setDocumentMode('edit');
    setDocumentTitle('');
    setDocumentContent('');
    setDocumentMessage(null);
  }

  function handleSelectDocument(document: ProjectDocument) {
    if (document.id === selectedDocumentId) return;
    if (!confirmDiscardChanges()) return;

    setSelectedDocumentId(document.id);
    setDocumentMode('view');
    setDraftReturnDocumentId(null);
    setDocumentTitle(document.title);
    setDocumentContent(document.content || '');
    setDocumentMessage(null);
  }

  function handleEditDocument() {
    if (!selectedDocument) return;
    setDocumentTitle(selectedDocument.title);
    setDocumentContent(selectedDocument.content || '');
    setDocumentMode('edit');
    setDocumentMessage(null);
  }

  function handleCancelEdit() {
    if (!confirmDiscardChanges()) return;

    const returnDocument = isDraft
      ? documents.find((document) => document.id === draftReturnDocumentId) ?? null
      : selectedDocument;
    setSelectedDocumentId(returnDocument?.id ?? null);
    setDocumentTitle(returnDocument?.title ?? '');
    setDocumentContent(returnDocument?.content || '');
    setDocumentMode('view');
    setDraftReturnDocumentId(null);
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
      setSelectedDocumentIds((current) => current.filter((id) => id !== selectedDocumentId));
      setDocumentMode('view');
      setDraftReturnDocumentId(null);
      setDocumentTitle(nextDocument?.title ?? '');
      setDocumentContent(nextDocument?.content || '');
      setDocumentMessage({ type: 'success', text: 'Document deleted.' });
    } catch {
      setDocumentMessage({ type: 'error', text: 'Document could not be deleted.' });
    } finally {
      setDocumentDeleting(false);
    }
  }

  function toggleDocumentSelection(documentId: string) {
    setSelectedDocumentIds((current) => current.includes(documentId)
      ? current.filter((id) => id !== documentId)
      : [...current, documentId]);
  }

  async function handleDeleteSelectedDocuments() {
    if (!projectId || selectedDocumentIds.length === 0) return;

    const currentDocumentWillBeDeleted = selectedDocumentId !== null && selectedDocumentIds.includes(selectedDocumentId);
    const confirmationMessage = currentDocumentWillBeDeleted && hasUnsavedChanges
      ? `Delete ${selectedDocumentIds.length} selected document${selectedDocumentIds.length === 1 ? '' : 's'}? Unsaved changes to the open document will be discarded.`
      : `Delete ${selectedDocumentIds.length} selected document${selectedDocumentIds.length === 1 ? '' : 's'}? This cannot be undone.`;
    if (!window.confirm(confirmationMessage)) return;

    setDocumentDeleting(true);
    setDocumentMessage(null);

    try {
      const results = await Promise.allSettled(selectedDocumentIds.map((documentId) => deleteProjectDocument(projectId, documentId)));
      const deletedIds = new Set(results.flatMap((result, index) => result.status === 'fulfilled' ? [selectedDocumentIds[index]] : []));
      const nextDocuments = documents.filter((document) => !deletedIds.has(document.id));
      const currentDocumentDeleted = selectedDocumentId !== null && deletedIds.has(selectedDocumentId);
      const nextDocument = currentDocumentDeleted ? nextDocuments[0] ?? null : selectedDocument;

      setDocuments(nextDocuments);
      setSelectedDocumentIds([]);
      setSelectionMode(false);
      if (currentDocumentDeleted) {
        setSelectedDocumentId(nextDocument?.id ?? null);
        setDocumentTitle(nextDocument?.title ?? '');
        setDocumentContent(nextDocument?.content || '');
        setDocumentMode('view');
        setDraftReturnDocumentId(null);
      }

      setDocumentMessage(deletedIds.size === selectedDocumentIds.length
        ? { type: 'success', text: 'Selected documents deleted.' }
        : { type: 'error', text: 'Some documents could not be deleted.' });
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
        ) : documents.length === 0 && selectedDocumentId === null && documentMode === 'view' ? (
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
              <div className="document-sidebar-header">
                <div className="document-tree-label">Documents</div>
                {!selectionMode && (
                  <button type="button" className="document-select-trigger" onClick={() => setSelectionMode(true)} disabled={documentSaving || documentDeleting}>Select</button>
                )}
              </div>
              {selectionMode && (
                <div className="document-bulk-actions">
                  <span>{selectedDocumentIds.length} selected</span>
                  <button type="button" className="icon-button document-icon-button is-danger" onClick={handleDeleteSelectedDocuments} disabled={selectedDocumentIds.length === 0 || documentDeleting || documentSaving} aria-label="Delete selected documents" title="Delete selected documents">
                    <Icon name="trash" size={16} />
                  </button>
                  <button type="button" className="document-selection-clear" onClick={() => { setSelectionMode(false); setSelectedDocumentIds([]); }} disabled={documentDeleting || documentSaving}>Cancel</button>
                </div>
              )}
              <div className="document-tree">
                {documents.map((document) => (
                  <div key={document.id} className={`document-tree-row${document.id === selectedDocumentId ? ' is-active' : ''}`}>
                    {selectionMode && <input
                      type="checkbox"
                      checked={selectedDocumentIds.includes(document.id)}
                      onChange={() => toggleDocumentSelection(document.id)}
                      disabled={documentSaving || documentDeleting}
                      aria-label={`Select ${document.title}`}
                    />}
                    <button
                      type="button"
                      className="document-tree-item"
                      onClick={() => handleSelectDocument(document)}
                      disabled={documentSaving || documentDeleting}
                    >
                      <Icon name="document" size={15} />
                      <span>{document.title}</span>
                    </button>
                  </div>
                ))}
                {selectedDocumentId === null && (
                  <button type="button" className="document-tree-item is-active" disabled>
                    <Icon name="document" size={15} />
                    <span>Untitled document</span>
                  </button>
                )}
              </div>
            </aside>

            {documentMode === 'edit' ? (
              <div className="document-editor-stack document-edit-mode">
                <div className="document-mode-label"><Icon name="document" size={14} /> Editing {isDraft ? 'new document' : 'document'}</div>
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
                  <Button variant="secondary" onClick={handleCancelEdit} disabled={documentSaving || documentDeleting}>
                    Cancel
                  </Button>
                </div>
                {documentMessage && <p className={`document-message document-message-${documentMessage.type}`}>{documentMessage.text}</p>}
              </div>
            ) : selectedDocument ? (
              <article className="document-viewer">
                <div className="document-viewer-header">
                  <div>
                    <p className="document-mode-label"><Icon name="document" size={14} /> Document</p>
                    <h3>{selectedDocument.title}</h3>
                    <p className="document-viewer-meta">Last updated {new Date(selectedDocument.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="document-actions">
                    <button type="button" className="icon-button document-icon-button" onClick={handleEditDocument} disabled={documentDeleting} aria-label="Edit document" title="Edit document">
                      <Icon name="pencil" size={16} />
                    </button>
                    <button type="button" className="icon-button document-icon-button is-danger" onClick={handleDeleteDocument} disabled={documentDeleting} aria-label="Delete document" title="Delete document">
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
                {selectedDocument.content ? (
                  <div className="document-viewer-content rich-text-editor-content" dangerouslySetInnerHTML={{ __html: selectedDocument.content }} />
                ) : (
                  <p className="document-viewer-empty">This document is empty. Click the edit icon to start writing.</p>
                )}
                {documentMessage && <p className={`document-message document-message-${documentMessage.type}`}>{documentMessage.text}</p>}
              </article>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}
