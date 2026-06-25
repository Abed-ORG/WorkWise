import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Dropdown from './ui/Dropdown';
import Modal from './ui/Modal';
import Icon from './Icon';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import AIQuotaBadge from './AIQuotaBadge';
import { Button } from './ui';

interface HeaderProps { onMenuToggle: () => void; }

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
  const [logoutOpen, setLogoutOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  function handleSearchChange(value: string) {
    if (location.pathname !== '/tasks') {
      navigate(value ? `/tasks?q=${encodeURIComponent(value)}` : '/tasks');
      return;
    }

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
        </div>
        <div className="topbar-actions">
          <label className="search-pill" aria-label="Workspace search" onClick={() => searchInputRef.current?.focus()}>
            <Icon name="search" size={16} />
            <input
              ref={searchInputRef}
              type="search"
              value={location.pathname === '/tasks' ? search : ''}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search anything..."
            />
            <kbd>/</kbd>
          </label>

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