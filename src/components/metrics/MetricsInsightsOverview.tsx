/**
 * MetricsInsightsOverview - High-level behavioral insights dashboard.
 *
 * Displays:
 * 1. Common Failures (negative behaviors where at least one model has >5% frequency, with model frequency bars)
 * 2. Unique Stylistic Behaviors (top 3 per model where delta > 0, showing freq and delta)
 * 3. Misaligned Patterns (negative behaviors with positive quality delta, or stylistic behaviors with significant quality impact)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Paper,
  Chip,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Button,
  Menu,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { FrequencyChartAlt } from './charts/FrequencyChartAlt';
import { ModelComparisonTab } from './ModelComparisonTab';
import type { ModelClusterRow, MetricsFilters, MetricsSummary } from '../../types/metrics';
import { computeOverallProportion, computeGlobalQualityDelta } from './metricsUtils';
import { ClusterLabel } from '../ClusterLabel';
import { MetricsFilterBar } from './MetricsFilterBar';

// Threshold for displaying common failures (show any pattern where at least one model has > this frequency)
const COMMON_FAILURE_MIN_FREQUENCY = 0.05; // 5%

// Model color palette (matches FrequencyChartAlt)
const MODEL_COLORS = ['#5B8FF9', '#FF9845', '#5AD8A6', '#F46649', '#9270CA'];

function getModelColor(model: string, allModels: string[]): string {
  const index = allModels.indexOf(model);
  return MODEL_COLORS[index % MODEL_COLORS.length];
}

interface MetricsInsightsOverviewProps {
  data: ModelClusterRow[];
  filters: MetricsFilters;
  qualityMetrics: string[];
  onNavigateToCluster?: (clusterName: string) => void;
  /** Data method - single_model or side_by_side */
  method?: 'single_model' | 'side_by_side' | 'unknown';
  /** Pre-computed top clusters (in order) */
  topClusters?: string[];
  /** Whether to show confidence intervals */
  showCI?: boolean;
  /** Optional dataset summary (used to derive percentages when not provided per-cluster) */
  summary?: MetricsSummary;
  /** Optional filter change handler for inline filter dropdown in header */
  onFiltersChange?: (filters: MetricsFilters) => void;
  /** Available models for filters dropdown */
  availableModels?: string[];
  /** Available quality metrics for filters dropdown */
  availableQualityMetrics?: string[];
  /** Available behavior types (normalized) for filters dropdown */
  availableBehaviorTypes?: string[];
  /** Whether confidence intervals are present in the data */
  hasConfidenceIntervals?: boolean;
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

type InsightsTabKey =
  | 'commonFailures'
  | 'modelComparison'
  | 'uniqueBehaviors'
  | 'misalignedPatterns'
  | 'allClusters';

interface CommonFailure {
  cluster: string;
  totalSize: number;
  modelFrequencies: { model: string; proportion: number; size: number; proportionDelta?: number }[];
  category: string;
  /** Overall proportion of total conversations for this cluster (global, not per model) */
  proportionOverall?: number;
  /** Global delta in the selected quality metric aggregated across models */
  globalQualityDelta?: number;
  /** Average of per-model proportions (fallback if overall not present) */
  avgProportion?: number;
}

interface UniqueBehavior {
  cluster: string;
  category: string;
  modelDeltas: Map<string, number>; // model -> proportionDelta
  modelProportions: Map<string, number>; // model -> proportion
}

interface MisalignedPattern {
  cluster: string;
  category: string;
  metricsImpacted: { metric: string; avgDelta: number; significant: boolean }[];
}

