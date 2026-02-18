import React, { useState } from 'react';
import { Box, TextField, Stack, Autocomplete, Button, FormControlLabel, Switch, Chip, CircularProgress, Typography, IconButton } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

interface Filter {
  column: string;
  values: string[];
  negated: boolean;
  operator?: 'AND' | 'OR'; // Operator to use BEFORE this filter (undefined for first filter)
}

export interface NlSuggestion {
  code: string;
  explanation: string;
}

interface FilterBarProps {
  // Search functionality
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  
  // Dynamic column-based filtering (for data tab)
  categoricalColumns?: string[];
  pendingColumn?: string | null;
  pendingValues?: string[];
  pendingNegated?: boolean;
  onPendingColumnChange?: (column: string | null) => void;
  onPendingValuesChange?: (values: string[]) => void;
  onPendingNegatedChange?: (negated: boolean) => void;
  onAddFilter?: () => void;
  filters?: Filter[];
  onRemoveFilter?: (index: number) => void;
  onChangeFilterOperator?: (index: number, operator: 'AND' | 'OR') => void;
  uniqueValuesFor?: (column: string) => string[];
  
  // Fixed column filtering (for properties tab)
  fixedFilters?: {
    label: string;
    options: string[];
    value: string[];
    onChange: (values: string[]) => void;
  }[];
  
  // Results count
  resultCount?: number;
  resultLabel?: string;
  
  // Additional controls (for data tab)
  showGroupBy?: boolean;
  groupByOptions?: string[];
  groupByValue?: string | null;
  onGroupByChange?: (value: string | null) => void;
  
  showCustomCode?: boolean;
  customCodeValue?: string;
  onCustomCodeChange?: (value: string) => void;
  onCustomCodeRun?: () => void;
  onReset?: () => void;
  customCodeError?: string | null;

  // Natural language to pandas
  showNlQuery?: boolean;
  nlQueryLoading?: boolean;
  nlSuggestion?: NlSuggestion | null;
  nlError?: string | null;
  onNlQuerySubmit?: (query: string) => void;
  onAcceptNlCode?: (code: string) => void;
  onRejectNlCode?: () => void;
}

