import type {
  Field,
  FieldOption,
  Meta,
  Module,
  Step,
  StepRepeatConfig,
  EmailOnSubmit,
  EnrollmentCapacity,
  TripCapacity,
  RiepilogoPricing,
} from '@grest/shared';
import { FIELD_TYPES } from '@/lib/field-types';

const FIELD_TYPE_SET = new Set<string>(FIELD_TYPES);

export type ParseModuleJsonResult =
  | { ok: true; module: Module }
  | { ok: false; error: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function parseI18n(raw: unknown, path: string): { it: string } {
  if (!isRecord(raw) || typeof raw.it !== 'string') {
    throw new Error(`${path}: oggetto i18n con chiave "it" (stringa) atteso`);
  }
  return { it: raw.it };
}

function parseThankYou(raw: unknown, path: string) {
  if (!isRecord(raw)) throw new Error(`${path}: oggetto atteso`);
  return {
    title: parseI18n(raw.title, `${path}.title`),
    body: parseI18n(raw.body, `${path}.body`),
    notes: parseI18n(raw.notes, `${path}.notes`),
  };
}

function parseMeta(raw: unknown): Meta {
  if (!isRecord(raw)) throw new Error('meta: oggetto atteso');
  return {
    title: parseI18n(raw.title, 'meta.title'),
    description: parseI18n(raw.description, 'meta.description'),
    thankYou: parseThankYou(raw.thankYou, 'meta.thankYou'),
  };
}

function parseFieldOption(raw: unknown, index: number, fieldId: string): FieldOption {
  if (!isRecord(raw)) throw new Error(`campo ${fieldId}: opzione ${index + 1} non valida`);
  if (typeof raw.value !== 'string') throw new Error(`campo ${fieldId}: opzione ${index + 1} senza "value"`);
  const out: FieldOption = {
    value: raw.value,
    label: parseI18n(raw.label, `campo ${fieldId}.options[${index}].label`),
  };
  if (raw.enabledIf !== undefined) {
    out.enabledIf = raw.enabledIf as Field['showIf'];
  }
  return out;
}

function parseField(raw: unknown, stepIndex: number, fieldIndex: number): Field {
  const path = `steps[${stepIndex}].fields[${fieldIndex}]`;
  if (!isRecord(raw)) throw new Error(`${path}: oggetto campo atteso`);
  if (typeof raw.id !== 'string' || !raw.id.trim()) throw new Error(`${path}: "id" stringa non vuota attesa`);
  if (typeof raw.type !== 'string' || !FIELD_TYPE_SET.has(raw.type)) {
    throw new Error(`${path}: tipo campo non valido: ${String(raw.type)}`);
  }
  const type = raw.type as Field['type'];
  const label = parseI18n(raw.label, `${path}.label`);
  const required = Boolean(raw.required);

  const field: Field = {
    id: raw.id.trim(),
    type,
    label,
    required,
  };

  if (raw.placeholder !== undefined) {
    if (!isRecord(raw.placeholder) || typeof raw.placeholder.it !== 'string') {
      throw new Error(`${path}.placeholder: oggetto { it: string } atteso`);
    }
    field.placeholder = { it: raw.placeholder.it };
  }
  if (raw.validation !== undefined) {
    if (typeof raw.validation !== 'string') throw new Error(`${path}.validation: stringa attesa`);
    field.validation = raw.validation;
  }
  if (raw.showIf !== undefined || raw.requiredIf !== undefined) {
    if (raw.showIf !== undefined) field.showIf = raw.showIf as Field['showIf'];
    if (raw.requiredIf !== undefined) field.requiredIf = raw.requiredIf as Field['requiredIf'];
  }
  if (['select', 'radio', 'checkbox-group'].includes(type)) {
    if (!Array.isArray(raw.options) || raw.options.length === 0) {
      throw new Error(
        `${path}: per il tipo "${type}" serve un array "options" non vuoto`
      );
    }
    field.options = raw.options.map((o, i) => parseFieldOption(o, i, raw.id as string));
  }

  if (type === 'select' && raw.selectOther !== undefined) {
    if (!isRecord(raw.selectOther)) {
      throw new Error(`${path}.selectOther: oggetto atteso`);
    }
    const so = raw.selectOther;
    if (typeof so.enabled !== 'boolean') {
      throw new Error(`${path}.selectOther.enabled: boolean atteso`);
    }
    const cfg: NonNullable<Field['selectOther']> = { enabled: so.enabled };
    if (so.value !== undefined) {
      if (typeof so.value !== 'string' || !so.value.trim()) {
        throw new Error(`${path}.selectOther.value: stringa non vuota attesa`);
      }
      cfg.value = so.value.trim();
    }
    if (so.label !== undefined) {
      cfg.label = parseI18n(so.label, `${path}.selectOther.label`);
    }
    if (so.placeholder !== undefined) {
      cfg.placeholder = parseI18n(so.placeholder, `${path}.selectOther.placeholder`);
    }
    field.selectOther = cfg;
    const sentinel = cfg.value ?? '__other__';
    const opts = field.options ?? [];
    if (opts.some((o) => o.value === sentinel)) {
      throw new Error(
        `${path}.selectOther: il valore sintetico "${sentinel}" coincide con un'opzione; modifica selectOther.value o le opzioni.`
      );
    }
  }

  if (type === 'notice') {
    if (raw.noticeText !== undefined) {
      field.noticeText = parseI18n(raw.noticeText, `${path}.noticeText`);
    } else {
      field.noticeText = { ...field.label };
    }
    const nv = raw.noticeVariant;
    if (nv !== undefined) {
      if (nv !== 'info' && nv !== 'warning' && nv !== 'error') {
        throw new Error(`${path}.noticeVariant: atteso "info", "warning" o "error"`);
      }
      field.noticeVariant = nv;
    } else {
      field.noticeVariant = 'info';
    }
    field.required = false;
  }

  if (type === 'number') {
    if (raw.min !== undefined) {
      if (typeof raw.min !== 'number' || !Number.isFinite(raw.min)) {
        throw new Error(`${path}.min: numero atteso`);
      }
      field.min = raw.min;
    }
    if (raw.max !== undefined) {
      if (typeof raw.max !== 'number' || !Number.isFinite(raw.max)) {
        throw new Error(`${path}.max: numero atteso`);
      }
      field.max = raw.max;
    }
  }

  return field;
}

function parseStepRepeat(raw: unknown, path: string): StepRepeatConfig {
  if (!isRecord(raw)) throw new Error(`${path}: oggetto repeatFromField atteso`);
  if (typeof raw.countFieldId !== 'string' || !raw.countFieldId.trim()) {
    throw new Error(`${path}.countFieldId: stringa non vuota attesa`);
  }
  const cfg: StepRepeatConfig = { countFieldId: raw.countFieldId.trim() };
  if (raw.minCount !== undefined) {
    if (typeof raw.minCount !== 'number' || !Number.isFinite(raw.minCount)) {
      throw new Error(`${path}.minCount: numero atteso`);
    }
    cfg.minCount = raw.minCount;
  }
  if (raw.maxCount !== undefined) {
    if (typeof raw.maxCount !== 'number' || !Number.isFinite(raw.maxCount)) {
      throw new Error(`${path}.maxCount: numero atteso`);
    }
    cfg.maxCount = raw.maxCount;
  }
  return cfg;
}

function parseStep(raw: unknown, index: number): Step {
  const path = `steps[${index}]`;
  if (!isRecord(raw)) throw new Error(`${path}: oggetto step atteso`);
  if (typeof raw.id !== 'string' || !raw.id.trim()) throw new Error(`${path}: "id" stringa non vuota attesa`);
  if (!isRecord(raw.title)) throw new Error(`${path}.title: oggetto atteso`);
  const title = parseI18n(raw.title, `${path}.title`);
  if (!Array.isArray(raw.fields)) throw new Error(`${path}: array "fields" atteso`);
  const fields = raw.fields.map((f, j) => parseField(f, index, j));
  const step: Step = { id: raw.id.trim(), title, fields };
  if (raw.repeatFromField !== undefined) {
    step.repeatFromField = parseStepRepeat(raw.repeatFromField, `${path}.repeatFromField`);
  }
  return step;
}

function parseRiepilogoPricing(raw: unknown, path: string): RiepilogoPricing | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) throw new Error(`${path}: oggetto atteso`);
  const out: RiepilogoPricing = {};
  const numericKeys = [
    'iscrizioneBaseEur',
    'euroPerSettimanaSelezionata',
    'tesseramentoNoiNuovoEur',
    'scontoFamigliaNumerosaEur',
  ] as const;
  for (const k of numericKeys) {
    if (raw[k] === undefined) continue;
    const v = raw[k];
    if (typeof v !== 'number' || Number.isNaN(v) || v < 0) {
      throw new Error(`${path}.${String(k)}: numero ≥ 0 atteso`);
    }
    out[k] = v;
  }
  if (raw.tesseramentoFieldId !== undefined) {
    if (typeof raw.tesseramentoFieldId !== 'string' || !raw.tesseramentoFieldId.trim()) {
      throw new Error(`${path}.tesseramentoFieldId: stringa non vuota attesa`);
    }
    out.tesseramentoFieldId = raw.tesseramentoFieldId.trim();
  }
  if (raw.tesseramentoWhenValue !== undefined) {
    if (typeof raw.tesseramentoWhenValue !== 'string' || !String(raw.tesseramentoWhenValue).trim()) {
      throw new Error(`${path}.tesseramentoWhenValue: stringa non vuota attesa`);
    }
    out.tesseramentoWhenValue = String(raw.tesseramentoWhenValue).trim();
  }
  if (raw.prezziGiteByOptionValue !== undefined) {
    if (!isRecord(raw.prezziGiteByOptionValue)) {
      throw new Error(`${path}.prezziGiteByOptionValue: oggetto atteso`);
    }
    const pg: Record<string, number> = {};
    for (const [key, val] of Object.entries(raw.prezziGiteByOptionValue)) {
      if (!key.trim()) {
        throw new Error(`${path}.prezziGiteByOptionValue: chiavi non vuote attese`);
      }
      if (typeof val !== 'number' || Number.isNaN(val) || val < 0) {
        throw new Error(`${path}.prezziGiteByOptionValue["${key}"]: numero ≥ 0 atteso`);
      }
      pg[key.trim()] = val;
    }
    out.prezziGiteByOptionValue = pg;
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

function parseEmailOnSubmit(raw: unknown): EmailOnSubmit | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) throw new Error('emailOnSubmit: oggetto atteso');
  if (typeof raw.enabled !== 'boolean') throw new Error('emailOnSubmit.enabled: boolean atteso');
  if (typeof raw.templateFile !== 'string') throw new Error('emailOnSubmit.templateFile: stringa attesa');
  if (typeof raw.subject !== 'string') throw new Error('emailOnSubmit.subject: stringa attesa');
  if (typeof raw.body !== 'string') throw new Error('emailOnSubmit.body: stringa attesa');
  if (typeof raw.attachDocxToo !== 'boolean') throw new Error('emailOnSubmit.attachDocxToo: boolean atteso');
  const to =
    raw.to === undefined
      ? undefined
      : Array.isArray(raw.to)
        ? raw.to.map((x) => String(x).trim()).filter(Boolean)
        : undefined;
  const out: EmailOnSubmit = {
    enabled: raw.enabled,
    templateFile: raw.templateFile,
    subject: raw.subject,
    body: raw.body,
    attachDocxToo: raw.attachDocxToo,
    ...(to !== undefined ? { to } : {}),
  };
  if (raw.toFieldId !== undefined) {
    if (typeof raw.toFieldId !== 'string') {
      throw new Error('emailOnSubmit.toFieldId: stringa attesa');
    }
    const t = raw.toFieldId.trim();
    if (t) out.toFieldId = t;
  }
  if (raw.riepilogoPricing !== undefined) {
    out.riepilogoPricing = parseRiepilogoPricing(raw.riepilogoPricing, 'emailOnSubmit.riepilogoPricing');
  }
  if (raw.staticAttachmentFiles !== undefined) {
    if (!Array.isArray(raw.staticAttachmentFiles)) {
      throw new Error('emailOnSubmit.staticAttachmentFiles: array di stringhe atteso');
    }
    const names = raw.staticAttachmentFiles
      .map((x) => String(x).trim())
      .filter(Boolean);
    if (names.length) out.staticAttachmentFiles = names;
  }
  return out;
}

