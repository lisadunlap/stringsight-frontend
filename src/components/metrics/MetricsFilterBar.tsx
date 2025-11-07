/**
 * MetricsFilterBar - Horizontal filter bar for metrics visualization.
 * 
 * This component provides a compact horizontal filter bar with:
 * - Model multi-select
 * - Metric multi-select
 * - Show CI toggle (exp for misaligned metrics)
 * - Only show significant examples toggle
 * - Sort by dropdown (freq delta, freq, or quality delta)
 */

import {
  Box,
  Paper,
  Autocomplete,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  Stack,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import type { 
  MetricsFilters, 
  MetricsSortOption
} from '../../types/metrics';
import { getDisplayName } from './utils/metricUtils';

interface MetricsFilterBarProps {
  filters: MetricsFilters;
  onFiltersChange: (filters: MetricsFilters) => void;
  availableModels: string[];
  availableQualityMetrics: string[];
  hasConfidenceIntervals?: boolean;
}

export function MetricsFilterBar({
  filters,
  onFiltersChange,
  availableModels,
  availableQualityMetrics,
  hasConfidenceIntervals = false,
}: MetricsFilterBarProps) {
  // Handle filter updates
  const updateFilters = (updates: Partial<MetricsFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  // Simplified sort options - only show the three main options
  const sortOptions: { value: MetricsSortOption; label: string }[] = [
    { value: 'proportion_delta_desc', label: 'Freq Delta' },
    { value: 'proportion_desc', label: 'Freq' },
    { value: 'quality_delta_desc', label: 'Quality Delta' },
  ];

  return (
    <Paper 
      elevation={1}
      sx={{ 
        p: 2, 
        mb: 3,
        bgcolor: 'background.paper',
        borderRadius: 2,
      }}
    >
      <Stack 
        direction="row" 
        spacing={2} 
        alignItems="center" 
        flexWrap="wrap"
        sx={{ gap: 2 }}
      >
        {/* Header Icon */}
        <TuneIcon color="primary" sx={{ mr: 1 }} />

        {/* Model Selection */}
        <Box sx={{ minWidth: 220, maxWidth: 480, flex: '1 1 320px' }}>
          <Autocomplete
            multiple
            size="small"
            options={availableModels}
            value={filters.selectedModels}
            onChange={(_, newValue) => updateFilters({ selectedModels: newValue })}
            sx={{ width: '100%' }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const props = getTagProps({ index });
                return (
                  <Chip
                    {...props}
                    key={option}
                    label={option.split('/').pop() || option}
                    size="small"
                    variant="outlined"
                    sx={{
                      maxWidth: 160,
                      '& .MuiChip-label': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }
                    }}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Models"
                placeholder={filters.selectedModels.length === 0 ? "All models" : ""}
              />
            )}
            ChipProps={{ size: 'small' }}
          />
        </Box>

        {/* Metric Selection */}
        <Box sx={{ minWidth: 220, maxWidth: 520, flex: '1 1 360px' }}>
          <Autocomplete
            multiple
            size="small"
            options={availableQualityMetrics}
            value={filters.selectedMetrics}
            onChange={(_, newValue) => updateFilters({ selectedMetrics: newValue })}
            sx={{ width: '100%' }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const props = getTagProps({ index });
                return (
                  <Chip
                    {...props}
                    key={option}
                    label={getDisplayName(option)}
                    size="small"
                    variant="outlined"
                    sx={{
                      maxWidth: 180,
                      '& .MuiChip-label': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }
                    }}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Metrics"
                placeholder={filters.selectedMetrics.length === 0 ? "All metrics" : ""}
              />
            )}
            ChipProps={{ size: 'small' }}
          />
        </Box>

        {/* Show CI Toggle */}
        {hasConfidenceIntervals && (
          <FormControlLabel
            control={
              <Switch
                checked={filters.showCI}
                onChange={(e) => updateFilters({ showCI: e.target.checked })}
                size="small"
                color="primary"
              />
            }
            label="Show CI's"
            sx={{ flex: '0 0 auto' }}
          />
        )}

        {/* Significant Only Toggle */}
        <FormControlLabel
          control={
            <Switch
              checked={filters.significanceOnly}
              onChange={(e) => updateFilters({ significanceOnly: e.target.checked })}
              size="small"
              color="primary"
            />
          }
          label="Only show significant"
          sx={{ flex: '0 0 auto' }}
        />

        {/* Sort By */}
        <Box sx={{ minWidth: 150, flex: '0 0 auto' }}>
          <FormControl fullWidth size="small">
            <InputLabel>Sort by</InputLabel>
            <Select
              value={filters.sortBy}
              label="Sort by"
              onChange={(e) => updateFilters({ sortBy: e.target.value as MetricsSortOption })}
            >
              {sortOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Stack>
    </Paper>
  );
}

export default MetricsFilterBar;

