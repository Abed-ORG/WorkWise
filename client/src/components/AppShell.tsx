import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import OnboardingWizard from './OnboardingWizard';

export default function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('workwise-sidebar-collapsed') === 'true');

  function toggleSidebarCollapsed() {
    setIsSidebarCollapsed((current) => {
      localStorage.setItem('workwise-sidebar-collapsed', String(!current));
      return !current;
    });
  }

  return (
    <div className={`app-shell${isSidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <Sidebar isOpen={isSidebarOpen} collapsed={isSidebarCollapsed} onCollapseToggle={toggleSidebarCollapsed} onClose={() => setIsSidebarOpen(false)} />
      <OnboardingWizard />
      <div className="app-main">
        <Header onMenuToggle={() => setIsSidebarOpen((current) => !current)} />
        <main className="app-content">
          <div className="content-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
