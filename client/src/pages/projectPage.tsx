import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { Button, Spinner } from '../components/ui';
import { getUserProjects, getUserInvitations, acceptInvitation, declineInvitation } from '../services/projectService';
import type { Project, Invitation } from '../services/projectService';
import { queryKeys, queryTimes } from '../services/queryOptions';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState('');

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
      queryClient.setQueryData<Project[]>(queryKeys.projects, (current = []) => {
        const projects = Array.isArray(current) ? current : [];
        return projects.some((item) => item.id === project.id) ? projects : [project, ...projects];
      });
    },
    onError: (_error, _invitationId, context) => {
      queryClient.setQueryData(queryKeys.invitations, context?.previousInvitations);
      setMutationError('Invitation could not be accepted.');
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
    },
  });

  const projects = Array.isArray(projectsQuery.data) ? projectsQuery.data : [];
  const invitations = Array.isArray(invitationsQuery.data) ? invitationsQuery.data : [];
  const loading = projectsQuery.isLoading || invitationsQuery.isLoading;
  const error = projectsQuery.isError || invitationsQuery.isError
    ? 'We could not load your projects. Check the connection and try again.'
    : mutationError;

  if (loading) return <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Loading your workspace...</p></div>;

  return (
    <>
      <PageHeader eyebrow="Project portfolio" title="Projects" description="Organize goals, tasks, and people into focused spaces that are easy to navigate." actions={<Button onClick={() => navigate('/projects/create')}><Icon name="plus" size={16} /> New project</Button>} />

      {error && <div className="alert alert-error mb-5">{error} <button className="text-link ml-2" onClick={() => { projectsQuery.refetch(); invitationsQuery.refetch(); }}>Retry</button></div>}

      {invitations.length > 0 && (
        <section className="invitation-stack animate-enter-delay" aria-label="Pending invitations">
          {invitations.map((invitation) => (
            <article className="invitation-card" key={invitation.id}>
              <div><strong>You&apos;re invited to {invitation.project?.name}</strong><p>{invitation.sender?.name} invited you as {invitation.role.toLowerCase()}.</p></div>
              <div className="flex gap-2"><Button onClick={() => acceptInvitationMutation.mutate(invitation.id)}>Accept</Button><Button variant="secondary" onClick={() => declineInvitationMutation.mutate(invitation.id)}>Decline</Button></div>
            </article>
          ))}
        </section>
      )}

      {!error && projects.length === 0 ? (
        <div className="app-card empty-panel animate-enter-delay">
          <span className="empty-icon"><Icon name="folder" size={26} /></span>
          <h3>No projects yet</h3>
          <p>Create your first project and give your team one clear place to plan and deliver work.</p>
          <Button onClick={() => navigate('/projects/create')}><Icon name="plus" size={16} /> Create project</Button>
        </div>
      ) : (
        <section className="project-grid animate-enter-delay">
          {projects.map((project) => (
            <article className="app-card project-card" key={project.id} onClick={() => navigate(`/projects/${project.id}`)} onKeyDown={(event) => { if (event.key === 'Enter') navigate(`/projects/${project.id}`); }} tabIndex={0} role="link">
              <div className="project-card-top"><span className="project-key">{project.key}</span><span className="project-members">{project.members?.length ?? 0} member{(project.members?.length ?? 0) === 1 ? '' : 's'}</span></div>
              <h3>{project.name}</h3>
              <p>{project.description || 'A focused workspace ready for your team and its next milestone.'}</p>
              <div className="project-meta"><span><Icon name="tasks" size={14} /> {project._count?.tasks ?? 0} tasks</span><span><Icon name="activity" size={14} /> {project.sprints?.[0]?.name || 'No active sprint'}</span></div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
