import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Dropdown from './ui/Dropdown';
import Modal from './ui/Modal';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';

interface HeaderProps { onMenuToggle: () => void; }

const pageNames: Record<string, string> = {
  '/dashboard': 'Overview',
  '/projects': 'Projects',
  '/projects/create': 'Create project',
  '/tasks': 'My tasks',
  '/profile': 'My profile',
};

const shortcuts = [
  { key: '/', action: 'Focus search' },
  { key: '?', action: 'Show shortcuts' },
  { key: 'B', action: 'Go to board view' },
  { key: 'C', action: 'Create task' },
  { key: 'Esc', action: 'Close shortcuts' },
];

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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pageTitle = pageNames[location.pathname] ?? (location.pathname.endsWith('/settings') ? 'Project settings' : 'Workspace');
  const search = searchParams.get('q') ?? '';

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (event.key === 'Escape') {
        setShortcutsOpen(false);
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

  function handleSearchChange(value: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set('q', value);
      else next.delete('q');
      return next;
    });
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button type="button" onClick={onMenuToggle} className="icon-button menu-button" aria-label="Open navigation">
            <Icon name="menu" size={19} />
          </button>
          <div>
            <div className="topbar-kicker">WorkWise workspace</div>
            <div className="topbar-title">{pageTitle}</div>
          </div>
        </div>

        <div className="topbar-actions">
          <label className="search-pill" aria-label="Workspace search">
            <Icon name="search" size={16} />
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search anything..."
            />
            <kbd>/</kbd>
          </label>
          <ThemeToggle />
          <button className="icon-button notification-button" type="button" aria-label="Notifications"><Icon name="bell" size={18} /></button>
          <Dropdown
            align="right"
            trigger={
              <span className="profile-trigger">
                <span className="avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.initials}</span>
                <span className="profile-copy">
                  <span className="profile-name">{user.name}</span>
                  <span className="profile-role">Workspace member</span>
                </span>
                <Icon name="chevron-down" size={15} />
              </span>
            }
            items={[
              { label: 'View profile', onSelect: () => navigate('/profile') },
              { label: 'Sign out', onSelect: logout },
            ]}
          />
        </div>
      </header>

      <Modal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} className="shortcuts-modal">
        <div className="shortcuts-modal-header">
          <div>
            <p className="section-kicker">Shortcuts</p>
            <h2>Keyboard shortcuts</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setShortcutsOpen(false)} aria-label="Close shortcuts">
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="shortcuts-list">
          {shortcuts.map((shortcut) => (
            <div className="shortcuts-row" key={shortcut.key}>
              <kbd>{shortcut.key}</kbd>
              <span>{shortcut.action}</span>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