export function MetricsInsightsOverview({
  data,
  filters,
  qualityMetrics,
  onNavigateToCluster,
  method = 'unknown',
  topClusters,
  showCI = false,
  summary,
  onFiltersChange,
  availableModels,
  availableQualityMetrics,
  availableBehaviorTypes,
  hasConfidenceIntervals,
}: MetricsInsightsOverviewProps) {
  // Debug logging
  console.log('[MetricsInsightsOverview] Rendering with:', {
    dataLength: data.length,
    qualityMetricsLength: qualityMetrics.length,
    method,
    filters,
    firstDataItem: data[0]
  });

  const insights = useMemo(() => {
    if (!data.length) {
      console.log('[MetricsInsightsOverview] Early return - no data');
      return {
        commonFailures: [],
        uniqueBehaviors: [],
        misalignedPatterns: [],
        allModels: []
      };
    }

    // Apply model filter
    const filteredData = filters.selectedModels.length > 0
      ? data.filter(row => filters.selectedModels.includes(row.model))
      : data;

    // Get all unique models from the filtered data
    const allModels = [...new Set(filteredData.map(row => row.model))].sort();

    // 1. COMMON FAILURES - Negative behaviors where at least one model has >COMMON_FAILURE_MIN_FREQUENCY
    const negativeRows = filteredData.filter(row => {
      const group = normalizeGroup(row.metadata?.group);
      return group === 'negative_critical' || group === 'negative_non_critical';
    });

    const clusterGroups = new Map<string, { category: string; rows: ModelClusterRow[] }>();
    negativeRows.forEach(row => {
      if (!clusterGroups.has(row.cluster)) {
        clusterGroups.set(row.cluster, {
          category: normalizeGroup(row.metadata?.group),
          rows: []
        });
      }
      clusterGroups.get(row.cluster)!.rows.push(row);
    });

    const commonFailures: CommonFailure[] = Array.from(clusterGroups.entries())
      .map(([cluster, { category, rows }]) => {
        // Create a map of existing model data
        const modelDataMap = new Map(rows.map(r => [
          r.model,
          {
            proportion: r.proportion || 0,
            size: r.size || 0,
            proportionDelta: r.proportion_delta
          }
        ]));

        // Create frequencies for all models, filling in 0 for missing ones
        const modelFrequencies = allModels.map(model => ({
          model,
          proportion: modelDataMap.get(model)?.proportion || 0,
          size: modelDataMap.get(model)?.size || 0,
          proportionDelta: modelDataMap.get(model)?.proportionDelta
        }));

        // Global stats for the cluster
        const proportionOverall = computeOverallProportion(rows);
        const globalQualityDelta = computeGlobalQualityDelta(rows, filters.qualityMetric);
        const avgProportion = modelFrequencies.length > 0
          ? (modelFrequencies.reduce((s, mf) => s + (mf.proportion || 0), 0) / modelFrequencies.length)
          : undefined;

        return {
          cluster,
          totalSize: rows.reduce((sum, r) => sum + (r.size || 0), 0),
          modelFrequencies,
          category,
          proportionOverall,
          globalQualityDelta,
          avgProportion
        };
      })
      .filter(failure => {
        // Only show failures where at least one model has > COMMON_FAILURE_MIN_FREQUENCY
        return failure.modelFrequencies.some(mf => mf.proportion > COMMON_FAILURE_MIN_FREQUENCY);
      })
      .sort((a, b) => b.totalSize - a.totalSize);

    // 2. UNIQUE STYLISTIC BEHAVIORS - Group by cluster, show delta per model
    const stylisticRows = filteredData.filter(row => {
      const group = normalizeGroup(row.metadata?.group);
      return (group === 'style' || group === 'positive') && (row.proportion_delta || 0) > 0;
    });

    // Group by cluster, track which models have each cluster
    const clusterBehaviorMap = new Map<string, { category: string; modelDeltas: Map<string, number>; modelProportions: Map<string, number> }>();
    stylisticRows.forEach(row => {
      if (!clusterBehaviorMap.has(row.cluster)) {
        clusterBehaviorMap.set(row.cluster, {
          category: normalizeGroup(row.metadata?.group),
          modelDeltas: new Map(),
          modelProportions: new Map()
        });
      }
      clusterBehaviorMap.get(row.cluster)!.modelDeltas.set(row.model, row.proportion_delta || 0);
      clusterBehaviorMap.get(row.cluster)!.modelProportions.set(row.model, row.proportion || 0);
    });

    // Convert to array and sort by maximum delta across all models
    const uniqueBehaviors: UniqueBehavior[] = Array.from(clusterBehaviorMap.entries())
      .map(([cluster, data]) => ({
        cluster,
        category: data.category,
        modelDeltas: data.modelDeltas,
        modelProportions: data.modelProportions
      }))
      .sort((a, b) => {
        const maxDeltaA = Math.max(...Array.from(a.modelDeltas.values()));
        const maxDeltaB = Math.max(...Array.from(b.modelDeltas.values()));
        return maxDeltaB - maxDeltaA;
      })
      .slice(0, 3); // Show top 3 behaviors

    // 3. MISALIGNED PATTERNS
    // - Negative behaviors with positive quality delta
    // - Style behaviors with any quality delta (positive or negative)
    // Aggregate deltas across all models for each cluster
    // Note: This section requires quality metrics, so skip if none are available

    // Initialize misaligned patterns array (may remain empty if no quality metrics)
    let misalignedPatterns: MisalignedPattern[] = [];

    // Only compute misaligned patterns if we have quality metrics
    if (qualityMetrics.length > 0) {
      const misalignedMap = new Map<string, { category: string; metricDeltas: Map<string, { deltas: number[]; significances: boolean[] }> }>();

      filteredData.forEach(row => {
        const group = normalizeGroup(row.metadata?.group);

        // Check if this is a negative or style behavior (NOT positive)
        const isNegative = group === 'negative_critical' || group === 'negative_non_critical';
        const isStylistic = group === 'style';

        if (!isNegative && !isStylistic) return;

        qualityMetrics.forEach(metric => {
          const qualityDeltaKey = `quality_delta_${metric}`;
          const significantKey = `quality_delta_${metric}_significant`;
          const delta = row[qualityDeltaKey as keyof ModelClusterRow] as number | undefined;
          const significant = row[significantKey as keyof ModelClusterRow] as boolean | undefined;

          if (typeof delta !== 'number' || !isFinite(delta)) return;

          // For negative behaviors: only include if delta > 0 (positive impact)
          // For stylistic behaviors: include any delta (positive or negative)
          const shouldInclude = isNegative ? delta > 0 : true;

          if (!shouldInclude) return;

          // Apply significance filter if enabled
          if (filters.significanceOnly && !significant) return;

          if (!misalignedMap.has(row.cluster)) {
            misalignedMap.set(row.cluster, {
              category: group,
              metricDeltas: new Map()
            });
          }

          const clusterData = misalignedMap.get(row.cluster)!;

          if (!clusterData.metricDeltas.has(metric)) {
            clusterData.metricDeltas.set(metric, { deltas: [], significances: [] });
          }

          clusterData.metricDeltas.get(metric)!.deltas.push(delta);
          clusterData.metricDeltas.get(metric)!.significances.push(significant || false);
        });
      });

      // Convert to array and compute average deltas
      // Only include metrics where at least one model showed significant impact
      misalignedMap.forEach((data, cluster) => {
        const metricsImpacted: { metric: string; avgDelta: number; significant: boolean }[] = [];

        data.metricDeltas.forEach((metricData, metric) => {
          const avgDelta = metricData.deltas.reduce((sum, d) => sum + d, 0) / metricData.deltas.length;
          const anySig = metricData.significances.some(s => s);

          // Only include this metric if at least one model had a significant impact
          if (anySig) {
            metricsImpacted.push({
              metric,
              avgDelta,
              significant: anySig
            });
          }
        });

        if (metricsImpacted.length > 0) {
          misalignedPatterns.push({
            cluster,
            category: data.category,
            metricsImpacted
          });
        }
      });

      // Sort by total absolute impact (sum of |avgDelta|)
      misalignedPatterns.sort((a, b) => {
        const aImpact = a.metricsImpacted.reduce((sum, m) => sum + Math.abs(m.avgDelta), 0);
        const bImpact = b.metricsImpacted.reduce((sum, m) => sum + Math.abs(m.avgDelta), 0);
        return bImpact - aImpact;
      });
    }

    return {
      commonFailures,
      uniqueBehaviors,
      misalignedPatterns,
      allModels
    };
  }, [data, filters, qualityMetrics]);
  const shortModelName = (model: string) => model.split('/').pop() || model;

  console.log('[MetricsInsightsOverview] Component rendering with insights:', {
    commonFailures: insights.commonFailures.length,
    uniqueBehaviors: insights.uniqueBehaviors.length,
    misalignedPatterns: insights.misalignedPatterns.length,
    allModels: insights.allModels
  });

  // Determine whether the Model Comparison tab has any data to show
  const hasModelComparisonData = useMemo(() => {
    if (!data.length) {
      return false;
    }

    const filteredData = filters.selectedModels.length > 0
      ? data.filter(row => filters.selectedModels.includes(row.model))
      : data;

    const selectedBehaviorTypes = Array.isArray(filters.selectedBehaviorTypes)
      ? filters.selectedBehaviorTypes
      : [];

    return filteredData.some(row => {
      const group = normalizeGroup(row.metadata?.group);

      // Respect behavior-type filter if present (include all if no selection)
      if (selectedBehaviorTypes.length > 0 && !selectedBehaviorTypes.includes(group)) {
        return false;
      }

      const proportionDelta = row.proportion_delta || 0;

      // Must have positive, significant frequency delta above the 5% threshold
      if (proportionDelta <= 0.05) return false;
      if (row.proportion_delta_significant !== true) return false;

      return true;
    });
  }, [data, filters]);

  // Check if behavior types are present in the data
  const hasBehaviorTypes = useMemo(() => {
    if (!data.length) return false;
    
    // Check if any row has a metadata.group that normalizes to a known behavior type
    const hasBehaviorType = data.some(row => {
      const group = normalizeGroup(row.metadata?.group);
      return group === 'negative_critical' || 
             group === 'negative_non_critical' || 
             group === 'style' || 
             group === 'positive';
    });
    
    // Also check if availableBehaviorTypes prop has values
    const hasAvailableTypes = availableBehaviorTypes && availableBehaviorTypes.length > 0;
    
    return hasBehaviorType || hasAvailableTypes;
  }, [data, availableBehaviorTypes]);

  const availableTabs: { key: InsightsTabKey; label: string }[] = useMemo(() => {
    // If behavior types are not present, only show All Clusters and Model Comparison
    if (!hasBehaviorTypes) {
      return [
        { key: 'allClusters', label: 'All Clusters' },
        { key: 'modelComparison', label: 'Model Comparison' }
      ];
    }
    
    // Otherwise show all tabs
    return [
      { key: 'commonFailures', label: 'Common Failures' },
      { key: 'allClusters', label: 'All Clusters' },
      { key: 'modelComparison', label: 'Model Comparison' },
      { key: 'uniqueBehaviors', label: 'Unique Stylistic Behaviors' },
      { key: 'misalignedPatterns', label: 'Misaligned Patterns' }
    ];
  }, [hasBehaviorTypes]);

  const [activeTab, setActiveTab] = useState<InsightsTabKey | null>(
    availableTabs.length > 0 ? availableTabs[0].key : null
  );

  // Filters dropdown anchor
  const [filtersAnchorEl, setFiltersAnchorEl] = useState<null | HTMLElement>(null);
  const filtersMenuOpen = Boolean(filtersAnchorEl);

  const handleFiltersButtonClick = (event: React.MouseEvent<HTMLElement>) => {
    setFiltersAnchorEl(event.currentTarget);
  };

  const handleFiltersMenuClose = () => {
    setFiltersAnchorEl(null);
  };

  // Count active filters (excluding showCI, which is treated as a display default)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.selectedModels.length > 0) count += 1;
    if (filters.selectedMetrics.length > 0) count += 1;
    if (filters.selectedBehaviorTypes && filters.selectedBehaviorTypes.length > 0) count += 1;
    if (filters.significanceOnly) count += 1;
    return count;
  }, [filters]);

  // Keep the active tab in sync with the available tabs and ensure we never
  // select a tab that has no data
  useEffect(() => {
    if (availableTabs.length === 0) {
      if (activeTab !== null) {
        setActiveTab(null);
      }
      return;
    }

    if (!activeTab || !availableTabs.some(tab => tab.key === activeTab)) {
      setActiveTab(availableTabs[0].key);
    }
  }, [activeTab, availableTabs]);

  // Always show tabs, even if there's no data (tabs will show empty states)
  if (!activeTab) {
    return null;
  }

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header row: view selector + filters dropdown */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          mb: 1,
          borderBottom: '2px solid',
          borderColor: 'divider',
          position: 'relative',
        }}
      >
        {/* Folder-style tabs */}
        <Box
          sx={{
            display: 'flex',
            position: 'relative',
            gap: 0.5,
            flexWrap: 'wrap',
            maxWidth: '100%',
            pb: 0,
          }}
        >
          {availableTabs.map((tab, index) => {
            const isActive = activeTab === tab.key;
            return (
              <Button
                key={tab.key}
                size="small"
                onClick={() => setActiveTab(tab.key)}
                sx={{
                  textTransform: 'none',
                  borderRadius: 0,
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  px: 2.5,
                  py: 1,
                  minHeight: 40,
                  fontSize: '0.95rem',
                  fontWeight: isActive ? 600 : 500,
                  color: '#000000',
                  backgroundColor: isActive ? '#E3F2FD' : '#FFFFFF',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderBottom: isActive ? '2px solid #FFFFFF' : '2px solid transparent',
                  boxShadow: isActive ? '0 -2px 4px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.08)' : 'none',
                  position: 'relative',
                  zIndex: isActive ? 2 : 1,
                  marginBottom: isActive ? '-2px' : 0,
                  opacity: isActive ? 1 : 0.6,
                  '&:hover': {
                    backgroundColor: isActive ? '#E3F2FD' : '#FFFFFF',
                    opacity: 1,
                  },
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </Button>
            );
          })}
        </Box>

        {onFiltersChange && availableModels && availableQualityMetrics && (
          <Button
            variant="text"
            size="small"
            onClick={handleFiltersButtonClick}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              color: 'text.primary',
              mb: 0.5,
              fontSize: '1rem',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            {activeFiltersCount > 0
              ? `Filters (${activeFiltersCount} active)`
              : 'Filters'}
          </Button>
        )}
      </Box>

      {/* Spacing after tabs */}
      <Box sx={{ mb: 2 }} />

      {/* Filters dropdown menu */}
      {onFiltersChange && availableModels && availableQualityMetrics && (
        <Menu
          anchorEl={filtersAnchorEl}
          open={filtersMenuOpen}
          onClose={handleFiltersMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          keepMounted
        >
          <Box sx={{ p: 1 }}>
            <MetricsFilterBar
              filters={filters}
              onFiltersChange={onFiltersChange}
              availableModels={availableModels}
              availableQualityMetrics={availableQualityMetrics}
              availableBehaviorTypes={availableBehaviorTypes || []}
              hasConfidenceIntervals={hasConfidenceIntervals || false}
              variant="menu"
            />
          </Box>
        </Menu>
      )}

      {/* 1. COMMON FAILURES */}
      {activeTab === 'commonFailures' && (
        <Box>
          {insights.commonFailures.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No common failure patterns found
            </Typography>
          ) : (
            <Box>
              {/* Header row */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  pb: 1,
                  mb: 0.5
                }}
              >
                <Box sx={{ minWidth: 220, fontWeight: 600, fontSize: '0.875rem', pl: 4 }}>
                  Frequency
                </Box>
                <Box sx={{ flex: 1, fontWeight: 600, fontSize: '0.875rem', pl: 10 }}>
                  Failure Pattern (Cluster Label)
                </Box>
                <Box sx={{ minWidth: 120, fontWeight: 600, fontSize: '0.875rem', textAlign: 'right', pr: 3 }}>
                  Severity
                </Box>
              </Box>
              
              {insights.commonFailures.map((failure, idx) => (
                <Paper
                  key={idx}
                  variant="outlined"
                  onClick={() => onNavigateToCluster?.(failure.cluster)}
                  sx={{
                    p: 1.5,
                    mb: idx < insights.commonFailures.length - 1 ? 1 : 0,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    borderRadius: 2,
                    '&:hover': {
                      bgcolor: '#F9FAFB',
                      boxShadow: 1
                    },
                    position: 'relative'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    {/* Left side: Model bars with names */}
                    <Stack spacing={0.125} sx={{ minWidth: 220 }}>
                      {failure.modelFrequencies.map(mf => {
                        const hasData = mf.proportion > 0;
                        const modelShortName = shortModelName(mf.model);
                        const tooltipText = `${modelShortName}: ${(mf.proportion * 100).toFixed(1)}% (${mf.size} conversations)`;
                        
                        return (
                          <Tooltip key={mf.model} title={tooltipText} arrow placement="top">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                                {hasData && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      left: 0,
                                      top: 0,
                                      height: '100%',
                                      width: `${Math.min(100, mf.proportion * 100)}%`,
                                      bgcolor: getModelColor(mf.model, insights.allModels),
                                      opacity: 0.8,
                                      transition: 'width 0.3s ease'
                                    }}
                                  />
                                )}
                              </Box>

                              {/* Model name */}
                              <Typography
                                variant="caption"
                                sx={{
                                  fontSize: '0.75rem',
                                  color: hasData ? 'text.secondary' : 'text.disabled',
                                  minWidth: 100,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {modelShortName}
                              </Typography>
                            </Box>
                          </Tooltip>
                        );
                      })}
                    </Stack>

                    {/* Middle: Cluster name (Markdown-supported) */}
                    <Box sx={{ flex: 1, minWidth: 0, pr: 10 }}>
                      <ClusterLabel
                        text={failure.cluster}
                        typographyProps={{
                          variant: 'body1',
                          sx: {
                            color: '#111827',
                            lineHeight: 1.6,
                            fontSize: '1rem',
                            mb: 0.5
                          }
                        }}
                      />
                      <Stack spacing={0.25} sx={{ color: '#6B7280', fontSize: 13 }}>
                        <Typography variant="body2" sx={{ color: '#6B7280', fontSize: 13 }}>
                          {(() => {
                            const percent = typeof failure.proportionOverall === 'number'
                              ? failure.proportionOverall
                              : (typeof failure.avgProportion === 'number' ? failure.avgProportion : undefined);
                            const suffix = typeof percent === 'number' && isFinite(percent) ? ` (${(percent * 100).toFixed(1)}%)` : '';
                            return `${failure.totalSize.toLocaleString()} conversations${suffix}`;
                          })()}
                        </Typography>
                      </Stack>
                    </Box>

                    {/* Arrow icon - at the very right */}
                    <Box sx={{ color: 'action.active', ml: 'auto' }}>
                      →
                    </Box>
                  </Box>

                  {/* Severity chip at absolute bottom right - aligned with arrow */}
                  <Box sx={{
                    position: 'absolute',
                    bottom: 8,
                    right: 12
                  }}>
                    <Chip
                      label={failure.category === 'negative_critical' ? 'Critical' : 'Non-critical'}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.75rem',
                        color: failure.category === 'negative_critical' ? '#DC2626' : '#CA8A04',
                        borderColor: failure.category === 'negative_critical' ? '#DC2626' : '#CA8A04',
                        bgcolor: 'white',
                        fontWeight: 500
                      }}
                      variant="outlined"
                    />
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* 2. MODEL COMPARISON */}
      {activeTab === 'modelComparison' && (
        <Box>
          <ModelComparisonTab
            data={data}
            filters={filters}
            onNavigateToCluster={onNavigateToCluster}
          />
        </Box>
      )}

      {/* 3. UNIQUE STYLISTIC BEHAVIORS */}
      {activeTab === 'uniqueBehaviors' && (
        <Box>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', width: '100%', maxHeight: 'none', alignSelf: 'stretch' }}>

          {insights.uniqueBehaviors.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No unique stylistic patterns found
            </Typography>
          ) : (
            <TableContainer sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        borderBottom: '2px solid',
                        borderColor: 'divider',
                        py: 1.5,
                        minWidth: 400
                      }}
                    >
                      Stylistic Behavior
                    </TableCell>
                    {insights.allModels.map((model, idx) => (
                      <TableCell
                        key={idx}
                        align="center"
                        sx={{
                          fontWeight: 600,
                          borderBottom: '2px solid',
                          borderColor: 'divider',
                          py: 1.5,
                          minWidth: 100
                        }}
                      >
                        {shortModelName(model)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {insights.uniqueBehaviors.map((behavior, idx) => (
                    <TableRow
                      key={idx}
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        borderBottom: idx === insights.uniqueBehaviors.length - 1 ? 'none' : '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <TableCell
                        sx={{
                          py: 1.5,
                          cursor: 'pointer',
                          '&:hover': { color: 'primary.main' }
                        }}
                        onClick={() => onNavigateToCluster?.(behavior.cluster)}
                      >
                        <ClusterLabel
                          text={behavior.cluster}
                          typographyProps={{
                            variant: 'body2',
                            sx: { fontSize: '0.95rem' }
                          }}
                        />
                      </TableCell>
                      {insights.allModels.map((model, mIdx) => {
                        const delta = behavior.modelDeltas.get(model);
                        const proportion = behavior.modelProportions.get(model);
                        return (
                          <TableCell
                            key={mIdx}
                            align="center"
                            sx={{ py: 1.5 }}
                          >
                            {delta !== undefined && proportion !== undefined ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: 'text.primary',
                                    fontWeight: 500,
                                    fontSize: '0.9rem'
                                  }}
                                >
                                  {(proportion * 100).toFixed(1)}%
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'success.main',
                                    fontWeight: 500,
                                    fontSize: '0.8rem'
                                  }}
                                >
                                  (+{(delta * 100).toFixed(1)}%)
                                </Typography>
                              </Box>
                            ) : (
                              <Typography
                                variant="body2"
                                sx={{
                                  color: 'text.disabled',
                                  fontSize: '0.9rem'
                                }}
                              >
                                —
                              </Typography>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          </Paper>
        </Box>
      )}

      {/* 4. MISALIGNED PATTERNS */}
      {activeTab === 'misalignedPatterns' && (
        <Box>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', maxHeight: '800px' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexShrink: 0 }}>
              <WarningAmberIcon sx={{ fontSize: 20, color: 'warning.main' }} />
              <Typography variant="h6">
                Misaligned Patterns
              </Typography>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexShrink: 0 }}>
              Negative behaviors that improve metrics, and style behaviors with quality impact. Only shows patterns that are statistically significant.
            </Typography>

          {qualityMetrics.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No quality metrics available. Misaligned patterns require quality metrics to be computed.
            </Typography>
          ) : insights.misalignedPatterns.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No misaligned patterns detected
              {filters.significanceOnly && ' (try disabling "Significant Only" filter)'}
            </Typography>
          ) : (
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {(() => {
            // Group patterns by category
            const groupedPatterns = insights.misalignedPatterns.reduce((acc, pattern) => {
              if (!acc[pattern.category]) {
                acc[pattern.category] = [];
              }
              acc[pattern.category].push(pattern);
              return acc;
            }, {} as Record<string, MisalignedPattern[]>);

            // Define category order and styling
            const categoryConfig: Record<string, { label: string; color: string; order: number }> = {
              negative_critical: { label: 'Negative (critical)', color: '#DC2626', order: 1 },
              negative_non_critical: { label: 'Negative (non-critical)', color: '#CA8A04', order: 2 },
              style: { label: 'Style', color: '#9C27B0', order: 3 },
              positive: { label: 'Positive', color: '#16A34A', order: 4 }
            };

            // Sort categories by order
            const sortedCategories = Object.keys(groupedPatterns).sort(
              (a, b) => (categoryConfig[a]?.order || 999) - (categoryConfig[b]?.order || 999)
            );

            return (
              <Stack spacing={3}>
                {sortedCategories.map((category) => {
                  const config = categoryConfig[category] || { label: category, color: '#9E9E9E', order: 999 };
                  const patterns = groupedPatterns[category];

                  return (
                    <Box key={category}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: config.color,
                          mb: 0.75,
                          fontSize: '0.875rem'
                        }}
                      >
                        {config.label}
                      </Typography>
                      <Stack
                        spacing={0.75}
                        sx={{
                          pl: 1.5,
                          ml: 0.5,
                          borderLeft: '2px solid',
                          borderColor: config.color
                        }}
                      >
                        {patterns.map((pattern, idx) => {
                          const isLast = idx === patterns.length - 1;
                          return (
                            <Box
                              key={idx}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                '&:hover': { bgcolor: 'action.hover' },
                                borderRadius: 0.5,
                                px: 0.5,
                                py: 0.5,
                                borderBottom: isLast ? 'none' : '1px solid',
                                borderColor: 'divider'
                              }}
                            >
                              <Box
                                sx={{
                                  flex: 1,
                                  cursor: 'pointer',
                                  fontSize: '1rem',
                                  '&:hover': { color: 'primary.main', textDecoration: 'underline' }
                                }}
                                onClick={() => onNavigateToCluster?.(pattern.cluster)}
                              >
                                <ClusterLabel
                                  text={pattern.cluster}
                                  typographyProps={{
                                    variant: 'body1',
                                    sx: { fontSize: '1rem' }
                                  }}
                                />
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                                {pattern.metricsImpacted.map((mi, miIdx) => {
                                  const isPositive = mi.avgDelta > 0;
                                  return (
                                    <Typography
                                      key={miIdx}
                                      variant="body2"
                                      sx={{
                                        color: isPositive ? 'success.main' : 'error.main',
                                        fontWeight: 500,
                                        fontSize: '0.85rem',
                                        flex: '1 1 33%',
                                        maxWidth: '33%',
                                        minWidth: 0,
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word',
                                        lineHeight: 1.2
                                      }}
                                    >
                                      {isPositive ? '+' : ''}{mi.avgDelta.toFixed(2)} {mi.metric}
                                    </Typography>
                                  );
                                })}
                              </Box>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            );
          })()}
            </Box>
          )}
          </Paper>
        </Box>
      )}

      {/* 5. ALL CLUSTERS */}
      {activeTab === 'allClusters' && (
        <Box>
          <FrequencyChartAlt
            data={data}
            filters={filters}
            summary={summary}
            topClusters={topClusters}
            showCI={showCI}
            onNavigateToCluster={onNavigateToCluster}
          />
        </Box>
      )}
    </Box>
  );
}

export default MetricsInsightsOverview;
