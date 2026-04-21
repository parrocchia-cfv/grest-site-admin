'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { Field } from '@grest/shared';
import { formatFieldTypeLabel } from '@/lib/field-types';

interface SortableFieldItemProps {
  field: Field;
  stepIndex: number;
  fieldIndex: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updater: (f: Field) => Field) => void;
  onRemove: () => void;
}

export function SortableFieldItem({
  field,
  stepIndex,
  fieldIndex,
  isSelected,
  onSelect,
  onRemove,
}: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: { type: 'field', fieldId: field.id, stepIndex },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const label =
    field.type === 'notice'
      ? (field.noticeText?.it ?? field.label?.it ?? field.id).replace(/\s+/g, ' ').trim().slice(0, 56)
      : field.label?.it ?? field.id;

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        alignItems: 'center',
        py: 0.5,
        px: 1,
        mb: 0.5,
        borderRadius: 1,
        bgcolor: isSelected ? 'primary.light' : 'background.paper',
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        opacity: isDragging ? 0.7 : 1,
        cursor: 'pointer',
      }}
      onClick={onSelect}
    >
      <IconButton size="small" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} sx={{ cursor: 'grab' }}>
        <DragIndicatorIcon />
      </IconButton>
      <Typography variant="body2" sx={{ flex: 1 }}>
        [{formatFieldTypeLabel(field.type)}] {label}
      </Typography>
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
