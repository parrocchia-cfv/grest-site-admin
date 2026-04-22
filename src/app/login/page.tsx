'use client';

import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import { useAuth } from '@/contexts/AuthContext';
import { login as apiLogin } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const { setTokens } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiLogin({ username, password });
      // Commit tokens before navigating: otherwise ProtectedRoute can render
      // with stale isAuthenticated (false) and redirect back to /login.
      flushSync(() => {
        setTokens(res.accessToken, res.refreshToken, rememberMe, res.user);
      });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accesso non riuscito');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, maxWidth: 440, width: '100%' }}>
        <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Admin – Accesso
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Accedi al pannello per gestire moduli, iscrizioni e capienze.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Utente"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            required
            autoComplete="username"
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            autoComplete="current-password"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
            }
            label="Remember me su questo dispositivo"
            sx={{ mt: 0.5 }}
          />
          {error && (
            <Typography color="error" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 2.25, minHeight: 42 }}
            disabled={loading}
          >
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
