import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authService from '../services/authService';
import type { LoginPayload, RegisterPayload, User } from '../services/authService';
import { clearStoredAuth, getStoredAuth, setStoredAuth, updateStoredUser } from '../services/authStorage';
import { getMyProfile } from '../services/userService';
import { setAuthHandlers } from '../services/apiClient';
import { queryKeys, queryTimes } from '../services/queryOptions';
import { AuthContext } from './auth-context';
import type { AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [initialAuth] = useState(getStoredAuth);
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(initialAuth !== null);

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
  }, []);

  const updateUser = useCallback((nextUser: User) => {
    updateStoredUser(nextUser);
    setUser(nextUser);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await authService.login(payload);
    setStoredAuth(response);
    setUser(response.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await authService.register(payload);
    setStoredAuth(response);
    setUser(response.user);
  }, []);

  useEffect(() => {
    setAuthHandlers({ onUnauthorized: logout });
    return () => setAuthHandlers({ onUnauthorized: undefined });
  }, [logout]);

  useEffect(() => {
    let active = true;
    const stored = initialAuth;

    if (!stored) {
      return () => { active = false; };
    }

    queryClient.fetchQuery({
      queryKey: queryKeys.profile,
      queryFn: getMyProfile,
      staleTime: queryTimes.profile,
    })
      .then((profile) => {
        if (!active) return;
        updateUser({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatarUrl: profile.avatarUrl,
          notificationPreference: profile.notificationPreference,
        });
      })
      .catch(() => {
        if (active) logout();
      })
      .finally(() => {
        if (active) setIsInitializing(false);
      });

    return () => { active = false; };
  }, [initialAuth, logout, queryClient, updateUser]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, isInitializing, login, register, updateUser, logout }),
    [user, isInitializing, login, register, updateUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
