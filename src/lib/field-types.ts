import type { FieldType } from '@grest/shared';

export const FIELD_TYPES: FieldType[] = [
  'text',
  'email',
  'number',
  'textarea',
  'select',
  'radio',
  'checkbox-group',
  'checkbox',
  'switch',
  'date',
  'notice',
];

/** Etichette leggibili nel builder (il valore tecnico resta `FieldType`). */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Testo breve',
  email: 'Email',
  number: 'Numero',
  textarea: 'Testo lungo',
  select: 'Elenco a discesa (dropdown)',
  radio: 'Scelta singola (radio)',
  'checkbox-group': 'Scelta multipla (checkbox)',
  checkbox: 'Checkbox',
  switch: 'Interruttore (sì/no)',
  date: 'Data',
  notice: 'Testo informativo (avviso, solo lettura)',
};

export function formatFieldTypeLabel(type: FieldType): string {
  return FIELD_TYPE_LABELS[type] ?? type;
}
