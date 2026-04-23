'use client';

import type {
  Module,
  Step,
  Field,
  Condition,
  ConditionOp,
  FieldType,
  StepRepeatConfig,
  NoticeVariant,
} from '@grest/shared';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { VALIDATION_TYPES } from '@/lib/validation-types';
import { FIELD_TYPES, formatFieldTypeLabel } from '@/lib/field-types';
import { normalizeFieldForType, typeUsesPlaceholder, typeUsesValidation } from '@/lib/field-normalize';

const CONDITION_OPS: { value: ConditionOp; label: string }[] = [
  { value: 'eq', label: 'Uguale' },
  { value: 'neq', label: 'Diverso' },
  { value: 'in', label: 'In (lista)' },
  { value: 'notIn', label: 'Non in (lista)' },
  { value: 'contains', label: 'Contiene (checkbox-group)' },
  { value: 'notContains', label: 'Non contiene (checkbox-group)' },
  { value: 'intersects', label: 'Interseca (checkbox-group)' },
  { value: 'notIntersects', label: 'Non interseca (checkbox-group)' },
  { value: 'empty', label: 'Vuoto' },
  { value: 'notEmpty', label: 'Non vuoto' },
];

const SELECT_NONE = '__none__';

const NOTICE_VARIANTS: { value: NoticeVariant; label: string }[] = [
  { value: 'info', label: 'Informativo (blu)' },
  { value: 'warning', label: 'Attenzione (giallo)' },
  { value: 'error', label: 'Importante (rosso)' },
];

/** Campi negli step precedenti a `beforeStepIndex` (per ripetizione e condizioni). */
function fieldsBeforeStep(module: Module, beforeStepIndex: number): Field[] {
  const out: Field[] = [];
  for (let i = 0; i < beforeStepIndex; i++) {
    out.push(...module.steps[i].fields);
  }
  return out;
}

function fieldsByIdFromModule(module: Module): Map<string, Field> {
  const map = new Map<string, Field>();
  for (const s of module.steps) {
    for (const f of s.fields) {
      map.set(f.id, f);
    }
  }
  return map;
}

