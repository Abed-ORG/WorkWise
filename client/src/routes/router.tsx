import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ProtectedRoute from '../components/ProtectedRoute';
import PublicRoute from '../components/PublicRoute';
import DashboardPage from '../pages/DashboardPage';
import LoginPage from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import RegisterPage from '../pages/RegisterPage';
import ProjectsPage from '../pages/projectPage';
import CreateProjectPage from '../pages/createProjectPage';
import ProjectSettingsPage from '../pages/projectSettingPage';
import ProfilePage from '../pages/ProfilePage';
import ProjectOverviewPage from '../pages/ProjectOverviewPage';
import TasksPage from '../pages/TasksPage';
import SprintPage from '../pages/SprintPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    element: <PublicRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/projects/create', element: <CreateProjectPage /> },
          { path: '/projects/:projectId', element: <ProjectOverviewPage /> },
          { path: '/projects/:projectId/sprints', element: <SprintPage /> },
          { path: '/projects/:projectId/settings', element: <ProjectSettingsPage /> },
          { path: '/tasks', element: <TasksPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export default router;
