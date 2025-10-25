import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
  Button,
  Alert,
  Divider,
  FormHelperText,
  Checkbox,
  ListItemText
} from '@mui/material';

export interface ColumnMapping {
  promptCol: string;
  responseCols: string[];
  modelCols: string[];
  scoreCols: string[];
  method: 'single_model' | 'side_by_side';
  selectedModels?: { column: string; modelA: string; modelB: string };
}

interface ColumnSelectorProps {
  columns: string[];
  rows: Record<string, any>[];
  onMappingChange: (mapping: ColumnMapping) => void;
  onValidationChange: (isValid: boolean, errors: string[]) => void;
  autoDetectedMapping?: ColumnMapping;
}

export function ColumnSelector({ 
  columns, 
  rows,
  onMappingChange, 
  onValidationChange,
  autoDetectedMapping 
}: ColumnSelectorProps) {
  const [mapping, setMapping] = useState<ColumnMapping>({
    promptCol: '',
    responseCols: [],
    modelCols: [],
    scoreCols: [],
    method: 'single_model'
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [useAutoDetection, setUseAutoDetection] = useState(true);

  // Initialize with auto-detected mapping if available
  useEffect(() => {
    if (autoDetectedMapping && useAutoDetection) {
      setMapping(autoDetectedMapping);
    }
  }, [autoDetectedMapping, useAutoDetection]);

  // Validate mapping and notify parent
  useEffect(() => {
    const newErrors = validateMapping(mapping);
    setErrors(newErrors);
    const isValid = newErrors.length === 0;
    onValidationChange(isValid, newErrors);
    // Do not auto-apply mapping; wait for explicit user action (Done)
  }, [mapping, onValidationChange]);

  const validateMapping = (currentMapping: ColumnMapping): string[] => {
    const errors: string[] = [];
    
    if (!currentMapping.promptCol) {
      errors.push('Please select a prompt column');
    }
    
    if (currentMapping.responseCols.length === 0) {
      errors.push('Please select at least one response column');
    }
    
    if (currentMapping.method === 'side_by_side') {
      const hasLegacySbs = currentMapping.responseCols.length === 2;
      const hasTidyPair = Boolean(currentMapping.selectedModels && currentMapping.modelCols.length >= 1 && currentMapping.responseCols.length >= 1);
      if (!hasLegacySbs && !hasTidyPair) {
        errors.push('For side-by-side: either select exactly 2 response columns (legacy), or choose a model column and select Model A/B.');
      }
      if (hasLegacySbs && currentMapping.modelCols.length > 0 && currentMapping.modelCols.length !== 2) {
        errors.push('Legacy side-by-side requires exactly 2 model columns when specified');
      }
    } else {
      if (currentMapping.responseCols.length > 1) {
        errors.push('Single model format should have exactly 1 response column');
      }
      if (currentMapping.modelCols.length > 1) {
        errors.push('Single model format should have at most 1 model column');
      }
    }
    // Optional pair validation only for side-by-side tidy path
    if (currentMapping.method === 'side_by_side' && currentMapping.selectedModels) {
      const { modelA, modelB } = currentMapping.selectedModels;
      if (!modelA || !modelB) {
        errors.push('Please select both Model A and Model B or clear the selection.');
      } else if (modelA === modelB) {
        errors.push('Model A and Model B must be different');
      }
    }
    
    return errors;
  };

  const handlePromptChange = (event: any) => {
    setMapping(prev => ({ ...prev, promptCol: event.target.value }));
    setUseAutoDetection(false);
  };

  const handleMethodChange = (event: any) => {
    const newMethod = event.target.value as 'single_model' | 'side_by_side';
    setMapping(prev => ({ 
      ...prev, 
      method: newMethod,
      // Reset response and model cols when method changes
      responseCols: newMethod === 'side_by_side' ? prev.responseCols.slice(0, 2) : prev.responseCols.slice(0, 1),
      modelCols: newMethod === 'side_by_side' ? prev.modelCols.slice(0, 2) : prev.modelCols.slice(0, 1)
    }));
    setUseAutoDetection(false);
  };

  const handleResponseChange = (event: any) => {
    const value = typeof event.target.value === 'string' ? [event.target.value] : event.target.value;
    const maxCols = mapping.method === 'side_by_side' ? 2 : 1;
    setMapping(prev => ({ ...prev, responseCols: value.slice(0, maxCols) }));
    setUseAutoDetection(false);
  };

  const handleModelChange = (event: any) => {
    const value = typeof event.target.value === 'string' ? [event.target.value] : event.target.value;
    const maxCols = mapping.method === 'side_by_side' ? 2 : 1;
    setMapping(prev => ({ ...prev, modelCols: value.slice(0, maxCols), selectedModels: undefined }));
    setUseAutoDetection(false);
  };

  const handleScoreChange = (event: any) => {
    const value = typeof event.target.value === 'string' ? [event.target.value] : event.target.value;
    setMapping(prev => ({ ...prev, scoreCols: value }));
    setUseAutoDetection(false);
  };

  const resetToAutoDetection = () => {
    if (autoDetectedMapping) {
      setMapping(autoDetectedMapping);
      setUseAutoDetection(true);
    }
  };

  const getAvailableColumns = (excludeColumns: string[] = []) => {
    return columns.filter(col => !excludeColumns.includes(col));
  };

  // Compute unique model names for the currently selected model column
  const availableModels = React.useMemo(() => {
    const col = mapping.modelCols[0];
    if (!col) return [] as string[];
    const s = new Set<string>();
    rows.forEach(r => { const v = r?.[col]; if (v !== null && v !== undefined) s.add(String(v)); });
    return Array.from(s).sort();
  }, [mapping.modelCols, rows]);

  const renderChips = (selectedCols: string[], color: 'primary' | 'secondary' = 'primary', onDelete?: (col: string) => void) => {
    return selectedCols.map(col => (
      <Chip 
        key={col} 
        label={col} 
        size="small" 
        color={color}
        onDelete={onDelete ? () => onDelete(col) : undefined}
        sx={{ mr: 0.5, mb: 0.5 }}
      />
    ));
  };

  return (
    <Box sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Column Mapping</Typography>
        {autoDetectedMapping && !useAutoDetection && (
          <Button 
            size="small" 
            variant="outlined" 
            onClick={resetToAutoDetection}
          >
            Reset to Auto-Detection
          </Button>
        )}
      </Box>

      {autoDetectedMapping && useAutoDetection && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Auto-detected column mapping. You can modify the selections below if needed.
        </Alert>
      )}

      {/* Method Selection */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Comparison Method</InputLabel>
        <Select
          value={mapping.method}
          label="Comparison Method"
          onChange={handleMethodChange}
        >
          <MenuItem value="single_model">Single Model Analysis</MenuItem>
          <MenuItem value="side_by_side">Side-by-Side Comparison</MenuItem>
        </Select>
        <FormHelperText>
          {mapping.method === 'single_model' 
            ? 'Analyze responses from individual models'
            : 'Compare responses between two models'
          }
        </FormHelperText>
      </FormControl>

      <Divider sx={{ my: 2 }} />

      {/* Prompt Column */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Prompt Column *</InputLabel>
        <Select
          value={mapping.promptCol}
          label="Prompt Column *"
          onChange={handlePromptChange}
        >
          {columns.map(col => (
            <MenuItem key={col} value={col}>{col}</MenuItem>
          ))}
        </Select>
        <FormHelperText>Column containing the input prompts/questions</FormHelperText>
      </FormControl>

      {/* Response Columns */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>
          Response Column{mapping.method === 'side_by_side' ? 's' : ''} *
        </InputLabel>
        <Select
          multiple={mapping.method === 'side_by_side'}
          value={mapping.method === 'side_by_side' ? mapping.responseCols : mapping.responseCols[0] || ''}
          label={`Response Column${mapping.method === 'side_by_side' ? 's' : ''} *`}
          onChange={handleResponseChange}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
              {mapping.method === 'side_by_side' 
                ? renderChips(Array.isArray(selected) ? selected : [selected])
                : selected
              }
            </Box>
          )}
        >
          {getAvailableColumns([mapping.promptCol]).map(col => (
            <MenuItem key={col} value={col}>{col}</MenuItem>
          ))}
        </Select>
        <FormHelperText>
          {mapping.method === 'side_by_side' 
            ? 'Option A: select exactly 2 response columns (legacy). Option B: select a model column below and choose Model A/B.'
            : 'Column containing the model response'
          }
        </FormHelperText>
      </FormControl>

      {/* Model Columns */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>
          Model Column{mapping.method === 'side_by_side' ? 's' : ''} (Optional)
        </InputLabel>
        <Select
          multiple={mapping.method === 'side_by_side'}
          value={mapping.method === 'side_by_side' ? mapping.modelCols : mapping.modelCols[0] || ''}
          label={`Model Column${mapping.method === 'side_by_side' ? 's' : ''} (Optional)`}
          onChange={handleModelChange}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
              {mapping.method === 'side_by_side' 
                ? renderChips(Array.isArray(selected) ? selected : [selected], 'secondary')
                : selected
              }
            </Box>
          )}
        >
          {getAvailableColumns([mapping.promptCol, ...mapping.responseCols]).map(col => (
            <MenuItem key={col} value={col}>{col}</MenuItem>
          ))}
        </Select>
        <FormHelperText>
          {mapping.method === 'side_by_side' 
            ? 'Optional: Select 2 columns containing model names (will use "Model A", "Model B" if not specified)'
            : 'Optional: Column containing model names (will use "unknown" if not specified)'
          }
        </FormHelperText>
      </FormControl>

      {/* Model A/B pickers only when method is side_by_side (tidy path) */}
      {mapping.method === 'side_by_side' && mapping.modelCols[0] && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Compare Two Models (Optional)</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Model A</InputLabel>
              <Select
                value={mapping.selectedModels?.modelA || ''}
                label="Model A"
                onChange={(e) => {
                  const modelA = String(e.target.value);
                  setMapping(prev => ({ ...prev, selectedModels: { column: prev.modelCols[0], modelA, modelB: prev.selectedModels?.modelB || '' } }));
                  setUseAutoDetection(false);
                }}
              >
                {availableModels.map(m => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Model B</InputLabel>
              <Select
                value={mapping.selectedModels?.modelB || ''}
                label="Model B"
                onChange={(e) => {
                  const modelB = String(e.target.value);
                  setMapping(prev => ({ ...prev, selectedModels: { column: prev.modelCols[0], modelA: prev.selectedModels?.modelA || '', modelB } }));
                  setUseAutoDetection(false);
                }}
              >
                {availableModels.map(m => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          {mapping.selectedModels?.modelA && mapping.selectedModels?.modelB && mapping.selectedModels.modelA === mapping.selectedModels.modelB && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Model A and Model B should be different.
            </Alert>
          )}
        </>
      )}

      {/* Score Columns */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Score Columns (Optional)</InputLabel>
        <Select
          multiple
          value={mapping.scoreCols}
          label="Score Columns (Optional)"
          onChange={handleScoreChange}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
              {renderChips(selected, 'secondary', (col) => {
                setMapping(prev => ({ ...prev, scoreCols: prev.scoreCols.filter(c => c !== col) }));
                setUseAutoDetection(false);
              })}
            </Box>
          )}
          MenuProps={{
            PaperProps: { sx: { maxHeight: 360 } }
          }}
        >
          {getAvailableColumns([mapping.promptCol, ...mapping.responseCols, ...mapping.modelCols]).map(col => (
            <MenuItem key={col} value={col}>
              <Checkbox checked={mapping.scoreCols.indexOf(col) > -1} />
              <ListItemText primary={col} />
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          Select one or more metrics. Checked items are included. Click Done to apply.
        </FormHelperText>
      </FormControl>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Please fix the following issues:</Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Summary */}
      {errors.length === 0 && mapping.promptCol && mapping.responseCols.length > 0 && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Ready to process:</Typography>
          <Typography variant="body2">
            <strong>Method:</strong> {mapping.method === 'single_model' ? 'Single Model' : 'Side-by-Side'}<br/>
            <strong>Prompt:</strong> {mapping.promptCol}<br/>
            <strong>Response{mapping.method === 'side_by_side' ? 's' : ''}:</strong> {mapping.responseCols.join(', ')}<br/>
            {mapping.modelCols.length > 0 && (
              <>
                <strong>Model{mapping.method === 'side_by_side' ? 's' : ''}:</strong> {mapping.modelCols.join(', ')}<br/>
              </>
            )}
            {mapping.scoreCols.length > 0 && (
              <>
                <strong>Scores:</strong> {mapping.scoreCols.join(', ')}
              </>
            )}
          </Typography>
        </Alert>
      )}

      {/* Persistent footer action */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        {(() => {
          const isLegacySbs = mapping.method === 'side_by_side' && mapping.responseCols.length === 2;
          const isTidySbs = mapping.method === 'side_by_side' 
            && mapping.responseCols.length >= 1 
            && mapping.modelCols.length >= 1 
            && Boolean(mapping.selectedModels?.modelA) 
            && Boolean(mapping.selectedModels?.modelB) 
            && mapping.selectedModels!.modelA !== mapping.selectedModels!.modelB;
          const sideBySideOk = mapping.method !== 'side_by_side' || isLegacySbs || isTidySbs;
          const legacySbsModelColsOk = !(mapping.method === 'side_by_side' && isLegacySbs && mapping.modelCols.length > 0 && mapping.modelCols.length !== 2);
          const singleOk = mapping.method !== 'single_model' || (mapping.responseCols.length === 1 && mapping.modelCols.length <= 1);
          var disable = !mapping.promptCol 
            || mapping.responseCols.length === 0 
            || !singleOk 
            || !sideBySideOk 
            || !legacySbsModelColsOk 
            || errors.length > 0;
          return null;
        })()}
        <Button
          variant="contained"
          color="primary"
          onClick={() => onMappingChange(mapping)}
          disabled={(() => {
            const isLegacySbs = mapping.method === 'side_by_side' && mapping.responseCols.length === 2;
            const isTidySbs = mapping.method === 'side_by_side' 
              && mapping.responseCols.length >= 1 
              && mapping.modelCols.length >= 1 
              && Boolean(mapping.selectedModels?.modelA) 
              && Boolean(mapping.selectedModels?.modelB) 
              && mapping.selectedModels!.modelA !== mapping.selectedModels!.modelB;
            const sideBySideOk = mapping.method !== 'side_by_side' || isLegacySbs || isTidySbs;
            const legacySbsModelColsOk = !(mapping.method === 'side_by_side' && isLegacySbs && mapping.modelCols.length > 0 && mapping.modelCols.length !== 2);
            const singleOk = mapping.method !== 'single_model' || (mapping.responseCols.length === 1 && mapping.modelCols.length <= 1);
            return !mapping.promptCol
              || mapping.responseCols.length === 0
              || !singleOk
              || !sideBySideOk
              || !legacySbsModelColsOk
              || errors.length > 0;
          })()}
        >
          Done
        </Button>
      </Box>
    </Box>
  );
}
