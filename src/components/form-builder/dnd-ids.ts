/** Droppable id for a step’s field list (append / empty step). Must not collide with field or step sortable ids. */
const PREFIX = 'step-fields-dropzone:';

export function stepFieldsDropId(stepId: string): string {
  return `${PREFIX}${stepId}`;
}

export function parseStepFieldsDropId(overId: string): string | null {
  if (!overId.startsWith(PREFIX)) return null;
  return overId.slice(PREFIX.length);
}
