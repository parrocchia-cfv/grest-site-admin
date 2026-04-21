'use client';

import { useCallback, useId, useRef, useState } from 'react';
import type { Module } from '@grest/shared';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import {
  mergeImportedWithCurrent,
  parseModuleJson,
  readJsonFileAsText,
} from '@/lib/import-module-json';

export interface ImportModuleJsonDialogProps {
  open: boolean;
  currentModule: Module;
  onClose: () => void;
  onImported: (module: Module) => void;
}

export function ImportModuleJsonDialog({
  open,
  currentModule,
  onClose,
  onImported,
}: ImportModuleJsonDialogProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [keepIds, setKeepIds] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resetAndClose = useCallback(() => {
    setText('');
    setError(null);
    setKeepIds(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }, [onClose]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const content = await readJsonFileAsText(file);
      setText(content);
    } catch {
      setError('Impossibile leggere il file.');
    }
  }, []);

  const handleConfirm = useCallback(() => {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Incolla il JSON oppure scegli un file .json.');
      return;
    }
    const parsed = parseModuleJson(trimmed);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const merged = mergeImportedWithCurrent(parsed.module, currentModule, keepIds);
    onImported(merged);
    resetAndClose();
  }, [text, keepIds, currentModule, onImported, resetAndClose]);

  return (
    <Dialog open={open} onClose={resetAndClose} fullWidth maxWidth="md">
      <DialogTitle>Importa modulo da JSON</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Incolla lo schema esportato o scegli un file prodotto da «Esporta JSON» o da{' '}
          <code>docs/samples/</code>. Verifica il contenuto prima di salvare sul server.
        </Typography>
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={handleFile}
        />
        <label htmlFor={fileInputId}>
          <Button variant="outlined" component="span" size="small" sx={{ mb: 2 }}>
            Scegli file…
          </Button>
        </label>
        <TextField
          fullWidth
          multiline
          minRows={12}
          maxRows={24}
          label="JSON del modulo"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder='{ "id": "...", "version": 1, "meta": { ... }, "steps": [ ... ] }'
          InputProps={{ sx: { fontFamily: 'ui-monospace, monospace', fontSize: 13 } }}
        />
        <FormControlLabel
          sx={{ mt: 1, alignItems: 'flex-start' }}
          control={
            <Checkbox
              checked={keepIds}
              onChange={(e) => setKeepIds(e.target.checked)}
            />
          }
          label={
            <span>
              Mantieni <strong>ID</strong> e <strong>GUID</strong> del modulo attualmente aperto
              (consigliato in modifica, così il salvataggio resta sul record corretto)
            </span>
          }
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={resetAndClose}>Annulla</Button>
        <Button variant="contained" onClick={handleConfirm}>
          Importa
        </Button>
      </DialogActions>
    </Dialog>
  );
}
