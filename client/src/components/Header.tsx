import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Dropdown from './ui/Dropdown';
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

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = pageNames[location.pathname] ?? (location.pathname.endsWith('/settings') ? 'Project settings' : 'Workspace');

  return (
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
        <input
          className="search-pill"
          placeholder="Search anything..."
          value={location.pathname === '/tasks' ? new URLSearchParams(location.search).get('q') ?? '' : ''}
          onChange={(event) => {
           const value = event.target.value;

          if (location.pathname !== '/tasks') {
            navigate(`/tasks?q=${encodeURIComponent(value)}`);
            return;
          }

          navigate(value ? `/tasks?q=${encodeURIComponent(value)}` : '/tasks');
        }}
        />
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
  );
}
