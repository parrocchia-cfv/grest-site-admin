import type { Field, Module, RiepilogoPricing } from '@grest/shared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldById(module: Module, id: string): Field | undefined {
  for (const s of module.steps) {
    for (const f of s.fields) {
      if (f.id === id) return f;
    }
  }
  return undefined;
}

/** Nome file .docx senza path (allineato a `safe_template_filename` sul backend). */
export function isValidTemplateFileName(name: string): boolean {
  const t = name.trim();
  if (!t) return false;
  if (/[/\\]/.test(t) || t.includes('..')) return false;
  return /\.docx$/i.test(t);
}

/**
 * Allegati statici email: solo basename, estensioni come `backend/services/email_static_attachments.py`.
 */
const STATIC_ATTACHMENT_EXT_RE =
  /\.(pdf|docx|doc|png|jpe?g|gif|txt)$/i;

export function isValidStaticAttachmentFileName(name: string): boolean {
  const t = name.trim();
  if (!t) return false;
  if (/[/\\]/.test(t) || t.includes('..')) return false;
  if (t.startsWith('.')) return false;
  return STATIC_ATTACHMENT_EXT_RE.test(t);
}

/** Validazione lista allegati statici (UI + salvataggio). */
export function validateStaticAttachmentFilesList(
  files: string[] | undefined
): string | null {
  const list = files;
  if (!list?.length) return null;
  const seen = new Set<string>();
  for (const raw of list) {
    const a = String(raw).trim();
    if (!a) {
      return 'Allegati statici: rimuovi righe vuote o voci senza nome file.';
    }
    if (!isValidStaticAttachmentFileName(a)) {
      return `Allegato statico non valido: "${a}". Solo nome file senza percorsi; estensioni: .pdf, .docx, .doc, .png, .jpg, .jpeg, .gif, .txt (come sul server).`;
    }
    const lower = a.toLowerCase();
    if (seen.has(lower)) {
      return `Allegati statici: nome duplicato "${a}".`;
    }
    seen.add(lower);
  }
  return null;
}

function validateRiepilogoPricing(cfg: NonNullable<Module['emailOnSubmit']>): string | null {
  const rp = cfg.riepilogoPricing;
  if (!rp || typeof rp !== 'object') return null;

  const numKeys: (keyof RiepilogoPricing)[] = [
    'iscrizioneBaseEur',
    'euroPerSettimanaSelezionata',
    'tesseramentoNoiNuovoEur',
    'scontoFamigliaNumerosaEur',
  ];
  for (const k of numKeys) {
    const v = rp[k];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'number' || Number.isNaN(v) || v < 0) {
      return `«Riepilogo prezzi»: "${String(k)}" deve essere un numero ≥ 0.`;
    }
  }

  if (rp.tesseramentoFieldId !== undefined && rp.tesseramentoFieldId !== null) {
    if (typeof rp.tesseramentoFieldId !== 'string' || !rp.tesseramentoFieldId.trim()) {
      return '«Riepilogo prezzi»: tesseramentoFieldId non valido.';
    }
  }
  if (rp.tesseramentoWhenValue !== undefined && rp.tesseramentoWhenValue !== null) {
    if (typeof rp.tesseramentoWhenValue !== 'string' || !String(rp.tesseramentoWhenValue).trim()) {
      return '«Riepilogo prezzi»: tesseramentoWhenValue non valido.';
    }
  }

  const pg = rp.prezziGiteByOptionValue;
  if (pg !== undefined && pg !== null) {
    if (typeof pg !== 'object' || Array.isArray(pg)) {
      return '«Riepilogo prezzi»: prezziGiteByOptionValue deve essere un oggetto (value → prezzo).';
    }
    for (const [key, val] of Object.entries(pg)) {
      if (!key.trim()) {
        return '«Riepilogo prezzi»: chiavi prezzi gite non possono essere vuote.';
      }
      if (typeof val !== 'number' || Number.isNaN(val) || val < 0) {
        return `«Riepilogo prezzi»: prezzo non valido per la gita "${key}".`;
      }
    }
  }

  return null;
}

export function validateEmailOnSubmitForSave(module: Module): string | null {
  const cfg = module.emailOnSubmit;
  if (!cfg?.enabled) return null;
  const templateFile = cfg.templateFile?.trim() ?? '';
  if (!templateFile) {
    return 'Con «Email dopo invio» attiva, indica il nome del file template .docx.';
  }
  if (!isValidTemplateFileName(templateFile)) {
    return 'Il template deve essere solo il nome di un file .docx (es. iscrizione.docx), senza percorsi.';
  }
  const list = cfg.to ?? [];
  for (const raw of list) {
    const a = String(raw).trim();
    if (!a) continue;
    if (!EMAIL_RE.test(a)) {
      return `Indirizzo email non valido tra i destinatari: "${a}".`;
    }
  }
  const toFieldId = cfg.toFieldId?.trim();
  if (toFieldId) {
    const ref = fieldById(module, toFieldId);
    if (!ref) {
      return `Campo destinatario "${toFieldId}" non trovato nel modulo.`;
    }
    if (ref.type !== 'email') {
      return `Il campo "${toFieldId}" deve essere di tipo "email" per inviare la mail a quell’indirizzo.`;
    }
  }
  const staticErr = validateStaticAttachmentFilesList(cfg.staticAttachmentFiles);
  if (staticErr) return staticErr;
  return validateRiepilogoPricing(cfg);
}
