'use client';

import type { EmailOnSubmit, Module, RiepilogoPricing } from '@grest/shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

/** Campi checkbox-group «uscite» da cui suggerire i `value` delle opzioni gite. */
export const GITE_FIELD_IDS = [
  'uscite_elem_1_2_giorni',
  'uscite_1_2',
  'uscite_elem_3_5_giorni',
  'uscite_3_5',
  'uscite_medie_giorni',
  'uscite_m',
] as const;

const GITE_FIELD_ID_SET = new Set<string>(GITE_FIELD_IDS);

function isRiepilogoPricingEmpty(r: RiepilogoPricing): boolean {
  if (r.iscrizioneBaseEur != null) return false;
  if (r.euroPerSettimanaSelezionata != null) return false;
  if (r.tesseramentoNoiNuovoEur != null) return false;
  if (r.scontoFamigliaNumerosaEur != null) return false;
  if (r.tesseramentoFieldId?.trim()) return false;
  if (r.tesseramentoWhenValue?.trim()) return false;
  const pg = r.prezziGiteByOptionValue;
  if (pg && Object.keys(pg).length > 0) return false;
  return true;
}

export function suggestedGitaOptionValues(module: Module): string[] {
  const seen = new Set<string>();
  for (const step of module.steps) {
    for (const f of step.fields) {
      if (!GITE_FIELD_ID_SET.has(f.id)) continue;
      if (f.type !== 'checkbox-group' || !f.options) continue;
      for (const opt of f.options) {
        const v = opt.value?.trim();
        if (v) seen.add(v);
      }
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

function numOrUndef(raw: string): number | undefined {
  const t = raw.trim();
  if (t === '') return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export interface EmailRiepilogoPricingSectionProps {
  module: Module;
  email: EmailOnSubmit;
  disabled: boolean;
  onPatchEmail: (patch: Partial<EmailOnSubmit>) => void;
}

export function EmailRiepilogoPricingSection({
  module,
  email,
  disabled,
  onPatchEmail,
}: EmailRiepilogoPricingSectionProps) {
  const rp = email.riepilogoPricing ?? {};
  const giteMap = rp.prezziGiteByOptionValue ?? {};
  const suggestions = suggestedGitaOptionValues(module);
  const usedKeys = new Set(Object.keys(giteMap));

  const patchRp = (partial: Partial<RiepilogoPricing>) => {
    const next: RiepilogoPricing = {
      ...rp,
      ...partial,
    };
    if (
      next.prezziGiteByOptionValue &&
      Object.keys(next.prezziGiteByOptionValue).length === 0
    ) {
      delete next.prezziGiteByOptionValue;
    }
    onPatchEmail({
      riepilogoPricing: isRiepilogoPricingEmpty(next) ? undefined : next,
    });
  };

  const setGiteMap = (next: Record<string, number>) => {
    patchRp({
      prezziGiteByOptionValue: Object.keys(next).length ? next : undefined,
    });
  };

  const updateNumeric = (key: keyof RiepilogoPricing, raw: string) => {
    const n = numOrUndef(raw);
    patchRp({ [key]: n } as Partial<RiepilogoPricing>);
  };

  return (
    <Box
      sx={{
        mt: 2,
        p: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="subtitle2" gutterBottom>
        Tariffe riepilogo email
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
        Usate per il placeholder <code>{'{{ riepilogo }}'}</code> nel corpo della mail. Valori assenti
        usano i default in <code>grest_riepilogo.py</code> sul server.
      </Typography>

      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
          <TextField
            size="small"
            type="number"
            label="Iscrizione base (€)"
            disabled={disabled}
            value={rp.iscrizioneBaseEur ?? ''}
            onChange={(e) => updateNumeric('iscrizioneBaseEur', e.target.value)}
            inputProps={{ min: 0, step: 'any' }}
            sx={{ flex: 1, minWidth: 160 }}
          />
          <TextField
            size="small"
            type="number"
            label="€ per settimana selezionata"
            disabled={disabled}
            value={rp.euroPerSettimanaSelezionata ?? ''}
            onChange={(e) => updateNumeric('euroPerSettimanaSelezionata', e.target.value)}
            inputProps={{ min: 0, step: 'any' }}
            sx={{ flex: 1, minWidth: 160 }}
          />
          <TextField
            size="small"
            type="number"
            label="Tesseramento Noi nuovo (€)"
            disabled={disabled}
            value={rp.tesseramentoNoiNuovoEur ?? ''}
            onChange={(e) => updateNumeric('tesseramentoNoiNuovoEur', e.target.value)}
            inputProps={{ min: 0, step: 'any' }}
            sx={{ flex: 1, minWidth: 160 }}
          />
          <TextField
            size="small"
            type="number"
            label="Sconto famiglia numerosa (€)"
            disabled={disabled}
            value={rp.scontoFamigliaNumerosaEur ?? ''}
            onChange={(e) => updateNumeric('scontoFamigliaNumerosaEur', e.target.value)}
            inputProps={{ min: 0, step: 'any' }}
            sx={{ flex: 1, minWidth: 160 }}
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            size="small"
            label="ID campo tesseramento"
            disabled={disabled}
            value={rp.tesseramentoFieldId ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim();
              patchRp({ tesseramentoFieldId: v ? v : undefined });
            }}
            placeholder="tesseramento_noi"
            helperText="Default backend: tesseramento_noi"
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="Valore che attiva il costo tesseramento"
            disabled={disabled}
            value={rp.tesseramentoWhenValue ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim();
              patchRp({ tesseramentoWhenValue: v ? v : undefined });
            }}
            placeholder="richiesta_6euro"
            helperText="Default backend: richiesta_6euro"
            sx={{ flex: 1 }}
          />
        </Stack>

        <Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Prezzi gite (value opzione → €)
          </Typography>
          {suggestions.length > 0 && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Suggeriti dai campi uscite ({GITE_FIELD_IDS.join(', ')}):
            </Typography>
          )}
          {suggestions.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
              {suggestions
                .filter((v) => !usedKeys.has(v))
                .map((v) => (
                  <Chip
                    key={v}
                    size="small"
                    label={v}
                    clickable
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setGiteMap({ ...giteMap, [v]: giteMap[v] ?? 0 });
                    }}
                  />
                ))}
            </Stack>
          )}

          {Object.entries(giteMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => (
              <Stack
                key={key}
                direction="row"
                spacing={1}
                alignItems="flex-start"
                sx={{ mb: 1 }}
              >
                <TextField
                  size="small"
                  label="Value opzione"
                  disabled={disabled}
                  value={key}
                  onChange={(e) => {
                    const nk = e.target.value.trim();
                    const next = { ...giteMap };
                    delete next[key];
                    if (nk) next[nk] = val;
                    setGiteMap(next);
                  }}
                  sx={{ flex: 2, minWidth: 120 }}
                />
                <TextField
                  size="small"
                  type="number"
                  label="€"
                  disabled={disabled}
                  value={val}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setGiteMap({ ...giteMap, [key]: n });
                  }}
                  inputProps={{ min: 0, step: 'any' }}
                  sx={{ width: 100 }}
                />
                <IconButton
                  aria-label="Rimuovi"
                  disabled={disabled}
                  onClick={() => {
                    const next = { ...giteMap };
                    delete next[key];
                    setGiteMap(next);
                  }}
                  size="small"
                  sx={{ mt: 0.5 }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
            <Button
              size="small"
              variant="outlined"
              disabled={disabled}
              onClick={() => {
                const base = `voce_${Object.keys(giteMap).length + 1}`;
                let k = base;
                let i = 0;
                while (giteMap[k] !== undefined) {
                  i += 1;
                  k = `${base}_${i}`;
                }
                setGiteMap({ ...giteMap, [k]: 0 });
              }}
            >
              Aggiungi riga (value manuale)
            </Button>
            {suggestions.length > 0 && (
              <Button
                size="small"
                disabled={disabled}
                onClick={() => {
                  const next = { ...giteMap };
                  for (const v of suggestions) {
                    if (next[v] === undefined) next[v] = 0;
                  }
                  setGiteMap(next);
                }}
              >
                Importa tutti i value suggeriti (€ 0)
              </Button>
            )}
            <Button
              size="small"
              color="warning"
              disabled={disabled}
              onClick={() => patchRp({ prezziGiteByOptionValue: undefined })}
            >
              Azzera solo prezzi gite
            </Button>
          </Stack>
        </Box>

        <Button
          size="small"
          disabled={disabled}
          onClick={() => onPatchEmail({ riepilogoPricing: undefined })}
        >
          Rimuovi tutte le tariffe personalizzate
        </Button>
      </Stack>
    </Box>
  );
}
