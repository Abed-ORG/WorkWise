import { useContext } from 'react';
import { AuthContext } from '../context/auth-context';
import type { LoginPayload, RegisterPayload, User } from '../services/authService';
import { getInitials } from '../utils/initials';

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
      initials: user ? getInitials(user.name, '') : '',
      avatarUrl: user?.avatarUrl,
      notificationPreference: user?.notificationPreference,
    },
    login,
    register,
    updateUser,
    logout,
  };
}
