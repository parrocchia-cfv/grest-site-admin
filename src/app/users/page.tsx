'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/AdminLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import {
  createAdminUser,
  deleteAdminUser,
  getModules,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  type AuthUserProfile,
} from '@/lib/api-client';
import type { Module } from '@grest/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

export default function UsersPage() {
  const auth = useAuth();
  const canManageUsers = Boolean(auth.user?.isSuperadmin || auth.user?.permissions.manageUsers);

  const authHandle = useMemo(
    () => ({
      getAccessToken: auth.getAccessToken,
      getRefreshToken: auth.getRefreshToken,
      setTokens: auth.setTokens,
      clearTokens: auth.clearTokens,
    }),
    [auth.getAccessToken, auth.getRefreshToken, auth.setTokens, auth.clearTokens]
  );

  const [users, setUsers] = useState<AuthUserProfile[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createData, setCreateData] = useState({
    username: '',
    password: '',
    isSuperadmin: false,
    manageUsers: false,
    manageModules: false,
    manageSubmissions: false,
    viewAnalytics: false,
    moduleIds: [] as string[],
  });

  async function refresh(): Promise<void> {
    const [u, m] = await Promise.all([listAdminUsers(authHandle), getModules(authHandle)]);
    setUsers(u);
    setModules(m);
  }

  useEffect(() => {
    if (!canManageUsers) return;
    refresh().catch((e) => setError(e instanceof Error ? e.message : 'Errore caricamento utenti'));
  }, [canManageUsers]);

  function toggleModule(moduleId: string): void {
    setCreateData((prev) => ({
      ...prev,
      moduleIds: prev.moduleIds.includes(moduleId)
        ? prev.moduleIds.filter((x) => x !== moduleId)
        : [...prev.moduleIds, moduleId],
    }));
  }

  async function handleCreate(): Promise<void> {
    if (!createData.username.trim() || !createData.password.trim()) {
      setError('Inserisci username e password');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createAdminUser(
        {
          username: createData.username.trim(),
          password: createData.password,
          isSuperadmin: createData.isSuperadmin,
          permissions: {
            manageUsers: createData.manageUsers,
            manageModules: createData.manageModules,
            manageSubmissions: createData.manageSubmissions,
            viewAnalytics: createData.viewAnalytics,
          },
          moduleIds: createData.isSuperadmin ? [] : createData.moduleIds,
        },
        authHandle
      );
      setNotice('Utente creato');
      setCreateData({
        username: '',
        password: '',
        isSuperadmin: false,
        manageUsers: false,
        manageModules: false,
        manageSubmissions: false,
        viewAnalytics: false,
        moduleIds: [],
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Creazione utente fallita');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(userId: number): Promise<void> {
    if (!window.confirm('Eliminare questo utente?')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminUser(userId, authHandle);
      setNotice('Utente eliminato');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eliminazione utente fallita');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(userId: number): Promise<void> {
    const pw = window.prompt('Nuova password (min 8 caratteri)');
    if (!pw) return;
    setBusy(true);
    setError(null);
    try {
      await resetAdminUserPassword(userId, pw, authHandle);
      setNotice('Password resettata');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset password fallito');
    } finally {
      setBusy(false);
    }
  }

  async function togglePermission(
    user: AuthUserProfile,
    key: 'manageUsers' | 'manageModules' | 'manageSubmissions' | 'viewAnalytics'
  ): Promise<void> {
    if (user.isSuperadmin) return;
    setBusy(true);
    setError(null);
    try {
      await updateAdminUser(
        user.id,
        {
          isSuperadmin: user.isSuperadmin,
          permissions: { ...user.permissions, [key]: !user.permissions[key] },
          moduleIds: user.moduleIds,
        },
        authHandle
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aggiornamento permessi fallito');
    } finally {
      setBusy(false);
    }
  }

  if (!canManageUsers) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <Alert severity="error">Non hai i permessi per la gestione utenti.</Alert>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <PageHeader title="Utenti admin" subtitle="Crea utenti, assegna permessi e resetta password." />
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice(null)}>{notice}</Alert>}

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Nuovo utente</Typography>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <TextField
              label="Username"
              value={createData.username}
              onChange={(e) => setCreateData((p) => ({ ...p, username: e.target.value }))}
            />
            <TextField
              label="Password iniziale"
              type="password"
              value={createData.password}
              onChange={(e) => setCreateData((p) => ({ ...p, password: e.target.value }))}
            />
          </Box>
          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={<Checkbox checked={createData.isSuperadmin} onChange={(e) => setCreateData((p) => ({ ...p, isSuperadmin: e.target.checked }))} />}
              label="Superadmin"
            />
            <FormControlLabel
              control={<Checkbox checked={createData.manageUsers} onChange={(e) => setCreateData((p) => ({ ...p, manageUsers: e.target.checked }))} />}
              label="Gestione utenti"
            />
            <FormControlLabel
              control={<Checkbox checked={createData.manageModules} onChange={(e) => setCreateData((p) => ({ ...p, manageModules: e.target.checked }))} />}
              label="Gestione moduli"
            />
            <FormControlLabel
              control={<Checkbox checked={createData.manageSubmissions} onChange={(e) => setCreateData((p) => ({ ...p, manageSubmissions: e.target.checked }))} />}
              label="Gestione iscrizioni"
            />
            <FormControlLabel
              control={<Checkbox checked={createData.viewAnalytics} onChange={(e) => setCreateData((p) => ({ ...p, viewAnalytics: e.target.checked }))} />}
              label="Analytics"
            />
          </Box>
          {!createData.isSuperadmin && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">Moduli visibili (scope)</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.75 }}>
                {modules.map((m) => (
                  <Chip
                    key={m.id}
                    label={m.meta?.title?.it?.trim() || m.id}
                    clickable
                    color={createData.moduleIds.includes(m.id) ? 'primary' : 'default'}
                    onClick={() => toggleModule(m.id)}
                  />
                ))}
              </Box>
            </Box>
          )}
          <Button sx={{ mt: 1.5 }} variant="contained" onClick={handleCreate} disabled={busy}>
            Crea utente
          </Button>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Utenti esistenti</Typography>
          <Box sx={{ display: 'grid', gap: 1 }}>
            {users.map((u) => (
              <Box key={u.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 600 }}>{u.username}</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => handleResetPassword(u.id)} disabled={busy}>
                      Reset password
                    </Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => handleDelete(u.id)} disabled={busy || u.id === auth.user?.id}>
                      Elimina
                    </Button>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.75 }}>
                  <Chip size="small" label={u.isSuperadmin ? 'Superadmin' : 'Utente limitato'} color={u.isSuperadmin ? 'primary' : 'default'} />
                  <Chip size="small" label={`moduli: ${u.isSuperadmin ? 'tutti' : u.moduleIds.length}`} />
                </Box>
                {!u.isSuperadmin && (
                  <Box sx={{ mt: 0.75, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {(['manageUsers', 'manageModules', 'manageSubmissions', 'viewAnalytics'] as const).map((key) => (
                      <Button key={key} size="small" variant={u.permissions[key] ? 'contained' : 'outlined'} onClick={() => void togglePermission(u, key)} disabled={busy}>
                        {key}
                      </Button>
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Paper>
      </AdminLayout>
    </ProtectedRoute>
  );
}

