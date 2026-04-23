'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Module } from '@grest/shared';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/AdminLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import {
  getModules,
  getModule,
  getModuleSubmissions,
  patchAdminSubmission,
  deleteAdminSubmission,
  type AdminSubmissionRow,
} from '@/lib/api-client';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import { buildPublicEditSubmissionUrl } from '@/lib/public-form-url';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

type SedeWeekStats = {
  sede: string;
  weekFieldId: string;
  limit: number;
  enrolled: number;
  waitlisted: number;
};

type TripStats = {
  fieldId: string;
  optionValue: string;
  optionLabel: string;
  limit: number;
  enrolled: number;
};

const PRIMARY_FIELDS_ORDER = [
  'cognome',
  'nome',
  'sesso',
  'data_nascita',
  'luogo_nascita',
  'codice_fiscale',
  'classe',
  'sezione',
  'email',
  'telefono',
  'cellulare',
  'nome_genitore',
  'cognome_genitore',
  'email_genitore',
  'telefono_genitore',
] as const;

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

function pct(current: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(100, (current / limit) * 100));
}

function valueToString(v: unknown): string {
  if (Array.isArray(v)) return v.map((item) => valueToString(item)).join(' ');
  if (typeof v === 'object' && v !== null) return JSON.stringify(v);
  return v == null ? '' : String(v);
}

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function getModuleTitle(m: Module): string {
  return m.meta?.title?.it?.trim() || m.id;
}

function isWeekSelected(value: unknown, expected: string): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === expected.trim().toLowerCase();
  return false;
}

function isWaitlisted(row: AdminSubmissionRow): boolean {
  const r = row.responses;
  return !!(r && typeof r === 'object' && (r as Record<string, unknown>)._capacityWaitlisted === true);
}

function getWaitlistedWeeks(row: Record<string, unknown>): Set<string> {
  const raw = row._capacityWaitlistedWeeks;
  if (!Array.isArray(raw)) return new Set<string>();
  return new Set(raw.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()));
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

