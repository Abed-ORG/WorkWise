import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { Button } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { getUserInvitations, getUserProjects } from '../services/projectService';
import { queryKeys, queryTimes } from '../services/queryOptions';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isInitializing } = useAuth();
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: getUserProjects,
    staleTime: queryTimes.projects,
  });
  const invitationsQuery = useQuery({
    queryKey: queryKeys.invitations,
    queryFn: getUserInvitations,
    staleTime: queryTimes.activity,
  });
  const projects = Array.isArray(projectsQuery.data) ? projectsQuery.data : [];
  const invitations = Array.isArray(invitationsQuery.data) ? invitationsQuery.data : [];
  const loading = isInitializing || projectsQuery.isLoading || invitationsQuery.isLoading;

  const openTasks = projects.reduce((total, project) => total + (project._count?.tasks ?? 0), 0);
  const memberCount = new Set(projects.flatMap((project) => project.members?.map((member) => member.user.id) ?? [])).size;
  const firstName = user.name.trim().split(/\s+/)[0] || 'there';
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const stats = [
    { label: 'Active projects', value: projects.length, icon: 'folder' as const },
    { label: 'Open tasks', value: openTasks, icon: 'tasks' as const },
    { label: 'Team members', value: memberCount, icon: 'team' as const },
    { label: 'Invitations', value: invitations.length, icon: 'bell' as const },
  ];

  return (
    <>
      {loading ? <DashboardSkeleton /> : null}

      {!loading && (
        <>
      <PageHeader
        eyebrow="Workspace overview"
        title={`${timeGreeting}, ${firstName}`}
        description="Here is a focused snapshot of your projects, priorities, and team activity."
        actions={<Button onClick={() => navigate('/projects/create')}><Icon name="plus" size={16} /> New project</Button>}
      />

      <section className="stats-grid animate-enter-delay" aria-label="Workspace statistics">
        {stats.map((stat) => (
          <article className="app-card stat-card" key={stat.label}>
            <div className="stat-head"><span>{stat.label}</span><span className="stat-icon"><Icon name={stat.icon} size={18} /></span></div>
            <p className="stat-value">{stat.value}</p>
            <p className="stat-label">Across your workspace</p>
          </article>
        ))}
      </section>

      <section className="dashboard-grid animate-enter-delay">
        <article className="app-card card-padding">
          <div className="section-heading">
            <div><h2>Your projects</h2><p>Every project where you are currently a member.</p></div>
            <Button variant="ghost" onClick={() => navigate('/projects')}>View all <Icon name="arrow-right" size={15} /></Button>
          </div>
          {projects.length ? (
            <div className="focus-list">
              {projects.map((project) => (
                <button className="focus-item text-left" type="button" key={project.id} onClick={() => navigate(`/projects/${project.id}`)}>
                  <span className="project-key">{project.key}</span>
                  <span className="focus-copy">
                    <strong>{project.name}</strong>
                    <span>{project._count?.tasks ?? 0} open tasks - {project.sprints?.[0]?.name || 'No active sprint'}</span>
                  </span>
                  <Icon name="arrow-right" size={16} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <span className="empty-icon"><Icon name="folder" size={25} /></span>
              <h3>Your first project starts here</h3>
              <p>Create a focused space for tasks, teammates, progress, and AI-assisted planning.</p>
              <Button onClick={() => navigate('/projects/create')}>Create a project</Button>
            </div>
          )}
        </article>

        <aside className="app-card card-padding">
          <div className="section-heading"><div><h2>Today&apos;s focus</h2><p>A simple plan for a clear day.</p></div></div>
          <div className="focus-list">
            <div className="focus-item"><span className="focus-check"><Icon name="check" size={15} /></span><span className="focus-copy"><strong>Review project priorities</strong><span>Keep the next milestone clear</span></span></div>
            <div className="focus-item"><span className="focus-check"><Icon name="team" size={15} /></span><span className="focus-copy"><strong>Check team updates</strong><span>Unblock work early</span></span></div>
            <div className="focus-item"><span className="focus-check"><Icon name="sparkles" size={15} /></span><span className="focus-copy"><strong>Plan with AI</strong><span>Break the next idea into tasks</span></span></div>
          </div>
        </aside>
      </section>
        </>
      )}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton animate-enter-delay" aria-label="Loading dashboard" aria-busy="true">
      <section className="dashboard-skeleton-header app-card">
        <div>
          <div className="skeleton skeleton-line skeleton-line-sm" />
          <div className="skeleton skeleton-line skeleton-line-title" />
          <div className="skeleton skeleton-line skeleton-line-copy" />
        </div>
        <div className="skeleton skeleton-button" />
      </section>

      <section className="stats-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <article className="app-card stat-card dashboard-skeleton-card" key={index}>
            <div className="stat-head">
              <div className="skeleton skeleton-line skeleton-line-label" />
              <div className="skeleton skeleton-icon" />
            </div>
            <div className="skeleton skeleton-line skeleton-line-value" />
            <div className="skeleton skeleton-line skeleton-line-caption" />
          </article>
        ))}
      </section>

      <section className="dashboard-grid" aria-hidden="true">
        <article className="app-card card-padding">
          <div className="section-heading">
            <div>
              <div className="skeleton skeleton-line skeleton-line-heading" />
              <div className="skeleton skeleton-line skeleton-line-caption" />
            </div>
            <div className="skeleton skeleton-button skeleton-button-sm" />
          </div>
          <div className="focus-list">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="focus-item dashboard-skeleton-project" key={index}>
                <div className="skeleton skeleton-key" />
                <div className="focus-copy">
                  <div className="skeleton skeleton-line skeleton-line-project" />
                  <div className="skeleton skeleton-line skeleton-line-caption" />
                </div>
                <div className="skeleton skeleton-chevron" />
              </div>
            ))}
          </div>
        </article>

        <aside className="app-card card-padding">
          <div className="section-heading">
            <div>
              <div className="skeleton skeleton-line skeleton-line-heading" />
              <div className="skeleton skeleton-line skeleton-line-caption" />
            </div>
          </div>
          <div className="focus-list">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="focus-item" key={index}>
                <div className="skeleton skeleton-check" />
                <div className="focus-copy">
                  <div className="skeleton skeleton-line skeleton-line-project" />
                  <div className="skeleton skeleton-line skeleton-line-caption" />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
