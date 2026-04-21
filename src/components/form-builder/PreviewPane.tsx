'use client';

import type { Module } from '@grest/shared';
import { formatFieldTypeLabel } from '@/lib/field-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface PreviewPaneProps {
  module: Module;
}

export function PreviewPane({ module }: PreviewPaneProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Anteprima
      </Typography>
      <Typography variant="h6">{module.meta?.title?.it ?? module.id}</Typography>
      {module.steps.map((step) => (
        <Box key={step.id} sx={{ mt: 2 }}>
          <Typography variant="subtitle1" fontWeight="medium">
            {step.title?.it ?? step.id}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {step.fields.map((f) => (
              <li key={f.id}>
                <Typography variant="body2">
                  {f.type === 'notice'
                    ? (f.noticeText?.it ?? f.label?.it ?? f.id).slice(0, 80)
                    : f.label?.it ?? f.id}{' '}
                  ({formatFieldTypeLabel(f.type)})
                  {f.type !== 'notice' && f.required ? ' *' : ''}
                </Typography>
              </li>
            ))}
          </Box>
        </Box>
      ))}
    </Paper>
  );
}
