import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from './Icon';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreference,
} from '../services/notificationService';
import type { NotificationItem, NotificationPreference } from '../services/notificationService';
import { getRealtimeSocket } from '../services/realtimeService';
import { useAuth } from '../hooks/useAuth';
import { queryKeys, queryTimes } from '../services/queryOptions';

const preferenceLabels: Record<NotificationPreference, string> = {
  ALL: 'All',
  MENTIONS_ONLY: 'Mentions only',
  NONE: 'None',
};

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
  const queryClient = useQueryClient();
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
  const items = Array.isArray(notificationsQuery.data) ? notificationsQuery.data : [];
  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

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

  function renderNotificationPanel(className: string) {
    return (
      <div className={`${className} animate-enter`}>
        <div className="notification-menu-header">
          <div>
            <p className="section-kicker">Updates</p>
            <h3>Notifications</h3>
          </div>
          <button type="button" className="text-button" onClick={handleReadAll} disabled={!unreadCount}>
            Mark all read
          </button>
        </div>

        <label className="notification-preference">
          <span>Preference</span>
          <select value={preference} onChange={(event) => handlePreferenceChange(event.target.value as NotificationPreference)}>
            {Object.entries(preferenceLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

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
