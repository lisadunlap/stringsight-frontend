/**
 * MetricsFilterBar - Horizontal filter bar for metrics visualization.
 *
 * This component provides a compact horizontal filter bar with:
 * - Model multi-select
 * - Show CI toggle (exp for misaligned metrics)
 * - Only show significant examples toggle
 */

import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Checkbox,
  ListItemText,
  OutlinedInput,
} from '@mui/material';
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
  availableBehaviorTypes?: string[];
  hasConfidenceIntervals?: boolean;
  /**
   * Visual variant:
   * - "bar": full-width horizontal bar with border (default)
   * - "menu": compact layout suitable for a dropdown menu
   */
  variant?: 'bar' | 'menu';
}

// Helper to get display label for behavior type
function getBehaviorTypeLabel(behaviorType: string): string {
  const labels: Record<string, string> = {
    'negative_critical': 'Negative (Critical)',
    'negative_non_critical': 'Negative (Non-Critical)',
    'positive': 'Positive',
    'style': 'Stylistic',
  };
  return labels[behaviorType] || behaviorType;
}

export function MetricsFilterBar({
  filters,
  onFiltersChange,
  availableModels,
  availableQualityMetrics,
  availableBehaviorTypes = [],
  hasConfidenceIntervals = false,
  variant = 'bar',
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

  const handleReset = () => {
    updateFilters({
      selectedModels: [],
      selectedMetrics: [],
      selectedBehaviorTypes: [],
      showCI: true,
      significanceOnly: false,
      sortBy: 'proportion_delta_desc',
    });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        mb: variant === 'bar' ? 2 : 0,
        pb: variant === 'bar' ? 1.5 : 0,
        borderBottom: variant === 'bar' ? '1px solid' : 'none',
        borderColor: variant === 'bar' ? 'divider' : 'transparent',
        minWidth: variant === 'menu' ? 360 : undefined,
        px: variant === 'menu' ? 1 : 0,
        pt: variant === 'menu' ? 1 : 0,
      }}
    >
      {/* First Row: Model, Metric, Behavior Type Selection */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {/* Model Selection */}
        <Box sx={{ minWidth: 200, flex: '0 0 auto' }}>
          <FormControl fullWidth size="small">
            <InputLabel>Models</InputLabel>
            <Select
              multiple
              value={filters.selectedModels}
              onChange={(e) => {
                const value = typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]);
                updateFilters({ selectedModels: value });
              }}
              input={<OutlinedInput label="Models" />}
              renderValue={(selected) => {
                const count = (selected as string[]).length;
                return count > 0 ? `${count} selected` : 'All';
              }}
              MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
            >
              {availableModels.map((model) => (
                <MenuItem key={model} value={model}>
                  <Checkbox checked={filters.selectedModels.indexOf(model) > -1} />
                  <ListItemText primary={model.split('/').pop() || model} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Behavior Type Selection */}
        {availableBehaviorTypes.length > 0 && (
          <Box sx={{ minWidth: 180, flex: '0 0 auto' }}>
            <FormControl fullWidth size="small">
              <InputLabel>Behavior Types</InputLabel>
              <Select
                multiple
                value={filters.selectedBehaviorTypes || []}
                onChange={(e) => {
                  const value = typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]);
                  updateFilters({ selectedBehaviorTypes: value });
                }}
                input={<OutlinedInput label="Behavior Types" />}
                renderValue={(selected) => {
                  const count = (selected as string[]).length;
                  return count > 0 ? `${count} selected` : 'All';
                }}
                MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
              >
                {availableBehaviorTypes.map((behaviorType) => (
                  <MenuItem key={behaviorType} value={behaviorType}>
                    <Checkbox checked={(filters.selectedBehaviorTypes || []).indexOf(behaviorType) > -1} />
                    <ListItemText primary={getBehaviorTypeLabel(behaviorType)} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
      </Box>

      {/* Second Row: Toggles */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {/* Show CI Toggle */}
        <FormControlLabel
          control={
            <Switch
              checked={filters.showCI}
              onChange={(e) => updateFilters({ showCI: e.target.checked })}
              size="small"
              color="primary"
              disabled={!hasConfidenceIntervals}
            />
          }
          label="Show CI's"
          sx={{ flex: '0 0 auto' }}
        />

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
      </Box>
    </Box>
  );
}

export default MetricsFilterBar;

