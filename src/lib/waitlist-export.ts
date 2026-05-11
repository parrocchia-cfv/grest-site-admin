import type { Module } from '@grest/shared';
import type { AdminSubmissionRow } from '@/lib/api-client';

const SEDE_LABELS: Record<string, string> = {
  post: 'Postumia',
  postumia: 'Postumia',
  salva: 'Salvarosa',
  salvarosa: 'Salvarosa',
  villa: 'Villarazzo',
  villarazzo: 'Villarazzo',
  bordi: 'Bordignon',
  bordignon: 'Bordignon',
  patro: 'Patronato',
  patronato: 'Patronato',
};

function mapSedeLabel(value: string): string {
  const key = value.trim().toLowerCase();
  return SEDE_LABELS[key] ?? value;
}

function mapClassLabel(value: string): string {
  const trimmed = value.trim();
  const compact = trimmed.replace(/\s+/g, '').toLowerCase();
  const m = compact.match(/^(\d+)([em])$/);
  if (!m) return value;
  return `${m[1]} ${m[2] === 'e' ? 'Elementare' : 'Media'}`;
}

function schemaFieldIdsLongestFirst(module: Module): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const step of module.steps) {
    for (const f of step.fields) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        ids.push(f.id);
      }
    }
  }
  return ids.sort((a, b) => b.length - a.length || a.localeCompare(b, 'it'));
}

function parseFieldKey(
  key: string,
  module: Module | null
): { baseId: string; repeatIndex: number | null } {
  if (module) {
    for (const fid of schemaFieldIdsLongestFirst(module)) {
      if (key === fid) return { baseId: fid, repeatIndex: null };
      const prefixed = `${fid}_`;
      if (key.startsWith(prefixed)) {
        const tail = key.slice(prefixed.length);
        if (/^\d+$/.test(tail)) return { baseId: fid, repeatIndex: Number(tail) };
      }
    }
  }
  const m = key.match(/^(.*)_(\d+)$/);
  if (!m) return { baseId: key, repeatIndex: null };
  return { baseId: m[1], repeatIndex: Number(m[2]) };
}

function fieldLabelById(module: Module, fieldId: string): string {
  for (const step of module.steps) {
    for (const f of step.fields) {
      if (f.id === fieldId) return f.label?.it?.trim() || fieldId;
    }
  }
  return fieldId;
}

function findOptionLabel(module: Module, fieldId: string, value: string): string {
  for (const step of module.steps) {
    for (const field of step.fields) {
      if (field.id !== fieldId) continue;
      const opt = field.options?.find((o) => o.value === value);
      return opt?.label?.it ?? value;
    }
  }
  return value;
}

function formatSubmittedAt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function childDisplayName(row: Record<string, unknown>): string {
  const cognome = typeof row.cognome === 'string' ? row.cognome.trim() : '';
  const nome = typeof row.nome === 'string' ? row.nome.trim() : '';
  const full = `${cognome} ${nome}`.trim();
  if (full) return full;
  return 'Nome non disponibile';
}

function firstNonEmptyString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function pickClasse(row: Record<string, unknown>): string {
  for (const k of ['classe', 'classe_freq', 'class']) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return mapClassLabel(v.trim());
  }
  return '';
}

function pickDataNascita(row: Record<string, unknown>): string {
  const v = row.data_nascita;
  return typeof v === 'string' ? v.trim() : '';
}

function weekWaitlistLabel(module: Module, weekWireId: string): string {
  const { baseId, repeatIndex } = parseFieldKey(weekWireId, module);
  const base = fieldLabelById(module, baseId);
  if (repeatIndex !== null) return `${base} (#${repeatIndex + 1})`;
  return base;
}

function formatTripWaitlistDetail(module: Module, row: Record<string, unknown>): string {
  const raw = row._tripCapacityWaitlistedByField;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
  const parts: string[] = [];
  for (const [fieldId, opts] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(opts)) continue;
    const fieldLabel = fieldLabelById(module, fieldId);
    const labels: string[] = [];
    for (const ov of opts) {
      if (typeof ov !== 'string' || !ov.trim()) continue;
      labels.push(findOptionLabel(module, fieldId, ov.trim()));
    }
    if (labels.length) parts.push(`${fieldLabel}: ${labels.join(', ')}`);
  }
  return parts.join(' · ');
}

export type WaitlistSheet = {
  /** Nome foglio Excel (max ~31 caratteri) */
  sheetName: string;
  headers: string[];
  rows: string[][];
};

export type WaitlistExportSheets = {
  sedi: WaitlistSheet | null;
  gite: WaitlistSheet | null;
};

/**
 * Costruisce due tabelle (sedi × settimane in lista d’attesa, gite in lista d’attesa)
 * con orari e contatti utili alle decisioni. Usa i metadati `_capacity*` / `_trip*` sulle risposte.
 */