function buildWeekStats(module: Module, submissions: AdminSubmissionRow[]): SedeWeekStats[] {
  const cfg = module.enrollmentCapacity;
  if (!cfg?.enabled) return [];
  const expected = cfg.weekParticipationValue?.trim() || 'si';
  const out: SedeWeekStats[] = [];
  const counts = new Map<string, { enrolled: number; waitlisted: number }>();

  for (const sub of submissions) {
    const row = sub.responses ?? {};
    const sedeRaw = row[cfg.sedeFieldId];
    if (typeof sedeRaw !== 'string' || !sedeRaw.trim()) continue;
    const sede = sedeRaw.trim();
    const waitWeeks = getWaitlistedWeeks(row);
    for (const weekId of cfg.weekFieldIds) {
      const key = `${sede}::${weekId}`;
      const cur = counts.get(key) ?? { enrolled: 0, waitlisted: 0 };
      if (isWeekSelected(row[weekId], expected)) {
        cur.enrolled += 1;
      }
      if (waitWeeks.has(weekId)) cur.waitlisted += 1;
      counts.set(key, cur);
    }
  }

  for (const [sede, weekMap] of Object.entries(cfg.limitsBySede)) {
    for (const [weekFieldId, limit] of Object.entries(weekMap)) {
      const k = `${sede}::${weekFieldId}`;
      const c = counts.get(k) ?? { enrolled: 0, waitlisted: 0 };
      out.push({
        sede,
        weekFieldId,
        limit: Number(limit) || 0,
        enrolled: c.enrolled,
        waitlisted: c.waitlisted,
      });
    }
  }
  return out.sort((a, b) => a.sede.localeCompare(b.sede) || a.weekFieldId.localeCompare(b.weekFieldId));
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

function buildTripStats(module: Module, submissions: AdminSubmissionRow[]): TripStats[] {
  const cfg = module.tripCapacity;
  if (!cfg?.enabled) return [];
  const counts = new Map<string, number>();

  for (const sub of submissions) {
    const row = sub.responses ?? {};
    for (const fieldId of Object.keys(cfg.limitsByField)) {
      const raw = row[fieldId];
      const selected = Array.isArray(raw)
        ? raw.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        : typeof raw === 'string' && raw.trim()
          ? [raw.trim()]
          : [];
      for (const v of selected) {
        const k = `${fieldId}::${v}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }

  const out: TripStats[] = [];
  for (const [fieldId, optionMap] of Object.entries(cfg.limitsByField)) {
    for (const [optionValue, limit] of Object.entries(optionMap)) {
      const key = `${fieldId}::${optionValue}`;
      out.push({
        fieldId,
        optionValue,
        optionLabel: findOptionLabel(module, fieldId, optionValue),
        limit: Number(limit) || 0,
        enrolled: counts.get(key) ?? 0,
      });
    }
  }
  return out.sort((a, b) => a.fieldId.localeCompare(b.fieldId) || a.optionValue.localeCompare(b.optionValue));
}

function fieldLabelById(module: Module, fieldId: string): string {
  for (const step of module.steps) {
    for (const f of step.fields) {
      if (f.id === fieldId) return f.label?.it?.trim() || fieldId;
    }
  }
  return fieldId;
}

function childDisplayName(row: Record<string, unknown>): string {
  const cognome = typeof row.cognome === 'string' ? row.cognome.trim() : '';
  const nome = typeof row.nome === 'string' ? row.nome.trim() : '';
  const full = `${cognome} ${nome}`.trim();
  if (full) return full;
  return 'Nome non disponibile';
}

function parseFieldKey(key: string): { baseId: string; repeatIndex: number | null } {
  const m = key.match(/^(.*)_(\d+)$/);
  if (!m) return { baseId: key, repeatIndex: null };
  return { baseId: m[1], repeatIndex: Number(m[2]) };
}

function withRepeatSuffix(label: string, repeatIndex: number | null): string {
  if (repeatIndex === null) return label;
  return `${label} #${repeatIndex + 1}`;
}

function shortenHeader(label: string, maxLen = 38): string {
  const clean = label.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

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

function buildFieldIndex(
  module: Module | null
): Map<string, { label: string; type: string; options: { value: string; label: string }[] }> {
  const out = new Map<string, { label: string; type: string; options: { value: string; label: string }[] }>();
  if (!module) return out;
  for (const step of module.steps) {
    for (const field of step.fields) {
      out.set(field.id, {
        label: field.label?.it?.trim() || field.id,
        type: field.type,
        options: (field.options ?? []).map((o) => ({
          value: o.value,
          label: o.label?.it?.trim() || o.value,
        })),
      });
    }
  }
  return out;
}

function rankExportColumn(
  key: string,
  module: Module | null,
  fieldIndex: Map<string, { label: string; type: string; options: { value: string; label: string }[] }>
): [number, number, string] {
  if (key === 'submittedAt') return [0, 0, ''];
  const { baseId } = parseFieldKey(key);
  const primaryIndex = PRIMARY_FIELDS_ORDER.findIndex((x) => x === baseId);
  if (primaryIndex >= 0) return [1, primaryIndex, key];

  const enrollment = module?.enrollmentCapacity;
  if (enrollment?.enabled) {
    if (baseId === enrollment.sedeFieldId) return [2, 0, key];
    const weekIdx = enrollment.weekFieldIds.findIndex((x) => x === baseId);
    if (weekIdx >= 0) return [3, weekIdx, key];
  }

  const trip = module?.tripCapacity;
  if (trip?.enabled) {
    const tripFields = Object.keys(trip.limitsByField);
    const tripIdx = tripFields.findIndex((x) => x === baseId);
    if (tripIdx >= 0) return [4, tripIdx, key];
  }

  const label = fieldIndex.get(baseId)?.label || baseId;
  return [5, 0, `${label}::${key}`];
}

type ExportColumn = {
  id: string;
  header: string;
  rank: [number, number, string];
  value: (submission: AdminSubmissionRow) => string;
};

function toHumanExportValue(
  key: string,
  raw: unknown,
  fieldMeta: { type: string; options: { value: string; label: string }[] } | undefined
): string {
  const { baseId } = parseFieldKey(key);
  const isSedeField = baseId.toLowerCase().includes('sede');
  const isClassField = baseId.toLowerCase().includes('classe') || baseId.toLowerCase().includes('class');

  const mapScalar = (input: string): string => {
    let out = input;
    if (fieldMeta && (fieldMeta.type === 'select' || fieldMeta.type === 'radio')) {
      const opt = fieldMeta.options.find((o) => o.value === input);
      out = opt?.label ?? out;
    }
    if (isSedeField) out = mapSedeLabel(out);
    if (isClassField) out = mapClassLabel(out);
    return out;
  };

  if (Array.isArray(raw)) {
    return raw
      .filter((v): v is string => typeof v === 'string')
      .map((v) => mapScalar(v))
      .join(', ');
  }
  if (typeof raw === 'string') return mapScalar(raw);
  if (typeof raw === 'object' && raw !== null) return JSON.stringify(raw);
  return raw == null ? '' : String(raw);
}

export default function AnalyticsPage() {
  const auth = useAuth();
  const canViewAnalytics = Boolean(auth.user?.isSuperadmin || auth.user?.permissions.viewAnalytics);
  const canManageSubmissions = Boolean(auth.user?.isSuperadmin || auth.user?.permissions.manageSubmissions);
  const authHandle = useMemo(
    () => ({
      getAccessToken: auth.getAccessToken,
      getRefreshToken: auth.getRefreshToken,
      setTokens: auth.setTokens,
      clearTokens: auth.clearTokens,
    }),
    [auth.getAccessToken, auth.getRefreshToken, auth.setTokens, auth.clearTokens]
  );

  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmissionRow[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [loadingModuleDetail, setLoadingModuleDetail] = useState(false);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editTarget, setEditTarget] = useState<AdminSubmissionRow | null>(null);
  const [editJson, setEditJson] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [waitlistSedeFilter, setWaitlistSedeFilter] = useState('');
  const [waitlistWeekFilter, setWaitlistWeekFilter] = useState('');

  useEffect(() => {
    setLoadingModules(true);
    setError(null);
    getModules(authHandle)
      .then((list) => {
        setModules(list);
        setSelectedModuleId((prev) => prev || list[0]?.id || '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Errore caricamento moduli'))
      .finally(() => setLoadingModules(false));
  }, [authHandle]);

  useEffect(() => {
    if (!selectedModuleId) {
      setSelectedModule(null);
      setSubmissions([]);
      return;
    }
    setLoadingModuleDetail(true);
    setError(null);
    getModule(selectedModuleId, authHandle)
      .then((m) => setSelectedModule(m))
      .catch((e) => {
        setSelectedModule(null);
        setError(e instanceof Error ? e.message : 'Errore caricamento dettaglio modulo');
      })
      .finally(() => setLoadingModuleDetail(false));
  }, [selectedModuleId, authHandle]);

  const refreshSubmissions = async () => {
    if (!selectedModuleId) {
      setSubmissions([]);
      return;
    }
    setLoadingSubs(true);
    setError(null);
    try {
      const rows = await getModuleSubmissions(selectedModuleId, authHandle);
      setSubmissions(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento iscrizioni');
    } finally {
      setLoadingSubs(false);
    }
  };

  useEffect(() => {
    if (!selectedModuleId) {
      setSubmissions([]);
      return;
    }
    void refreshSubmissions();
  }, [selectedModuleId, authHandle]);

  const filteredSubmissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((s) => {
      if ((s.id ?? '').toLowerCase().includes(q)) return true;
      if ((s.submissionGroupId ?? '').toLowerCase().includes(q)) return true;
      if ((s.submittedAt ?? '').toLowerCase().includes(q)) return true;
      const responses = s.responses ?? {};
      return Object.entries(responses).some(([k, v]) => {
        if (k.startsWith('_')) return false;
        const keyHit = k.toLowerCase().includes(q);
        const valueHit = valueToString(v).toLowerCase().includes(q);
        return keyHit || valueHit;
      });
    });
  }, [submissions, searchQuery]);

  const weekStats = useMemo(
    () => (selectedModule ? buildWeekStats(selectedModule, filteredSubmissions) : []),
    [selectedModule, filteredSubmissions]
  );
  const tripStats = useMemo(
    () => (selectedModule ? buildTripStats(selectedModule, filteredSubmissions) : []),
    [selectedModule, filteredSubmissions]
  );

  const waitlistConfig = selectedModule?.enrollmentCapacity;
  const waitlistSediOptions = useMemo(() => {
    if (!waitlistConfig?.enabled) return [];
    return Object.keys(waitlistConfig.limitsBySede).sort((a, b) => a.localeCompare(b));
  }, [waitlistConfig]);
  const waitlistWeekOptions = useMemo(() => {
    if (!waitlistConfig?.enabled) return [];
    return [...waitlistConfig.weekFieldIds];
  }, [waitlistConfig]);

  useEffect(() => {
    if (!waitlistConfig?.enabled) {
      setWaitlistSedeFilter('');
      setWaitlistWeekFilter('');
      return;
    }
    const nextSede =
      waitlistSediOptions.length > 0 && !waitlistSediOptions.includes(waitlistSedeFilter)
        ? waitlistSediOptions[0]
        : waitlistSedeFilter || waitlistSediOptions[0] || '';
    const nextWeek =
      waitlistWeekOptions.length > 0 && !waitlistWeekOptions.includes(waitlistWeekFilter)
        ? waitlistWeekOptions[0]
        : waitlistWeekFilter || waitlistWeekOptions[0] || '';
    if (nextSede !== waitlistSedeFilter) setWaitlistSedeFilter(nextSede);
    if (nextWeek !== waitlistWeekFilter) setWaitlistWeekFilter(nextWeek);
  }, [
    waitlistConfig,
    waitlistSediOptions,
    waitlistWeekOptions,
    waitlistSedeFilter,
    waitlistWeekFilter,
  ]);

  const waitlistRows = useMemo(() => {
    if (!waitlistConfig?.enabled || !waitlistSedeFilter || !waitlistWeekFilter) return [];
    const out: { name: string; submittedAt: string; submissionId: string }[] = [];
    for (const s of filteredSubmissions) {
      const row = s.responses ?? {};
      if ((row as Record<string, unknown>)._capacityWaitlisted !== true) continue;
      const sedeRaw = row[waitlistConfig.sedeFieldId];
      if (typeof sedeRaw !== 'string' || sedeRaw.trim() !== waitlistSedeFilter) continue;
      const waitWeeks = (row as Record<string, unknown>)._capacityWaitlistedWeeks;
      const weeks = Array.isArray(waitWeeks)
        ? waitWeeks.filter((x): x is string => typeof x === 'string')
        : [];
      if (!weeks.includes(waitlistWeekFilter)) continue;
      out.push({
        name: childDisplayName(row),
        submittedAt: s.submittedAt ?? '',
        submissionId: s.id,
      });
    }
    return out.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  }, [filteredSubmissions, waitlistConfig, waitlistSedeFilter, waitlistWeekFilter]);

  const userResponseColumns = useMemo(() => {
    const keys = new Set<string>();
    for (const s of submissions) {
      const r = s.responses ?? {};
      for (const k of Object.keys(r)) {
        // Escludi metadati tecnici (_submission*, _capacity*, ecc.) dal file per la segreteria.
        if (k.startsWith('_')) continue;
        keys.add(k);
      }
    }
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [submissions]);

  const exportColumns = useMemo<ExportColumn[]>(() => {
    const fieldIndex = buildFieldIndex(selectedModule);
    const expectedWeekYes = selectedModule?.enrollmentCapacity?.weekParticipationValue?.trim() || 'si';
    const out: ExportColumn[] = [
      {
        id: 'submittedAt',
        header: 'Data/Ora invio',
        rank: [0, 0, ''],
        value: (s) => formatSubmittedAt(s.submittedAt),
      },
    ];

    for (const key of userResponseColumns) {
      const { baseId, repeatIndex } = parseFieldKey(key);
      const meta = fieldIndex.get(baseId);
      if (!meta) continue;
      const baseRank = rankExportColumn(key, selectedModule, fieldIndex);
      const baseLabel = withRepeatSuffix(meta.label, repeatIndex);

      // UX export: checkbox-group su colonne separate (una colonna per opzione, X se selezionata).
      if (meta.type === 'checkbox-group' && meta.options.length > 0) {
        meta.options.forEach((opt, idx) => {
          out.push({
            id: `${key}::opt::${opt.value}`,
            header: shortenHeader(`${baseLabel} · ${opt.label}`),
            rank: [baseRank[0], baseRank[1], `${baseRank[2]}::${String(idx).padStart(4, '0')}`],
            value: (s) => {
              const row = s.responses ?? {};
              const raw = row[key];
              if (!Array.isArray(raw)) return '';
              return raw.some((v) => typeof v === 'string' && v === opt.value) ? 'X' : '';
            },
          });
        });
        continue;
      }

      // UX export: settimane come flag X (non si/no).
      const isWeekField = Boolean(selectedModule?.enrollmentCapacity?.weekFieldIds.includes(baseId));
      if (isWeekField) {
        out.push({
          id: key,
          header: shortenHeader(baseLabel),
          rank: baseRank,
          value: (s) => {
            const row = s.responses ?? {};
            return isWeekSelected(row[key], expectedWeekYes) ? 'X' : '';
          },
        });
        continue;
      }

      out.push({
        id: key,
        header: shortenHeader(baseLabel),
        rank: baseRank,
        value: (s) => {
          const row = s.responses ?? {};
          const v = row[key];
          return toHumanExportValue(key, v, meta);
        },
      });
    }

    return out.sort((a, b) => {
      const ra = a.rank;
      const rb = b.rank;
      if (ra[0] !== rb[0]) return ra[0] - rb[0];
      if (ra[1] !== rb[1]) return ra[1] - rb[1];
      return ra[2].localeCompare(rb[2], 'it');
    });
  }, [selectedModule, userResponseColumns]);

  const weekPivot = useMemo(() => {
    const byWeek = new Map<string, Map<string, SedeWeekStats>>();
    const sedeSet = new Set<string>();
    for (const r of weekStats) {
      sedeSet.add(r.sede);
      if (!byWeek.has(r.weekFieldId)) byWeek.set(r.weekFieldId, new Map<string, SedeWeekStats>());
      byWeek.get(r.weekFieldId)!.set(r.sede, r);
    }
    return {
      weeks: Array.from(byWeek.keys()).sort((a, b) => a.localeCompare(b)),
      sedi: Array.from(sedeSet).sort((a, b) => a.localeCompare(b)),
      cells: byWeek,
    };
  }, [weekStats]);

  const overview = useMemo(() => {
    const weekLimit = weekStats.reduce((acc, r) => acc + r.limit, 0);
    const weekEnrolled = weekStats.reduce((acc, r) => acc + r.enrolled, 0);
    const weekWait = weekStats.reduce((acc, r) => acc + r.waitlisted, 0);
    const tripLimit = tripStats.reduce((acc, r) => acc + r.limit, 0);
    const tripEnrolled = tripStats.reduce((acc, r) => acc + r.enrolled, 0);
    return { weekLimit, weekEnrolled, weekWait, tripLimit, tripEnrolled };
  }, [weekStats, tripStats]);

  function exportChildrenCsv(): void {
    if (filteredSubmissions.length === 0) return;
    const lines: string[] = [];
    lines.push(exportColumns.map((c) => csvEscape(c.header)).join(','));
    for (const s of filteredSubmissions) {
      const vals = exportColumns.map((c) => c.value(s));
      lines.push(vals.map(csvEscape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeId = (selectedModuleId || 'modulo').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `iscrizioni_${safeId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openEditDialog(row: AdminSubmissionRow): void {
    setEditTarget(row);
    setEditJson(JSON.stringify(row.responses ?? {}, null, 2));
  }

  async function handleSaveEdit(): Promise<void> {
    if (!editTarget) return;
    let parsed: Record<string, unknown>;
    try {
      const j = JSON.parse(editJson);
      if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('JSON non valido');
      parsed = j as Record<string, unknown>;
    } catch {
      setError('JSON risposte non valido');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await patchAdminSubmission(
        editTarget.submissionGroupId || editTarget.id,
        {
          moduleId: selectedModuleId,
          responses: parsed,
          submittedAt: editTarget.submittedAt,
        },
        authHandle
      );
      setEditTarget(null);
      setNotice('Iscrizione aggiornata');
      await refreshSubmissions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aggiornamento iscrizione fallito');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(row: AdminSubmissionRow): Promise<void> {
    const byGroup = !!row.submissionGroupId;
    const ok = window.confirm(
      byGroup
        ? 'Eliminare tutte le righe del gruppo di invio? Operazione irreversibile.'
        : 'Eliminare questa iscrizione? Operazione irreversibile.'
    );
    if (!ok) return;
    setActionLoading(true);
    setError(null);
    try {
      await deleteAdminSubmission(
        row.submissionGroupId || row.id,
        byGroup ? 'group' : 'single',
        authHandle
      );
      setNotice(byGroup ? 'Gruppo iscrizioni eliminato' : 'Iscrizione eliminata');
      await refreshSubmissions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eliminazione iscrizione fallita');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        {!canViewAnalytics ? (
          <Alert severity="error">Non hai i permessi per visualizzare Analytics.</Alert>
        ) : (
          <>
        <PageHeader
          title="Analytics iscrizioni"
          subtitle="Vista strutturata iscritti, capienze settimane/gite ed export dati."
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <FormControl fullWidth size="small" disabled={loadingModules || modules.length === 0}>
            <InputLabel id="analytics-module-label">Modulo</InputLabel>
            <Select
              labelId="analytics-module-label"
              label="Modulo"
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(String(e.target.value))}
            >
              {modules.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {getModuleTitle(m)} ({m.id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip label={`Righe iscrizioni: ${submissions.length}`} size="small" />
            <Chip label={`Filtrate: ${filteredSubmissions.length}`} size="small" color="secondary" />
            {loadingSubs && <Chip color="info" size="small" label="Aggiornamento dati..." />}
            {loadingModuleDetail && <Chip color="info" size="small" label="Lettura config modulo..." />}
          </Box>
          <TextField
            fullWidth
            sx={{ mt: 1.5 }}
            label="Cerca iscrizioni (nome, cognome, email, classe, data...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Es. mario, rossi, 1e, 2026-06, @mail..."
          />
          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              disabled={filteredSubmissions.length === 0}
              onClick={exportChildrenCsv}
            >
              Esporta Excel (CSV) filtrato
            </Button>
          </Box>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            mb: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' },
          }}
        >
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2">Totale settimane</Typography>
            <Typography variant="h5">{`${overview.weekEnrolled} / ${overview.weekLimit}`}</Typography>
            <LinearProgress
              variant="determinate"
              value={pct(overview.weekEnrolled, overview.weekLimit)}
              sx={{ mt: 1, height: 8, borderRadius: 99 }}
            />
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2">Lista d’attesa settimane</Typography>
            <Typography variant="h5">{overview.weekWait}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Iscrizioni attualmente in coda sui blocchi attivi.
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2">Totale gite</Typography>
            <Typography variant="h5">{`${overview.tripEnrolled} / ${overview.tripLimit}`}</Typography>
            <LinearProgress
              variant="determinate"
              value={pct(overview.tripEnrolled, overview.tripLimit)}
              sx={{ mt: 1, height: 8, borderRadius: 99 }}
            />
          </Paper>
        </Box>

        <Accordion defaultExpanded sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Settimane per sede</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {weekStats.length === 0 ? (
              <Typography color="text.secondary">
                Nessuna configurazione `enrollmentCapacity` attiva per questo modulo.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Settimana (fieldId)</TableCell>
                      {weekPivot.sedi.map((sede) => (
                        <TableCell key={sede} align="center">
                          {sede}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {weekPivot.weeks.map((weekId) => {
                      return (
                        <TableRow key={weekId}>
                          <TableCell>{weekId}</TableCell>
                          {weekPivot.sedi.map((sede) => {
                            const cell = weekPivot.cells.get(weekId)?.get(sede);
                            if (!cell) return <TableCell key={`${weekId}-${sede}`} align="center">—</TableCell>;
                            const text = `${cell.enrolled} di ${cell.limit}`;
                            const progress = pct(cell.enrolled, cell.limit);
                            return (
                              <TableCell key={`${weekId}-${sede}`} align="center">
                                {text}
                                <LinearProgress
                                  variant="determinate"
                                  value={progress}
                                  sx={{ mt: 0.6, height: 6, borderRadius: 99 }}
                                />
                                {cell.waitlisted > 0 && (
                                  <Typography variant="caption" color="warning.main" display="block">
                                    attesa: {cell.waitlisted}
                                  </Typography>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Gite / uscite</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {tripStats.length === 0 ? (
              <Typography color="text.secondary">
                Nessuna configurazione `tripCapacity` attiva per questo modulo.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Campo gita (fieldId)</TableCell>
                      <TableCell>Opzione</TableCell>
                      <TableCell align="right">Iscritti / Max</TableCell>
                      <TableCell>Utilizzo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tripStats.map((r) => (
                      <TableRow key={`${r.fieldId}-${r.optionValue}`}>
                        <TableCell>{r.fieldId}</TableCell>
                        <TableCell>
                          {r.optionLabel} <Typography component="span" color="text.secondary">({r.optionValue})</Typography>
                        </TableCell>
                        <TableCell align="right">{`${r.enrolled} di ${r.limit}`}</TableCell>
                        <TableCell sx={{ minWidth: 180 }}>
                          <LinearProgress
                            variant="determinate"
                            value={pct(r.enrolled, r.limit)}
                            sx={{ height: 8, borderRadius: 99 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Gestione iscrizioni</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              Ricerca rapida sulle iscrizioni filtrate con accesso alla modifica sul sito pubblico.
            </Typography>
            {filteredSubmissions.length === 0 ? (
              <Typography color="text.secondary">Nessuna iscrizione trovata con i filtri correnti.</Typography>
            ) : (
              <TableContainer sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Data invio</TableCell>
                      <TableCell>ID gruppo</TableCell>
                      <TableCell>Nome/Cognome</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell align="right">Azioni</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSubmissions.slice(0, 60).map((s) => {
                      const r = s.responses ?? {};
                      const nome = typeof r.nome === 'string' ? r.nome : '';
                      const cognome = typeof r.cognome === 'string' ? r.cognome : '';
                      const email = typeof r.email === 'string' ? r.email : '';
                      const editToken = s.submissionGroupId || s.id;
                      const editUrl = buildPublicEditSubmissionUrl(editToken);
                      return (
                        <TableRow key={s.id}>
                          <TableCell>{formatSubmittedAt(s.submittedAt)}</TableCell>
                          <TableCell>{s.submissionGroupId ?? s.id}</TableCell>
                          <TableCell>{`${nome} ${cognome}`.trim() || '—'}</TableCell>
                          <TableCell>{email || '—'}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'inline-flex', gap: 1 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => openEditDialog(s)}
                                disabled={!canManageSubmissions}
                              >
                                Modifica inline
                              </Button>
                            {editUrl ? (
                              <Button size="small" variant="outlined" href={editUrl} target="_blank" rel="noreferrer">
                                Modifica su public
                              </Button>
                            ) : (
                              <Button size="small" variant="outlined" disabled>
                                Modifica su public
                              </Button>
                            )}
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => handleDelete(s)}
                                disabled={actionLoading || !canManageSubmissions}
                              >
                                Elimina
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              Export CSV/Excel disponibile nel pannello filtri in alto, sempre visibile durante la consultazione.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Lista d’attesa (dettaglio)</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {!waitlistConfig?.enabled ? (
              <Typography color="text.secondary">
                Abilita `enrollmentCapacity` per usare la lista d’attesa per sede/settimana.
              </Typography>
            ) : (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.5,
                    mb: 1.5,
                  }}
                >
                  <FormControl size="small">
                    <InputLabel id="waitlist-sede-label">Sede</InputLabel>
                    <Select
                      labelId="waitlist-sede-label"
                      value={waitlistSedeFilter}
                      label="Sede"
                      onChange={(e) => setWaitlistSedeFilter(String(e.target.value))}
                    >
                      {waitlistSediOptions.map((sede) => (
                        <MenuItem key={sede} value={sede}>
                          {sede}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small">
                    <InputLabel id="waitlist-week-label">Settimana</InputLabel>
                    <Select
                      labelId="waitlist-week-label"
                      value={waitlistWeekFilter}
                      label="Settimana"
                      onChange={(e) => setWaitlistWeekFilter(String(e.target.value))}
                    >
                      {waitlistWeekOptions.map((weekId) => (
                        <MenuItem key={weekId} value={weekId}>
                          {fieldLabelById(selectedModule!, weekId)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {waitlistRows.length === 0 ? (
                  <Typography color="text.secondary">
                    Nessun bambino in lista d’attesa per i filtri correnti.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Cognome nome</TableCell>
                          <TableCell>Data/ora compilazione</TableCell>
                          <TableCell>ID submission</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {waitlistRows.map((r) => (
                          <TableRow key={r.submissionId}>
                            <TableCell>{r.name}</TableCell>
                            <TableCell>{formatSubmittedAt(r.submittedAt)}</TableCell>
                            <TableCell>{r.submissionId}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </AccordionDetails>
        </Accordion>
        <Dialog open={!!editTarget} onClose={() => (actionLoading ? null : setEditTarget(null))} maxWidth="md" fullWidth>
          <DialogTitle>Modifica iscrizione (JSON risposte)</DialogTitle>
          <DialogContent>
            <TextField
              multiline
              minRows={14}
              fullWidth
              value={editJson}
              onChange={(e) => setEditJson(e.target.value)}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditTarget(null)} disabled={actionLoading}>Annulla</Button>
            <Button onClick={handleSaveEdit} variant="contained" disabled={actionLoading}>
              Salva modifica
            </Button>
          </DialogActions>
        </Dialog>
          </>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
