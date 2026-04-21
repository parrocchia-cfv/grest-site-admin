'use client';

import type { Field, Module, TripCapacity } from '@grest/shared';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';

function defaultTripCapacity(): TripCapacity {
  return {
    enabled: false,
    limitsByField: {},
  };
}

function ensureTripCapacity(m: Module): TripCapacity {
  const t = m.tripCapacity;
  if (!t) return defaultTripCapacity();
  const normalized: TripCapacity = {
    ...defaultTripCapacity(),
    ...t,
    limitsByField: {},
  };
  for (const [fieldId, map] of Object.entries(t.limitsByField ?? {})) {
    if (!map || typeof map !== 'object') continue;
    normalized.limitsByField[fieldId] = {};
    for (const [optionValue, lim] of Object.entries(map)) {
      if (typeof lim !== 'number' || !Number.isFinite(lim) || lim < 0) continue;
      normalized.limitsByField[fieldId][optionValue] = Math.floor(lim);
    }
  }
  return normalized;
}

function tripFields(module: Module): Array<{ field: Field; stepId: string }> {
  const out: Array<{ field: Field; stepId: string }> = [];
  for (const step of module.steps) {
    for (const field of step.fields) {
      if (field.type === 'checkbox-group' && field.options?.length) {
        out.push({ field, stepId: step.id });
      }
    }
  }
  return out;
}

export interface TripCapacitySectionProps {
  module: Module;
  onUpdateModule: (updater: (m: Module) => Module) => void;
}

export function TripCapacitySection({ module, onUpdateModule }: TripCapacitySectionProps) {
  const tc = ensureTripCapacity(module);
  const fields = tripFields(module);

  const patchTripCapacity = (patch: Partial<TripCapacity>) => {
    onUpdateModule((m) => ({
      ...m,
      tripCapacity: {
        ...ensureTripCapacity(m),
        ...patch,
      },
    }));
  };

  const setLimit = (fieldId: string, optionValue: string, raw: string) => {
    const nextLimits: Record<string, Record<string, number>> = {
      ...tc.limitsByField,
      [fieldId]: { ...(tc.limitsByField[fieldId] ?? {}) },
    };
    const trimmed = raw.trim();
    if (trimmed === '') {
      delete nextLimits[fieldId][optionValue];
    } else {
      const n = Math.max(0, Math.floor(Number(trimmed) || 0));
      nextLimits[fieldId][optionValue] = n;
    }
    if (Object.keys(nextLimits[fieldId]).length === 0) {
      delete nextLimits[fieldId];
    }
    patchTripCapacity({ limitsByField: nextLimits });
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2">Capienza gite / uscite</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        Limiti per opzione dei campi checkbox-group (gite). Questi valori sono usati da analytics e
        possono essere applicati lato backend in fase submit.
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={tc.enabled}
            onChange={(e) => patchTripCapacity({ enabled: e.target.checked })}
          />
        }
        label="Attiva limiti gite"
      />

      {fields.length === 0 ? (
        <Alert severity="info" sx={{ mt: 1 }}>
          Nessun campo di tipo checkbox-group trovato nel modulo.
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
          {fields.map(({ field, stepId }) => (
            <Box
              key={field.id}
              sx={{
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {field.label?.it ?? field.id}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                Campo <code>{field.id}</code> (step <code>{stepId}</code>)
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {(field.options ?? []).map((opt) => (
                  <Box key={`${field.id}-${opt.value}`} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {opt.label?.it ?? opt.value}{' '}
                      <Typography component="span" variant="caption" color="text.secondary">
                        ({opt.value})
                      </Typography>
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      label="Limite"
                      value={tc.limitsByField[field.id]?.[opt.value] ?? ''}
                      disabled={!tc.enabled}
                      onChange={(e) => setLimit(field.id, opt.value, e.target.value)}
                      inputProps={{ min: 0 }}
                      sx={{ width: 130 }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