function coerceConditionValue(
  ref: Field | undefined,
  op: ConditionOp,
  previous: unknown
): unknown {
  if (op === 'empty' || op === 'notEmpty') return undefined;
  if (
    op === 'in' ||
    op === 'notIn' ||
    op === 'contains' ||
    op === 'notContains' ||
    op === 'intersects' ||
    op === 'notIntersects'
  ) {
    if (Array.isArray(previous)) return previous;
    if (typeof previous === 'string' && previous.trim()) {
      return previous
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }
  if (!ref) return previous ?? '';
  if (ref.type === 'switch' || ref.type === 'checkbox') {
    if (previous === true || previous === false) return previous;
    return false;
  }
  if (ref.type === 'number') {
    if (typeof previous === 'number' && Number.isFinite(previous)) return previous;
    const n = Number(previous);
    return Number.isFinite(n) ? n : 0;
  }
  if (ref.type === 'select' || ref.type === 'radio') {
    const opts = ref.options ?? [];
    if (typeof previous === 'string' && opts.some((o) => o.value === previous)) return previous;
    return opts[0]?.value ?? '';
  }
  if (previous == null) return '';
  return String(previous);
}

function ensureOptions(field: Field): NonNullable<Field['options']> {
  return field.options ?? [];
}

interface PropertyPanelProps {
  module: Module;
  selectedStepIndex: number | null;
  selectedField: { stepIndex: number; fieldIndex: number } | null;
  onUpdateStep: (index: number, updater: (s: Step) => Step) => void;
  onUpdateField: (stepIndex: number, fieldIndex: number, updater: (f: Field) => Field) => void;
}

export function PropertyPanel({
  module,
  selectedStepIndex,
  selectedField,
  onUpdateStep,
  onUpdateField,
}: PropertyPanelProps) {
  const allFieldIds = module.steps.flatMap((s) => s.fields.map((f) => f.id));
  const fieldsById = fieldsByIdFromModule(module);

  if (selectedField !== null) {
    const step = module.steps[selectedField.stepIndex];
    const field = step?.fields[selectedField.fieldIndex];
    if (!field) return null;

    const update = (updater: (f: Field) => Field) =>
      onUpdateField(selectedField.stepIndex, selectedField.fieldIndex, updater);
    const updateOptionAt = (
      idx: number,
      updater: (opt: NonNullable<Field['options']>[number]) => NonNullable<Field['options']>[number]
    ) =>
      update((f) => ({
        ...f,
        options: ensureOptions(f).map((o, i) => (i === idx ? updater(o) : o)),
      }));

    const updateCondition = (
      key: 'showIf' | 'requiredIf',
      cond: Condition | undefined
    ) => {
      update((f) => ({ ...f, [key]: cond }));
    };

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Campo: {field.id}
        </Typography>
        <TextField
          fullWidth
          size="small"
          label="ID campo"
          value={field.id}
          onChange={(e) => update((f) => ({ ...f, id: e.target.value }))}
          margin="dense"
        />
        <FormControl fullWidth size="small" margin="dense">
          <InputLabel>Tipo campo</InputLabel>
          <Select
            value={field.type}
            label="Tipo campo"
            onChange={(e) => {
              const newType = e.target.value as FieldType;
              update((f) => normalizeFieldForType({ ...f, type: newType }, newType));
            }}
          >
            {FIELD_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {formatFieldTypeLabel(t)} ({t})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: -0.5, mb: 0.5 }}>
          {field.type === 'notice' ? (
            <>
              Testo mostrato nel modulo senza input. Colori come gli avvisi: blu / giallo / rosso.
            </>
          ) : (
            <>
              Per un menu a tendina usa <strong>select</strong> (dropdown); per una sola scelta tra opzioni
              visibili usa <strong>radio</strong>.
            </>
          )}
        </Typography>
        {field.type === 'notice' ? (
          <>
            <TextField
              fullWidth
              size="small"
              label="Testo avviso (it)"
              value={field.noticeText?.it ?? ''}
              onChange={(e) =>
                update((f) => ({
                  ...f,
                  noticeText: { it: e.target.value },
                  label: { it: (e.target.value || f.label?.it || 'Avviso').slice(0, 80) },
                }))
              }
              margin="dense"
              multiline
              minRows={3}
            />
            <FormControl fullWidth size="small" margin="dense">
              <InputLabel>Stile</InputLabel>
              <Select
                value={field.noticeVariant ?? 'info'}
                label="Stile"
                onChange={(e) =>
                  update((f) => ({
                    ...f,
                    noticeVariant: e.target.value as NoticeVariant,
                  }))
                }
              >
                {NOTICE_VARIANTS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        ) : (
          <TextField
            fullWidth
            size="small"
            label="Label (it)"
            value={field.label?.it ?? ''}
            onChange={(e) => update((f) => ({ ...f, label: { it: e.target.value } }))}
            margin="dense"
          />
        )}
        {typeUsesPlaceholder(field.type) && (
          <TextField
            fullWidth
            size="small"
            label="Placeholder (it)"
            value={field.placeholder?.it ?? ''}
            onChange={(e) =>
              update((f) => ({
                ...f,
                placeholder: e.target.value ? { it: e.target.value } : undefined,
              }))
            }
            margin="dense"
          />
        )}
        {field.type !== 'notice' && (
          <FormControlLabel
            control={
              <Checkbox
                checked={field.required}
                onChange={(e) => update((f) => ({ ...f, required: e.target.checked }))}
              />
            }
            label="Obbligatorio"
          />
        )}
        {typeUsesValidation(field.type) && (
          <FormControl fullWidth size="small" margin="dense">
            <InputLabel>Validazione</InputLabel>
            <Select
              value={field.validation ?? 'generic'}
              label="Validazione"
              onChange={(e) =>
                update((f) => ({
                  ...f,
                  validation: e.target.value === 'generic' ? undefined : e.target.value,
                }))
              }
            >
              {VALIDATION_TYPES.map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {field.type === 'number' && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <TextField
              size="small"
              type="number"
              label="Min (opzionale)"
              value={field.min ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                update((f) => ({
                  ...f,
                  min: raw === '' ? undefined : Number(raw),
                }));
              }}
              sx={{ flex: 1, minWidth: 120 }}
            />
            <TextField
              size="small"
              type="number"
              label="Max (opzionale)"
              value={field.max ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                update((f) => ({
                  ...f,
                  max: raw === '' ? undefined : Number(raw),
                }));
              }}
              sx={{ flex: 1, minWidth: 120 }}
            />
          </Box>
        )}

        <Typography variant="subtitle2" sx={{ mt: 2 }}>
          showIf
        </Typography>
        <ConditionForm
          value={field.showIf}
          selfFieldId={field.id}
          fieldIds={allFieldIds.filter((id) => id !== field.id)}
          fieldsById={fieldsById}
          onChange={(cond) => updateCondition('showIf', cond)}
        />

        {field.type !== 'notice' && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              requiredIf
            </Typography>
            <ConditionForm
              value={field.requiredIf}
              selfFieldId={field.id}
              fieldIds={allFieldIds.filter((id) => id !== field.id)}
              fieldsById={fieldsById}
              onChange={(cond) => updateCondition('requiredIf', cond)}
            />
          </>
        )}

        {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox-group') && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              Opzioni
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Inserisci valore e label separatamente, senza pipe.
              {field.type === 'select'
                ? ' Per il tipo «elenco a discesa», le opzioni compaiono nel menu dropdown in compilazione.'
                : ''}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {ensureOptions(field).map((opt, idx) => (
                <Box key={`opt-${idx}`} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      label="Valore"
                      value={opt.value}
                      onChange={(e) => updateOptionAt(idx, (o) => ({ ...o, value: e.target.value }))}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      label="Label (it)"
                      value={opt.label?.it ?? ''}
                      onChange={(e) =>
                        updateOptionAt(idx, (o) => ({ ...o, label: { it: e.target.value } }))
                      }
                      sx={{ flex: 1.2 }}
                    />
                    <Button
                      color="error"
                      onClick={() =>
                        update((f) => ({
                          ...f,
                          options: ensureOptions(f).filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      Rimuovi
                    </Button>
                  </Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={opt.enabled !== false}
                        onChange={(e) =>
                          updateOptionAt(idx, (o) => ({ ...o, enabled: e.target.checked }))
                        }
                      />
                    }
                    label="Opzione attiva"
                  />
                  {(field.type === 'radio' || field.type === 'checkbox-group') && (
                    <Box
                      sx={{
                        pl: 1,
                        pr: 1,
                        pb: 1,
                        borderLeft: '2px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        Abilitazione opzione ({field.type}) con enabledIf
                      </Typography>
                      <ConditionForm
                        value={opt.enabledIf}
                        selfFieldId={field.id}
                        fieldIds={allFieldIds.filter((id) => id !== field.id)}
                        fieldsById={fieldsById}
                        onChange={(cond) =>
                          updateOptionAt(idx, (o) => ({ ...o, enabledIf: cond }))
                        }
                      />
                    </Box>
                  )}
                </Box>
              ))}
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  update((f) => ({
                    ...f,
                    options: [
                      ...ensureOptions(f),
                      { value: '', label: { it: '' }, enabled: true },
                    ],
                  }))
                }
              >
                + Aggiungi opzione
              </Button>
            </Box>
            {field.type === 'select' && (
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!field.selectOther?.enabled}
                      onChange={(e) =>
                        update((f) => {
                          if (!e.target.checked) {
                            const { selectOther: _x, ...rest } = f;
                            return rest;
                          }
                          return {
                            ...f,
                            selectOther: {
                              enabled: true,
                              value: '__other__',
                              label: { it: 'Altro' },
                            },
                          };
                        })
                      }
                    />
                  }
                  label="Opzione «Altro» con testo libero"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  In compilazione compare un’ulteriore voce nel menu e, se scelta, un campo per specificare
                  il testo. Il valore inviato nel select e la chiave del testo sono documentati nel prompt
                  backend.
                </Typography>
                {field.selectOther?.enabled && (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      pl: 1,
                      borderLeft: '2px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <TextField
                      size="small"
                      label="Valore sintetico (select)"
                      value={field.selectOther.value ?? '__other__'}
                      onChange={(e) =>
                        update((f) => ({
                          ...f,
                          selectOther: {
                            ...f.selectOther!,
                            value: e.target.value,
                          },
                        }))
                      }
                      helperText="Deve essere diverso da tutti i «Valore» delle opzioni sopra (default consigliato: __other__)."
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="Label menu «Altro» (it)"
                      value={field.selectOther.label?.it ?? ''}
                      onChange={(e) =>
                        update((f) => ({
                          ...f,
                          selectOther: {
                            ...f.selectOther!,
                            label: { it: e.target.value },
                          },
                        }))
                      }
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="Placeholder campo testo (it, opzionale)"
                      value={field.selectOther.placeholder?.it ?? ''}
                      onChange={(e) =>
                        update((f) => ({
                          ...f,
                          selectOther: {
                            ...f.selectOther!,
                            placeholder: e.target.value
                              ? { it: e.target.value }
                              : undefined,
                          },
                        }))
                      }
                      fullWidth
                    />
                  </Box>
                )}
              </Box>
            )}
          </>
        )}
      </Box>
    );
  }

  if (selectedStepIndex !== null) {
    const step = module.steps[selectedStepIndex];
    if (!step) return null;

    const previousFields = fieldsBeforeStep(module, selectedStepIndex);
    /** Campi degli step precedenti (tipicamente un `number` per «quanti figli»). */
    const repeatCandidates = previousFields;

    const setRepeat = (cfg: StepRepeatConfig | undefined) => {
      onUpdateStep(selectedStepIndex, (s) => {
        if (cfg === undefined) {
          const { repeatFromField: _r, ...rest } = s;
          return rest;
        }
        return { ...s, repeatFromField: cfg };
      });
    };

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Step: {step.id}
        </Typography>
        <TextField
          fullWidth
          size="small"
          label="ID step"
          value={step.id}
          onChange={(e) => onUpdateStep(selectedStepIndex, (s) => ({ ...s, id: e.target.value }))}
          margin="dense"
        />
        <TextField
          fullWidth
          size="small"
          label="Titolo (it)"
          value={step.title?.it ?? ''}
          onChange={(e) =>
            onUpdateStep(selectedStepIndex, (s) => ({ ...s, title: { it: e.target.value } }))
          }
          margin="dense"
        />

        <Typography variant="subtitle2" sx={{ mt: 2 }}>
          Ripetizione step
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Utile es. per dati di ogni figlio: uno step può essere ripetuto N volte in base al valore di
          un campo <strong>numero</strong> in uno step precedente. In compilazione e in salvataggio
          i campi useranno suffissi <code>_0</code>, <code>_1</code>, … (vedi app public/backend).
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(step.repeatFromField)}
              disabled={selectedStepIndex === 0 || repeatCandidates.length === 0}
              onChange={(e) => {
                if (e.target.checked) {
                  const first = repeatCandidates[0];
                  setRepeat({
                    countFieldId: first?.id ?? '',
                  });
                } else {
                  setRepeat(undefined);
                }
              }}
            />
          }
          label="Ripeti questo step N volte (N = valore del campo scelto)"
        />
        {selectedStepIndex === 0 && (
          <Typography variant="caption" color="text.secondary" display="block">
            Serve almeno uno step prima di questo, con un campo che indichi quante volte ripetere (es.
            numero figli).
          </Typography>
        )}
        {selectedStepIndex > 0 && repeatCandidates.length === 0 && (
          <Typography variant="caption" color="warning.main" display="block">
            Nessun campo negli step precedenti.
          </Typography>
        )}
        {step.repeatFromField && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
            <FormControl fullWidth size="small" margin="dense">
              <InputLabel>Campo che definisce N</InputLabel>
              <Select
                label="Campo che definisce N"
                value={step.repeatFromField.countFieldId || SELECT_NONE}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === SELECT_NONE) {
                    setRepeat(undefined);
                    return;
                  }
                  setRepeat({
                    ...step.repeatFromField!,
                    countFieldId: v,
                  });
                }}
              >
                {repeatCandidates.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.id} [{f.type}] — {f.label?.it ?? ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="number"
              label="N minimo (opzionale)"
              value={step.repeatFromField.minCount ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                setRepeat({
                  ...step.repeatFromField!,
                  minCount:
                    raw === '' ? undefined : Math.max(0, Math.floor(Number(raw)) || 0),
                });
              }}
              inputProps={{ min: 0 }}
            />
            <TextField
              size="small"
              type="number"
              label="N massimo (opzionale)"
              value={step.repeatFromField.maxCount ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                setRepeat({
                  ...step.repeatFromField!,
                  maxCount:
                    raw === '' ? undefined : Math.max(0, Math.floor(Number(raw)) || 0),
                });
              }}
              inputProps={{ min: 0 }}
            />
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Modifica titolo, GUID, ringraziamento e versione nella sezione{' '}
        <strong>Opzioni modulo</strong> sopra l’elenco degli step.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Clicca uno <strong>step</strong> (intestazione) per ID e titolo dello step, oppure un{' '}
        <strong>campo</strong> per le sue proprietà.
      </Typography>
    </Box>
  );
}

