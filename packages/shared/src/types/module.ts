/**
 * Types for the dynamic module schema (aligned with specifiche_moduli_e_architettura.md).
 */

/** i18n object: locale key -> string (v1: it only) */
export type I18n = { it: string };

/** Condition for showIf / requiredIf (allineato a `conditions.ts` nel sito pubblico). */
export type ConditionOp =
  | 'eq'
  | 'neq'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'notContains'
  | 'intersects'
  | 'notIntersects'
  | 'empty'
  | 'notEmpty';

export interface Condition {
  field: string;
  op: ConditionOp;
  value?: unknown;
}

/** Field types supported in v1 */
export type FieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox-group'
  | 'checkbox'
  | 'switch'
  | 'date'
  /** Testo statico (solo lettura), stile avviso colorato; nessun valore in `responses`. */
  | 'notice';

/** Solo per `type: 'notice'`: colori tipo MUI Alert (info=blu, warning=giallo, error=rosso). */
export type NoticeVariant = 'info' | 'warning' | 'error';

/** Option for select/radio/checkbox-group */
export interface FieldOption {
  value: string;
  label: I18n;
  /** Flag statico: se false l'opzione risulta non selezionabile nel public. */
  enabled?: boolean;
  /** Condizione opzionale per abilitare la singola opzione (es. radio). */
  enabledIf?: Condition;
}

/**
 * Solo per `type: 'select'`: opzione «Altro» con testo libero.
 * Il valore scelto nel select è `value` (default `__other__`); il testo è in `{fieldId}_other`
 * (in step ripetuti: `{fieldId}_{i}_other`).
 */
export interface SelectOtherConfig {
  enabled: boolean;
  /** Valore inviato nel campo select quando l’utente sceglie «Altro» (default `__other__`). Deve essere distinto da ogni `options[].value`. */
  value?: string;
  label?: I18n;
  placeholder?: I18n;
}

export interface Field {
  id: string;
  type: FieldType;
  label: I18n;
  placeholder?: I18n;
  required: boolean;
  validation?: string;
  showIf?: Condition;
  requiredIf?: Condition;
  options?: FieldOption[];
  /** Solo per `type: 'select'`: opzione Altro + chiave `{id}_other` per il testo. */
  selectOther?: SelectOtherConfig;
  /** Solo per `type: 'notice'`: contenuto mostrato e variante colore. */
  noticeVariant?: NoticeVariant;
  noticeText?: I18n;
  /** Solo per `type: 'number'`: limiti inclusivi opzionali (validazione lato public). */
  min?: number;
  max?: number;
}

/**
 * Configurazione step ripetuto N volte (es. N figli) in base al valore di un campo precedente.
 * Runtime (public): campi con suffisso `_0`, `_1`, … o come da convenzione implementativa.
 */
export interface StepRepeatConfig {
  /** ID del campo in uno **step precedente** che fornisce N (tipicamente tipo `number`). */
  countFieldId: string;
  minCount?: number;
  maxCount?: number;
}

export interface Step {
  id: string;
  title: I18n;
  fields: Field[];
  /** Se presente, questo step viene mostrato/salvato N volte (N dal valore di `countFieldId`). */
  repeatFromField?: StepRepeatConfig;
}

export interface ThankYou {
  title: I18n;
  body: I18n;
  notes: I18n;
}

export interface Meta {
  title: I18n;
  description: I18n;
  thankYou: ThankYou;
}

/**
 * Tariffe per il testo automatico `{{ riepilogo }}` (moduli con settimane/gite).
 * Opzionale: valori assenti usano i default lato backend.
 * @see docs/email-submission-templates.md §4.0
 */
export interface RiepilogoPricing {
  /** Quota fissa per figlio (€). */
  iscrizioneBaseEur?: number;
  /** Importo per ogni settimana con partecipazione «Sì». */
  euroPerSettimanaSelezionata?: number;
  /** Costo tesseramento Noi quando il campo assume `tesseramentoWhenValue`. */
  tesseramentoNoiNuovoEur?: number;
  /** ID campo radio/select tesseramento (default backend: `tesseramento_noi`). */
  tesseramentoFieldId?: string;
  /** Valore campo che attiva il costo tesseramento (default: `richiesta_6euro`). */
  tesseramentoWhenValue?: string;
  /** Sconto € dal 2° figlio in su (una tantum sul parziale). */
  scontoFamigliaNumerosaEur?: number;
  /** Mappa `value` opzione gita (checkbox-group) → importo €; si unisce ai default backend. */
  prezziGiteByOptionValue?: Record<string, number>;
}

/**
 * Email dopo submit con PDF/DOCX da template Word (`email_templates/` sul server).
 * @see docs/email-submission-templates.md
 */
/**
 * Limiti di iscrizione per combinazione sede × settimana (campo settimana = stesso id nello schema).
 * Conteggi solo lato server; `_capacityWaitlistPosition` non è esposto al sito pubblico.
 */
export interface EnrollmentCapacity {
  enabled: boolean;
  /** Es. `sede_grest` (stesso id nei figli ripetuti: suffissi `_i` nel wire). */
  sedeFieldId: string;
  /** Es. `prima`, `seconda`, `terza` — ordine solo per validazione limiti. */
  weekFieldIds: string[];
  /** Valore che conta come iscritto alla settimana (default backend: `si`). */
  weekParticipationValue?: string;
  /**
   * Chiavi livello 1 = `value` opzione sede; livello 2 = fieldId settimana → max posti confermati.
   */
  limitsBySede: Record<string, Record<string, number>>;
}

/**
 * Limiti posti per gite/uscite (tipicamente campi `checkbox-group`).
 * Chiave 1: `fieldId` della domanda gite; chiave 2: `options[].value` -> capienza massima.
 */
export interface TripCapacity {
  enabled: boolean;
  limitsByField: Record<string, Record<string, number>>;
}

export interface EmailOnSubmit {
  enabled: boolean;
  /** Solo nome file, es. `iscrizione.docx` (cartella sul server). */
  templateFile: string;
  /** Destinatari opzionali; se vuoto il backend usa `SMTP_TO_DEFAULT` (salvo `toFieldId`). */
  to?: string[];
  /**
   * ID del campo modulo di tipo email: dopo il submit il backend aggiunge il valore alle destinazioni.
   * Si unisce a `to` (senza duplicati).
   */
  toFieldId?: string;
  subject: string;
  body: string;
  /** Se true, allega anche il .docx oltre al PDF (quando il PDF è generato). */
  attachDocxToo: boolean;
  /**
   * Nomi file aggiuntivi nella cartella `email_templates/` sul server (non compilati da template).
   * Solo nomi file sicuri, estensioni consentite lato backend.
   */
  staticAttachmentFiles?: string[];
  /** Tariffe riepilogo email (solo se usi `{{ riepilogo }}` nel body). */
  riepilogoPricing?: RiepilogoPricing;
}

export interface Module {
  id: string;
  /** Public URL segment for GET /api/modules/{guid}; if omitted, backend may fall back to `id`. */
  guid?: string;
  version: number;
  meta: Meta;
  steps: Step[];
  emailOnSubmit?: EmailOnSubmit;
  /** Opzionale: capienza sede × settimana e lista d'attesa (backend). */
  enrollmentCapacity?: EnrollmentCapacity;
  /** Opzionale: capienza gite per opzione (analytics/admin). */
  tripCapacity?: TripCapacity;
}
