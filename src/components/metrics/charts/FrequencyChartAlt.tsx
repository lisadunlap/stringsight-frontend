/**
 * FrequencyChartAlt - Text-based list visualization for frequency data.
 *
 * Alternative to FrequencyChart with:
 * - Compact list format (cluster name + multiple model bars)
 * - Full cluster names visible without truncation
 * - Visual bar representation using colored divs
 * - Inline percentage labels
 */

import { useMemo, useState } from 'react';
import { Box, Typography, Alert, Stack, Paper, Chip, Tooltip, Select, MenuItem, FormControl, IconButton, TextField, InputAdornment, Checkbox, ListItemText } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import type { ModelClusterRow, MetricsFilters, MetricsSummary } from '../../../types/metrics';
import { computeOverallProportion, computeGlobalQualityDelta } from '../metricsUtils';
import { ClusterLabel } from '../../ClusterLabel';

// Model color palette (matches MetricsInsightsOverview)
const MODEL_COLORS = ['#5B8FF9', '#FF9845', '#5AD8A6', '#F46649', '#9270CA'];

function getModelColor(model: string, allModels: string[]): string {
  const index = allModels.indexOf(model);
  return MODEL_COLORS[index % MODEL_COLORS.length];
}

// Normalize group names to standard categories
function normalizeGroup(value: unknown): string {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'negative (critical)' || v === 'negative critical') return 'negative_critical';
  if (v === 'negative (non-critical)' || v === 'negative non-critical' || v === 'negative (non critical)') return 'negative_non_critical';
  if (v === 'positive') return 'positive';
  if (v === 'style') return 'style';
  return v;
}

// Get color for each category
function getCategoryColor(category: string): string {
  switch (category) {
    case 'negative_critical': return '#DC2626'; // red
    case 'negative_non_critical': return '#CA8A04'; // orange
    case 'style': return '#9C27B0'; // purple
    case 'positive': return '#16A34A'; // green
    default: return '#9E9E9E'; // gray
  }
}

// Get display name for category
function getCategoryDisplayName(category: string): string {
  switch (category) {
    case 'negative_critical': return 'Negative (critical)';
    case 'negative_non_critical': return 'Negative (non-critical)';
    case 'style': return 'Style';
    case 'positive': return 'Positive';
    case '': return 'Uncategorized';
    default: return category || 'Uncategorized';
  }
}

interface FrequencyChartAltProps {
  /** Model-cluster data */
  data: ModelClusterRow[];
  /** Current filters */
  filters: MetricsFilters;
  /** Optional dataset summary for deriving conversation counts and percents */
  summary?: MetricsSummary;
  /** Pre-computed top clusters (in order) */
  topClusters?: string[];
  /** Whether to show confidence intervals */
  showCI?: boolean;
  /** Chart height (ignored in list view) */
  height?: number;
  /** Callback to navigate to a cluster */
  onNavigateToCluster?: (clusterName: string) => void;
}

