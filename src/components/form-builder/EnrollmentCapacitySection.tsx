'use client';

import { useEffect, useState } from 'react';
import type { EnrollmentCapacity, Module } from '@grest/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

function defaultEnrollment(): EnrollmentCapacity {
  return {
    enabled: false,
    sedeFieldId: '',
    weekFieldIds: [],
    limitsBySede: {},
  };
}

function ensureEnrollment(m: Module): EnrollmentCapacity {
  const e = m.enrollmentCapacity;
  if (!e) return defaultEnrollment();
  return {
    ...defaultEnrollment(),
    ...e,
    weekFieldIds: e.weekFieldIds ? [...e.weekFieldIds] : [],
    limitsBySede: e.limitsBySede ? { ...e.limitsBySede } : {},
  };
}

export interface EnrollmentCapacitySectionProps {
  module: Module;
  onUpdateModule: (updater: (m: Module) => Module) => void;
}

function parseWeekFieldIdsLine(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function EnrollmentCapacitySection({
  module,
  onUpdateModule,
}: EnrollmentCapacitySectionProps) {
  const ec = ensureEnrollment(module);
  const [sedeText, setSedeText] = useState(() => ec.sedeFieldId);
  const [weekFieldIdsText, setWeekFieldIdsText] = useState(() =>
    ec.weekFieldIds.join(', ')
  );
  const [weekParticipationText, setWeekParticipationText] = useState(
    () => ec.weekParticipationValue ?? ''
  );
  const [limitsText, setLimitsText] = useState(() =>
    JSON.stringify(ec.limitsBySede ?? {}, null, 2)
  );
  const [limitsError, setLimitsError] = useState<string | null>(null);

  const limitsSig = JSON.stringify(module.enrollmentCapacity?.limitsBySede ?? {});
  const weekSig = JSON.stringify(module.enrollmentCapacity?.weekFieldIds ?? []);
  const sedeSig = module.enrollmentCapacity?.sedeFieldId ?? '';
  const partSig = module.enrollmentCapacity?.weekParticipationValue ?? '';

  useEffect(() => {
    const e = ensureEnrollment(module);
    setSedeText(e.sedeFieldId);
    setWeekFieldIdsText(e.weekFieldIds.join(', '));
    setWeekParticipationText(e.weekParticipationValue ?? '');
    setLimitsText(JSON.stringify(e.limitsBySede ?? {}, null, 2));
    setLimitsError(null);
  }, [module.id, limitsSig, weekSig, sedeSig, partSig]);

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2">Capienza iscrizioni (sede × settimana)</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        Il backend conta le righe inviate per ogni combinazione sede e settimana. Se i posti sono
        esauriti, l’iscrizione resta salvata in lista d’attesa con un numero interno per gli
        organizzatori (non mostrato sul sito pubblico).
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={ec.enabled}
            onChange={(e) =>
              onUpdateModule((m) => ({
                ...m,
                enrollmentCapacity: {
                  ...ensureEnrollment(m),
                  enabled: e.target.checked,
                },
              }))
            }
          />
        }
        label="Attiva limiti e lista d’attesa"
      />
      <TextField
        fullWidth
        size="small"
        label="ID campo sede"
        value={sedeText}
        disabled={!ec.enabled}
        onChange={(e) => setSedeText(e.target.value)}
        onBlur={() =>
          onUpdateModule((m) => ({
            ...m,
            enrollmentCapacity: {
              ...ensureEnrollment(m),
              sedeFieldId: sedeText.trim(),
            },
          }))
        }
        margin="dense"
        placeholder="es. sede_grest"
        helperText="Stesso id del campo radio/select sede nel modulo (nei figli ripetuti: suffisso _0, _1, …)."
      />
      <TextField
        fullWidth
        size="small"
        label="ID campi settimana (separati da virgola o punto e virgola)"
        value={weekFieldIdsText}
        disabled={!ec.enabled}
        onChange={(e) => setWeekFieldIdsText(e.target.value)}
        onBlur={() =>
          onUpdateModule((m) => ({
            ...m,
            enrollmentCapacity: {
              ...ensureEnrollment(m),
              weekFieldIds: parseWeekFieldIdsLine(weekFieldIdsText),
            },
          }))
        }
        margin="dense"
        placeholder="prima, seconda, terza"
        helperText="Puoi usare spazi dopo le virgole; l’elenco viene aggiornato quando esci dal campo."
      />
      <TextField
        fullWidth
        size="small"
        label="Valore «partecipo» settimana (opzionale)"
        value={weekParticipationText}
        disabled={!ec.enabled}
        onChange={(e) => setWeekParticipationText(e.target.value)}
        onBlur={() =>
          onUpdateModule((m) => ({
            ...m,
            enrollmentCapacity: {
              ...ensureEnrollment(m),
              weekParticipationValue: weekParticipationText.trim() || undefined,
            },
          }))
        }
        margin="dense"
        placeholder="si (predefinito sul server)"
      />
      <TextField
        fullWidth
        size="small"
        label="Limiti (JSON): limitsBySede"
        value={limitsText}
        disabled={!ec.enabled}
        onChange={(e) => {
          setLimitsText(e.target.value);
          setLimitsError(null);
        }}
        onBlur={() => {
          try {
            const parsed = JSON.parse(limitsText) as unknown;
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              setLimitsError('Inserisci un oggetto JSON.');
              return;
            }
            onUpdateModule((m) => ({
              ...m,
              enrollmentCapacity: {
                ...ensureEnrollment(m),
                limitsBySede: parsed as Record<string, Record<string, number>>,
              },
            }));
            setLimitsError(null);
          } catch {
            setLimitsError('JSON non valido.');
          }
        }}
        margin="dense"
        multiline
        minRows={6}
        error={Boolean(limitsError)}
        InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }}
        helperText={
          limitsError ||
          'Esempio: per ogni value sede (es. "salva"), chiavi = id campo settimana e numero posti.'
        }
      />
      <Alert severity="info" sx={{ mt: 1 }}>
        Esempio struttura:{' '}
        <code>
          {`{ "salva": { "prima": 40, "seconda": 40, "terza": 35 } }`}
        </code>
      </Alert>
    </Box>
  );
}
