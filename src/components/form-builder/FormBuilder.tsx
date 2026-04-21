'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { Module, Step, Field, FieldType } from '@grest/shared';
import { createEmptyStep, createEmptyField } from '@/lib/defaults';
import { FIELD_TYPES, formatFieldTypeLabel } from '@/lib/field-types';
import { SortableStepItem } from './SortableStepItem';
import { PropertyPanel } from './PropertyPanel';
import { copyModuleJsonToClipboard, downloadModuleJson } from '@/lib/export-module-json';
import { ImportModuleJsonDialog } from './ImportModuleJsonDialog';
import { ModuleOptionsForm } from './ModuleOptionsForm';
import { parseStepFieldsDropId } from './dnd-ids';

type FieldDropTarget =
  | { toStepIndex: number; insertAt: number; kind: 'beforeField' }
  | { toStepIndex: number; kind: 'append' }
  | { toStepIndex: number; kind: 'prepend' };

function resolveFieldDropTarget(module: Module, overIdStr: string): FieldDropTarget | null {
  const dropStepId = parseStepFieldsDropId(overIdStr);
  if (dropStepId !== null) {
    const si = module.steps.findIndex((s) => s.id === dropStepId);
    if (si === -1) return null;
    return { toStepIndex: si, kind: 'append' };
  }
  for (let si = 0; si < module.steps.length; si++) {
    const fi = module.steps[si].fields.findIndex((f) => f.id === overIdStr);
    if (fi !== -1) {
      return { toStepIndex: si, insertAt: fi, kind: 'beforeField' };
    }
  }
  const si = module.steps.findIndex((s) => s.id === overIdStr);
  if (si !== -1) {
    return { toStepIndex: si, kind: 'prepend' };
  }
  return null;
}

interface FormBuilderProps {
  module: Module;
  onChange: (module: Module) => void;
}

