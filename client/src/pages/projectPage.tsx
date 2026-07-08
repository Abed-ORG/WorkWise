import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { Button } from '../components/ui';
import PageSkeleton from '../components/PageSkeleton';
import { getUserProjects, getUserInvitations, acceptInvitation, declineInvitation } from '../services/projectService';
import type { Project, Invitation } from '../services/projectService';
import { queryKeys, queryTimes } from '../services/queryOptions';
import { useToast } from '../hooks/useToast';
import { getProjectIcon } from '../services/projectIconStorage';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [mutationError, setMutationError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'updated' | 'created' | 'name'>('updated');
  const [view, setView] = useState<'grid' | 'list'>('grid');

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

  const acceptInvitationMutation = useMutation({
    mutationFn: acceptInvitation,
    onMutate: async (invitationId) => {
      setMutationError('');
      await queryClient.cancelQueries({ queryKey: queryKeys.invitations });
      const previousInvitations = queryClient.getQueryData<Invitation[]>(queryKeys.invitations);
      queryClient.setQueryData<Invitation[]>(queryKeys.invitations, (current = []) => current.filter((invitation) => invitation.id !== invitationId));
      return { previousInvitations };
    },
    onSuccess: (project) => {
      toast.success(`Joined ${project.name}.`);
      queryClient.setQueryData<Project[]>(queryKeys.projects, (current = []) => {
        const projects = Array.isArray(current) ? current : [];
        return projects.some((item) => item.id === project.id) ? projects : [project, ...projects];
      });
    },
    onError: (_error, _invitationId, context) => {
      queryClient.setQueryData(queryKeys.invitations, context?.previousInvitations);
      setMutationError('Invitation could not be accepted.');
      toast.error('Invitation could not be accepted.');
    },
  });

  const declineInvitationMutation = useMutation({
    mutationFn: declineInvitation,
    onMutate: async (invitationId) => {
      setMutationError('');
      await queryClient.cancelQueries({ queryKey: queryKeys.invitations });
      const previousInvitations = queryClient.getQueryData<Invitation[]>(queryKeys.invitations);
      queryClient.setQueryData<Invitation[]>(queryKeys.invitations, (current = []) => current.filter((invitation) => invitation.id !== invitationId));
      return { previousInvitations };
    },
    onError: (_error, _invitationId, context) => {
      queryClient.setQueryData(queryKeys.invitations, context?.previousInvitations);
      setMutationError('Invitation could not be declined.');
      toast.error('Invitation could not be declined.');
    },
    onSuccess: () => toast.success('Invitation declined.'),
  });

  const projects = useMemo(() => Array.isArray(projectsQuery.data) ? projectsQuery.data : [], [projectsQuery.data]);
  const visibleProjects = useMemo(() => projects
    .filter((project) => `${project.name} ${project.key} ${project.description ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : new Date(sort === 'created' ? b.createdAt : b.updatedAt).getTime() - new Date(sort === 'created' ? a.createdAt : a.updatedAt).getTime()), [projects, search, sort]);
  const linkedInvitationId = new URLSearchParams(location.search).get('invitation');
  const invitations = useMemo(() => {
    const pendingInvitations = Array.isArray(invitationsQuery.data) ? invitationsQuery.data : [];
    if (!linkedInvitationId) return pendingInvitations;
    return [...pendingInvitations].sort((a, b) => Number(b.id === linkedInvitationId) - Number(a.id === linkedInvitationId));
  }, [invitationsQuery.data, linkedInvitationId]);
  const loading = projectsQuery.isLoading || invitationsQuery.isLoading;
  const error = projectsQuery.isError || invitationsQuery.isError
    ? 'We could not load your projects. Check the connection and try again.'
    : mutationError;
  const linkedInvitationVisible = Boolean(linkedInvitationId && invitations.some((invitation) => invitation.id === linkedInvitationId));

  if (loading) return <PageSkeleton variant="cards" />;

  return (
    <>
      <PageHeader eyebrow="Project portfolio" title="Projects" description="Organize goals, tasks, and people into focused spaces that are easy to navigate." actions={<Button onClick={() => navigate('/projects/create')}><Icon name="plus" size={16} /> New project</Button>} />

      {error && <div className="alert alert-error mb-5">{error} <button className="text-link ml-2" onClick={() => { projectsQuery.refetch(); invitationsQuery.refetch(); }}>Retry</button></div>}

      {linkedInvitationId && !linkedInvitationVisible && (
        <div className="alert alert-error mb-5">
          This invitation is not available for the signed-in account. Sign out, then sign in or register with the email address that received the invitation.
        </div>
      )}

      {invitations.length > 0 && (
        <section className="invitation-stack animate-enter-delay" aria-label="Pending invitations">
          {invitations.map((invitation) => (
            <article className={`invitation-card${invitation.id === linkedInvitationId ? ' is-linked' : ''}`} key={invitation.id}>
              <div><strong>Invitation letter: {invitation.project?.name}</strong><p>{invitation.sender?.name} invited you as {invitation.role.toLowerCase()}. Accept to join the project, or decline to keep it out of your workspace.</p></div>
              <div className="flex gap-2"><Button onClick={() => acceptInvitationMutation.mutate(invitation.id)}>Accept</Button><Button variant="secondary" onClick={() => declineInvitationMutation.mutate(invitation.id)}>Decline</Button></div>
            </article>
          ))}
        </section>
      )}

      <div className="project-list-toolbar app-card">
        <label><Icon name="search" size={15} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" /></label>
        <div className="project-toolbar-controls">
          <SortDropdown value={sort} onChange={(v) => setSort(v as typeof sort)} />
          <div className="project-view-toggle"><button type="button" className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')}><Icon name="board" size={13} /> Grid</button><button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}><Icon name="menu" size={13} /> List</button></div>
        </div>
      </div>

      {!error && projects.length === 0 ? (
        <div className="app-card empty-panel animate-enter-delay">
          <span className="empty-icon"><Icon name="folder" size={26} /></span>
          <h3>No projects yet</h3>
          <p>Create your first project and give your team one clear place to plan and deliver work.</p>
          <Button onClick={() => navigate('/projects/create')}><Icon name="plus" size={16} /> Create project</Button>
        </div>
      ) : (
        <section className={`project-grid animate-enter-delay${view === 'list' ? ' is-list-view' : ''}`}>
          {visibleProjects.map((project) => (
            <article className="app-card project-card" key={project.id} onClick={() => navigate(`/projects/${project.id}`)} onKeyDown={(event) => { if (event.key === 'Enter') navigate(`/projects/${project.id}`); }} tabIndex={0} role="link">
              <div className="project-card-top"><span className="project-identity"><span className="project-emoji" aria-hidden="true">{getProjectIcon(project.id, project.icon)}</span><span className="project-key">{project.key}</span></span><span className="project-members">{project.members?.length ?? 0} member{(project.members?.length ?? 0) === 1 ? '' : 's'}</span></div>
              <h3>{project.name}</h3>
              <p>{project.description || 'A focused workspace ready for your team and its next milestone.'}</p>
              <div className="project-meta"><span><Icon name="tasks" size={14} /> {project._count?.tasks ?? 0} tasks</span><span><Icon name="activity" size={14} /> {project.sprints?.[0]?.name || 'No active sprint'}</span><span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span></div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

const sortOptions = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'created', label: 'Date created' },
  { value: 'name', label: 'Name' },
];

function SortDropdown({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = sortOptions.find((o) => o.value === value) ?? sortOptions[0];

  useEffect(() => {
    if (!open) return undefined;
    function handle(event: PointerEvent) { if (!ref.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener('pointerdown', handle);
    return () => document.removeEventListener('pointerdown', handle);
  }, [open]);

  return (
    <div className={`filter-dropdown project-sort-dropdown${open ? ' is-open' : ''}`} ref={ref}>
      <button type="button" className="filter-dropdown-trigger project-sort-trigger" onClick={() => setOpen((v) => !v)}>
        <span>
          <span className="filter-dropdown-label">Sort</span>
          <span className="filter-dropdown-value">{selected.label}</span>
        </span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="filter-dropdown-menu">
          {sortOptions.map((option) => (
            <button key={option.value} type="button" className={`filter-dropdown-option${option.value === value ? ' is-selected' : ''}`} onClick={() => { onChange(option.value); setOpen(false); }}>
              <span>{option.label}</span>
              {option.value === value && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
