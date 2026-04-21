import type { Module } from '@grest/shared';
import { apiConfig } from './api-config';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export type AuthHandle = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (access: string, refresh: string) => void;
  clearTokens: () => void;
};

export interface AdminSubmissionRow {
  id: string;
  moduleId: string;
  submittedAt: string | null;
  submissionGroupId: string | null;
  responses: Record<string, unknown>;
}

export interface AdminSubmissionPatchRequest {
  moduleId: string;
  responses: Record<string, unknown>;
  submittedAt?: string | null;
}

function redirectToLogin() {
  if (typeof window !== 'undefined') window.location.href = '/login';
}

/** Legge `detail` da risposta FastAPI (stringa o oggetto con `message`). */
async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const j: unknown = await res.json();
    if (j && typeof j === 'object' && 'detail' in j) {
      const d = (j as { detail: unknown }).detail;
      if (typeof d === 'string' && d.trim()) return d.trim();
      if (d && typeof d === 'object' && 'message' in d) {
        const msg = (d as { message?: unknown }).message;
        if (typeof msg === 'string' && msg.trim()) {
          const err = (d as { error?: unknown }).error;
          const prefix = typeof err === 'string' && err.trim() ? `[${err.trim()}] ` : '';
          return prefix + msg.trim();
        }
      }
    }
  } catch {
    /* ignore */
  }
  return `${fallback} (HTTP ${res.status})`;
}

async function fetchWithAuth(
  path: string,
  options: RequestInit,
  auth: AuthHandle
): Promise<Response> {
  const base = apiConfig.baseUrl;
  if (!base) throw new Error('API URL not configured');
  const token = auth.getAccessToken();
  const headers: HeadersInit = {
    ...(options.headers as Record<string, string>),
    Authorization: token ? `Bearer ${token}` : '',
  };
  let res = await fetch(`${base}${path}`, { ...options, headers });
  if (res.status === 401) {
    const refreshToken = auth.getRefreshToken();
    if (refreshToken) {
      try {
        const newTokens = await refresh(refreshToken);
        auth.setTokens(newTokens.accessToken, newTokens.refreshToken);
        const retryHeaders: HeadersInit = {
          ...(options.headers as Record<string, string>),
          Authorization: `Bearer ${newTokens.accessToken}`,
        };
        res = await fetch(`${base}${path}`, { ...options, headers: retryHeaders });
      } catch {
        auth.clearTokens();
        redirectToLogin();
        throw new Error('Unauthorized');
      }
    }
    if (res.status === 401) {
      auth.clearTokens();
      redirectToLogin();
      throw new Error('Unauthorized');
    }
  }
  return res;
}

// Auth API (no token required)

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const base = apiConfig.baseUrl;
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json() as Promise<LoginResponse>;
}

export async function refresh(refreshToken: string): Promise<RefreshResponse> {
  const base = apiConfig.baseUrl;
  const res = await fetch(`${base}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Refresh failed');
  return res.json() as Promise<RefreshResponse>;
}

// Modules API (require auth)

export async function getModules(auth: AuthHandle): Promise<Module[]> {
  const res = await fetchWithAuth('/api/admin/modules', { method: 'GET' }, auth);
  if (!res.ok) throw new Error('Failed to load modules');
  return res.json() as Promise<Module[]>;
}

export async function getModule(id: string, auth: AuthHandle): Promise<Module | null> {
  const res = await fetchWithAuth(`/api/admin/modules/${encodeURIComponent(id)}`, { method: 'GET' }, auth);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load module');
  return res.json() as Promise<Module>;
}

export async function createModule(module: Module, auth: AuthHandle): Promise<Module> {
  const res = await fetchWithAuth('/api/admin/modules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(module),
  }, auth);
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Creazione modulo fallita'));
  return res.json() as Promise<Module>;
}

export async function updateModule(id: string, module: Module, auth: AuthHandle): Promise<Module> {
  const res = await fetchWithAuth(`/api/admin/modules/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(module),
  }, auth);
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Salvataggio modulo fallito'));
  return res.json() as Promise<Module>;
}

export async function getModuleSubmissions(
  moduleId: string,
  auth: AuthHandle
): Promise<AdminSubmissionRow[]> {
  const res = await fetchWithAuth(
    `/api/admin/modules/${encodeURIComponent(moduleId)}/submissions`,
    { method: 'GET' },
    auth
  );
  if (!res.ok) throw new Error('Caricamento iscrizioni fallito');
  return res.json() as Promise<AdminSubmissionRow[]>;
}

export async function patchAdminSubmission(
  submissionId: string,
  body: AdminSubmissionPatchRequest,
  auth: AuthHandle
): Promise<{ ok: boolean }> {
  const res = await fetchWithAuth(
    `/api/admin/submissions/${encodeURIComponent(submissionId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    auth
  );
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Aggiornamento iscrizione fallito'));
  return res.json() as Promise<{ ok: boolean }>;
}

export async function deleteAdminSubmission(
  submissionId: string,
  scope: 'single' | 'group',
  auth: AuthHandle
): Promise<{ ok: boolean; deletedCount: number }> {
  const res = await fetchWithAuth(
    `/api/admin/submissions/${encodeURIComponent(submissionId)}?scope=${encodeURIComponent(scope)}`,
    { method: 'DELETE' },
    auth
  );
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Eliminazione iscrizione fallita'));
  return res.json() as Promise<{ ok: boolean; deletedCount: number }>;
}

export async function downloadBackendLog(auth: AuthHandle): Promise<Blob> {
  const res = await fetchWithAuth('/api/admin/logs/download', { method: 'GET' }, auth);
  if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Download log backend fallito'));
  return res.blob();
}
