import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from './ui';

export default function PublicRoute() {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();
  if (isInitializing) return <div className="empty-panel min-h-screen"><Spinner size="lg" /></div>;
  const redirect = new URLSearchParams(location.search).get('redirect');
  const safeRedirect = redirect?.startsWith('/') ? redirect : '/dashboard';
  return isAuthenticated ? <Navigate to={safeRedirect} replace /> : <Outlet />;
}
