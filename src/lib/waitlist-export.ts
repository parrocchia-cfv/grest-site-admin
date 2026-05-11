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
      if (!detailRaw.trim()) continue;
      giteRows.push([
        formatSubmittedAt(s.submittedAt),
        s.submittedAt ?? '',
        s.id ?? '',
        s.submissionGroupId ?? '',
        childDisplayName(row),
        pickDataNascita(row),
        pickClasse(row),
        detailRaw,
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

function shortenHeader(label: string, maxLen = 42): string {
  const clean = label.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

type TripOptionCol = {
  fieldId: string;
  optionValue: string;
  header: string;
};

/**
 * Export "pivot" per decisioni:
 * - Colonne settimane (uno `X` per la settimana in attesa)
 * - Colonne gite/uscite (uno `X` per l'opzione in attesa)
 * - Una riga per submission.
 */
export function buildWaitlistPivotSheet(
  module: Module | null,
  submissions: AdminSubmissionRow[]
): WaitlistSheet | null {
  if (!module) return null;

  const ec = module.enrollmentCapacity;
  const tc = module.tripCapacity;

  const weekIds = ec?.enabled ? ec.weekFieldIds : [];
  const tripOptions: TripOptionCol[] = [];

  if (tc?.enabled && tc.limitsByField) {
    const fieldIds = Object.keys(tc.limitsByField).sort((a, b) => a.localeCompare(b));
    for (const fieldId of fieldIds) {
      const optionMap = tc.limitsByField[fieldId] ?? {};
      const optionValues = Object.keys(optionMap).sort((a, b) => a.localeCompare(b));
      const fieldLabel = fieldLabelById(module, fieldId);
      for (const optionValue of optionValues) {
        const optLabel = findOptionLabel(module, fieldId, optionValue);
        tripOptions.push({
          fieldId,
          optionValue,
          header: shortenHeader(`${fieldLabel} · ${optLabel}`),
        });
      }
    }
  }

  if (weekIds.length === 0 && tripOptions.length === 0) return null;

  const moduleGuid = (module.guid?.trim() || module.id).trim();

  const baseHeaders: string[] = [
    'Data/Ora invio',
    'Data invio (ISO)',
    'Nominativo minore',
    'Data di nascita',
    'Classe',
  ];
  if (ec?.enabled) baseHeaders.push('Sede');

  baseHeaders.push('Email contatto', 'Telefono', 'Cellulare');

  const weekHeaders = weekIds.map((wid) => shortenHeader(weekWaitlistLabel(module, wid)));
  const tripHeaders = tripOptions.map((t) => t.header);

  const tailHeaders = ['GUID modulo', 'GUID iscrizione (riga)', 'GUID gruppo invio'];

  const headers = [...baseHeaders, ...weekHeaders, ...tripHeaders, ...tailHeaders];

  type SortRow = { sortKey: string; cells: string[] };
  const rows: SortRow[] = [];

  for (const s of submissions) {
    const row = (s.responses ?? {}) as Record<string, unknown>;

    const hasSeatWaitlisted = (row as Record<string, unknown>)._capacityWaitlisted === true;
    const waitWeeksRaw = (row as Record<string, unknown>)._capacityWaitlistedWeeks;
    const waitWeeks = Array.isArray(waitWeeksRaw)
      ? waitWeeksRaw
          .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
          .map((x) => x.trim())
      : [];

    const hasTripWaitlisted = (row as Record<string, unknown>)._tripCapacityWaitlisted === true;
    const tripDetailRaw = (row as Record<string, unknown>)._tripCapacityWaitlistedByField;

    const tripWaitSet = new Set<string>();
    if (hasTripWaitlisted && tripDetailRaw && typeof tripDetailRaw === 'object' && !Array.isArray(tripDetailRaw)) {
      for (const [fieldId, opts] of Object.entries(tripDetailRaw as Record<string, unknown>)) {
        if (!Array.isArray(opts)) continue;
        for (const ov of opts) {
          if (typeof ov !== 'string' || !ov.trim()) continue;
          tripWaitSet.add(`${fieldId}::${ov.trim()}`);
        }
      }
    }

    const hasSeatWaitlist = hasSeatWaitlisted && waitWeeks.length > 0;
    const hasTripWaitlist = tripWaitSet.size > 0;
    if (!hasSeatWaitlist && !hasTripWaitlist) continue;

    const iso = s.submittedAt ?? '';
    const sedeRaw = ec?.enabled ? row[ec.sedeFieldId] : undefined;
    const sede =
      ec?.enabled && typeof sedeRaw === 'string' && sedeRaw.trim()
        ? mapSedeLabel(sedeRaw.trim())
        : '—';

    const cellsBase: string[] = [
      formatSubmittedAt(s.submittedAt),
      iso,
      childDisplayName(row),
      pickDataNascita(row),
      pickClasse(row),
    ];
    if (ec?.enabled) cellsBase.push(sede);
    cellsBase.push(
      firstNonEmptyString(row, ['email', 'email_genitore']),
      firstNonEmptyString(row, ['telefono', 'telefono_genitore']),
      firstNonEmptyString(row, ['cellulare', 'cellulare_genitore'])
    );

    const weekCells = weekIds.map((wid) => {
      for (const w of waitWeeks) {
        const { baseId } = parseFieldKey(w, module);
        if (baseId === wid) return 'X';
      }
      return '';
    });
    const tripCells = tripOptions.map((t) => (tripWaitSet.has(`${t.fieldId}::${t.optionValue}`) ? 'X' : ''));

    const tailCells = [moduleGuid, s.id ?? '', s.submissionGroupId ?? ''];

    rows.push({ sortKey: iso, cells: [...cellsBase, ...weekCells, ...tripCells, ...tailCells] });
  }

  rows.sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || ''));

  return rows.length > 0
    ? {
        sheetName: 'Lista attesa pivot',
        headers,
        rows: rows.map((r) => r.cells),
      }
    : null;
}

export async function downloadWaitlistPivotWorkbook(
  fileBaseName: string,
  sheet: WaitlistSheet
): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const aoa = [sheet.headers, ...sheet.rows];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const safeName = sheet.sheetName.slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  const rawBase = fileBaseName.trim() || 'liste_attesa';
  const safeId = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `${safeId}.xlsx`);
}

export function downloadWaitlistPivotCsv(sheet: WaitlistSheet, fileBaseName: string): void {
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
  const rawBase = fileBaseName.trim() || 'liste_attesa';
  const safeId = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `${safeId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
