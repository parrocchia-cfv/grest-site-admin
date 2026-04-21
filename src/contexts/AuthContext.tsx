'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { refresh as apiRefresh } from '@/lib/api-client';

const REFRESH_TOKEN_KEY = 'grest_admin_refresh_token';
const REMEMBER_ME_KEY = 'grest_admin_remember_me';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  rememberMe: boolean;
  isAuthLoading: boolean;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string, rememberMe?: boolean) => void;
  clearTokens: () => void;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  const local = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (local) return local;
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

function loadRememberMeDefault(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(REMEMBER_ME_KEY);
  if (raw == null) return true;
  return raw === '1';
}

function persistRefreshToken(refresh: string, rememberMe: boolean): void {
  if (typeof window === 'undefined') return;
  if (rememberMe) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.setItem(REMEMBER_ME_KEY, '1');
  } else {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.setItem(REMEMBER_ME_KEY, '0');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [state, setState] = useState<AuthState>(() => ({
    accessToken: null,
    refreshToken: loadStoredRefreshToken(),
    rememberMe: loadRememberMeDefault(),
    isAuthLoading: true,
  }));

  const setTokens = useCallback((access: string, refresh: string, rememberMe?: boolean) => {
    const persistAsRemember = rememberMe ?? state.rememberMe;
    setState((prev) => ({
      accessToken: access,
      refreshToken: refresh,
      rememberMe: persistAsRemember,
      isAuthLoading: false,
    }));
    persistRefreshToken(refresh, persistAsRemember);
  }, [state.rememberMe]);

  const clearTokens = useCallback(() => {
    setState((prev) => ({
      accessToken: null,
      refreshToken: null,
      rememberMe: prev.rememberMe,
      isAuthLoading: false,
    }));
    if (typeof window !== 'undefined') {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }, []);

  useEffect(() => {
    if (bootstrapped) return;
    const rt = state.refreshToken;
    if (!rt) {
      setState((prev) => ({ ...prev, isAuthLoading: false }));
      setBootstrapped(true);
      return;
    }
    let cancelled = false;
    apiRefresh(rt)
      .then((res) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          isAuthLoading: false,
        }));
        persistRefreshToken(res.refreshToken, state.rememberMe);
        setBootstrapped(true);
      })
      .catch(() => {
        if (cancelled) return;
        clearTokens();
        setBootstrapped(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bootstrapped, clearTokens, state.refreshToken, state.rememberMe]);

  const getAccessToken = useCallback(() => state.accessToken, [state.accessToken]);
  const getRefreshToken = useCallback(() => state.refreshToken, [state.refreshToken]);

  const value: AuthContextValue = {
    ...state,
    isAuthenticated: !!state.accessToken,
    setTokens,
    clearTokens,
    getAccessToken,
    getRefreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
