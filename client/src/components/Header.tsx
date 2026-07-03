import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import Dropdown from './ui/Dropdown';
import Modal from './ui/Modal';
import Icon from './Icon';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import AIQuotaBadge from './AIQuotaBadge';
import { Button } from './ui';
import { getProjectDocuments, getUserProjects } from '../services/projectService';
import type { Project, ProjectDocument } from '../services/projectService';
import { getAssignedTasks } from '../services/taskService';
import type { Task } from '../services/taskService';
import { queryKeys, queryTimes } from '../services/queryOptions';

interface HeaderProps { onMenuToggle: () => void; }
type SearchResult =
  | { id: string; type: 'project'; title: string; meta: string; detail?: string; to: string }
  | { id: string; type: 'task'; title: string; meta: string; detail?: string; to: string }
  | { id: string; type: 'document'; title: string; meta: string; detail?: string; to: string }
  | { id: string; type: 'member'; title: string; meta: string; detail?: string; to: string };

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  );
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRootRef = useRef<HTMLDivElement>(null);
  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  const searchEnabled = normalizedSearch.length >= 2;

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: getUserProjects,
    staleTime: queryTimes.projects,
    enabled: searchEnabled,
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.assignedTasks,
    queryFn: getAssignedTasks,
    staleTime: queryTimes.tasks,
    enabled: searchEnabled,
  });
  const documentsQuery = useQuery({
    queryKey: ['global-search-documents', normalizedSearch],
    queryFn: async () => {
      const projects = projectsQuery.data ?? [];
      const results = await Promise.all(projects.slice(0, 8).map((project) => getProjectDocuments(project.id, debouncedSearch.trim()).catch(() => [])));
      return results.flatMap((documents, index) => documents.map((document) => ({ document, project: projects[index] })));
    },
    staleTime: queryTimes.documents,
    enabled: searchEnabled && Boolean(projectsQuery.data?.length),
  });

  const projectResults: SearchResult[] = (projectsQuery.data ?? [])
    .filter((project: Project) => `${project.name} ${project.key} ${project.description ?? ''}`.toLowerCase().includes(normalizedSearch))
    .slice(0, 4)
    .map((project) => ({ id: project.id, type: 'project', title: project.name, meta: project.key, to: `/projects/${project.id}` }));
  const taskResults: SearchResult[] = (tasksQuery.data ?? [])
    .filter((task: Task) => `${task.title} ${task.description ?? ''} ${task.project?.name ?? ''} ${task.project?.key ?? ''}`.toLowerCase().includes(normalizedSearch))
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      type: 'task',
      title: task.title,
      meta: task.project ? `${task.project.key} - ${task.project.name}` : 'Task',
      detail: task.status.name.toLowerCase(),
      to: task.projectId ? `/projects/${task.projectId}/board` : '/tasks',
    }));
  const documentResults: SearchResult[] = (documentsQuery.data ?? [])
    .filter(({ document }: { document: ProjectDocument; project: Project }) => `${document.title} ${document.content ?? ''}`.toLowerCase().includes(normalizedSearch))
    .slice(0, 4)
    .map(({ document, project }) => ({ id: document.id, type: 'document', title: document.title, meta: `${project.key} - ${project.name}`, to: `/projects/${project.id}/docs` }));
  const memberResults: SearchResult[] = Array.from(
    (projectsQuery.data ?? []).reduce((membersById, project) => {
      project.members.forEach((member) => {
        if (!membersById.has(member.user.id)) membersById.set(member.user.id, { member, project });
      });
      return membersById;
    }, new Map<string, { member: Project['members'][number]; project: Project }>()).values()
  )
    .filter(({ member }) => `${member.user.name} ${member.user.email}`.toLowerCase().includes(normalizedSearch))
    .slice(0, 5)
    .map(({ member, project }) => ({ id: member.user.id, type: 'member', title: member.user.name, meta: member.user.email, detail: `${project.key} - ${project.name}`, to: `/projects/${project.id}` }));
  const searchResults = [...projectResults, ...taskResults, ...documentResults, ...memberResults].slice(0, 10);
  const searchLoading = searchEnabled && (projectsQuery.isLoading || tasksQuery.isLoading || documentsQuery.isLoading);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        navigate('/profile?shortcuts=true');
        return;
      }

      if (event.key === 'Escape') {
        return;
      }

      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        navigate('/dashboard');
        return;
      }

      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        window.alert('Create task placeholder');
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchValue), 220);
    return () => window.clearTimeout(timeout);
  }, [searchValue]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!searchRootRef.current?.contains(event.target as Node)) setSearchOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  function handleSearchChange(value: string) {
    setSearchValue(value);
    setSearchOpen(Boolean(value.trim()));
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchOpen(false);
      searchInputRef.current?.blur();
    }
  }

  function navigateToResult(result: SearchResult) {
    setSearchOpen(false);
    setSearchValue('');
    setDebouncedSearch('');
    navigate(result.to);
  }

  function renderSearchSection(label: string, results: SearchResult[]) {
    if (!results.length) return null;

    return (
      <section className="search-result-section" aria-label={label}>
        <div className="search-result-section-label">{label}</div>
        {results.map((result) => (
          <button key={`${result.type}-${result.id}`} type="button" className="search-result-item" role="option" onClick={() => navigateToResult(result)}>
            <span className="search-result-icon"><Icon name={result.type === 'project' ? 'folder' : result.type === 'task' ? 'tasks' : result.type === 'document' ? 'document' : 'user'} size={15} /></span>
            <span className="search-result-copy">
              <strong>{result.title}</strong>
              <small>{result.detail ? `${result.meta} - ${result.detail}` : result.meta}</small>
            </span>
          </button>
        ))}
      </section>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button type="button" onClick={onMenuToggle} className="icon-button menu-button" aria-label="Open navigation">
            <Icon name="menu" size={19} />
          </button>
        </div>
        <div className="topbar-actions">
          <div className="search-root" ref={searchRootRef}>
            <label className="search-pill" aria-label="Workspace search" onClick={() => searchInputRef.current?.focus()}>
              <Icon name="search" size={16} />
              <input
                ref={searchInputRef}
                type="search"
                value={searchValue}
                onChange={(event) => handleSearchChange(event.target.value)}
                onFocus={() => { if (searchValue.trim()) setSearchOpen(true); }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search anything..."
              />
              <kbd>/</kbd>
            </label>
            {searchOpen && <div className="search-results-panel" role="listbox" aria-label="Search results">
              {!searchEnabled ? (
                <div className="search-results-empty">Type at least 2 characters.</div>
              ) : searchLoading ? (
                <div className="search-results-empty">Searching...</div>
              ) : searchResults.length ? (
                <>
                  {renderSearchSection('Projects', projectResults)}
                  {renderSearchSection('Tasks', taskResults)}
                  {renderSearchSection('Documents', documentResults)}
                  {renderSearchSection('Team members', memberResults)}
                  {searchResults.map((result) => (
                  <button key={`${result.type}-${result.id}`} type="button" className="search-result-item" role="option" onClick={() => navigateToResult(result)}>
                    <span className="search-result-icon"><Icon name={result.type === 'project' ? 'folder' : result.type === 'task' ? 'tasks' : result.type === 'document' ? 'document' : 'user'} size={15} /></span>
                    <span className="search-result-copy">
                      <strong>{result.title}</strong>
                      <small>{result.type} · {result.meta}</small>
                    </span>
                  </button>
                  ))}
                </>
              ) : (
                <div className="search-results-empty"><strong>No results found</strong><span>Try another keyword.</span></div>
              )}
            </div>}
          </div>

          <AIQuotaBadge />
          <ThemeToggle />
          <NotificationBell />
          <Dropdown
            align="right"
            trigger={
              <span className="profile-trigger">
                <span className="avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.initials}</span>
                <span className="profile-copy">
                  <span className="profile-name">{user.name}</span>
                </span>
                <Icon name="chevron-down" size={15} />
              </span>
            }
            items={[
              { label: 'View profile', onSelect: () => navigate('/profile') },
              { label: 'Sign out', tone: 'danger', onSelect: () => setLogoutOpen(true) },
            ]}
          />
        </div>
      </header>

      <Modal isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} className="confirm-modal">
        <div className="shortcuts-modal-header">
          <div>
            <p className="section-kicker">Sign out</p>
            <h2>Leave WorkWise?</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setLogoutOpen(false)} aria-label="Close logout confirmation">
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="confirm-modal-body">
          <p>You will need to sign in again to access your workspace.</p>
          <div className="confirm-modal-actions">
            <Button variant="secondary" onClick={() => setLogoutOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={logout}>Sign out</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
