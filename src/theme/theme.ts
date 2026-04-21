'use client';

import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#111827',
    },
    secondary: {
      main: '#475569',
    },
    success: {
      main: '#0f766e',
    },
    warning: {
      main: '#b45309',
    },
    error: {
      main: '#b91c1c',
    },
    background: {
      default: '#f6f7fb',
      paper: '#ffffff',
    },
    text: {
      primary: '#111827',
      secondary: '#475569',
    },
    divider: '#e5e7eb',
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h4: {
      fontSize: '1.75rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontSize: '1.35rem',
      fontWeight: 650,
      letterSpacing: '-0.01em',
    },
    subtitle2: {
      fontWeight: 650,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0',
    },
  },
  shape: {
    borderRadius: 12,
  },
  spacing: 8,
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFeatureSettings: '"cv03", "cv04", "cv11"',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
          border: '1px solid #e5e7eb',
          transition: 'box-shadow 220ms ease, transform 220ms ease, border-color 220ms ease',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingInline: 14,
          minHeight: 36,
          transition: 'transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
          '&:active': {
            transform: 'translateY(0.5px)',
          },
        },
        contained: {
          background: '#111827',
          color: '#fff',
          '&:hover': {
            background: '#0b1220',
            transform: 'translateY(-1px)',
            boxShadow: '0 10px 20px rgba(15,23,42,0.18)',
          },
        },
        outlined: {
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#fff',
          transition: 'box-shadow 180ms ease, border-color 180ms ease',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#94a3b8',
          },
          '&.Mui-focused': {
            boxShadow: '0 0 0 4px rgba(17,24,39,0.06)',
          },
        },
        notchedOutline: {
          borderColor: '#d1d5db',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 650,
          color: '#334155',
          backgroundColor: '#f8fafc',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});
