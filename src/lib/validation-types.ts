/**
 * Validation types for builder dropdown (contratti_e_convenzioni.md §3).
 */
export const VALIDATION_TYPES = [
  'generic',
  'nome_it',
  'cognome_it',
  'codice_fiscale',
  'partita_iva',
  'email',
  'telefono_it',
  'cap_it',
] as const;

export type ValidationType = (typeof VALIDATION_TYPES)[number];
