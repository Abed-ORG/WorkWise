import { NavLink, useLocation } from 'react-router-dom';
import Brand from './Brand';
import Icon from './Icon';
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
  const location = useLocation();
  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch && projectMatch[1] !== 'create' ? projectMatch[1] : null;

  const projectNavItems: NavItem[] = projectId ? [
    { label: 'Board', to: `/projects/${projectId}/board`, icon: 'board' },
    { label: 'Backlog', to: `/projects/${projectId}/backlog`, icon: 'tasks' },
    { label: 'Docs', to: `/projects/${projectId}/docs`, icon: 'document' },
    { label: 'Sprints', to: `/projects/${projectId}/sprints`, icon: 'activity' },
  ] : [];

  return (
    <>
      {isOpen && <button className="sidebar-overlay md:hidden" type="button" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand"><Brand /></div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => (
            <div key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/dashboard'}
                onClick={onClose}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon name={item.icon} size={19} />
                {item.label}
              </NavLink>
              {item.to === '/projects' && projectNavItems.length > 0 && (
                <div className="project-subnav" aria-label="Project navigation">
                  {projectNavItems.map((projectItem) => (
                    <NavLink
                      key={projectItem.to}
                      to={projectItem.to}
                      onClick={onClose}
                      className={({ isActive }) => `nav-link nav-link-sub ${isActive ? 'active' : ''}`}
                    >
                      <Icon name={projectItem.icon} size={17} />
                      {projectItem.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
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