function ConditionForm({
  value,
  selfFieldId,
  fieldIds,
  fieldsById,
  onChange,
}: {
  value: Condition | undefined;
  selfFieldId: string;
  fieldIds: string[];
  fieldsById: Map<string, Field>;
  onChange: (c: Condition | undefined) => void;
}) {
  if (fieldIds.length === 0) {
    return <Typography variant="caption">Aggiungi altri campi nello stesso modulo per le condizioni.</Typography>;
  }

  const fieldKey = value?.field ?? '';
  const refField = fieldKey ? fieldsById.get(fieldKey) : undefined;
  const op = value?.op ?? 'eq';
  const needValue = op !== 'empty' && op !== 'notEmpty';

  const setCondition = (next: Condition | undefined) => {
    onChange(next);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <FormControl size="small" fullWidth>
        <InputLabel>Campo riferimento</InputLabel>
        <Select
          value={fieldKey || SELECT_NONE}
          label="Campo riferimento"
          onChange={(e) => {
            const v = e.target.value;
            if (v === SELECT_NONE) {
              setCondition(undefined);
              return;
            }
            const ref = fieldsById.get(v);
            const nextOp = (value?.op ?? 'eq') as ConditionOp;
            const nextVal = coerceConditionValue(ref, nextOp, undefined);
            setCondition({
              field: v,
              op: nextOp,
              ...(nextOp === 'empty' || nextOp === 'notEmpty' ? {} : { value: nextVal }),
            });
          }}
        >
          <MenuItem value={SELECT_NONE}>— Nessuna condizione —</MenuItem>
          {fieldIds.map((id) => (
            <MenuItem key={id} value={id}>
              {id}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {fieldKey ? (
        <>
          <FormControl size="small" fullWidth>
            <InputLabel>Operatore</InputLabel>
            <Select
              value={op}
              label="Operatore"
              onChange={(e) => {
                const newOp = e.target.value as ConditionOp;
                const nextVal =
                  newOp === 'empty' || newOp === 'notEmpty'
                    ? undefined
                    : coerceConditionValue(refField, newOp, value?.value);
                setCondition({
                  field: fieldKey,
                  op: newOp,
                  ...(newOp === 'empty' || newOp === 'notEmpty' ? {} : { value: nextVal }),
                });
              }}
            >
              {CONDITION_OPS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {needValue &&
            (refField ? (
              <ConditionValueInput
                refField={refField}
                op={op}
                value={value?.value}
                onChange={(v) =>
                  setCondition({
                    field: fieldKey,
                    op,
                    value: v,
                  })
                }
              />
            ) : (
              <TextField
                size="small"
                fullWidth
                label="Valore"
                helperText="Campo riferimento non trovato nello schema: correggi o reimposta la condizione."
                value={value?.value == null ? '' : String(value.value)}
                onChange={(e) =>
                  setCondition({
                    field: fieldKey,
                    op,
                    value: e.target.value,
                  })
                }
              />
            ))}
        </>
      ) : null}
    </Box>
  );
}

function ConditionValueInput({
  refField,
  op,
  value,
  onChange,
}: {
  refField: Field;
  op: ConditionOp;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (
    op === 'in' ||
    op === 'notIn' ||
    op === 'contains' ||
    op === 'notContains' ||
    op === 'intersects' ||
    op === 'notIntersects'
  ) {
    const lines = Array.isArray(value)
      ? value.map((v) => String(v)).join('\n')
      : typeof value === 'string'
        ? value
        : '';
    const hint =
      op === 'in' || op === 'notIn'
        ? 'Un valore per riga (confronto con il valore singolo del campo: select, radio, …).'
        : 'Un valore per riga (per checkbox-group: sottoinsiemi / intersezione con la selezione).';
    return (
      <>
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={2}
          value={lines}
          onChange={(e) => {
            // Non normalizzare "aggressivamente" mentre l'utente digita:
            // preserva spazi/righe vuote e applica solo split per mantenere UX fluida.
            const arr = e.target.value.split('\n');
            onChange(arr);
          }}
        />
      </>
    );
  }

  if (refField.type === 'switch' || refField.type === 'checkbox') {
    const b = value === true || value === false ? value : false;
    return (
      <FormControl size="small" fullWidth>
        <InputLabel>Valore</InputLabel>
        <Select
          value={b ? 'true' : 'false'}
          label="Valore"
          onChange={(e) => onChange(e.target.value === 'true')}
        >
          <MenuItem value="true">Sì (true)</MenuItem>
          <MenuItem value="false">No (false)</MenuItem>
        </Select>
      </FormControl>
    );
  }

  if (refField.type === 'number') {
    const n = typeof value === 'number' ? value : Number(value);
    return (
      <TextField
        size="small"
        fullWidth
        type="number"
        label="Valore"
        value={Number.isFinite(n) ? n : ''}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === '' ? 0 : Number(raw));
        }}
      />
    );
  }

  if (
    refField.type === 'select' ||
    refField.type === 'radio' ||
    refField.type === 'checkbox-group'
  ) {
    const opts = refField.options ?? [];
    return (
      <FormControl size="small" fullWidth>
        <InputLabel>Valore opzione</InputLabel>
        <Select
          value={typeof value === 'string' ? value : opts[0]?.value ?? ''}
          label="Valore opzione"
          onChange={(e) => onChange(e.target.value)}
        >
          {opts.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.value} — {o.label?.it ?? ''}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  const str = value == null ? '' : String(value);
  return (
    <TextField
      size="small"
      fullWidth
      label="Valore"
      value={str}
      onChange={(e) => onChange(e.target.value)}
      type={refField.type === 'date' ? 'text' : 'text'}
      helperText={
        refField.type === 'date'
          ? 'Usa lo stesso formato che inserirà l’utente (es. YYYY-MM-DD).'
          : undefined
      }
    />
  );
}
