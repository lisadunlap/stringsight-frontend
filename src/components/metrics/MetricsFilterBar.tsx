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
  Typography,
  Tooltip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Stack,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
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
      showCI: false,
      significanceOnly: false,
      sortBy: 'proportion_delta_desc',
    });
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: 1.5,
      mb: 2,
      pb: 1.5,
      borderBottom: '1px solid',
      borderColor: 'divider'
    }}>
      {/* Title + Reset */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Tooltip title="Reset filters" arrow>
          <IconButton
            size="small"
            onClick={handleReset}
            sx={{ color: 'text.secondary' }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Controls Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {/* Model Selection */}
        <Box sx={{ minWidth: 200, flex: '0 0 auto' }}>
          <FormControl fullWidth size="small">
            <InputLabel>Models</InputLabel>
            <Select
              multiple
              value={filters.selectedModels}
              onChange={(e) => updateFilters({ selectedModels: e.target.value as string[] })}
              label="Models"
              renderValue={(selected) => {
                if ((selected as string[]).length === 0) return 'All models';
                if ((selected as string[]).length === 1) {
                  return ((selected as string[])[0] || '').split('/').pop() || (selected as string[])[0];
                }
                return `${(selected as string[]).length} selected`;
              }}
            >
              {availableModels.map((model) => (
                <MenuItem key={model} value={model}>
                  {model.split('/').pop() || model}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Metric Selection */}
        <Box sx={{ minWidth: 200, flex: '0 0 auto' }}>
          <FormControl fullWidth size="small">
            <InputLabel>Metrics</InputLabel>
            <Select
              multiple
              value={filters.selectedMetrics}
              onChange={(e) => updateFilters({ selectedMetrics: e.target.value as string[] })}
              label="Metrics"
              renderValue={(selected) => {
                if ((selected as string[]).length === 0) return 'All metrics';
                if ((selected as string[]).length === 1) {
                  return getDisplayName((selected as string[])[0]);
                }
                return `${(selected as string[]).length} selected`;
              }}
            >
              {availableQualityMetrics.map((metric) => (
                <MenuItem key={metric} value={metric}>
                  {getDisplayName(metric)}
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
                onChange={(e) => updateFilters({ selectedBehaviorTypes: e.target.value as string[] })}
                label="Behavior Types"
                renderValue={(selected) => {
                  if ((selected as string[]).length === 0) return 'All types';
                  if ((selected as string[]).length === 1) {
                    return getBehaviorTypeLabel((selected as string[])[0]);
                  }
                  return `${(selected as string[]).length} selected`;
                }}
              >
                {availableBehaviorTypes.map((behaviorType) => (
                  <MenuItem key={behaviorType} value={behaviorType}>
                    {getBehaviorTypeLabel(behaviorType)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Right-aligned controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto', flexWrap: 'wrap' }}>
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

          {/* Sort By */}
          <Box sx={{ minWidth: 160, flex: '0 0 auto' }}>
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
        </Box>
      </Box>
    </Box>
  );
}

export default MetricsFilterBar;

