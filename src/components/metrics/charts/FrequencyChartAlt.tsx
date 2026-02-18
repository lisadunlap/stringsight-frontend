/**
 * FrequencyChartAlt - Text-based list visualization for frequency data.
 *
 * Alternative to FrequencyChart with:
 * - Compact list format (cluster name + multiple model bars)
 * - Full cluster names visible without truncation
 * - Visual bar representation using colored divs
 * - Inline percentage labels
 */

import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Alert, Stack, Paper, Chip, Tooltip, Select, MenuItem, FormControl, IconButton, TextField, InputAdornment, Checkbox, ListItemText } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import type { ModelClusterRow, MetricsFilters, MetricsSummary } from '../../../types/metrics';
import { computeOverallProportion, computeGlobalQualityDelta } from '../metricsUtils';
import { getModelDisplayName } from '../../../lib/normalize';
import { ClusterLabel } from '../../ClusterLabel';

// Model color palette (matches MetricsInsightsOverview)
const MODEL_COLORS = ['#5B8FF9', '#FF9845', '#5AD8A6', '#F46649', '#9270CA'];

function getModelColor(model: string, allModels: string[]): string {
  const index = allModels.indexOf(model);
  return MODEL_COLORS[index % MODEL_COLORS.length];
}

// Normalize group names to standard categories
function normalizeGroup(value: unknown): string {
  const v = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!v) return '';
  if (v === 'negative_(critical)' || v === 'negative_critical' || v === 'negative(critical)') return 'negative_critical';
  if (v === 'negative_(non-critical)' || v === 'negative_non-critical' || v === 'negative_non_critical' || v === 'negative(non-critical)') return 'negative_non_critical';
  if (v === 'positive') return 'positive';
  if (v === 'style') return 'style';
  if (v === 'phrasing') return 'phrasing';
  if (v === 'domain' || v === 'problem_domain') return 'problem_domain';
  if (v === 'skills_required' || v === 'skillsrequired') return 'skills_required';
  return v;
}

function getBehaviorTypeNormalized(row: ModelClusterRow): string {
  const metadata = row.metadata || {};
  const behaviorType = (metadata as Record<string, unknown>).behavior_type;
  if (typeof behaviorType === 'string' && behaviorType.trim()) {
    return normalizeGroup(behaviorType);
  }

  const groupValue = (metadata as Record<string, unknown>).group;
  const group = String(groupValue || '').trim();
  if (group.includes('_')) {
    const parts = group.split('_');
    const tail = parts[parts.length - 1];
    return normalizeGroup(tail);
  }
  return normalizeGroup(group);
}

// Get color for each category
function getCategoryColor(category: string): string {
  switch (category) {
    case 'negative_critical': return '#DC2626'; // red
    case 'negative_non_critical': return '#CA8A04'; // orange
    case 'style': return '#9C27B0'; // purple
    case 'positive': return '#16A34A'; // green
    case 'phrasing': return '#0EA5E9'; // sky blue
    case 'problem_domain': return '#06B6D4'; // cyan
    case 'skills_required': return '#14B8A6'; // teal
    default: return '#9E9E9E'; // gray
  }
}

