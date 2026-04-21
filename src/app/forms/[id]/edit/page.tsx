'use client';

import { useRouter, useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/AdminLayout';
import { PageHeader } from '@/components/PageHeader';
import { FormBuilder } from '@/components/form-builder/FormBuilder';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import type { Module } from '@grest/shared';
import { useAuth } from '@/contexts/AuthContext';
import { getModule, updateModule } from '@/lib/api-client';
import { validateEmailOnSubmitForSave } from '@/lib/validate-email-on-submit';

export default function EditFormPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const auth = useAuth();
  const [module, setModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHandle = {
    getAccessToken: auth.getAccessToken,
    getRefreshToken: auth.getRefreshToken,
    setTokens: auth.setTokens,
    clearTokens: auth.clearTokens,
  };

  useEffect(() => {
    getModule(id, authHandle)
      .then((m) => {
        setModule(m ?? null);
        if (!m) setError('Modulo non trovato');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Errore'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = useCallback(async () => {
    if (!module) return;
    if (!module.meta?.title?.it?.trim()) {
      setError('Inserisci il titolo del modulo.');
      return;
    }
    if (module.steps.length === 0) {
      setError('Aggiungi almeno uno step.');
      return;
    }
    const emailErr = validateEmailOnSubmitForSave(module);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateModule(module.id, module, authHandle);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  }, [module, authHandle]);

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary">Caricamento modulo…</Typography>
          </Paper>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!module) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <Alert severity="error">{error ?? 'Modulo non trovato'}</Alert>
          <Button sx={{ mt: 1 }} onClick={() => router.push('/forms')}>
            Torna all’elenco
          </Button>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <PageHeader
          title={`Modifica: ${module.meta?.title?.it ?? module.id}`}
          subtitle="Aggiorna schema e impostazioni. Il salvataggio preserva l’identità del modulo."
          actions={
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvataggio…' : 'Salva'}
            </Button>
          }
        />
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        <Paper sx={{ p: 1.25 }}>
          <FormBuilder module={module} onChange={setModule} />
        </Paper>
      </AdminLayout>
    </ProtectedRoute>
  );
}
