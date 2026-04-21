'use client';

import type { EmailOnSubmit, Module, ThankYou } from '@grest/shared';
import { EnrollmentCapacitySection } from '@/components/form-builder/EnrollmentCapacitySection';
import { TripCapacitySection } from '@/components/form-builder/TripCapacitySection';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import { randomUuid } from '@/lib/uuid';
import { getPublicFormSlug, getPublicFormUrl } from '@/lib/public-form-url';
import {
  isValidTemplateFileName,
  validateStaticAttachmentFilesList,
} from '@/lib/validate-email-on-submit';
import { EmailRiepilogoPricingSection } from '@/components/form-builder/EmailRiepilogoPricingSection';

/** Allineato a `MARKER` in `backend/services/grest_riepilogo.py`. */
const BODY_RIEPILOGO_MARKER = '{{ riepilogo }}';

function emptyThankYou(): ThankYou {
  return {
    title: { it: '' },
    body: { it: '' },
    notes: { it: '' },
  };
}

const DEFAULT_EMAIL_ON_SUBMIT: EmailOnSubmit = {
  enabled: false,
  templateFile: '',
  subject: 'Nuova compilazione — {{ _module_title }}',
  body: 'In allegato il modulo compilato in PDF.',
  to: [],
  attachDocxToo: false,
};

function ensureEmailOnSubmit(m: Module): EmailOnSubmit {
  const rp = m.emailOnSubmit?.riepilogoPricing;
  return {
    ...DEFAULT_EMAIL_ON_SUBMIT,
    ...m.emailOnSubmit,
    to: m.emailOnSubmit?.to ? [...m.emailOnSubmit.to] : DEFAULT_EMAIL_ON_SUBMIT.to,
    toFieldId: m.emailOnSubmit?.toFieldId,
    riepilogoPricing: rp
      ? {
          ...rp,
          prezziGiteByOptionValue: rp.prezziGiteByOptionValue
            ? { ...rp.prezziGiteByOptionValue }
            : undefined,
        }
      : undefined,
    staticAttachmentFiles: m.emailOnSubmit?.staticAttachmentFiles?.length
      ? [...m.emailOnSubmit.staticAttachmentFiles]
      : undefined,
  };
}

function emailFieldsFromModule(module: Module): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const s of module.steps) {
    for (const f of s.fields) {
      if (f.type === 'email') {
        out.push({ id: f.id, label: f.label?.it ?? f.id });
      }
    }
  }
  return out;
}

function patchEmailOnSubmit(m: Module, patch: Partial<EmailOnSubmit>): Module {
  return { ...m, emailOnSubmit: { ...ensureEmailOnSubmit(m), ...patch } };
}

