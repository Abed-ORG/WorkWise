import { useContext } from 'react';
import { AuthContext } from '../context/auth-context';
import type { LoginPayload, RegisterPayload, User } from '../services/authService';

export interface AuthState {
  isAuthenticated: boolean;
  isInitializing: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    initials: string;
    avatarUrl?: string | null;
    notificationPreference?: User['notificationPreference'];
  };
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  updateUser: (user: User) => void;
  logout: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const { user, isAuthenticated, isInitializing, login, register, updateUser, logout } = context;

  return {
    isAuthenticated,
    isInitializing,
    user: {
      id: user?.id ?? '',
      name: user?.name ?? '',
      email: user?.email ?? '',
      initials: user ? getInitials(user.name) : '',
      avatarUrl: user?.avatarUrl,
      notificationPreference: user?.notificationPreference,
    },
    login,
    register,
    updateUser,
    logout,
  };
}
