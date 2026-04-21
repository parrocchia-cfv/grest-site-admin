'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/AdminLayout';
import { PageHeader } from '@/components/PageHeader';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <PageHeader
          title="Dashboard"
          subtitle="Panoramica rapida e accesso ai flussi principali dell’admin."
        />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' } }}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Moduli</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Crea, modifica e pubblica i moduli dinamici.
            </Typography>
            <Button component={NextLink} href="/forms" variant="contained">Apri moduli</Button>
          </Paper>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Nuovo modulo</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Parti da una struttura vuota e configura campi/step.
            </Typography>
            <Button component={NextLink} href="/forms/new" variant="outlined">Crea modulo</Button>
          </Paper>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Analytics</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Iscritti, capienze settimane/gite ed export dati.
            </Typography>
            <Button component={NextLink} href="/analytics" variant="outlined">Apri analytics</Button>
          </Paper>
        </Box>
        <Box sx={{ mt: 2 }}>
          <Link component={NextLink} href="/forms" color="text.secondary">
            Vai alla gestione completa dei moduli
          </Link>
        </Box>
      </AdminLayout>
    </ProtectedRoute>
  );
}
