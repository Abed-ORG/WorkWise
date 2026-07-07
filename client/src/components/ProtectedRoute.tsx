import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from './ui';

export default function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();
  if (isInitializing) return <div className="empty-panel min-h-screen"><Spinner size="lg" /></div>;
  const redirect = `${location.pathname}${location.search}${location.hash}`;
  return isAuthenticated ? <Outlet /> : <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
}
