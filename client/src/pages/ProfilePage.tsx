import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { Input, Button, Card } from '../components/ui';
import PageSkeleton from '../components/PageSkeleton';
import Modal from '../components/ui/Modal';
import ProjectNotificationPreferences from '../components/ProjectNotificationPreferences';
import { changeMyPassword, confirmEmailChange, getMyProfile, requestEmailChange, updateMyProfile } from '../services/userService';
import type { UserProfile } from '../services/userService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { queryKeys, queryTimes } from '../services/queryOptions';

interface FormState { name: string; avatarUrl: string; }
interface PasswordFormState { currentPassword: string; newPassword: string; confirmPassword: string; }
interface PasswordFormErrors { currentPassword?: string; newPassword?: string; confirmPassword?: string; }
interface EmailChangeErrors { newEmail?: string; code?: string; }

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const AVATAR_SIZE = 256;
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', avatarUrl: '' });
  const [nameError, setNameError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(searchParams.get('shortcuts') === 'true');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState<PasswordFormErrors>({});
  const [changingPassword, setChangingPassword] = useState(false);
  const [emailStep, setEmailStep] = useState<'request' | 'confirm'>('request');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [emailChangeErrors, setEmailChangeErrors] = useState<EmailChangeErrors>({});
  const [requestingEmailChange, setRequestingEmailChange] = useState(false);
  const [confirmingEmailChange, setConfirmingEmailChange] = useState(false);
  const notificationPreferencesRef = useRef<HTMLDivElement>(null);
  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: getMyProfile,
    staleTime: queryTimes.profile,
  });
  const profile = profileQuery.data ?? null;

  useEffect(() => {
    setShortcutsOpen(searchParams.get('shortcuts') === 'true');
  }, [searchParams]);

  useEffect(() => {
    if (location.hash === '#notification-preferences' && profile) {
      notificationPreferencesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, profile]);

  useEffect(() => {
    if (profileQuery.data) setForm({ name: profileQuery.data.name, avatarUrl: profileQuery.data.avatarUrl ?? '' });
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
    if (profile) setForm({ name: profile.name, avatarUrl: profile.avatarUrl ?? '' });
    setNameError('');
    setAvatarError('');
    setEditing(false);
  }

  function handlePasswordFieldChange(field: keyof PasswordFormState, value: string) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    if (passwordErrors[field]) setPasswordErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();

    const errors: PasswordFormErrors = {};
    if (!passwordForm.currentPassword) errors.currentPassword = 'Current password is required';
    if (passwordForm.newPassword.length < 8) errors.newPassword = 'New password must be at least 8 characters';
    if (passwordForm.newPassword !== passwordForm.confirmPassword) errors.confirmPassword = 'Passwords do not match';

    if (Object.keys(errors).length) {
      setPasswordErrors(errors);
      return;
    }

    setChangingPassword(true);
    try {
      await changeMyPassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordErrors({});
      toast.success('Password updated successfully.');
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        setPasswordErrors({ currentPassword: 'Current password is incorrect' });
      } else {
        toast.error('Failed to update password. Please try again.');
      }
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleRequestEmailChange(event: React.FormEvent) {
    event.preventDefault();
    const trimmedEmail = newEmailInput.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailChangeErrors({ newEmail: 'Enter a valid email address' });
      return;
    }

    setRequestingEmailChange(true);
    try {
      await requestEmailChange(trimmedEmail);
      setPendingEmail(trimmedEmail);
      setEmailStep('confirm');
      setEmailChangeErrors({});
      toast.success(`Verification code sent to ${trimmedEmail}.`);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setEmailChangeErrors({ newEmail: 'That email address is already in use' });
      } else if (axios.isAxiosError(error) && error.response?.status === 400) {
        setEmailChangeErrors({ newEmail: error.response.data?.message || 'Enter a valid email address' });
      } else {
        toast.error('Failed to send verification code. Please try again.');
      }
    } finally {
      setRequestingEmailChange(false);
    }
  }

  async function handleConfirmEmailChange(event: React.FormEvent) {
    event.preventDefault();

    if (!verificationCode.trim()) {
      setEmailChangeErrors({ code: 'Enter the verification code' });
      return;
    }

    setConfirmingEmailChange(true);
    try {
      const updated = await confirmEmailChange(verificationCode.trim());
      queryClient.setQueryData<UserProfile | undefined>(queryKeys.profile, (current) => current ? { ...current, ...updated } : current);
      updateUser(updated);
      setEmailStep('request');
      setNewEmailInput('');
      setVerificationCode('');
      setPendingEmail('');
      setEmailChangeErrors({});
      toast.success('Email address updated successfully.');
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setEmailChangeErrors({ code: 'That email address is already in use' });
      } else if (axios.isAxiosError(error) && error.response?.status === 400) {
        setEmailChangeErrors({ code: 'This code is invalid or has expired' });
      } else {
        toast.error('Failed to confirm the email change. Please try again.');
      }
    } finally {
      setConfirmingEmailChange(false);
    }
  }

  function handleUseDifferentEmail() {
    setEmailStep('request');
    setVerificationCode('');
    setEmailChangeErrors({});
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

  if (profileQuery.isLoading) return <PageSkeleton variant="cards" />;
  if (!profile) return <div className="app-card empty-panel"><h3>Profile unavailable</h3><p>We could not load your account details right now.</p></div>;

  return (
    <>
      <PageHeader eyebrow="Personal settings" title="My profile" description="Manage how you appear to teammates across WorkWise." />
      <div className="form-layout animate-enter-delay">
        <section className="app-card profile-hero">
          <div className="profile-identity">
            <div className="profile-avatar">
              {(editing ? form.avatarUrl : profile.avatarUrl)
                ? <img src={(editing ? form.avatarUrl : profile.avatarUrl) ?? ''} alt={profile.name} />
                : getInitials(profile.name)}
            </div>
            <div><h2>{profile.name}</h2><p>{profile.email}</p></div>
          </div>
          <div className="profile-stats">
            <div className="profile-stat"><strong>{profile._count.projectMembers}</strong><span>Projects</span></div>
            <div className="profile-stat"><strong>{user.initials}</strong><span>Initials</span></div>
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
            <div className="form-stack">
              <Input label="Full name" value={form.name} onChange={(event) => { setForm((current) => ({ ...current, name: event.target.value })); setNameError(''); }} error={nameError} autoFocus />
              <div className="field">
                <label className="field-label" htmlFor="avatar-upload">Profile picture</label>
                <input ref={fileInputRef} id="avatar-upload" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleAvatarChange(event.target.files?.[0])} />
                <div className="avatar-upload-row">
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()}><Icon name="user" size={16} /> Choose from device</Button>
                  {form.avatarUrl && <Button variant="ghost" onClick={() => { setForm((current) => ({ ...current, avatarUrl: '' })); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Remove picture</Button>}
                </div>
                <p className={`field-help${avatarError ? ' field-error' : ''}`}>{avatarError || 'JPG, PNG, or WebP. The image is cropped and resized automatically.'}</p>
              </div>
              <div className="flex gap-2"><Button loading={saving} onClick={handleSave}>Save changes</Button><Button variant="secondary" onClick={handleCancel} disabled={saving}>Cancel</Button></div>
            </div>
          ) : (
            <div className="profile-edit-action"><Button variant="secondary" onClick={() => setEditing(true)}><Icon name="user" size={16} /> Edit profile</Button></div>
          )}
        </section>

        <Card title="Account details" className="tip-card">
          <div className="form-stack">
            <div><p className="field-help">Full name</p><strong className="text-sm">{profile.name}</strong></div>
            <div><p className="field-help">Email address</p><strong className="text-sm break-all">{profile.email}</strong></div>
            <div>
              <p className="field-help mb-2">Project roles</p>
              {profile.projectMembers.length > 0 ? (
                <div className="focus-list">
                  {profile.projectMembers.map((membership) => (
                    <div className="focus-item" key={membership.project.id}>
                      <span className="project-key">{membership.project.key}</span>
                      <span className="focus-copy">
                        <strong>{membership.project.name}</strong>
                        <span>{membership.role.toLowerCase()}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="field-help">No project roles yet.</p>}
            </div>
            <div className="auth-note mt-0"><Icon name="check" size={17} /> Your email is used for sign-in and project invitations.</div>
          </div>
        </Card>

        <div className="settings-stack">
          <Card title="Email address" className="tip-card">
            {emailStep === 'request' ? (
              <form className="form-stack" onSubmit={handleRequestEmailChange} noValidate>
                <p className="field-help">Current email: <strong>{profile.email}</strong></p>
                <Input
                  label="New email address"
                  type="email"
                  value={newEmailInput}
                  onChange={(event) => { setNewEmailInput(event.target.value); setEmailChangeErrors((current) => ({ ...current, newEmail: undefined })); }}
                  error={emailChangeErrors.newEmail}
                  autoComplete="email"
                />
                <div><Button type="submit" loading={requestingEmailChange}>Send verification code</Button></div>
              </form>
            ) : (
              <form className="form-stack" onSubmit={handleConfirmEmailChange} noValidate>
                <div className="auth-note mt-0">
                  <Icon name="sparkles" size={17} />
                  <span className="focus-copy">We sent a verification code to <strong>{pendingEmail}</strong>. Enter it below to confirm the change.</span>
                </div>
                <Input
                  label="Verification code"
                  value={verificationCode}
                  onChange={(event) => { setVerificationCode(event.target.value); setEmailChangeErrors((current) => ({ ...current, code: undefined })); }}
                  error={emailChangeErrors.code}
                  autoComplete="one-time-code"
                />
                <div className="flex gap-2">
                  <Button type="submit" loading={confirmingEmailChange}>Confirm change</Button>
                  <Button type="button" variant="secondary" onClick={handleUseDifferentEmail} disabled={confirmingEmailChange}>Use a different email</Button>
                </div>
              </form>
            )}
          </Card>

          <Card title="Change password" className="tip-card">
            <form className="form-stack" onSubmit={handleChangePassword} noValidate>
              <Input
                label="Current password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => handlePasswordFieldChange('currentPassword', event.target.value)}
                error={passwordErrors.currentPassword}
                autoComplete="current-password"
              />
              <Input
                label="New password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => handlePasswordFieldChange('newPassword', event.target.value)}
                error={passwordErrors.newPassword}
                helperText={passwordErrors.newPassword ? undefined : 'At least 8 characters.'}
                autoComplete="new-password"
              />
              <Input
                label="Confirm new password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => handlePasswordFieldChange('confirmPassword', event.target.value)}
                error={passwordErrors.confirmPassword}
                autoComplete="new-password"
              />
              <div><Button type="submit" loading={changingPassword}>Update password</Button></div>
            </form>
          </Card>

          <div id="notification-preferences" ref={notificationPreferencesRef}>
            <ProjectNotificationPreferences />
          </div>
        </div>
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
