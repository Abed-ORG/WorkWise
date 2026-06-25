import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ProtectedRoute from '../components/ProtectedRoute';
import PublicRoute from '../components/PublicRoute';
import { Spinner } from '../components/ui';

const ActivityFeedPage = lazy(() => import('../pages/ActivityFeedPage'));
const CreateProjectPage = lazy(() => import('../pages/createProjectPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
const LandingPage = lazy(() => import('../pages/LandingPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const ProjectAnalyticsPage = lazy(() => import('../pages/ProjectAnalyticsPage'));
const ProjectBacklogPage = lazy(() => import('../pages/ProjectBacklogPage'));
const ProjectBoardPage = lazy(() => import('../pages/ProjectBoardPage'));
const ProjectDocsPage = lazy(() => import('../pages/ProjectDocsPage'));
const ProjectOverviewPage = lazy(() => import('../pages/ProjectOverviewPage'));
const ProjectsPage = lazy(() => import('../pages/projectPage'));
const ProjectSettingsPage = lazy(() => import('../pages/projectSettingPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'));
const SprintBoardPage = lazy(() => import('../pages/SprintBoardPage'));
const SprintPage = lazy(() => import('../pages/SprintPage'));
const TasksPage = lazy(() => import('../pages/TasksPage'));

function RouteFallback() {
  return (
    <div className="empty-panel min-h-screen">
      <Spinner size="lg" />
      <p className="mt-4">Loading workspace...</p>
    </div>
  );
}

function lazyRoute(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      { path: '/', element: lazyRoute(<LandingPage />) },
      { path: '/login', element: lazyRoute(<LoginPage />) },
      { path: '/register', element: lazyRoute(<RegisterPage />) },
      { path: '/forgot-password', element: lazyRoute(<ForgotPasswordPage />) },
      { path: '/reset-password', element: lazyRoute(<ResetPasswordPage />) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard', element: lazyRoute(<DashboardPage />) },
          { path: '/projects', element: lazyRoute(<ProjectsPage />) },
          { path: '/projects/create', element: lazyRoute(<CreateProjectPage />) },
          { path: '/projects/:projectId', element: lazyRoute(<ProjectOverviewPage />) },
          { path: '/projects/:projectId/board', element: lazyRoute(<ProjectBoardPage />) },
          { path: '/projects/:projectId/backlog', element: lazyRoute(<ProjectBacklogPage />) },
          { path: '/projects/:projectId/docs', element: lazyRoute(<ProjectDocsPage />) },
          { path: '/projects/:projectId/activity', element: lazyRoute(<ActivityFeedPage />) },
          { path: '/projects/:projectId/analytics', element: lazyRoute(<ProjectAnalyticsPage />) },
          { path: '/projects/:projectId/sprints', element: lazyRoute(<SprintPage />) },
          { path: '/projects/:projectId/sprints/:sprintId/board', element: lazyRoute(<SprintBoardPage />) },
          { path: '/projects/:projectId/settings', element: lazyRoute(<ProjectSettingsPage />) },
          { path: '/tasks', element: lazyRoute(<TasksPage />) },
          { path: '/profile', element: lazyRoute(<ProfilePage />) },
        ],
      },
    ],
  },
  {
    path: '*',
    element: lazyRoute(<NotFoundPage />),
  },
]);

export default router;
