import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from './Icon';
import { Button, Select } from './ui';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreference,
} from '../services/notificationService';
import type { NotificationItem, NotificationPreference } from '../services/notificationService';
import { acceptInvitation, declineInvitation, getUserInvitations } from '../services/projectService';
import type { Invitation, Project } from '../services/projectService';
import { getRealtimeSocket } from '../services/realtimeService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { queryKeys, queryTimes } from '../services/queryOptions';

const preferenceLabels: Record<NotificationPreference, string> = {
  ALL: 'All',
  MENTIONS_ONLY: 'Mentions only',
  NONE: 'None',
};
const preferenceOptions = Object.entries(preferenceLabels).map(([value, label]) => ({ value, label }));

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function NotificationBell() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [preference, setPreference] = useState<NotificationPreference>(user.notificationPreference ?? 'ALL');
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileFabRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: getNotifications,
    staleTime: queryTimes.notifications,
  });
  const invitationsQuery = useQuery({
    queryKey: queryKeys.invitations,
    queryFn: getUserInvitations,
    staleTime: queryTimes.activity,
  });
  const items = Array.isArray(notificationsQuery.data) ? notificationsQuery.data : [];
  const invitations = Array.isArray(invitationsQuery.data) ? invitationsQuery.data : [];
  const unreadNotificationCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);
  const unreadCount = unreadNotificationCount + invitations.length;

  const acceptInvitationMutation = useMutation({
    mutationFn: acceptInvitation,
    onSuccess: (project, invitationId) => {
      queryClient.setQueryData<Invitation[]>(queryKeys.invitations, (current = []) => current.filter((invitation) => invitation.id !== invitationId));
      queryClient.setQueryData<Project[]>(queryKeys.projects, (current = []) => {
        const projects = Array.isArray(current) ? current : [];
        return projects.some((item) => item.id === project.id) ? projects : [project, ...projects];
      });
      toast.success(`Joined ${project.name}.`);
    },
    onError: () => toast.error('Invitation could not be accepted.'),
  });

  const declineInvitationMutation = useMutation({
    mutationFn: declineInvitation,
    onSuccess: (_result, invitationId) => {
      queryClient.setQueryData<Invitation[]>(queryKeys.invitations, (current = []) => current.filter((invitation) => invitation.id !== invitationId));
      toast.success('Invitation declined.');
    },
    onError: () => toast.error('Invitation could not be declined.'),
  });

  useEffect(() => {
    const activeSocket = getRealtimeSocket();
    if (!activeSocket) return undefined;

    function handleNewNotification(notification: NotificationItem) {
      queryClient.setQueryData<NotificationItem[]>(queryKeys.notifications, (current = []) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 20));
    }

    activeSocket.on('notification:new', handleNewNotification);
    return () => {
      activeSocket.off('notification:new', handleNewNotification);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !mobileFabRef.current?.contains(target) && !mobilePanelRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  async function handleRead(notificationId: string) {
    const previousItems = items;
    queryClient.setQueryData<NotificationItem[]>(queryKeys.notifications, (current = []) => current.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item)));
    await markNotificationRead(notificationId).catch(() => {
      queryClient.setQueryData(queryKeys.notifications, previousItems);
    });
  }

  async function handleReadAll() {
    const previousItems = items;
    queryClient.setQueryData<NotificationItem[]>(queryKeys.notifications, (current = []) => current.map((item) => ({ ...item, isRead: true })));
    await markAllNotificationsRead().catch(() => {
      queryClient.setQueryData(queryKeys.notifications, previousItems);
    });
  }

  async function handlePreferenceChange(nextPreference: NotificationPreference) {
    const previousPreference = preference;
    setPreference(nextPreference);
    try {
      const savedPreference = await updateNotificationPreference(nextPreference);
      setPreference(savedPreference);
      updateUser({ ...user, notificationPreference: savedPreference });
    } catch {
      setPreference(previousPreference);
    }
  }

  function handleOpenNotificationSettings() {
    setIsOpen(false);
    navigate('/profile#notification-preferences');
  }

  function renderNotificationPanel(className: string) {
    return (
      <div className={`${className} animate-enter`}>
        <div className="notification-menu-header">
          <div>
            <p className="section-kicker">Updates</p>
            <h3>Notifications</h3>
          </div>
          <button type="button" className="text-button" onClick={handleReadAll} disabled={!unreadNotificationCount}>
            Mark all read
          </button>
        </div>

        <div className="notification-preference">
          <span>Preference</span>
          <Select
            aria-label="Notification preference"
            value={preference}
            options={preferenceOptions}
            onChange={(event) => handlePreferenceChange(event.target.value as NotificationPreference)}
          />
        </div>

        <button type="button" className="text-button notification-settings-link" onClick={handleOpenNotificationSettings}>
          <Icon name="settings" size={14} /> Notification settings
        </button>

        {invitations.length > 0 && (
          <div className="notification-list" aria-label="Project invitations">
            {invitations.map((invitation) => (
              <div className="notification-item is-unread notification-invitation" key={invitation.id}>
                <span className="notification-dot" />
                <span>
                  <strong>You&apos;re invited to {invitation.project?.name}</strong>
                  <small>{invitation.sender?.name} invited you as {invitation.role.toLowerCase()}.</small>
                  <span className="notification-invitation-actions">
                    <Button className="notification-invitation-button" onClick={() => acceptInvitationMutation.mutate(invitation.id)}>Accept</Button>
                    <Button className="notification-invitation-button" variant="secondary" onClick={() => declineInvitationMutation.mutate(invitation.id)}>Decline</Button>
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="notification-list">
          {items.length ? (
            items.map((item) => (
              <button
                type="button"
                className={`notification-item ${item.isRead ? '' : 'is-unread'}`}
                key={item.id}
                onClick={() => handleRead(item.id)}
              >
                <span className="notification-dot" />
                <span>
                  <strong>{item.message}</strong>
                  <small>{formatTime(item.createdAt)}</small>
                </span>
              </button>
            ))
          ) : (
            <div className="notification-empty">
              <Icon name="bell" size={18} />
              <p>No notifications yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="notification-root" ref={containerRef}>
      <button
        className="icon-button notification-button"
        type="button"
        aria-label="Notifications"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Icon name="bell" size={18} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {isOpen && renderNotificationPanel('notification-menu')}

      {unreadCount > 0 && createPortal(
        <button
          ref={mobileFabRef}
          className="mobile-notification-fab"
          type="button"
          aria-label={`Notifications, ${unreadCount} unread`}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          style={{
            position: 'fixed',
            right: '18px',
            bottom: '22px',
            top: 'auto',
            left: 'auto',
            zIndex: 9999,
          }}
        >
          <Icon name="bell" size={20} />
          <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        </button>,
        document.body,
      )}

      {isOpen && createPortal(
        <div ref={mobilePanelRef}>
          {renderNotificationPanel('mobile-notification-panel')}
        </div>,
        document.body,
      )}
    </div>
  );
}