export function buildWaitlistExportSheets(
  module: Module | null,
  submissions: AdminSubmissionRow[]
): WaitlistExportSheets {
  if (!module) return { sedi: null, gite: null };

  const sediHeaders = [
    'Data/ora invio',
    'Data invio (ISO)',
    'ID iscrizione',
    'ID gruppo invio',
    'Nominativo minore',
    'Data di nascita',
    'Classe',
    'Sede',
    'Settimane in lista d’attesa',
    'Email contatto',
    'Telefono',
    'Cellulare',
  ];

  const giteHeaders = [
    'Data/ora invio',
    'Data invio (ISO)',
    'ID iscrizione',
    'ID gruppo invio',
    'Nominativo minore',
    'Data di nascita',
    'Classe',
    'Gite in lista d’attesa',
    'Email contatto',
    'Telefono',
    'Cellulare',
  ];

  const sediRows: string[][] = [];
  const giteRows: string[][] = [];

  const ec = module.enrollmentCapacity;
  if (ec?.enabled) {
    for (const s of submissions) {
      const row = s.responses ?? {};
      if ((row as Record<string, unknown>)._capacityWaitlisted !== true) continue;
      const weeksRaw = (row as Record<string, unknown>)._capacityWaitlistedWeeks;
      const weeks = Array.isArray(weeksRaw)
        ? weeksRaw.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())
        : [];
      if (weeks.length === 0) continue;
      const sedeRaw = row[ec.sedeFieldId];
      const sede =
        typeof sedeRaw === 'string' && sedeRaw.trim() ? mapSedeLabel(sedeRaw.trim()) : '—';
      const weekLabels = weeks.map((w) => weekWaitlistLabel(module, w)).join(' · ');
      sediRows.push([
        formatSubmittedAt(s.submittedAt),
        s.submittedAt ?? '',
        s.id ?? '',
        s.submissionGroupId ?? '',
        childDisplayName(row),
        pickDataNascita(row),
        pickClasse(row),
        sede,
        weekLabels,
        firstNonEmptyString(row, ['email', 'email_genitore']),
        firstNonEmptyString(row, ['telefono', 'telefono_genitore']),
        firstNonEmptyString(row, ['cellulare', 'cellulare_genitore']),
      ]);
    }
    sediRows.sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));
  }

  const tc = module.tripCapacity;
  if (tc?.enabled) {
    for (const s of submissions) {
      const row = s.responses ?? {};
      if ((row as Record<string, unknown>)._tripCapacityWaitlisted !== true) continue;
      const detailRaw = formatTripWaitlistDetail(module, row as Record<string, unknown>);
      const detail = detailRaw.trim() ? detailRaw : '— (dettaglio gite non disponibile)';
      giteRows.push([
        formatSubmittedAt(s.submittedAt),
        s.submittedAt ?? '',
        s.id ?? '',
        s.submissionGroupId ?? '',
        childDisplayName(row),
        pickDataNascita(row),
        pickClasse(row),
        detail,
        firstNonEmptyString(row, ['email', 'email_genitore']),
        firstNonEmptyString(row, ['telefono', 'telefono_genitore']),
        firstNonEmptyString(row, ['cellulare', 'cellulare_genitore']),
      ]);
    }
    giteRows.sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));
  }

  return {
    sedi:
      sediRows.length > 0
        ? { sheetName: 'Lista attesa sedi', headers: sediHeaders, rows: sediRows }
        : null,
    gite:
      giteRows.length > 0
        ? { sheetName: 'Lista attesa gite', headers: giteHeaders, rows: giteRows }
        : null,
  };
}

/** True se c’è almeno una riga da esportare in uno dei fogli. */
export function waitlistExportHasRows(sheets: WaitlistExportSheets): boolean {
  return Boolean(
    (sheets.sedi && sheets.sedi.rows.length > 0) || (sheets.gite && sheets.gite.rows.length > 0)
  );
}

/**
 * Scrive un workbook XLSX con uno o due fogli (solo liste d’attesa).
 */
export async function downloadWaitlistWorkbook(
  fileBaseName: string,
  sheets: WaitlistExportSheets
): Promise<void> {
  const parts: WaitlistSheet[] = [];
  if (sheets.sedi && sheets.sedi.rows.length > 0) parts.push(sheets.sedi);
  if (sheets.gite && sheets.gite.rows.length > 0) parts.push(sheets.gite);
  if (parts.length === 0) return;

  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  for (const p of parts) {
    const aoa = [p.headers, ...p.rows];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const safeName = p.sheetName.slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  }
  const rawBase = fileBaseName.trim() || 'liste_attesa';
  const safeId = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `${safeId}.xlsx`);
}

/** CSV UTF-8 con BOM (un file per foglio; chiamare due volte per sedi + gite). */
export function downloadWaitlistCsv(sheet: WaitlistSheet, fileBaseName: string): void {
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines: string[] = [sheet.headers.map(escape).join(',')];
  for (const row of sheet.rows) lines.push(row.map(escape).join(','));
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const rawBase = fileBaseName.trim() || 'lista_attesa';
  const safeId = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `${safeId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