function parseEnrollmentCapacity(raw: unknown): EnrollmentCapacity | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) throw new Error('enrollmentCapacity: oggetto atteso');
  if (typeof raw.enabled !== 'boolean') throw new Error('enrollmentCapacity.enabled: boolean atteso');
  if (typeof raw.sedeFieldId !== 'string' || !raw.sedeFieldId.trim()) {
    throw new Error('enrollmentCapacity.sedeFieldId: stringa non vuota attesa');
  }
  if (!Array.isArray(raw.weekFieldIds) || raw.weekFieldIds.length === 0) {
    throw new Error('enrollmentCapacity.weekFieldIds: array di stringhe non vuoto atteso');
  }
  const weekFieldIds = raw.weekFieldIds.map((w) => {
    if (typeof w !== 'string' || !w.trim()) {
      throw new Error('enrollmentCapacity.weekFieldIds: ogni voce deve essere una stringa non vuota');
    }
    return w.trim();
  });
  if (!isRecord(raw.limitsBySede)) {
    throw new Error('enrollmentCapacity.limitsBySede: oggetto atteso');
  }
  const limitsBySede: Record<string, Record<string, number>> = {};
  for (const [sedeKey, weekMap] of Object.entries(raw.limitsBySede)) {
    if (!sedeKey.trim()) throw new Error('enrollmentCapacity.limitsBySede: chiavi sede non vuote');
    if (!isRecord(weekMap)) {
      throw new Error(`enrollmentCapacity.limitsBySede['${sedeKey}']: oggetto atteso`);
    }
    const inner: Record<string, number> = {};
    for (const [wk, lim] of Object.entries(weekMap)) {
      if (!wk.trim()) continue;
      if (typeof lim !== 'number' || Number.isNaN(lim) || lim < 0) {
        throw new Error(
          `enrollmentCapacity.limitsBySede['${sedeKey}']['${wk}']: numero ≥ 0 atteso`
        );
      }
      inner[wk.trim()] = lim;
    }
    limitsBySede[sedeKey.trim()] = inner;
  }
  const out: EnrollmentCapacity = {
    enabled: raw.enabled,
    sedeFieldId: raw.sedeFieldId.trim(),
    weekFieldIds,
    limitsBySede,
  };
  if (raw.weekParticipationValue !== undefined) {
    if (typeof raw.weekParticipationValue !== 'string' || !raw.weekParticipationValue.trim()) {
      throw new Error('enrollmentCapacity.weekParticipationValue: stringa non vuota attesa');
    }
    out.weekParticipationValue = raw.weekParticipationValue.trim();
  }
  return out;
}

