import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { Button, Card, Spinner } from '../components/ui';
import Modal from '../components/ui/Modal';
import { getProjectActivityFeed } from '../services/activityService';
import type { ProjectActivity } from '../services/activityService';
import { getAssignedTasks } from '../services/taskService';
import { getMyProfile, updateMyProfile } from '../services/userService';
import type { UserProfile } from '../services/userService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { queryKeys, queryTimes } from '../services/queryOptions';

interface FormState { name: string; avatarUrl: string; bio: string; bannerColor: string; bannerImageUrl: string; }
type ProfileActivity = ProjectActivity & { projectName: string; projectKey: string };

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const MAX_BANNER_FILE_SIZE = 8 * 1024 * 1024;
const AVATAR_SIZE = 256;
const BANNER_WIDTH = 1200;
const BANNER_HEIGHT = 300;
const defaultBannerColor = '#ffd100';
const bannerColorOptions = ['#ffd100', '#7dd3fc', '#a7f3d0', '#c4b5fd', '#fda4af', '#f9a8d4'];
const shortcuts = [
  { key: '/', action: 'Focus workspace search' },
  { key: '?', action: 'Open this shortcuts guide' },
  { key: 'B', action: 'Go to overview' },
  { key: 'C', action: 'Prepare task creation' },
  { key: 'Esc', action: 'Close dialogs' },
];

function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Canvas is unavailable'));
        return;
      }

      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = (image.naturalWidth - sourceSize) / 2;
      const sourceY = (image.naturalHeight - sourceSize) / 2;
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Invalid image'));
    };
    image.src = objectUrl;
  });
}