export function FormBuilder({ module, onChange }: FormBuilderProps) {
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [selectedField, setSelectedField] = useState<{
    stepIndex: number;
    fieldIndex: number;
  } | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [importJsonOpen, setImportJsonOpen] = useState(false);
  /** Step la cui area campi è compressa (solo UI builder). */
  const [collapsedStepIds, setCollapsedStepIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const valid = new Set(module.steps.map((s) => s.id));
    setCollapsedStepIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      return next;
    });
  }, [module.steps]);

  const toggleStepCollapsed = useCallback((stepId: string) => {
    setCollapsedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  const expandAllSteps = useCallback(() => {
    setCollapsedStepIds(new Set());
  }, []);

  const collapseAllSteps = useCallback(() => {
    setCollapsedStepIds(new Set(module.steps.map((s) => s.id)));
  }, [module.steps]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const updateModule = useCallback(
    (updater: (m: Module) => Module) => onChange(updater(module)),
    [module, onChange]
  );

  const updateMeta = useCallback(
    (updater: (m: Module['meta']) => Module['meta']) =>
      updateModule((m) => ({ ...m, meta: updater(m.meta) })),
    [updateModule]
  );

  const updateStep = useCallback(
    (index: number, updater: (s: Step) => Step) =>
      updateModule((m) => ({
        ...m,
        steps: m.steps.map((s, i) => (i === index ? updater(s) : s)),
      })),
    [updateModule]
  );

  const updateField = useCallback(
    (stepIndex: number, fieldIndex: number, updater: (f: Field) => Field) =>
      updateStep(stepIndex, (s) => ({
        ...s,
        fields: s.fields.map((f, i) => (i === fieldIndex ? updater(f) : f)),
      })),
    [updateStep]
  );

  const updateModuleRoot = useCallback(
    (updater: (m: Module) => Module) => updateModule(updater),
    [updateModule]
  );

  const addStep = useCallback(() => {
    const newStep = createEmptyStep();
    const newIndex = module.steps.length;
    updateModule((m) => ({ ...m, steps: [...m.steps, newStep] }));
    setSelectedStepIndex(newIndex);
    setActiveStepIndex(newIndex);
    setSelectedField(null);
  }, [updateModule, module.steps.length]);

  const addField = useCallback(
    (type: FieldType) => {
      const index = Math.min(activeStepIndex, Math.max(0, module.steps.length - 1));
      if (index >= module.steps.length) return;
      const newField = createEmptyField(type);
      updateStep(index, (s) => ({ ...s, fields: [...s.fields, newField] }));
      setSelectedField({ stepIndex: index, fieldIndex: module.steps[index].fields.length });
      setSelectedStepIndex(index);
      setActiveStepIndex(index);
    },
    [activeStepIndex, module.steps, updateStep]
  );

  const removeStep = useCallback(
    (index: number) => {
      updateModule((m) => ({
        ...m,
        steps: m.steps.filter((_, i) => i !== index),
      }));
      const nextStep = Math.max(0, Math.min(activeStepIndex, module.steps.length - 2));
      setSelectedStepIndex(nextStep);
      setActiveStepIndex(nextStep);
      setSelectedField(null);
    },
    [activeStepIndex, module.steps.length, updateModule]
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as { type?: string; stepId?: string; stepIndex?: number } | undefined;
    if (activeData?.type === 'step') {
      const fromId = active.id as string;
      const toId = over.id as string;
      const fromIndex = module.steps.findIndex((s) => s.id === fromId);
      const toIndex = module.steps.findIndex((s) => s.id === toId);
      if (fromIndex === -1 || toIndex === -1) return;
      const steps = [...module.steps];
      const [removed] = steps.splice(fromIndex, 1);
      steps.splice(toIndex, 0, removed);
      updateModule((m) => ({ ...m, steps }));
      setSelectedStepIndex(toIndex);
      setActiveStepIndex(toIndex);
      return;
    }

    if (activeData?.type === 'field' && typeof activeData.stepIndex === 'number') {
      const fromStepIndex = activeData.stepIndex;
      const fieldId = String(active.id);
      const fromStep = module.steps[fromStepIndex];
      if (!fromStep) return;
      const fromFieldIndex = fromStep.fields.findIndex((f) => f.id === fieldId);
      if (fromFieldIndex === -1) return;

      const target = resolveFieldDropTarget(module, String(over.id));
      if (!target) return;

      const { toStepIndex } = target;

      if (fromStepIndex === toStepIndex) {
        if (target.kind === 'beforeField') {
          const toIdx = target.insertAt;
          if (fromFieldIndex === toIdx) return;
          updateStep(fromStepIndex, (s) => ({
            ...s,
            fields: arrayMove(s.fields, fromFieldIndex, toIdx),
          }));
          setSelectedField({ stepIndex: fromStepIndex, fieldIndex: toIdx });
          setActiveStepIndex(fromStepIndex);
          return;
        }
        if (target.kind === 'append') {
          const fields = [...module.steps[fromStepIndex].fields];
          const [removed] = fields.splice(fromFieldIndex, 1);
          fields.push(removed);
          updateStep(fromStepIndex, (s) => ({ ...s, fields }));
          setSelectedField({ stepIndex: fromStepIndex, fieldIndex: fields.length - 1 });
          setActiveStepIndex(fromStepIndex);
          return;
        }
        if (target.kind === 'prepend') {
          if (fromFieldIndex === 0) return;
          const fields = [...module.steps[fromStepIndex].fields];
          const [removed] = fields.splice(fromFieldIndex, 1);
          fields.splice(0, 0, removed);
          updateStep(fromStepIndex, (s) => ({ ...s, fields }));
          setSelectedField({ stepIndex: fromStepIndex, fieldIndex: 0 });
          setActiveStepIndex(fromStepIndex);
        }
        return;
      }

      let selectedIndex = 0;
      updateModule((m) => {
        const steps = m.steps.map((s) => ({ ...s, fields: [...s.fields] }));
        const [removed] = steps[fromStepIndex].fields.splice(fromFieldIndex, 1);
        let insertAt = 0;
        if (target.kind === 'beforeField') {
          insertAt = target.insertAt;
        } else if (target.kind === 'append') {
          insertAt = steps[toStepIndex].fields.length;
        } else {
          insertAt = 0;
        }
        steps[toStepIndex].fields.splice(insertAt, 0, removed);
        selectedIndex = insertAt;
        return { ...m, steps };
      });
      setSelectedField({ stepIndex: toStepIndex, fieldIndex: selectedIndex });
      setSelectedStepIndex(null);
      setActiveStepIndex(toStepIndex);
    }
  }

  const stepIds = module.steps.map((s) => s.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <Box sx={{ width: '100%', display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            const name = `${module.guid ?? module.id}.json`;
            downloadModuleJson(module, name);
            setSnackbar('JSON scaricato');
          }}
        >
          Esporta JSON (scarica)
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={async () => {
            try {
              await copyModuleJsonToClipboard(module);
              setSnackbar('JSON copiato negli appunti');
            } catch {
              setSnackbar('Copia non riuscita (permessi browser?)');
            }
          }}
        >
          Esporta JSON (copia)
        </Button>
        <Button variant="outlined" size="small" onClick={() => setImportJsonOpen(true)}>
          Importa JSON
        </Button>
      </Box>
      <ImportModuleJsonDialog
        open={importJsonOpen}
        currentModule={module}
        onClose={() => setImportJsonOpen(false)}
        onImported={(imported) => {
          onChange(imported);
          setSelectedStepIndex(null);
          setSelectedField(null);
          setActiveStepIndex(0);
          setSnackbar('Modulo importato dallo schema JSON');
        }}
      />
      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
      >
        <Typography variant="body2" sx={{ px: 1, py: 0.5 }}>
          {snackbar}
        </Typography>
      </Snackbar>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          alignItems: 'start',
          gridTemplateColumns: {
            xs: '1fr',
            md: '220px minmax(0,1fr)',
            lg: '200px minmax(0,1fr) 320px',
            xl: '220px minmax(0,1fr) 340px',
          },
        }}
      >
        {/* Palette */}
        <Paper
          variant="outlined"
          sx={{ p: 2, position: { md: 'sticky' }, top: { md: 82 }, height: 'fit-content' }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Aggiungi campo
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {FIELD_TYPES.map((t) => (
              <Button
                key={t}
                size="small"
                variant="outlined"
                title={t}
                onClick={() => addField(t)}
              >
                + {formatFieldTypeLabel(t)}
              </Button>
            ))}
          </Box>
          <Button fullWidth variant="outlined" sx={{ mt: 2 }} onClick={addStep}>
            + Aggiungi step
          </Button>
        </Paper>

        {/* Steps list */}
        <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
          <Accordion defaultExpanded disableGutters elevation={0} sx={{ mb: 2, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Opzioni modulo</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 0 }}>
              <ModuleOptionsForm
                module={module}
                onUpdateModule={updateModuleRoot}
                onUpdateMeta={updateMeta}
              />
            </AccordionDetails>
          </Accordion>
          <Typography variant="subtitle2" gutterBottom>
            Step e campi
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Trascina un campo su un altro step, sull’intestazione dello step o nell’area tratteggiata per spostarlo.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Button size="small" variant="text" onClick={expandAllSteps}>
              Espandi tutti gli step
            </Button>
            <Button size="small" variant="text" onClick={collapseAllSteps}>
              Comprimi tutti gli step
            </Button>
          </Box>
          <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
            {module.steps.map((step, idx) => (
              <SortableStepItem
                key={step.id}
                step={step}
                stepIndex={idx}
                stepsCount={module.steps.length}
                selectedStepIndex={selectedStepIndex}
                selectedField={selectedField}
                collapsed={collapsedStepIds.has(step.id)}
                onToggleCollapse={() => toggleStepCollapsed(step.id)}
                onSelectStep={(idx) => {
                  setSelectedStepIndex(idx);
                  setActiveStepIndex(idx);
                  setSelectedField(null);
                }}
                onSelectField={(stepIndex, fieldIndex) => {
                  setSelectedField({ stepIndex, fieldIndex });
                  setSelectedStepIndex(null);
                  setActiveStepIndex(stepIndex);
                }}
                onUpdateStep={updateStep}
                onDeleteStep={removeStep}
              />
            ))}
          </SortableContext>
        </Paper>

        {/* Property panel */}
        <Paper
          variant="outlined"
          sx={{
            minWidth: 0,
            width: '100%',
            maxWidth: { lg: 340 },
            justifySelf: { lg: 'end' },
            position: { lg: 'sticky' },
            top: { lg: 82 },
          }}
        >
          <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
            Proprietà
          </Typography>
          <PropertyPanel
            module={module}
            selectedStepIndex={selectedStepIndex}
            selectedField={selectedField}
            onUpdateStep={updateStep}
            onUpdateField={updateField}
          />
        </Paper>
      </Box>
    </DndContext>
  );
}