function parseTripCapacity(raw: unknown): TripCapacity | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) throw new Error('tripCapacity: oggetto atteso');
  if (typeof raw.enabled !== 'boolean') throw new Error('tripCapacity.enabled: boolean atteso');
  if (!isRecord(raw.limitsByField)) {
    throw new Error('tripCapacity.limitsByField: oggetto atteso');
  }
  const limitsByField: Record<string, Record<string, number>> = {};
  for (const [fieldId, optionMap] of Object.entries(raw.limitsByField)) {
    if (!fieldId.trim()) throw new Error('tripCapacity.limitsByField: fieldId non valido');
    if (!isRecord(optionMap)) {
      throw new Error(`tripCapacity.limitsByField['${fieldId}']: oggetto atteso`);
    }
    const inner: Record<string, number> = {};
    for (const [optValue, lim] of Object.entries(optionMap)) {
      if (!optValue.trim()) continue;
      if (typeof lim !== 'number' || Number.isNaN(lim) || lim < 0) {
        throw new Error(`tripCapacity.limitsByField['${fieldId}']['${optValue}']: numero ≥ 0 atteso`);
      }
      inner[optValue.trim()] = Math.floor(lim);
    }
    limitsByField[fieldId.trim()] = inner;
  }
  return {
    enabled: raw.enabled,
    limitsByField,
  };
}

