import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Brand from './Brand';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import { getProjectById } from '../services/projectService';
import type { IconName } from './Icon';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: IconName;
  end?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: 'home' },
  { label: 'Projects', to: '/projects', icon: 'folder' },
  { label: 'My tasks', to: '/tasks', icon: 'tasks' },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch && projectMatch[1] !== 'create' ? projectMatch[1] : null;
  const [currentProject, setCurrentProject] = useState<{ name: string; key: string } | null>(null);

  useEffect(() => {
    if (!projectId) {
      setCurrentProject(null);
      return;
    }

    let active = true;
    getProjectById(projectId)
      .then((project) => {
        if (active) setCurrentProject({ name: project.name, key: project.key });
      })
      .catch(() => {
        if (active) setCurrentProject(null);
      });

    return () => { active = false; };
  }, [projectId]);

  const projectNavItems: NavItem[] = projectId ? [
    { label: 'Overview', to: `/projects/${projectId}`, icon: 'home', end: true },
    { label: 'Board', to: `/projects/${projectId}/board`, icon: 'board' },
    { label: 'Backlog', to: `/projects/${projectId}/backlog`, icon: 'tasks' },
    { label: 'Docs', to: `/projects/${projectId}/docs`, icon: 'document' },
    { label: 'Sprints', to: `/projects/${projectId}/sprints`, icon: 'flag' },
    { label: 'Analytics', to: `/projects/${projectId}/analytics`, icon: 'bar-chart' },
    { label: 'Project settings', to: `/projects/${projectId}/settings`, icon: 'settings' },
  ] : [];

  return (
    <>
      {isOpen && <button className="sidebar-overlay" type="button" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <ThemeToggle className="sidebar-theme-toggle" />
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => (
            <div key={item.to} className={item.to === '/projects' && projectNavItems.length > 0 ? 'nav-project-group' : undefined}>
              <NavLink
                to={item.to}
                end={item.to === '/dashboard' || item.to === '/projects'}
                onClick={onClose}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon name={item.icon} size={19} />
                {item.label}
              </NavLink>

              {item.to === '/projects' && projectNavItems.length > 0 && (
                <div className="project-context" aria-label="Current project navigation">
                  <div className="project-context-label" title={currentProject?.name ?? 'Loading project'}>
                    <span className="project-context-marker" />
                    <span className="project-context-copy">
                      <strong>{currentProject?.name ?? 'Loading project'}</strong>
                      {currentProject?.key && <small>{currentProject.key}</small>}
                    </span>
                  </div>
                  <div className="project-subnav">
                    {projectNavItems.map((projectItem, index) => (
                      <NavLink
                        key={projectItem.to}
                        to={projectItem.to}
                        end={projectItem.end}
                        onClick={onClose}
                        className={({ isActive }) => `nav-link nav-link-sub ${isActive ? 'active' : ''}`}
                        style={{ animationDelay: `${index * 18}ms` }}
                      >
                        <Icon name={projectItem.icon} size={17} />
                        {projectItem.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
