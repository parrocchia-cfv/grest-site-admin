import type { Module } from '@grest/shared';

/**
 * Slug pubblico (segmento query `guid`) per il sito pubblico: `/form?guid=…`
 * (export statico / GitHub Pages compatibile).
 */
export function getPublicFormSlug(module: Pick<Module, 'id' | 'guid'>): string {
  return module.guid?.trim() || module.id;
}

export function getPublicFormUrl(module: Pick<Module, 'id' | 'guid'>): string | null {
  const base = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (!base) return null;
  const slug = getPublicFormSlug(module);
  return `${base}/form?guid=${encodeURIComponent(slug)}`;
}

/**
 * Stesso `NEXT_PUBLIC_PUBLIC_SITE_URL` del sito pubblico; slash finale opzionale.
 * `editToken`: preferisci `submissionGroupId` dalla submission; altrimenti `submissions.id`.
 */
export function buildPublicEditSubmissionUrl(editToken: string): string | null {
  const base = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') ?? '';
  const id = editToken?.trim();
  if (!base || !id) return null;
  const root = base.endsWith('/') ? base : `${base}/`;
  return new URL(`modifica?group=${encodeURIComponent(id)}`, root).href;
}