function resizeBanner(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = BANNER_WIDTH;
      canvas.height = BANNER_HEIGHT;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Canvas is unavailable'));
        return;
      }

      const sourceRatio = image.naturalWidth / image.naturalHeight;
      const targetRatio = BANNER_WIDTH / BANNER_HEIGHT;
      let sourceWidth = image.naturalWidth;
      let sourceHeight = image.naturalHeight;
      let sourceX = 0;
      let sourceY = 0;

      if (sourceRatio > targetRatio) {
        sourceWidth = image.naturalHeight * targetRatio;
        sourceX = (image.naturalWidth - sourceWidth) / 2;
      } else {
        sourceHeight = image.naturalWidth / targetRatio;
        sourceY = (image.naturalHeight - sourceHeight) / 2;
      }

      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, BANNER_WIDTH, BANNER_HEIGHT);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Invalid image'));
    };
    image.src = objectUrl;
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRole(role: string) {
  return role.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatProfileDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatActivityTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function profileSettingsKey(userId: string) {
  return `workwise-profile-settings-${userId}`;
}

function loadProfileSettings(userId: string) {
  try {
    const raw = window.localStorage.getItem(profileSettingsKey(userId));
    if (!raw) return { bio: '', bannerColor: defaultBannerColor, bannerImageUrl: '' };
    const parsed = JSON.parse(raw) as Partial<Pick<FormState, 'bio' | 'bannerColor' | 'bannerImageUrl'>>;
    return {
      bio: typeof parsed.bio === 'string' ? parsed.bio : '',
      bannerColor: typeof parsed.bannerColor === 'string' ? parsed.bannerColor : defaultBannerColor,
      bannerImageUrl: typeof parsed.bannerImageUrl === 'string' ? parsed.bannerImageUrl : '',
    };
  } catch {
    return { bio: '', bannerColor: defaultBannerColor, bannerImageUrl: '' };
  }
}

function saveProfileSettings(userId: string, settings: Pick<FormState, 'bio' | 'bannerColor' | 'bannerImageUrl'>) {
  window.localStorage.setItem(profileSettingsKey(userId), JSON.stringify(settings));
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', avatarUrl: '', bio: '', bannerColor: defaultBannerColor, bannerImageUrl: '' });
  const [profileSettings, setProfileSettings] = useState({ bio: '', bannerColor: defaultBannerColor, bannerImageUrl: '' });
  const [nameError, setNameError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [bannerError, setBannerError] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(searchParams.get('shortcuts') === 'true');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: getMyProfile,
    staleTime: queryTimes.profile,
  });
  const profile = profileQuery.data ?? null;
  const assignedTasksQuery = useQuery({
    queryKey: queryKeys.assignedTasks,
    queryFn: getAssignedTasks,
    staleTime: queryTimes.tasks,
  });
  const profileActivityQuery = useQuery({
    queryKey: ['profile-recent-activity', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const projects = profile.projectMembers.slice(0, 6);
      const activityGroups = await Promise.all(projects.map(async (membership) => {
        const activity = await getProjectActivityFeed(membership.project.id).catch(() => []);
        return activity
          .filter((item) => item.user.id === profile.id)
          .map((item) => ({
            ...item,
            projectName: membership.project.name,
            projectKey: membership.project.key,
          }));
      }));

      return activityGroups.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);
    },
    enabled: Boolean(profile?.id && profile.projectMembers.length),
    staleTime: queryTimes.activity,
  });

  useEffect(() => {
    setShortcutsOpen(searchParams.get('shortcuts') === 'true');
  }, [searchParams]);

  useEffect(() => {
    if (profileQuery.data) {
      const settings = loadProfileSettings(profileQuery.data.id);
      setProfileSettings(settings);
      setForm({
        name: profileQuery.data.name,
        avatarUrl: profileQuery.data.avatarUrl ?? '',
        bio: settings.bio,
        bannerColor: settings.bannerColor,
        bannerImageUrl: settings.bannerImageUrl,
      });
    }
    if (profileQuery.isError) toast.error('Failed to load profile.');
  }, [profileQuery.data, profileQuery.isError, toast]);

  async function handleSave() {
    if (!form.name.trim()) {
      setNameError('Name is required');
      return;
    }
    setSaving(true);
    const previousProfile = profile;
    const optimisticProfile = profile ? { ...profile, name: form.name.trim(), avatarUrl: form.avatarUrl.trim() || undefined } : null;
    if (optimisticProfile) queryClient.setQueryData(queryKeys.profile, optimisticProfile);
    try {
      const updated = await updateMyProfile({ name: form.name.trim(), avatarUrl: form.avatarUrl.trim() || undefined });
      queryClient.setQueryData<UserProfile | undefined>(queryKeys.profile, (current) => current ? { ...current, ...updated } : current);
      if (profile) {
        const nextSettings = { bio: form.bio.trim(), bannerColor: form.bannerColor || defaultBannerColor, bannerImageUrl: form.bannerImageUrl };
        saveProfileSettings(profile.id, nextSettings);
        setProfileSettings(nextSettings);
      }
      updateUser(updated);
      setEditing(false);
      toast.success('Profile updated successfully.');
    } catch {
      queryClient.setQueryData(queryKeys.profile, previousProfile);
      toast.error('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (profile) setForm({ name: profile.name, avatarUrl: profile.avatarUrl ?? '', bio: profileSettings.bio, bannerColor: profileSettings.bannerColor, bannerImageUrl: profileSettings.bannerImageUrl });
    setNameError('');
    setAvatarError('');
    setBannerError('');
    if (bannerInputRef.current) bannerInputRef.current.value = '';
    setEditing(false);
  }

  function closeShortcuts() {
    setShortcutsOpen(false);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('shortcuts');
      return next;
    }, { replace: true });
  }

  async function handleAvatarChange(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setAvatarError('Choose an image smaller than 5 MB.');
      return;
    }

    try {
      const avatarUrl = await resizeAvatar(file);
      setForm((current) => ({ ...current, avatarUrl }));
      setAvatarError('');
    } catch {
      setAvatarError('This image could not be processed.');
    }
  }

  function chooseBannerColor(color: string) {
    setForm((current) => ({ ...current, bannerColor: color, bannerImageUrl: '' }));
    setBannerError('');
    if (bannerInputRef.current) bannerInputRef.current.value = '';
  }

  async function handleBannerChange(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setBannerError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_BANNER_FILE_SIZE) {
      setBannerError('Choose an image smaller than 8 MB.');
      return;
    }

    try {
      const bannerImageUrl = await resizeBanner(file);
      setForm((current) => ({ ...current, bannerImageUrl }));
      setBannerError('');
    } catch {
      setBannerError('This banner image could not be processed.');
    }
  }

  if (profileQuery.isLoading) return <div className="empty-panel"><Spinner size="lg" /><p className="mt-4">Loading your profile...</p></div>;
  if (!profile) return <div className="app-card empty-panel"><h3>Profile unavailable</h3><p>We could not load your account details right now.</p></div>;

  const assignedTasks = Array.isArray(assignedTasksQuery.data) ? assignedTasksQuery.data : [];
  const recentActivities = Array.isArray(profileActivityQuery.data) ? profileActivityQuery.data as ProfileActivity[] : [];
  const doneTasks = assignedTasks.filter((task) => task.status === 'DONE').length;
  const commentCount = recentActivities.filter((activity) => activity.action === 'COMMENT_ADDED').length;
  const updateCount = recentActivities.filter((activity) => activity.action !== 'COMMENT_ADDED').length;
  const joinedDate = formatProfileDate(profile.createdAt);
  const activityCount = commentCount + updateCount;
  const displayName = editing ? form.name : profile.name;
  const displayAvatar = editing ? form.avatarUrl : profile.avatarUrl;
  const displayBio = editing ? form.bio : profileSettings.bio;
  const bannerColor = editing ? form.bannerColor : profileSettings.bannerColor;
  const bannerImageUrl = editing ? form.bannerImageUrl : profileSettings.bannerImageUrl;
  const heroStyle = {
    '--profile-banner-color': bannerColor,
    '--profile-banner-image': bannerImageUrl ? `url("${bannerImageUrl}")` : undefined,
  } as CSSProperties;

  return (
    <>
      <PageHeader eyebrow="Personal settings" title="My profile" description="Manage how you appear to teammates across WorkWise." />
      <div className="form-layout animate-enter-delay">
        <section className={`app-card profile-hero${editing ? ' is-editing' : ''}`} style={heroStyle}>
          <div className={`profile-banner${bannerImageUrl ? ' has-image' : ''}`}>
            {editing && (
              <div className="profile-banner-editor">
                <div className="profile-banner-controls">
                  <div className="profile-banner-color-row">
                    <span>Banner color</span>
                    <div className="profile-banner-swatches" aria-label="Banner color presets">
                      {bannerColorOptions.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={!form.bannerImageUrl && form.bannerColor === color ? 'is-active' : ''}
                          style={{ backgroundColor: color }}
                          onClick={() => chooseBannerColor(color)}
                          aria-label={`Use banner color ${color}`}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={form.bannerColor}
                      onChange={(event) => chooseBannerColor(event.target.value)}
                      aria-label="Custom banner color"
                    />
                  </div>
                  <div className="profile-banner-upload-row">
                    <Button variant="secondary" onClick={() => bannerInputRef.current?.click()}><Icon name="upload" size={15} /> Upload banner</Button>
                    <input ref={bannerInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleBannerChange(event.target.files?.[0])} />
                  </div>
                </div>
                <p className={`field-help profile-banner-help${bannerError ? ' field-error' : ''}`}>{bannerError || 'Recommended banner size: 1200 × 300 px (JPG, PNG, WebP)'}</p>
              </div>
            )}
          </div>
          <div className="profile-identity">
            <div className="profile-avatar-stack">
              <button
                type="button"
                className="profile-avatar"
                onClick={() => editing && fileInputRef.current?.click()}
                disabled={!editing}
                aria-label={editing ? 'Change profile photo' : undefined}
                title={editing ? 'Recommended: square image, at least 400 x 400 px.' : undefined}
              >
                {displayAvatar
                  ? <img src={displayAvatar ?? ''} alt={profile.name} />
                  : getInitials(displayName)}
                {editing && <span className="profile-avatar-overlay">Change photo</span>}
              </button>
              <input ref={fileInputRef} id="avatar-upload" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleAvatarChange(event.target.files?.[0])} />
              <div className="profile-identity-copy">
                {editing ? (
                  <label className="field profile-name-field">
                    <span className="field-label">Full name</span>
                    <input
                      className={`field-control${nameError ? ' field-control-error' : ''}`}
                      value={form.name}
                      onChange={(event) => { setForm((current) => ({ ...current, name: event.target.value })); setNameError(''); }}
                      autoFocus
                    />
                    {nameError && <span className="field-help field-error">{nameError}</span>}
                  </label>
                ) : (
                  <h2>{profile.name}</h2>
                )}
                <p>{profile.email}</p>
              </div>
              {editing && <p className={`field-help profile-avatar-help${avatarError ? ' field-error' : ''}`}>{avatarError || 'Recommended: square image, at least 400 x 400 px. JPG, PNG, or WebP.'}</p>}
            </div>
          </div>

          <section className="profile-bio-panel">
            <div className="section-heading compact">
              <div>
                <h3>Bio</h3>
                <p>Personal introduction for teammates.</p>
              </div>
            </div>
            {editing ? (
              <textarea
                className="field-control profile-bio-input"
                value={form.bio}
                onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                placeholder="Write a short bio for your teammates..."
                rows={4}
              />
            ) : displayBio ? (
              <p className="profile-bio-text">{displayBio}</p>
            ) : (
              <div className="document-link-empty">No bio has been added yet.</div>
            )}
          </section>

          <div className="profile-stats">
            <div className="profile-stat"><strong>{profile._count.projectMembers}</strong><span>Projects</span></div>
            <div className="profile-stat"><strong>{doneTasks}</strong><span>Tasks done</span></div>
            <div className="profile-stat"><strong>{activityCount}</strong><span>Recent activity</span></div>
          </div>

          <div className="auth-note mt-0">
            <Icon name="sparkles" size={17} />
            <span className="focus-copy"><strong>Getting started guide</strong><span>Revisit task creation, invitations, and sprint setup anytime.</span></span>
            <Button variant="secondary" onClick={() => navigate('/profile?onboarding=true')}>Open guide</Button>
          </div>

          <div className="auth-note mt-0">
            <Icon name="tasks" size={17} />
            <span className="focus-copy"><strong>Keyboard shortcuts</strong><span>See the quick actions available across WorkWise.</span></span>
            <Button variant="secondary" onClick={() => setShortcutsOpen(true)}>View shortcuts</Button>
          </div>

          {editing ? (
            <div className="profile-edit-actions">
              {form.avatarUrl && <Button variant="ghost" onClick={() => { setForm((current) => ({ ...current, avatarUrl: '' })); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Remove photo</Button>}
              <Button loading={saving} onClick={handleSave}>Save changes</Button>
              <Button variant="secondary" onClick={handleCancel} disabled={saving}>Cancel</Button>
            </div>
          ) : (
            <div className="profile-edit-action"><Button variant="secondary" onClick={() => setEditing(true)}><Icon name="user" size={16} /> Edit profile</Button></div>
          )}
        </section>

        <aside className="profile-side-stack">
          <Card title="Account details" className="tip-card">
            <div className="form-stack">
              <div><p className="field-help">Full name</p><strong className="text-sm">{profile.name}</strong></div>
              <div><p className="field-help">Email address</p><strong className="text-sm break-all">{profile.email}</strong></div>
              <div><p className="field-help">Joined date</p><strong className="text-sm">{joinedDate}</strong></div>
              <div><p className="field-help">Initials</p><strong className="text-sm">{user.initials}</strong></div>
              <div>
                <p className="field-help mb-2">Project roles</p>
                {profile.projectMembers.length > 0 ? (
                  <div className="profile-role-list">
                    {profile.projectMembers.map((membership) => (
                      <div className="profile-role-item" key={membership.project.id}>
                        <span className="project-key">{membership.project.key}</span>
                        <span className="profile-role-copy">
                          <strong>{membership.project.name}</strong>
                          <span>{formatRole(membership.role)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : <p className="field-help">No project roles yet.</p>}
              </div>
              <div className="auth-note mt-0"><Icon name="check" size={17} /> Your email is used for sign-in and project invitations.</div>
            </div>
          </Card>

          <Card title="Contribution stats" className="tip-card profile-side-card">
            <div className="profile-contribution-grid">
              <div><strong>{assignedTasks.length}</strong><span>Assigned tasks</span></div>
              <div><strong>{doneTasks}</strong><span>Completed</span></div>
              <div><strong>{commentCount}</strong><span>Recent comments</span></div>
              <div><strong>{updateCount}</strong><span>Recent updates</span></div>
            </div>
          </Card>

          <Card title="Recent activity" className="tip-card profile-side-card">
            {profileActivityQuery.isLoading ? (
              <div className="document-loading compact"><Spinner /><span>Loading activity...</span></div>
            ) : recentActivities.length ? (
              <div className="profile-activity-list">
                {recentActivities.map((activity) => (
                  <article className="profile-activity-item" key={activity.id}>
                    <span className="activity-marker"><Icon name="activity" size={13} /></span>
                    <div>
                      <strong>{activity.action.replaceAll('_', ' ').toLowerCase()}</strong>
                      <p>{activity.target}</p>
                      <small>{activity.projectKey} - {formatActivityTime(activity.createdAt)}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="document-link-empty">No recent activity found for your projects.</div>
            )}
          </Card>
        </aside>
      </div>

      <Modal isOpen={shortcutsOpen} onClose={closeShortcuts} className="shortcuts-modal">
        <div className="shortcuts-modal-header">
          <div>
            <p className="section-kicker">Shortcuts</p>
            <h2>Keyboard shortcuts</h2>
          </div>
          <button type="button" className="icon-button" onClick={closeShortcuts} aria-label="Close shortcuts">
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="shortcuts-list">
          {shortcuts.map((shortcut) => (
            <div className="shortcuts-row" key={shortcut.key}>
              <kbd>{shortcut.key}</kbd>
              <span>{shortcut.action}</span>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