export default function FilterBar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search',
  categoricalColumns = [],
  pendingColumn,
  pendingValues = [],
  pendingNegated = false,
  onPendingColumnChange,
  onPendingValuesChange,
  onPendingNegatedChange,
  onAddFilter,
  filters: _filters = [],
  onRemoveFilter: _onRemoveFilter,
  onChangeFilterOperator: _onChangeFilterOperator,
  uniqueValuesFor,
  fixedFilters = [],
  resultCount,
  resultLabel = 'results',
  showGroupBy = false,
  groupByOptions = [],
  groupByValue,
  onGroupByChange,
  showCustomCode = false,
  customCodeValue = '',
  onCustomCodeChange,
  onCustomCodeRun,
  onReset,
  customCodeError,
  showNlQuery = false,
  nlQueryLoading = false,
  nlSuggestion = null,
  nlError = null,
  onNlQuerySubmit,
  onAcceptNlCode,
  onRejectNlCode,
}: FilterBarProps) {

  const [nlQueryText, setNlQueryText] = useState('');
  const [editedCode, setEditedCode] = useState('');

  React.useEffect(() => {
    if (nlSuggestion) {
      setEditedCode(nlSuggestion.code);
    }
  }, [nlSuggestion]);

  const handleNlSubmit = () => {
    if (!nlQueryText.trim() || nlQueryLoading) return;
    onNlQuerySubmit?.(nlQueryText.trim());
  };

  const handleAccept = () => {
    onAcceptNlCode?.(editedCode);
    setNlQueryText('');
  };

  const handleReject = () => {
    onRejectNlCode?.();
  };

  return (
    <Box sx={{
      pb: 1.5,
      mb: 2,
      borderBottom: '2px solid',
      borderColor: '#D1D5DB',
      width: '100%',
      maxWidth: '100vw',
      overflow: 'hidden'
    }}>
      {/* Row 1: Search, Filters, Group By */}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} alignItems={{ xs: 'stretch', lg: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          
          {/* Search Bar */}
          {onSearchChange && (
            <TextField 
              size="small" 
              label={searchPlaceholder}
              value={searchValue} 
              onChange={(e) => onSearchChange(e.target.value)} 
              sx={{ minWidth: 200 }} 
            />
          )}
          
          {/* Dynamic Column-based Filters (Data Tab) */}
          {categoricalColumns.length > 0 && (
            <>
              <Autocomplete
                size="small"
                sx={{ minWidth: 180, maxWidth: 220, flex: '0 1 auto' }}
                options={categoricalColumns}
                value={pendingColumn}
                onChange={(_, v) => onPendingColumnChange?.(v)}
                renderInput={(params) => <TextField {...params} label="Add filter (column)" />}
              />
              {pendingColumn && (
                <Autocomplete
                  multiple 
                  size="small"
                  sx={{ minWidth: 200, maxWidth: 300, flex: '0 1 auto' }}
                  options={uniqueValuesFor?.(pendingColumn) || []}
                  value={pendingValues}
                  onChange={(_, v) => onPendingValuesChange?.(v)}
                  renderTags={(value, getTagProps) => value.map((option, index) => (
                    <Chip {...getTagProps({ index })} key={option} label={option} />
                  ))}
                  renderInput={(params) => <TextField {...params} label="Values" />}
                />
              )}
              {pendingColumn && (
                <FormControlLabel 
                  control={<Switch checked={pendingNegated} onChange={(_, c) => onPendingNegatedChange?.(c)} />} 
                  label="NOT" 
                />
              )}
              <Button
                variant="outlined"
                disabled={!pendingColumn || pendingValues.length === 0}
                onClick={onAddFilter}
              >
                Add Filter
              </Button>
            </>
          )}
          
          {/* Fixed Column Filters (Properties Tab) */}
          {fixedFilters.map((filter, index) => (
            <Autocomplete
              key={index}
              multiple
              options={filter.options}
              value={filter.value}
              onChange={(_, v) => filter.onChange(v)}
              renderInput={(params) => <TextField {...params} size="small" label={filter.label} />}
              sx={{ minWidth: 180 }}
            />
          ))}
          
          {/* Group By (inline) */}
          {showGroupBy && (
            <Autocomplete
              size="small"
              sx={{ minWidth: 160, maxWidth: 220, flex: '0 1 auto' }}
              options={groupByOptions}
              value={groupByValue}
              onChange={(_, v) => onGroupByChange?.(v)}
              renderInput={(params) => <TextField {...params} label="Group by" />}
            />
          )}

        </Stack>

        {/* Custom Code Section (inline on row 1) */}
        {showCustomCode && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
            <TextField 
              size="small" 
              fullWidth 
              placeholder={"Custom expression"} 
              value={customCodeValue} 
              onChange={(e) => onCustomCodeChange?.(e.target.value)} 
            />
            <Button variant="outlined" onClick={onCustomCodeRun}>Run</Button>
            <Button variant="text" onClick={onReset}>Reset</Button>
          </Stack>
        )}
      </Stack>

      {/* Row 2: NL-to-Pandas Query */}
      {showNlQuery && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
          <AutoFixHighIcon sx={{ color: '#6B7280', fontSize: 20 }} />
          <TextField
            size="small"
            fullWidth
            placeholder="Text to Pandas: describe the data view you want..."
            value={nlQueryText}
            onChange={(e) => setNlQueryText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNlSubmit(); }}
            disabled={nlQueryLoading}
          />
          <Button
            variant="outlined"
            onClick={handleNlSubmit}
            disabled={!nlQueryText.trim() || nlQueryLoading}
            startIcon={nlQueryLoading ? <CircularProgress size={16} /> : undefined}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Generate
          </Button>
          {onReset && (
            <Button variant="text" onClick={onReset}>Reset</Button>
          )}
        </Stack>
      )}

      {/* NL Suggestion Card */}
      {nlSuggestion && (
        <Box sx={{
          mt: 1,
          p: 1.5,
          border: '1px solid',
          borderColor: nlError ? '#FCA5A5' : '#93C5FD',
          borderRadius: 1,
          bgcolor: nlError ? '#FEF2F2' : '#EFF6FF',
        }}>
          <Stack spacing={1}>
            <Typography variant="caption" sx={{ color: nlError ? '#991B1B' : '#1E40AF', fontWeight: 600 }}>
              Generated pandas expression
            </Typography>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={1}
              maxRows={4}
              value={editedCode}
              onChange={(e) => setEditedCode(e.target.value)}
              slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '0.85rem' } } }}
            />
            {nlError && (
              <Typography variant="caption" sx={{ color: '#DC2626' }}>
                Error: {nlError}
              </Typography>
            )}
            {nlSuggestion.explanation && !nlError && (
              <Typography variant="caption" sx={{ color: '#6B7280' }}>
                {nlSuggestion.explanation}
              </Typography>
            )}
            <Stack direction="row" spacing={1}>
              <IconButton
                size="small"
                onClick={handleAccept}
                sx={{ color: '#059669', border: '1px solid #059669', borderRadius: 1, px: 1.5 }}
              >
                <CheckIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Accept</Typography>
              </IconButton>
              <IconButton
                size="small"
                onClick={handleReject}
                sx={{ color: '#DC2626', border: '1px solid #DC2626', borderRadius: 1, px: 1.5 }}
              >
                <CloseIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Reject</Typography>
              </IconButton>
            </Stack>
          </Stack>
        </Box>
      )}
      
      {/* Custom Code Error */}
      {customCodeError && (
        <Box sx={{ color: '#b91c1c', mt: 1, fontSize: 12 }}>
          {customCodeError}
        </Box>
      )}
    </Box>
  );
}
