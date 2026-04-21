'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/AdminLayout';
import { PageHeader } from '@/components/PageHeader';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import type { Module } from '@grest/shared';
import { useAuth } from '@/contexts/AuthContext';
import { downloadBackendLog, getModules } from '@/lib/api-client';
import { getPublicFormUrl, getPublicFormSlug } from '@/lib/public-form-url';

function getTitle(module: Module): string {
  return module.meta?.title?.it ?? module.id;
}

/** List endpoint may return partial module rows; treat as Module for display. */
type ModuleRow = Module;

export default function FormsListPage() {
  const auth = useAuth();
  const [list, setList] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);

  useEffect(() => {
    const authHandle = {
      getAccessToken: auth.getAccessToken,
      getRefreshToken: auth.getRefreshToken,
      setTokens: auth.setTokens,
      clearTokens: auth.clearTokens,
    };
    getModules(authHandle)
      .then(setList)
      .catch((err) => setError(err instanceof Error ? err.message : 'Errore'))
      .finally(() => setLoading(false));
  }, [auth.getAccessToken, auth.getRefreshToken, auth.setTokens, auth.clearTokens]);

  async function copyPublicLink(m: ModuleRow) {
    const full = getPublicFormUrl(m);
    const slug = getPublicFormSlug(m);
    try {
      if (full) {
        await navigator.clipboard.writeText(full);
        setCopyMsg('Link pubblico copiato');
      } else {
        await navigator.clipboard.writeText(slug);
        setCopyMsg(
          'Copiato solo lo slug. Imposta NEXT_PUBLIC_PUBLIC_SITE_URL in .env.local per l’URL completo.'
        );
      }
      setTimeout(() => setCopyMsg(null), 4000);
    } catch {
      setCopyMsg('Copia non riuscita');
      setTimeout(() => setCopyMsg(null), 3000);
    }
  }

  async function downloadLogFile() {
    const authHandle = {
      getAccessToken: auth.getAccessToken,
      getRefreshToken: auth.getRefreshToken,
      setTokens: auth.setTokens,
      clearTokens: auth.clearTokens,
    };
    setDownloadBusy(true);
    setError(null);
    try {
      const blob = await downloadBackendLog(authHandle);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backend-log-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download log non riuscito');
    } finally {
      setDownloadBusy(false);
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <PageHeader
          title="Moduli"
          subtitle="Gestisci i moduli, copia link pubblici e accedi all’editor."
          actions={
            <>
              <Button
                variant="outlined"
                onClick={() => void downloadLogFile()}
                disabled={downloadBusy}
              >
                {downloadBusy ? 'Scarico log…' : 'Scarica log backend'}
              </Button>
              <Button component={Link} href="/forms/new" variant="contained">
                Nuovo modulo
              </Button>
            </>
          }
        />
        {copyMsg && (
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            {copyMsg}
          </Typography>
        )}
        {error && (
          <Typography color="error" sx={{ mb: 1 }}>
            {error}
          </Typography>
        )}
        {loading ? (
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary">Caricamento moduli…</Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Titolo</TableCell>
                  <TableCell>ID (admin)</TableCell>
                  <TableCell>GUID / slug pubblico</TableCell>
                  <TableCell>Versione</TableCell>
                  <TableCell align="right">Azioni</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{getTitle(m)}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{m.id}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {m.guid ?? '—'}
                    </TableCell>
                    <TableCell>{m.version}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Copia URL pubblico (o slug se manca il sito in .env)">
                        <Button size="small" onClick={() => copyPublicLink(m)} sx={{ mr: 1 }}>
                          Copia link
                        </Button>
                      </Tooltip>
                      <Button component={Link} href={`/forms/edit?id=${encodeURIComponent(m.id)}`} size="small">
                        Modifica
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
