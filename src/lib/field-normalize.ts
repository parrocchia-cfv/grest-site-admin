import type { Field, FieldType } from '@grest/shared';

/** Fields that don't use placeholder in the public form UI. */
export function typeUsesPlaceholder(type: FieldType): boolean {
  return type === 'text' || type === 'email' || type === 'number' || type === 'textarea';
}

/** Fields where JSON validation string is meaningful. */
export function typeUsesValidation(type: FieldType): boolean {
  return type === 'text' || type === 'email' || type === 'number' || type === 'textarea';
}

/**
 * Strip or keep properties when field type changes (admin builder).
 */
export function normalizeFieldForType(field: Field, type: FieldType): Field {
  let next: Field = { ...field, type };

  if (!typeUsesPlaceholder(type)) {
    const { placeholder: _p, ...rest } = next;
    next = rest as Field;
  }

  if (!typeUsesValidation(type)) {
    const { validation: _v, ...rest } = next;
    next = rest as Field;
  }

  if (type !== 'select' && type !== 'radio' && type !== 'checkbox-group') {
    const { options: _o, ...rest } = next;
    next = rest as Field;
  }

  if (type !== 'select') {
    const { selectOther: _so, ...rest } = next;
    next = rest as Field;
  }

  if (type !== 'number') {
    const { min: _min, max: _max, ...rest } = next;
    next = rest as Field;
  }

  if (type !== 'notice') {
    const { noticeVariant: _nv, noticeText: _nt, ...rest } = next;
    next = rest as Field;
  }

  if (type === 'notice') {
    return {
      ...next,
      type: 'notice',
      required: false,
      noticeVariant: next.noticeVariant ?? 'info',
      noticeText: next.noticeText ?? next.label ?? { it: '' },
    };
  }

  return next;
}