// Get display name for category (capitalized labels for user types)
function getCategoryDisplayName(category: string): string {
  switch (category) {
    case 'negative_critical': return 'Negative (critical)';
    case 'negative_non_critical': return 'Negative (non-critical)';
    case 'style': return 'Style';
    case 'positive': return 'Positive';
    case 'phrasing': return 'Phrasing';
    case 'problem_domain': return 'Problem Domain';
    case 'skills_required': return 'Skills Required';
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
  /** Metric shown in per-model bars on each cluster card */
  modelBarMetric?: 'frequency' | 'quality_delta';
  /** Optional initial sort key for this view */
  defaultSortBy?: 'frequency' | 'frequency_delta' | 'quality' | 'quality_delta' | 'quality_delta_abs';
  /** Optional initial sort direction for this view */
  defaultSortDirection?: 'asc' | 'desc';
}

export function FrequencyChartAlt({
  data,
  filters,
  summary,
  topClusters,
  showCI = false,
  onNavigateToCluster,
  modelBarMetric = 'frequency',
  defaultSortBy = 'frequency_delta',
  defaultSortDirection = 'desc'
}: FrequencyChartAltProps) {

  // Local state for list view filters.
  // Empty selection means "All Types" so role-based groups are visible by default.
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>(defaultSortBy);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Keep sort defaults in sync when this component is reused across tabs/modes.
  useEffect(() => {
    setSortBy(defaultSortBy);
    setSortDirection(defaultSortDirection);
  }, [defaultSortBy, defaultSortDirection, modelBarMetric]);

  const handleReset = () => {
    setSelectedCategories([]);
    setSortBy(defaultSortBy);
    setSortDirection(defaultSortDirection);
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
    let maxAbsQualityDelta = 0;
    let maxAbsQualityScore = 0;
    const clusterData = clustersToShow.map(cluster => {
      const clusterRows = clusterGroups[cluster] || [];
      const category = clusterRows.length > 0 ? getBehaviorTypeNormalized(clusterRows[0]) : '';
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

        const qualityDeltaNested = row?.quality_delta?.[filters.qualityMetric];
        const qualityDeltaFlat = row ? (row as unknown as Record<string, any>)[`quality_delta_${filters.qualityMetric}`] : undefined;
        const qualityDelta = typeof qualityDeltaNested === 'number' && isFinite(qualityDeltaNested)
          ? qualityDeltaNested
          : (typeof qualityDeltaFlat === 'number' && isFinite(qualityDeltaFlat) ? qualityDeltaFlat : 0);
        maxAbsQualityDelta = Math.max(maxAbsQualityDelta, Math.abs(qualityDelta));

        const qualityScoreNested = row?.quality?.[filters.qualityMetric];
        const qualityScoreFlat = row ? (row as unknown as Record<string, any>)[`quality_${filters.qualityMetric}`] : undefined;
        const qualityScore = typeof qualityScoreNested === 'number' && isFinite(qualityScoreNested)
          ? qualityScoreNested
          : (typeof qualityScoreFlat === 'number' && isFinite(qualityScoreFlat) ? qualityScoreFlat : 0);
        maxAbsQualityScore = Math.max(maxAbsQualityScore, Math.abs(qualityScore));

        return {
          model,
          modelShortName: getModelDisplayName(model),
          proportion,
          qualityDelta,
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
      // Always put outliers at the bottom
      const aIsOutlier = a.cluster.startsWith('Outliers') || a.cluster.startsWith('Outlier');
      const bIsOutlier = b.cluster.startsWith('Outliers') || b.cluster.startsWith('Outlier');

      // If one is an outlier and the other isn't, non-outlier comes first
      if (aIsOutlier && !bIsOutlier) return 1;
      if (!aIsOutlier && bIsOutlier) return -1;

      const clusterA = clusterGroups[a.cluster] || [];
      const clusterB = clusterGroups[b.cluster] || [];

      // Get average values across all models for sorting
      const getAvgProportion = (rows: ModelClusterRow[]) => {
        if (rows.length === 0) return 0;
        return rows.reduce((sum, r) => sum + (r.proportion || 0), 0) / rows.length;
      };

      const getMaxAbsProportionDelta = (rows: ModelClusterRow[]) => {
        if (rows.length === 0) return 0;
        const values = rows
          .map(r => (typeof r.proportion_delta === 'number' && isFinite(r.proportion_delta) ? Math.abs(r.proportion_delta) : 0))
          .filter(v => v !== 0);
        if (!values.length) return 0;
        return Math.max(...values);
      };

      const getAvgQuality = (rows: ModelClusterRow[]) => {
        if (rows.length === 0) return 0;
        const qualityMetric = filters.qualityMetric;
        if (!qualityMetric) return 0;

        const values: number[] = [];
        for (const r of rows) {
          // Prefer nested quality object when present
          const nested = r.quality?.[qualityMetric];
          if (typeof nested === 'number' && isFinite(nested)) {
            values.push(nested);
            continue;
          }

          // Fallback to flattened quality_<metric> key from backend JSONL
          const flat = (r as unknown as Record<string, any>)[`quality_${qualityMetric}`];
          if (typeof flat === 'number' && isFinite(flat)) {
            values.push(flat);
          }
        }

        if (!values.length) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      };

      const getAvgQualityDelta = (rows: ModelClusterRow[]) => {
        if (rows.length === 0) return 0;
        const qualityMetric = filters.qualityMetric;
        if (!qualityMetric) return 0;

        const values: number[] = [];
        for (const r of rows) {
          // Prefer nested quality_delta object when present
          const nested = r.quality_delta?.[qualityMetric];
          if (typeof nested === 'number' && isFinite(nested)) {
            values.push(nested);
            continue;
          }

          // Fallback to flattened quality_delta_<metric> key from backend JSONL
          const flat = (r as unknown as Record<string, any>)[`quality_delta_${qualityMetric}`];
          if (typeof flat === 'number' && isFinite(flat)) {
            values.push(flat);
          }
        }

        if (!values.length) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      };

      const getAvgAbsQualityDelta = (rows: ModelClusterRow[]) => {
        if (rows.length === 0) return 0;
        const qualityMetric = filters.qualityMetric;
        if (!qualityMetric) return 0;

        const values: number[] = [];
        for (const r of rows) {
          const nested = r.quality_delta?.[qualityMetric];
          if (typeof nested === 'number' && isFinite(nested)) {
            values.push(Math.abs(nested));
            continue;
          }
          const flat = (r as unknown as Record<string, any>)[`quality_delta_${qualityMetric}`];
          if (typeof flat === 'number' && isFinite(flat)) {
            values.push(Math.abs(flat));
          }
        }

        if (!values.length) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
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
          comparison = getAvgQualityDelta(clusterB) - getAvgQualityDelta(clusterA);
          break;
        case 'quality_delta_abs':
          comparison = getAvgAbsQualityDelta(clusterB) - getAvgAbsQualityDelta(clusterA);
          break;
        default:
          comparison = 0;
      }
      // Apply sort direction
      return sortDirection === 'desc' ? comparison : -comparison;
    });

      return { clusterData: sortedClusterData, maxProportion: maxProp, maxAbsQualityDelta, maxAbsQualityScore };
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
                  const labels = selected.map(cat => {
                    switch (cat) {
                      case 'negative_critical': return 'Neg (crit)';
                      case 'negative_non_critical': return 'Neg (non-crit)';
                      case 'style': return 'Style';
                      case 'positive': return 'Positive';
                      case 'phrasing': return 'Phrasing';
                      case 'problem_domain': return 'Problem Domain';
                      case 'skills_required': return 'Skills Req';
                      case '': return 'Uncat';
                      default: return cat || 'Uncat';
                    }
                  });
                  return labels.join(', ');
                }}
                sx={{ fontSize: '0.875rem' }}
              >
                {[...new Set(
                  data.map(row => getBehaviorTypeNormalized(row))
                )]
                  .sort((a, b) => getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b)))
                  .map((category) => (
                    <MenuItem key={category || '__uncategorized'} value={category}>
                      <Checkbox checked={selectedCategories.indexOf(category) > -1} />
                      <ListItemText primary={getCategoryDisplayName(category)} />
                    </MenuItem>
                  ))}
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
                <MenuItem value="quality_delta">Quality Impact</MenuItem>
                <MenuItem value="quality_delta_abs">|Quality Δ|</MenuItem>
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
                  const tooltipText = modelBarMetric === 'quality_delta'
                    ? `${bar.modelShortName}: ${bar.qualityDelta >= 0 ? '+' : ''}${bar.qualityDelta.toFixed(3)} ${filters.qualityMetric} delta`
                    : `${bar.modelShortName}: ${(bar.proportion * 100).toFixed(1)}%${hasCI ? ` (95% CI: [${(bar.ciLower * 100).toFixed(1)}%, ${(bar.ciUpper * 100).toFixed(1)}%])` : ''} (${bar.size} conversations)`;

                  const qualityDeltaDenom = listData.maxAbsQualityScore > 0 ? listData.maxAbsQualityScore : 1;
                  const barWidthPercent = modelBarMetric === 'quality_delta'
                    ? Math.min(100, (Math.abs(bar.qualityDelta) / qualityDeltaDenom) * 100)
                    : Math.min(100, bar.proportion * 100);
                  const barColor = modelBarMetric === 'quality_delta'
                    ? (bar.qualityDelta >= 0 ? '#22C55E' : '#EF4444')
                    : bar.color;

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
                            // Absolute percentage scale (0-100), metric-dependent
                            width: `${barWidthPercent}%`,
                            bgcolor: barColor,
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
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <ClusterLabel
                  text={cluster}
                  typographyProps={{
                    variant: 'body1',
                    sx: {
                      color: 'text.primary',
                      lineHeight: 1.6,
                      fontSize: '1rem',
                      mb: 1
                    }
                  }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
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
                  {category && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.7rem',
                        color: getCategoryColor(category),
                        fontWeight: 500,
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: `${getCategoryColor(category)}10`
                      }}
                    >
                      {getCategoryDisplayName(category)}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Arrow icon - at the very right */}
              <Box sx={{ color: 'action.active' }}>
                →
              </Box>
            </Box>
          </Paper>
        ))}
      </Stack>
      )}
    </Box>
  );
}

export default FrequencyChartAlt;
