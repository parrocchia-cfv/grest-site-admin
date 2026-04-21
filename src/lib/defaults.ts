import type { Module, Step, Field, FieldType } from '@grest/shared';
import { randomUuid } from './uuid';

/** ID univoci per evitare collisioni con dnd-kit e con moduli caricati da API/import. */
function newStepId(): string {
  return `step_${randomUuid()}`;
}

function newFieldId(): string {
  return `field_${randomUuid()}`;
}

export function createEmptyModule(id?: string): Module {
  const opaqueId = id ?? randomUuid();
  const stepId = newStepId();
  return {
    id: opaqueId,
    guid: opaqueId,
    version: 1,
    meta: {
      title: { it: 'Nuovo modulo' },
      description: { it: '' },
      thankYou: {
        title: { it: 'Grazie' },
        body: { it: 'Risposta ricevuta.' },
        notes: { it: '' },
      },
    },
    steps: [
      {
        id: stepId,
        title: { it: 'Step 1' },
        fields: [],
      },
    ],
  };
}

export function createEmptyStep(): Step {
  return {
    id: newStepId(),
    title: { it: 'Nuovo step' },
    fields: [],
  };
}

export function createEmptyField(type: FieldType): Field {
  if (type === 'notice') {
    return {
      id: newFieldId(),
      type: 'notice',
      label: { it: 'Avviso' },
      required: false,
      noticeVariant: 'info',
      noticeText: { it: 'Testo visibile all’utente (nessun campo da compilare).' },
    };
  }
  return {
    id: newFieldId(),
    type,
    label: { it: 'Nuovo campo' },
    required: false,
  };
}

/** Reset contatori legacy (no-op se non usati); utile per test o pagina /forms/new isolata. */
export function resetCounters() {
  /* step/field usano UUID; niente contatori globali. */
}
