'use client';

import { useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/AdminLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { changeMyPassword } from '@/lib/api-client';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export default function ProfilePage() {
  const auth = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const authHandle = useMemo(
    () => ({
      getAccessToken: auth.getAccessToken,
      getRefreshToken: auth.getRefreshToken,
      setTokens: auth.setTokens,
      clearTokens: auth.clearTokens,
    }),
    [auth.getAccessToken, auth.getRefreshToken, auth.setTokens, auth.clearTokens]
  );

  async function submitChangePassword(): Promise<void> {
    if (!currentPassword || !newPassword) {
      setError('Compila entrambe le password');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changeMyPassword(currentPassword, newPassword, authHandle);
      setNotice('Password aggiornata');
      setCurrentPassword('');
      setNewPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cambio password fallito');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <PageHeader
          title="Profilo"
          subtitle={`Utente: ${auth.user?.username ?? '—'}. Gestisci la tua password di accesso.`}
        />
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice(null)}>{notice}</Alert>}
        <Paper variant="outlined" sx={{ p: 2, maxWidth: 560 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Cambia password</Typography>
          <Box sx={{ display: 'grid', gap: 1 }}>
            <TextField
              label="Password attuale"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <TextField
              label="Nuova password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="Almeno 8 caratteri."
            />
          </Box>
          <Button sx={{ mt: 1.5 }} variant="contained" onClick={submitChangePassword} disabled={busy}>
            Aggiorna password
          </Button>
        </Paper>
      </AdminLayout>
    </ProtectedRoute>
  );
}

