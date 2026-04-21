'use client';

import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import type { Step } from '@grest/shared';
import { SortableFieldItem } from './SortableFieldItem';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { stepFieldsDropId } from './dnd-ids';

interface SortableStepItemProps {
  step: Step;
  stepIndex: number;
  stepsCount: number;
  selectedStepIndex: number | null;
  selectedField: { stepIndex: number; fieldIndex: number } | null;
  onSelectStep: (index: number) => void;
  onSelectField: (stepIndex: number, fieldIndex: number) => void;
  onUpdateStep: (index: number, updater: (s: Step) => Step) => void;
  onDeleteStep: (index: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SortableStepItem({
  step,
  stepIndex,
  selectedStepIndex,
  selectedField,
  onSelectStep,
  onSelectField,
  onUpdateStep,
  onDeleteStep,
  stepsCount,
  collapsed,
  onToggleCollapse,
}: SortableStepItemProps) {
  const canDeleteStep = stepsCount > 1;
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: step.id,
    data: { type: 'step', stepId: step.id },
  });

  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: stepFieldsDropId(step.id),
    data: { type: 'stepFieldDrop', stepIndex },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const fieldIds = step.fields.map((f) => f.id);

  return (
    <Paper
      ref={setSortableRef}
      style={style}
      elevation={isDragging ? 4 : 1}
      sx={{
        mb: 2,
        opacity: isDragging ? 0.8 : 1,
        border: selectedStepIndex === stepIndex ? 2 : 0,
        borderColor: 'primary.main',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          bgcolor: 'action.hover',
          cursor: 'pointer',
        }}
        onClick={() => onSelectStep(stepIndex)}
      >
        <IconButton size="small" {...attributes} {...listeners} sx={{ cursor: 'grab' }}>
          <DragIndicatorIcon />
        </IconButton>
        <Typography variant="subtitle1" sx={{ flex: 1 }}>
          {step.title?.it ?? step.id}
        </Typography>
        {step.repeatFromField && (
          <Chip size="small" label="Ripetuto N volte" sx={{ mr: 0.5 }} variant="outlined" />
        )}
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          title={collapsed ? 'Espandi step' : 'Comprimi step'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
        {canDeleteStep && (
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDeleteStep(stepIndex); }} title="Rimuovi step">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Collapse in={!collapsed} timeout="auto" unmountOnExit>
        <Box
          ref={setDropRef}
          sx={{
            px: 2,
            pb: 1,
            minHeight: step.fields.length === 0 ? 56 : undefined,
            borderRadius: 1,
            outline: isDropOver ? '2px dashed' : 'none',
            outlineColor: 'primary.main',
            outlineOffset: -2,
            bgcolor: isDropOver ? 'action.hover' : 'transparent',
            transition: 'background-color 0.15s ease',
          }}
        >
          <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
            {step.fields.map((field, fieldIndex) => (
              <SortableFieldItem
                key={field.id}
                field={field}
                stepIndex={stepIndex}
                fieldIndex={fieldIndex}
                isSelected={
                  selectedField?.stepIndex === stepIndex && selectedField?.fieldIndex === fieldIndex
                }
                onSelect={() => onSelectField(stepIndex, fieldIndex)}
                onUpdate={(updater) =>
                  onUpdateStep(stepIndex, (s) => ({
                    ...s,
                    fields: s.fields.map((f, i) => (i === fieldIndex ? updater(f) : f)),
                  }))
                }
                onRemove={() =>
                  onUpdateStep(stepIndex, (s) => ({
                    ...s,
                    fields: s.fields.filter((_, i) => i !== fieldIndex),
                  }))
                }
              />
            ))}
          </SortableContext>
        </Box>
      </Collapse>
    </Paper>
  );
}
