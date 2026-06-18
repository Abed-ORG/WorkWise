import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { Button, Spinner } from './ui';
import { getProjectDocuments } from '../services/projectService';
import type { ProjectDocument } from '../services/projectService';

interface DocumentLinkPickerProps {
  projectId: string;
  linkedDocuments: ProjectDocument[];
  onChange: (documentIds: string[]) => Promise<ProjectDocument[]>;
  disabled?: boolean;
}

function getPreview(content?: string | null) {
  if (!content) return 'No content yet';
  const plain = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain || 'No content yet';
}

export default function DocumentLinkPicker({ projectId, linkedDocuments, onChange, disabled = false }: DocumentLinkPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const linkedIds = useMemo(() => new Set(linkedDocuments.map((document) => document.id)), [linkedDocuments]);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      setError('');
      getProjectDocuments(projectId, query)
        .then((documents) => {
          if (active) setResults(Array.isArray(documents) ? documents : []);
        })
        .catch(() => {
          if (active) setError('Documents could not be searched.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [projectId, query]);

  async function toggleDocument(documentId: string) {
    const nextIds = linkedIds.has(documentId)
      ? linkedDocuments.map((document) => document.id).filter((id) => id !== documentId)
      : [...linkedDocuments.map((document) => document.id), documentId];

    setSavingId(documentId);
    setError('');
    try {
      await onChange(nextIds);
    } catch {
      setError('Document links could not be saved.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="document-link-picker">
      <div className="document-link-search">
        <Icon name="search" size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search project documents"
          disabled={disabled}
          aria-label="Search project documents"
        />
        {loading && <Spinner size="sm" />}
      </div>

      <div className="linked-document-list" aria-label="Linked documents">
        {linkedDocuments.length ? linkedDocuments.map((document) => (
          <div className="linked-document-row" key={document.id}>
            <span className="linked-document-icon"><Icon name="document" size={15} /></span>
            <span className="linked-document-copy">
              <strong>{document.title}</strong>
              <span>{getPreview(document.content).slice(0, 110)}</span>
            </span>
            <Button variant="ghost" disabled={disabled || savingId === document.id} onClick={() => toggleDocument(document.id)}>
              {savingId === document.id ? <Spinner size="sm" /> : <Icon name="close" size={15} />} Unlink
            </Button>
          </div>
        )) : (
          <div className="document-link-empty">No documents linked yet.</div>
        )}
      </div>

      <div className="document-search-results" aria-label="Project document search results">
        {results.map((document) => {
          const linked = linkedIds.has(document.id);
          return (
            <button
              type="button"
              className={`document-result-row${linked ? ' is-linked' : ''}`}
              key={document.id}
              disabled={disabled || savingId !== null}
              onClick={() => toggleDocument(document.id)}
            >
              <span className="linked-document-icon"><Icon name="document" size={15} /></span>
              <span className="linked-document-copy">
                <strong>{document.title}</strong>
                <span>{getPreview(document.content).slice(0, 120)}</span>
              </span>
              <span className="document-result-action">{savingId === document.id ? 'Saving' : linked ? 'Linked' : 'Link'}</span>
            </button>
          );
        })}
        {!loading && results.length === 0 && <div className="document-link-empty">No matching documents.</div>}
      </div>

      {error && <p className="document-message document-message-error">{error}</p>}
    </div>
  );
}
