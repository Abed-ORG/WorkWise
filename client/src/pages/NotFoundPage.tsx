import { Link } from 'react-router-dom';
import Brand from '../components/Brand';
import Icon from '../components/Icon';

export default function NotFoundPage() {
  return (
    <main className="auth-panel min-h-screen">
      <div className="auth-panel-controls"><Brand /></div>
      <div className="app-card empty-panel w-full max-w-lg">
        <span className="empty-icon"><Icon name="search" size={26} /></span>
        <p className="page-eyebrow">Error 404</p>
        <h1 className="page-title text-3xl">This page wandered off.</h1>
        <p>The link may be outdated, or the page might have moved to a new workspace.</p>
        <Link to="/dashboard" className="btn btn-primary">Back to Dashboard <Icon name="arrow-right" size={16} /></Link>
      </div>
    </main>
  );
}
