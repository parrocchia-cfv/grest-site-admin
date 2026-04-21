/**
 * Admin frontend always uses real backend API.
 */
function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base || base.trim() === '') {
    throw new Error(
      'Missing NEXT_PUBLIC_API_URL. Set it in apps/admin/.env.local (example: http://localhost:8000).'
    );
  }
  return base.replace(/\/+$/, '');
}

export const apiConfig = {
  get baseUrl(): string {
    return getApiBase();
  },
};
