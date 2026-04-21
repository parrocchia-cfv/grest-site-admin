import type { Module } from '@grest/shared';

export function moduleToJsonString(module: Module, pretty = true): string {
  return JSON.stringify(module, null, pretty ? 2 : undefined);
}

export function downloadModuleJson(module: Module, filename = 'module.json'): void {
  const blob = new Blob([moduleToJsonString(module, true)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'module.json';
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyModuleJsonToClipboard(module: Module): Promise<void> {
  await navigator.clipboard.writeText(moduleToJsonString(module, true));
}
