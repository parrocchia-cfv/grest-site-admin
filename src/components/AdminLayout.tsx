'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { useAuth } from '@/contexts/AuthContext';

const nav = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Moduli', href: '/forms' },
  { label: 'Analytics', href: '/analytics' },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { clearTokens } = useAuth();

  function handleLogout() {
    clearTokens();
    router.push('/login');
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}
      >
        <Toolbar sx={{ minHeight: 66 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700, color: 'text.primary' }}>
            Admin GREST
          </Typography>
          {nav.map(({ label, href }) => (
            <Button
              key={href}
              component={Link}
              href={href}
              color="inherit"
              sx={{
                color: pathname === href ? 'text.primary' : 'text.secondary',
                borderBottom: pathname === href ? '2px solid' : '2px solid transparent',
                borderRadius: 0,
                px: 1.5,
              }}
            >
              {label}
            </Button>
          ))}
          <Button variant="outlined" color="inherit" onClick={handleLogout} sx={{ ml: 1 }}>
            Esci
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" component="main" sx={{ py: { xs: 2, md: 3 } }}>
        {children}
      </Container>
    </Box>
  );
}