function parseToLines(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Un nome file per riga (allegati statici email). */
function parseStaticAttachmentLines(value: string): string[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface ModuleOptionsFormProps {
  module: Module;
  onUpdateModule: (updater: (m: Module) => Module) => void;
  onUpdateMeta: (updater: (m: Module['meta']) => Module['meta']) => void;
}

export function ModuleOptionsForm({
  module,
  onUpdateModule,
  onUpdateMeta,
}: ModuleOptionsFormProps) {
  const publicUrl = getPublicFormUrl(module);
  const publicSlug = getPublicFormSlug(module);
  const email = ensureEmailOnSubmit(module);
  const showRiepilogoPricing =
    email.enabled && email.body.includes(BODY_RIEPILOGO_MARKER);
  const templateFieldError =
    email.enabled &&
    email.templateFile.trim() !== '' &&
    !isValidTemplateFileName(email.templateFile)
      ? 'Usa solo il nome file .docx, senza cartelle (es. iscrizione.docx).'
      : email.enabled && email.templateFile.trim() === ''
        ? 'Obbligatorio se l’invio email è attivo.'
        : '';

  const staticAttachmentError = email.enabled
    ? validateStaticAttachmentFilesList(email.staticAttachmentFiles)
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pt: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        ID tecnico (DB): usato nell’URL di modifica admin e per il submit.
      </Typography>
      <TextField
        fullWidth
        size="small"
        label="ID modulo (tecnico)"
        value={module.id}
        margin="dense"
        InputProps={{ readOnly: true }}
        helperText="Non modificabile da qui dopo il salvataggio (legato all’URL)."
      />
      <TextField
        fullWidth
        size="small"
        label="GUID pubblico (link compilazione)"
        value={module.guid ?? ''}
        onChange={(e) =>
          onUpdateModule((m) => ({
            ...m,
            guid: e.target.value.trim() || undefined,
          }))
        }
        margin="dense"
        helperText="Segmento opaco nell’URL pubblico /form/… Se vuoto, il backend può usare l’ID tecnico."
      />
      <Button
        size="small"
        variant="outlined"
        sx={{ alignSelf: 'flex-start', mb: 1 }}
        onClick={() =>
          onUpdateModule((m) => ({
            ...m,
            guid: randomUuid(),
          }))
        }
      >
        Genera nuovo GUID
      </Button>
      {publicUrl ? (
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Link pubblico
          </Typography>
          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
            {publicUrl}
          </Typography>
          <Button
            size="small"
            sx={{ mt: 0.5 }}
            onClick={() => navigator.clipboard.writeText(publicUrl)}
          >
            Copia link
          </Button>
        </Box>
      ) : (
        <Alert severity="info" sx={{ mb: 1 }}>
          Imposta <code>NEXT_PUBLIC_PUBLIC_SITE_URL</code> in <code>.env.local</code> per vedere e
          copiare il link (slug: <code>{publicSlug}</code>).
        </Alert>
      )}
      <TextField
        fullWidth
        size="small"
        type="number"
        label="Versione schema"
        value={module.version}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onUpdateModule((m) => ({ ...m, version: Math.max(1, Math.floor(n)) }));
        }}
        margin="dense"
        inputProps={{ min: 1 }}
      />
      <Typography variant="subtitle2" sx={{ mt: 1 }}>
        Contenuti (meta)
      </Typography>
      <TextField
        fullWidth
        size="small"
        label="Titolo modulo (it)"
        value={module.meta?.title?.it ?? ''}
        onChange={(e) =>
          onUpdateMeta((m) => ({ ...m, title: { ...m.title, it: e.target.value } }))
        }
        margin="dense"
      />
      <TextField
        fullWidth
        size="small"
        label="Descrizione (it)"
        value={module.meta?.description?.it ?? ''}
        onChange={(e) =>
          onUpdateMeta((m) => ({ ...m, description: { ...m.description, it: e.target.value } }))
        }
        margin="dense"
      />
      <Typography variant="subtitle2" sx={{ mt: 1 }}>
        Pagina di ringraziamento
      </Typography>
      <TextField
        fullWidth
        size="small"
        label="Titolo ringraziamento (it)"
        value={module.meta?.thankYou?.title?.it ?? ''}
        onChange={(e) =>
          onUpdateMeta((m) => {
            const ty = m.thankYou ?? emptyThankYou();
            return {
              ...m,
              thankYou: { ...ty, title: { ...ty.title, it: e.target.value } },
            };
          })
        }
        margin="dense"
      />
      <TextField
        fullWidth
        size="small"
        label="Testo principale (it)"
        value={module.meta?.thankYou?.body?.it ?? ''}
        onChange={(e) =>
          onUpdateMeta((m) => {
            const ty = m.thankYou ?? emptyThankYou();
            return {
              ...m,
              thankYou: { ...ty, body: { ...ty.body, it: e.target.value } },
            };
          })
        }
        margin="dense"
        multiline
        minRows={2}
      />
      <TextField
        fullWidth
        size="small"
        label="Note aggiuntive (it)"
        value={module.meta?.thankYou?.notes?.it ?? ''}
        onChange={(e) =>
          onUpdateMeta((m) => {
            const ty = m.thankYou ?? emptyThankYou();
            return {
              ...m,
              thankYou: { ...ty, notes: { ...ty.notes, it: e.target.value } },
            };
          })
        }
        margin="dense"
        multiline
        minRows={2}
      />

      <EnrollmentCapacitySection module={module} onUpdateModule={onUpdateModule} />
      <TripCapacitySection module={module} onUpdateModule={onUpdateModule} />

      <Typography variant="subtitle2" sx={{ mt: 2 }}>
        Email dopo invio (PDF / DOCX)
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
        Dopo ogni invio il backend può generare un documento da un template Word in{' '}
        <code>email_templates/</code> sul server e inviare una mail (SMTP nel <code>.env</code> del
        backend). Vedi <code>docs/email-submission-templates.md</code>.
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={email.enabled}
            onChange={(e) =>
              onUpdateModule((m) => patchEmailOnSubmit(m, { enabled: e.target.checked }))
            }
          />
        }
        label="Invia email dopo ogni compilazione"
      />
      <TextField
        fullWidth
        size="small"
        label="Nome file template (.docx)"
        value={email.templateFile}
        onChange={(e) =>
          onUpdateModule((m) => patchEmailOnSubmit(m, { templateFile: e.target.value }))
        }
        margin="dense"
        placeholder="es. iscrizione.docx"
        disabled={!email.enabled}
        error={Boolean(templateFieldError)}
        helperText={
          templateFieldError ||
          'Solo nome file, senza percorsi. Copia il .docx nella cartella email_templates sul server.'
        }
      />
      <TextField
        fullWidth
        size="small"
        label="Destinatari (opzionale)"
        value={(email.to ?? []).join('\n')}
        onChange={(e) =>
          onUpdateModule((m) => patchEmailOnSubmit(m, { to: parseToLines(e.target.value) }))
        }
        margin="dense"
        multiline
        minRows={2}
        disabled={!email.enabled}
        placeholder={'segreteria@esempio.it\nuno@esempio.it'}
        helperText="Un indirizzo per riga (o separati da virgola). Opzionale se usi il campo modulo sotto o SMTP_TO_DEFAULT."
      />
      <FormControl fullWidth size="small" margin="dense" disabled={!email.enabled}>
        <InputLabel id="email-to-field-label">Aggiungi destinatario da campo (email)</InputLabel>
        <Select
          labelId="email-to-field-label"
          label="Aggiungi destinatario da campo (email)"
          value={email.toFieldId ?? ''}
          onChange={(e) => {
            const v = String(e.target.value);
            onUpdateModule((m) =>
              patchEmailOnSubmit(m, { toFieldId: v.trim() ? v.trim() : undefined })
            );
          }}
        >
          <MenuItem value="">— Nessuno —</MenuItem>
          {emailFieldsFromModule(module).map((x) => (
            <MenuItem key={x.id} value={x.id}>
              {x.id} — {x.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        Il backend unisce questi indirizzi a «Destinatari» sopra (senza duplicati). Utile per usare
        l’email inserita nel modulo (es. campo <code>email</code>).
      </Typography>
      <TextField
        fullWidth
        size="small"
        label="Oggetto email"
        value={email.subject}
        onChange={(e) => onUpdateModule((m) => patchEmailOnSubmit(m, { subject: e.target.value }))}
        margin="dense"
        disabled={!email.enabled}
        placeholder='es. Nuova iscrizione — {{ _module_title }}'
        helperText="Segnaposto Jinja: {{ _module_title }}, {{ _submission_id }}, …"
      />
      <TextField
        fullWidth
        size="small"
        label="Corpo email (testo)"
        value={email.body}
        onChange={(e) => onUpdateModule((m) => patchEmailOnSubmit(m, { body: e.target.value }))}
        margin="dense"
        multiline
        minRows={3}
        disabled={!email.enabled}
        placeholder="In allegato il modulo compilato in PDF."
        helperText="Stessi segnaposto del template: {{ cognome }}, {{ answers['id-campo'] }}, …"
      />
      {showRiepilogoPricing && (
        <EmailRiepilogoPricingSection
          module={module}
          email={email}
          disabled={!email.enabled}
          onPatchEmail={(patch) => onUpdateModule((m) => patchEmailOnSubmit(m, patch))}
        />
      )}
      <FormControlLabel
        control={
          <Checkbox
            checked={email.attachDocxToo}
            disabled={!email.enabled}
            onChange={(e) =>
              onUpdateModule((m) => patchEmailOnSubmit(m, { attachDocxToo: e.target.checked }))
            }
          />
        }
        label="Allega anche il file .docx (oltre al PDF, se generato)"
      />
      <TextField
        fullWidth
        size="small"
        label="Allegati statici (opzionale)"
        value={(email.staticAttachmentFiles ?? []).join('\n')}
        onChange={(e) => {
          const lines = parseStaticAttachmentLines(e.target.value);
          onUpdateModule((m) =>
            patchEmailOnSubmit(m, {
              staticAttachmentFiles: lines.length ? lines : undefined,
            })
          );
        }}
        margin="dense"
        multiline
        minRows={3}
        disabled={!email.enabled}
        placeholder={'informativa.pdf\nmodulo-aggiuntivo.docx'}
        error={Boolean(staticAttachmentError)}
        helperText={
          staticAttachmentError ||
          'Un nome file per riga: file già presenti nella cartella email_templates sul server, non compilati dal modulo. Estensioni: .pdf, .docx, .doc, .png, .jpg, .jpeg, .gif, .txt — solo nome file, senza percorsi.'
        }
      />
    </Box>
  );
}
