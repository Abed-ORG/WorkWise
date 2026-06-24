import { NavLink } from 'react-router-dom';
import Brand from './Brand';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import type { IconName } from './Icon';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { label: 'Overview', to: '/dashboard', icon: 'home' },
  { label: 'Projects', to: '/projects', icon: 'folder' },
  { label: 'My tasks', to: '/tasks', icon: 'tasks' },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {isOpen && <button className="sidebar-overlay" type="button" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <ThemeToggle className="sidebar-theme-toggle" />
        </div>

        <div className="sidebar-workspace">
          <span className="workspace-label">Workspace</span>
          <div className="workspace-name">
            Product team
            <Icon name="chevron-down" size={15} />
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={onClose}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon name={item.icon} size={19} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <strong>AI work assistant</strong>
          <p>Turn project updates into clear next steps for your team.</p>
          <NavLink to="/projects/create" className="btn btn-primary w-full" onClick={onClose}>
            <Icon name="plus" size={16} /> New project
          </NavLink>
        </div>
      </aside>
    </>
  );
}