/**
 * Valida e normalizza il testo JSON in un {@link Module}.
 */
export function parseModuleJson(text: string): ParseModuleJsonResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Il contenuto non è JSON valido.' };
  }

  try {
    if (!isRecord(data)) {
      return { ok: false, error: 'Il JSON deve essere un oggetto (schema modulo).' };
    }

    if (typeof data.id !== 'string' || !data.id.trim()) {
      return { ok: false, error: 'Campo obbligatorio mancante: "id" (stringa).' };
    }

    const versionRaw = data.version;
    const version =
      typeof versionRaw === 'number' && Number.isFinite(versionRaw)
        ? Math.max(1, Math.floor(versionRaw))
        : 1;

    const meta = parseMeta(data.meta);
    if (!Array.isArray(data.steps)) {
      return { ok: false, error: 'Campo obbligatorio mancante: "steps" (array).' };
    }
    if (data.steps.length === 0) {
      return { ok: false, error: 'Lo schema deve contenere almeno uno step.' };
    }

    const steps = data.steps.map((s, i) => parseStep(s, i));

    const module: Module = {
      id: data.id.trim(),
      version,
      meta,
      steps,
    };

    if (data.guid !== undefined) {
      if (typeof data.guid !== 'string' || !data.guid.trim()) {
        return { ok: false, error: 'Se presente, "guid" deve essere una stringa non vuota.' };
      }
      module.guid = data.guid.trim();
    }

    if (data.emailOnSubmit !== undefined) {
      module.emailOnSubmit = parseEmailOnSubmit(data.emailOnSubmit);
    }

    if (data.enrollmentCapacity !== undefined) {
      module.enrollmentCapacity = parseEnrollmentCapacity(data.enrollmentCapacity);
    }
    if (data.tripCapacity !== undefined) {
      module.tripCapacity = parseTripCapacity(data.tripCapacity);
    }

    return { ok: true, module };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Dopo un import, opzionalmente mantiene l’identità del modulo già aperto (modifica senza sovrascrivere id/guid).
 */
export function mergeImportedWithCurrent(
  imported: Module,
  current: Module,
  keepIds: boolean
): Module {
  if (!keepIds) return imported;
  return {
    ...imported,
    id: current.id,
    guid: current.guid,
  };
}

export function readJsonFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Lettura file non riuscita'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Lettura file non riuscita'));
    reader.readAsText(file, 'UTF-8');
  });
}
