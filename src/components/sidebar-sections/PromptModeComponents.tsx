import React from 'react';
import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  TextField,
  Button,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { PromptsMetadata } from '../../lib/api';

export type PromptMode = 'template' | 'dynamic';

interface PromptModeSelectorProps {
  mode: PromptMode;
  onModeChange: (mode: PromptMode) => void;
  disabled?: boolean;
}

export function PromptModeSelector({ mode, onModeChange, disabled }: PromptModeSelectorProps) {
  return (
    <Box sx={{ mb: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={mode === 'dynamic'}
            onChange={(e) => onModeChange(e.target.checked ? 'dynamic' : 'template')}
            disabled={disabled}
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2">Expand task description</Typography>
            <Tooltip title="AI will analyze sample conversations to expand your task description into a detailed, custom prompt">
              <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </Tooltip>
          </Box>
        }
      />
    </Box>
  );
}

interface TemplatePromptsSectionProps {
  taskDescription: string;
  onTaskDescriptionChange: (value: string) => void;
  onResetToDefault?: () => void;
  onFullscreenClick?: () => void;
  method: 'single_model' | 'side_by_side' | null;
  disabled?: boolean;
}

export function TemplatePromptsSection({
  taskDescription,
  onTaskDescriptionChange,
  onResetToDefault,
  onFullscreenClick,
  method,
  disabled,
}: TemplatePromptsSectionProps) {
  const placeholder = method === 'side_by_side'
    ? 'Describe the task for comparing two models (e.g., "Compare customer service responses from two chatbots")'
    : 'Describe the task for analyzing model behavior (e.g., "Analyze customer service chatbot responses")';

  return (
    <Box>
      {/* Task Description Input */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2">Task Description</Typography>
          <Tooltip title="Used to customize the template prompt for your specific use case">
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </Tooltip>
          {onFullscreenClick && (
            <IconButton
              size="small"
              onClick={onFullscreenClick}
              sx={{ ml: 'auto' }}
              title="Expand to full screen"
            >
              <FullscreenIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
        <TextField
          fullWidth
          multiline
          rows={5}
          size="small"
          placeholder={placeholder}
          value={taskDescription}
          onChange={(e) => onTaskDescriptionChange(e.target.value)}
          disabled={disabled}
        />
        {onResetToDefault && (
          <Box sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="text"
              onClick={onResetToDefault}
            >
              Reset to default
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}

interface DynamicPromptsSectionProps {
  taskDescription: string;
  onTaskDescriptionChange: (value: string) => void;
  onResetToDefault?: () => void;
  onFullscreenClick?: () => void;
  expandedTaskDescription: string | null;
  method: 'single_model' | 'side_by_side' | null;
  disabled?: boolean;
}

export function DynamicPromptsSection({
  taskDescription,
  onTaskDescriptionChange,
  onResetToDefault,
  onFullscreenClick,
  expandedTaskDescription,
  method,
  disabled,
}: DynamicPromptsSectionProps) {
  const placeholder = method === 'side_by_side'
    ? 'Describe the task for comparing two models (e.g., "Compare customer service responses from two chatbots")'
    : 'Describe the task for analyzing model behavior (e.g., "Analyze customer service chatbot responses")';

  return (
    <Box>
      {/* Task Description Input */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2">Task Description</Typography>
          <Tooltip title="Your task description will be automatically expanded using sample conversations when you run extraction">
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </Tooltip>
          {onFullscreenClick && (
            <IconButton
              size="small"
              onClick={onFullscreenClick}
              sx={{ ml: 'auto' }}
              title="Expand to full screen"
            >
              <FullscreenIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
        <TextField
          fullWidth
          multiline
          rows={5}
          size="small"
          placeholder={placeholder}
          value={taskDescription}
          onChange={(e) => onTaskDescriptionChange(e.target.value)}
          disabled={disabled}
        />
        {onResetToDefault && (
          <Box sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="text"
              onClick={onResetToDefault}
            >
              Reset to default
            </Button>
          </Box>
        )}
      </Box>

      {/* Show updated task description if available */}
      {expandedTaskDescription && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">View Task Description</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              sx={{
                p: 1.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                maxHeight: 200,
                overflow: 'auto',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {expandedTaskDescription}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}

