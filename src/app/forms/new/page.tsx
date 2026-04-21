'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
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
import { createEmptyModule, resetCounters } from '@/lib/defaults';
import { useAuth } from '@/contexts/AuthContext';
import { createModule } from '@/lib/api-client';
import { validateEmailOnSubmitForSave } from '@/lib/validate-email-on-submit';

const initialModule: Module = (() => {
  resetCounters();
  return createEmptyModule();
})();

export default function NewFormPage() {
  const router = useRouter();
  const auth = useAuth();
  const [module, setModule] = useState<Module>(initialModule);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHandle = {
    getAccessToken: auth.getAccessToken,
    getRefreshToken: auth.getRefreshToken,
    setTokens: auth.setTokens,
    clearTokens: auth.clearTokens,
  };

  const handleSave = useCallback(async () => {
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
      const created = await createModule(module, authHandle);
      router.push(`/forms/edit?id=${encodeURIComponent(created.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  }, [module, authHandle, router]);

  return (
    <ProtectedRoute>
      <AdminLayout>
        <PageHeader
          title="Nuovo modulo"
          subtitle="Configura schema, opzioni email e capienze prima del primo salvataggio."
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