export function FrequencyChartAlt({
  data,
  filters,
  summary,
  topClusters,
  showCI = false,
  onNavigateToCluster
}: FrequencyChartAltProps) {

  // Local state for list view filters
  // Include empty string to show uncategorized clusters by default
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'negative_critical',
    'negative_non_critical',
    'style',
    'positive',
    '' // Include uncategorized clusters
  ]);
  const [sortBy, setSortBy] = useState<string>('frequency_delta');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const handleReset = () => {
    setSelectedCategories(['negative_critical', 'negative_non_critical', 'style', 'positive', '']);
    setSortBy('frequency_delta');
    setSortDirection('desc');
    setSearchTerm('');
  };

  const listData = useMemo(() => {
    if (!data.length) {
      return { clusterData: [], maxProportion: 0 };
    }

    // Filter data by selected models
    const filteredData = data.filter(row =>
      filters.selectedModels.length === 0 || filters.selectedModels.includes(row.model)
    );

    if (!filteredData.length) {
      return { clusterData: [], maxProportion: 0 };
    }

    // Group by cluster
    const clusterGroups = filteredData.reduce((groups, row) => {
      if (!groups[row.cluster]) {
        groups[row.cluster] = [];
      }
      groups[row.cluster].push(row);
      return groups;
    }, {} as Record<string, ModelClusterRow[]>);

    // Get all unique clusters (no topK constraint)
    const clustersToShow = [...new Set(filteredData.map(row => row.cluster))];

    // Get all models
    const allModels = filters.selectedModels.length > 0
      ? filters.selectedModels
      : [...new Set(data.map(row => row.model))].sort();

    // Build cluster data with model bars
    let maxProp = 0;
    const clusterData = clustersToShow.map(cluster => {
      const clusterRows = clusterGroups[cluster] || [];
      const category = clusterRows.length > 0 ? normalizeGroup(clusterRows[0].metadata?.group) : '';
      const totalSize = clusterRows.reduce((sum, r) => sum + (r.size || 0), 0);
      const proportionOverall = computeOverallProportion(clusterRows);
      const globalQualityDelta = computeGlobalQualityDelta(clusterRows, filters.qualityMetric);
      // Fallback percent: average of per-model proportions (like model cards)
      const modelSet = filters.selectedModels.length > 0
        ? new Set(filters.selectedModels)
        : new Set(data.map(r => r.model));
      const proportionsForAvg: number[] = [];
      modelSet.forEach(m => {
        const row = clusterRows.find(r => r.model === m);
        proportionsForAvg.push(row?.proportion || 0);
      });
      const avgProportion = proportionsForAvg.length > 0
        ? proportionsForAvg.reduce((a, b) => a + b, 0) / proportionsForAvg.length
        : undefined;

      const modelBars = allModels.map(model => {
        const row = clusterGroups[cluster]?.find(r => r.model === model);
        const proportion = row?.proportion || 0;
        maxProp = Math.max(maxProp, proportion);

        return {
          model,
          modelShortName: model.split('/').pop() || model,
          proportion,
          ciLower: showCI ? row?.proportion_ci_lower : undefined,
          ciUpper: showCI ? row?.proportion_ci_upper : undefined,
          size: row?.size || 0,
          color: getModelColor(model, allModels)
        };
      });

      return {
        cluster,
        category,
        totalSize,
        proportionOverall,
        globalQualityDelta,
        avgProportion,
        modelBars: modelBars.filter(bar => bar.proportion > 0 || allModels.includes(bar.model))
      };
    });

    // Apply category filter
    let filteredClusterData = clusterData;
    if (selectedCategories.length > 0) {
      filteredClusterData = clusterData.filter(item =>
        selectedCategories.includes(item.category)
      );
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filteredClusterData = filteredClusterData.filter(item =>
        item.cluster.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    const sortedClusterData = [...filteredClusterData].sort((a, b) => {
      const clusterA = clusterGroups[a.cluster] || [];
      const clusterB = clusterGroups[b.cluster] || [];

      // Get average values across all models for sorting
      const getAvgProportion = (rows: ModelClusterRow[]) => {
        if (rows.length === 0) return 0;
        return rows.reduce((sum, r) => sum + r.proportion, 0) / rows.length;
      };

      const getMaxAbsProportionDelta = (rows: ModelClusterRow[]) => {
        if (rows.length === 0) return 0;
        return Math.max(...rows.map(r => Math.abs(r.proportion_delta)));
      };

      const getAvgQuality = (rows: ModelClusterRow[]) => {
        if (rows.length === 0) return 0;
        const qualityMetric = filters.qualityMetric;
        if (!qualityMetric) return 0;
        const values = rows.map(r => r.quality?.[qualityMetric] || 0).filter(v => v !== 0);
        if (values.length === 0) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      };

      const getMaxAbsQualityDelta = (rows: ModelClusterRow[]) => {
        if (rows.length === 0) return 0;
        const qualityMetric = filters.qualityMetric;
        if (!qualityMetric) return 0;
        const values = rows.map(r => Math.abs(r.quality_delta?.[qualityMetric] || 0));
        if (values.length === 0) return 0;
        return Math.max(...values);
      };

      let comparison = 0;
      switch (sortBy) {
        case 'frequency':
          comparison = getAvgProportion(clusterB) - getAvgProportion(clusterA);
          break;
        case 'frequency_delta':
          comparison = getMaxAbsProportionDelta(clusterB) - getMaxAbsProportionDelta(clusterA);
          break;
        case 'quality':
          comparison = getAvgQuality(clusterB) - getAvgQuality(clusterA);
          break;
        case 'quality_delta':
          comparison = getMaxAbsQualityDelta(clusterB) - getMaxAbsQualityDelta(clusterA);
          break;
        default:
          comparison = 0;
      }
      // Apply sort direction
      return sortDirection === 'desc' ? comparison : -comparison;
    });

      return { clusterData: sortedClusterData, maxProportion: maxProp };
  }, [data, filters, showCI, selectedCategories, sortBy, sortDirection, searchTerm]);

  if (!data.length) {
    return (
      <Box>
        <Alert severity="info">
          No cluster data available for frequency analysis.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with controls - Always visible */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        mb: 2,
        pb: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        {/* Title and Reset */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="h3">
            All Property Clusters
          </Typography>

          {/* Reset Button */}
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

        {/* Filters and Controls Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {/* Search Bar */}
          <TextField
            size="small"
            placeholder="Search clusters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />

          {/* Right side controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
            {/* Category Filter */}
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <Select
                multiple
                value={selectedCategories}
                onChange={(e) => setSelectedCategories(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                displayEmpty
                renderValue={(selected) => {
                  if (selected.length === 0) {
                    return 'All Types';
                  }
                  if (selected.length === 5) {
                    return 'All Types';
                  }
                  const labels = selected.map(cat => {
                    switch (cat) {
                      case 'negative_critical': return 'Neg (crit)';
                      case 'negative_non_critical': return 'Neg (non-crit)';
                      case 'style': return 'Style';
                      case 'positive': return 'Positive';
                      case '': return 'Uncat';
                      default: return cat || 'Uncat';
                    }
                  });
                  return labels.join(', ');
                }}
                sx={{ fontSize: '0.875rem' }}
              >
                <MenuItem value="negative_critical">
                  <Checkbox checked={selectedCategories.indexOf('negative_critical') > -1} />
                  <ListItemText primary="Negative (critical)" />
                </MenuItem>
                <MenuItem value="negative_non_critical">
                  <Checkbox checked={selectedCategories.indexOf('negative_non_critical') > -1} />
                  <ListItemText primary="Negative (non-critical)" />
                </MenuItem>
                <MenuItem value="style">
                  <Checkbox checked={selectedCategories.indexOf('style') > -1} />
                  <ListItemText primary="Style" />
                </MenuItem>
                <MenuItem value="positive">
                  <Checkbox checked={selectedCategories.indexOf('positive') > -1} />
                  <ListItemText primary="Positive" />
                </MenuItem>
                <MenuItem value="">
                  <Checkbox checked={selectedCategories.indexOf('') > -1} />
                  <ListItemText primary="Uncategorized" />
                </MenuItem>
              </Select>
            </FormControl>

            {/* Sort By */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                displayEmpty
                sx={{ fontSize: '0.875rem' }}
              >
                <MenuItem value="frequency">Frequency</MenuItem>
                <MenuItem value="frequency_delta">Frequency Δ</MenuItem>
                <MenuItem value="quality">Quality</MenuItem>
                <MenuItem value="quality_delta">Quality Δ</MenuItem>
              </Select>
            </FormControl>

            {/* Sort Direction */}
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <Select
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                sx={{ fontSize: '0.875rem' }}
              >
                <MenuItem value="desc">Descending</MenuItem>
                <MenuItem value="asc">Ascending</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Box>

      {/* Results or Empty State */}
      {!listData.clusterData.length ? (
        <Alert severity="warning">
          No data matches the current filters. Try adjusting your category selections or search term above.
        </Alert>
      ) : (
      <Stack spacing={1}>
        {listData.clusterData.map(({ cluster, category, modelBars, totalSize, proportionOverall, globalQualityDelta, avgProportion }) => (
          <Paper
            key={cluster}
            variant="outlined"
            onClick={() => onNavigateToCluster?.(cluster)}
            title="Click to view cluster and examples"
            sx={{
              p: 1.5,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: 'action.hover',
                boxShadow: 1
              },
              position: 'relative'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              {/* Left side: Model bars with names */}
              <Stack spacing={0.25} sx={{ minWidth: 220 }}>
                {modelBars.map(bar => {
                  // Build tooltip with CI if available
                  const hasCI = bar.ciLower !== undefined && bar.ciUpper !== undefined;
                  const tooltipText = `${bar.modelShortName}: ${(bar.proportion * 100).toFixed(1)}%${hasCI ? ` (95% CI: [${(bar.ciLower * 100).toFixed(1)}%, ${(bar.ciUpper * 100).toFixed(1)}%])` : ''} (${bar.size} conversations)`;

                  return (
                  <Tooltip key={bar.model} title={tooltipText} arrow placement="top">
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      {/* Visual bar */}
                      <Box
                        sx={{
                          width: 140,
                          height: 10,
                          bgcolor: 'grey.100',
                          borderRadius: 0.5,
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            height: '100%',
                            // Absolute percentage scale (0-100)
                            width: `${Math.min(100, bar.proportion * 100)}%`,
                            bgcolor: bar.color,
                            opacity: 0.8,
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </Box>

                      {/* Model name */}
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          minWidth: 100,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {bar.modelShortName}
                      </Typography>
                    </Box>
                  </Tooltip>
                  );
                })}
              </Stack>

              {/* Middle: Cluster description (Markdown-supported) */}
              <Box sx={{ flex: 1, minWidth: 0, pb: category ? 3 : 0 }}>
                <ClusterLabel
                  text={cluster}
                  typographyProps={{
                    variant: 'body1',
                    sx: {
                      color: 'text.primary',
                      lineHeight: 1.6,
                      fontSize: '1rem'
                    }
                  }}
                />
                <Stack spacing={0.25} sx={{ color: 'text.secondary' }}>
                  {(typeof totalSize === 'number' && totalSize > 0) && (
                    <Typography variant="body2" sx={{ fontSize: 13 }}>
                      {(() => {
                        const total = typeof summary?.total_battles === 'number' && summary.total_battles > 0 ? summary.total_battles : undefined;
                        const percent = typeof proportionOverall === 'number'
                          ? proportionOverall
                          : (typeof avgProportion === 'number' ? avgProportion : undefined);
                        const derivedCount = (total && typeof percent === 'number') ? Math.round(percent * total) : undefined;
                        const countText = typeof derivedCount === 'number' ? derivedCount.toLocaleString() : totalSize.toLocaleString();
                        const pctText = typeof percent === 'number' ? ` (${(percent * 100).toFixed(1)}%)` : '';
                        return `${countText} conversations${pctText}`;
                      })()}
                    </Typography>
                  )}
                </Stack>
              </Box>

              {/* Arrow icon - at the very right */}
              <Box sx={{ color: 'action.active' }}>
                →
              </Box>
            </Box>

            {/* Behavior tag at absolute bottom right */}
            <Box sx={{
              position: 'absolute',
              bottom: 8,
              right: 8
            }}>
              <Chip
                label={getCategoryDisplayName(category)}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  color: getCategoryColor(category),
                  borderColor: getCategoryColor(category),
                  bgcolor: 'transparent',
                  fontWeight: 500
                }}
                variant="outlined"
              />
            </Box>
          </Paper>
        ))}
      </Stack>
      )}
    </Box>
  );
}

export default FrequencyChartAlt;
