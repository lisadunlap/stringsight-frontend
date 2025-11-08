/**
 * MetricsInsightsOverview - High-level behavioral insights dashboard.
 *
 * Displays:
 * 1. Common Failures (negative behaviors where at least one model has >5% frequency, with model frequency bars)
 * 2. Unique Stylistic Behaviors (top 3 per model where delta > 0, showing freq and delta)
 * 3. Misaligned Patterns (negative behaviors with positive quality delta, or stylistic behaviors with significant quality impact)
 * 4. Model Cards (negative or stylistic behaviors with positive, significant frequency delta >15% per model)
 */

import React, { useMemo, useState } from 'react';
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
  TableSortLabel
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { ModelClusterRow, MetricsFilters } from '../../types/metrics';

// Threshold for displaying common failures (show any pattern where at least one model has > this frequency)
const COMMON_FAILURE_MIN_FREQUENCY = 0.05; // 5%

// Threshold for model cards (only show behaviors with frequency delta > this)
const MODEL_CARD_MIN_DELTA = 0.15; // 15%

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

interface CommonFailure {
  cluster: string;
  totalSize: number;
  modelFrequencies: { model: string; proportion: number; size: number; proportionDelta?: number }[];
  category: string;
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

interface ModelCardBehavior {
  cluster: string;
  category: string;
  proportion: number;
  proportionDelta: number;
  size: number;
}

interface ModelCard {
  model: string;
  behaviors: ModelCardBehavior[];
}

export function MetricsInsightsOverview({
  data,
  filters,
  qualityMetrics,
  onNavigateToCluster,
  method = 'unknown'
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
        modelCards: [],
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

        return {
          cluster,
          totalSize: rows.reduce((sum, r) => sum + (r.size || 0), 0),
          modelFrequencies,
          category
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

    // 4. MODEL CARDS - Negative or stylistic behaviors with positive, significant frequency delta per model
    const modelCardsMap = new Map<string, ModelCardBehavior[]>();
    
    filteredData.forEach(row => {
      const group = normalizeGroup(row.metadata?.group);
      const isNegative = group === 'negative_critical' || group === 'negative_non_critical';
      const isStylistic = group === 'style';
      
      // Only include negative or stylistic behaviors
      if (!isNegative && !isStylistic) return;
      
      // Must have positive frequency delta
      const proportionDelta = row.proportion_delta || 0;
      if (proportionDelta <= 0) return;
      
      // Must exceed threshold (>15%)
      if (proportionDelta <= MODEL_CARD_MIN_DELTA) return;
      
      // Must be significant
      if (row.proportion_delta_significant !== true) return;
      
      if (!modelCardsMap.has(row.model)) {
        modelCardsMap.set(row.model, []);
      }
      
      modelCardsMap.get(row.model)!.push({
        cluster: row.cluster,
        category: group,
        proportion: row.proportion || 0,
        proportionDelta,
        size: row.size || 0
      });
    });
    
    // Convert to array and sort behaviors by delta (descending)
    const modelCards: ModelCard[] = Array.from(modelCardsMap.entries())
      .map(([model, behaviors]) => ({
        model,
        behaviors: behaviors.sort((a, b) => b.proportionDelta - a.proportionDelta)
      }))
      .filter(card => card.behaviors.length > 0)
      .sort((a, b) => a.model.localeCompare(b.model));

    return {
      commonFailures,
      uniqueBehaviors,
      misalignedPatterns,
      modelCards,
      allModels
    };
  }, [data, filters, qualityMetrics]);

  // Only return null if there's no data at all
  // We can still show Common Failures and Unique Behaviors without quality metrics
  if (!data.length) {
    console.log('[MetricsInsightsOverview] Component returning null - no data');
    return null;
  }

  const shortModelName = (model: string) => model.split('/').pop() || model;

  console.log('[MetricsInsightsOverview] Component rendering with insights:', {
    commonFailures: insights.commonFailures.length,
    uniqueBehaviors: insights.uniqueBehaviors.length,
    misalignedPatterns: insights.misalignedPatterns.length,
    allModels: insights.allModels
  });

  return (
    <Box sx={{ mb: 4 }}>
      <Stack spacing={3}>
        {/* 1. COMMON FAILURES */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', maxHeight: '800px' }}>
          <Typography variant="h6" sx={{ mb: 2, flexShrink: 0 }}>
            Common Failure Patterns
          </Typography>

          {insights.commonFailures.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No common failure patterns found
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
                      Failure Pattern (Cluster Label)
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        borderBottom: '2px solid',
                        borderColor: 'divider',
                        py: 1.5,
                        minWidth: 350
                      }}
                    >
                      Frequency
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        fontWeight: 600,
                        borderBottom: '2px solid',
                        borderColor: 'divider',
                        py: 1.5,
                        minWidth: 120
                      }}
                    >
                      Severity
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {insights.commonFailures.map((failure, idx) => (
                    <TableRow
                      key={idx}
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        borderBottom: idx === insights.commonFailures.length - 1 ? 'none' : '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <TableCell
                        sx={{
                          py: 1.5,
                          cursor: 'pointer',
                          '&:hover': { color: 'primary.main' }
                        }}
                        onClick={() => onNavigateToCluster?.(failure.cluster)}
                      >
                        <Typography variant="body2" sx={{ fontSize: '0.95rem' }}>
                          {failure.cluster}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Stack spacing={0.5}>
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
                                      width: 180,
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
                                          width: `${mf.proportion * 100}%`,
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
                                      color: hasData ? 'text.primary' : 'text.disabled',
                                      minWidth: 120,
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
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ py: 1.5 }}
                      >
                        <Chip
                          label={failure.category === 'negative_critical' ? 'Critical' : 'Non-critical'}
                          size="small"
                          sx={{
                            height: 24,
                            fontSize: '0.75rem',
                            color: failure.category === 'negative_critical' ? '#DC2626' : '#CA8A04',
                            borderColor: failure.category === 'negative_critical' ? '#DC2626' : '#CA8A04',
                            bgcolor: 'background.paper',
                            fontWeight: 500
                          }}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* 2. UNIQUE STYLISTIC BEHAVIORS */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', maxHeight: '800px' }}>
          <Typography variant="h6" sx={{ mb: 2, flexShrink: 0 }}>
            Unique Stylistic Behaviors
          </Typography>

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
                        <Typography variant="body2" sx={{ fontSize: '0.95rem' }}>
                          {behavior.cluster}
                        </Typography>
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

        {/* 3. MISALIGNED PATTERNS - Only show if quality metrics are available */}
        {qualityMetrics.length > 0 && (
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

          {insights.misalignedPatterns.length === 0 ? (
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
                      <Stack spacing={0.75}>
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
                                py: 0.25
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  color: config.color,
                                  fontFamily: 'monospace',
                                  fontSize: '0.875rem',
                                  lineHeight: 1
                                }}
                              >
                                {isLast ? '└─' : '├─'}
                              </Typography>
                              <Typography
                                variant="body1"
                                sx={{
                                  flex: 1,
                                  cursor: 'pointer',
                                  fontSize: '1rem',
                                  '&:hover': { color: 'primary.main', textDecoration: 'underline' }
                                }}
                                onClick={() => onNavigateToCluster?.(pattern.cluster)}
                              >
                                {pattern.cluster}
                              </Typography>
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
        )}

        {/* 4. MODEL CARDS */}
        {insights.modelCards && insights.modelCards.length > 0 && (
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', maxHeight: '1000px' }}>
            <Typography variant="h6" sx={{ mb: 2, flexShrink: 0 }}>
              Model Cards
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, flexShrink: 0 }}>
              Negative or stylistic behaviors with positive, significant frequency delta (&gt;15%) for each model
            </Typography>

            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 2,
                pr: 1,
                '&::-webkit-scrollbar': {
                  width: '8px'
                },
                '&::-webkit-scrollbar-track': {
                  bgcolor: 'grey.100',
                  borderRadius: '4px'
                },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: 'grey.400',
                  borderRadius: '4px',
                  '&:hover': {
                    bgcolor: 'grey.500'
                  }
                }
              }}
            >
              {insights.modelCards.map((card) => {
                const modelColor = getModelColor(card.model, insights.allModels);
                // Convert hex to rgba with low opacity for light background
                const hexToRgba = (hex: string, alpha: number) => {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };
                return (
                  <Paper
                    key={card.model}
                    elevation={2}
                    sx={{
                      p: 2,
                      bgcolor: hexToRgba(modelColor, 0.05),
                      border: '1px solid',
                      borderColor: modelColor,
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{
                        mb: 1.5,
                        fontWeight: 600,
                        color: modelColor,
                        fontSize: '1rem',
                        flexShrink: 0
                      }}
                    >
                      {shortModelName(card.model)}
                    </Typography>
                    <Box
                      sx={{
                        flex: 1,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        minHeight: 0,
                        maxHeight: '400px',
                        pr: 1,
                        '&::-webkit-scrollbar': {
                          width: '8px'
                        },
                        '&::-webkit-scrollbar-track': {
                          bgcolor: 'grey.100',
                          borderRadius: '4px'
                        },
                        '&::-webkit-scrollbar-thumb': {
                          bgcolor: 'grey.400',
                          borderRadius: '4px',
                          '&:hover': {
                            bgcolor: 'grey.500'
                          }
                        }
                      }}
                    >
                      <Stack spacing={1}>
                        {card.behaviors.map((behavior, idx) => {
                          const categoryConfig: Record<string, { label: string; color: string }> = {
                            negative_critical: { label: 'Critical', color: '#DC2626' },
                            negative_non_critical: { label: 'Non-critical', color: '#CA8A04' },
                            style: { label: 'Style', color: '#9C27B0' }
                          };
                          const config = categoryConfig[behavior.category] || { label: behavior.category, color: '#9E9E9E' };
                          
                          return (
                            <Box
                              key={idx}
                              onClick={() => onNavigateToCluster?.(behavior.cluster)}
                              sx={{
                                p: 1.5,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                cursor: 'pointer',
                                '&:hover': {
                                  borderColor: modelColor
                                },
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  fontSize: '0.9rem',
                                  fontWeight: 500,
                                  wordBreak: 'break-word',
                                  whiteSpace: 'normal',
                                  mb: 0.5
                                }}
                              >
                                {behavior.cluster}
                              </Typography>
                              <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Frequency: {(behavior.proportion * 100).toFixed(1)}%
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 500 }}>
                                  Δ: +{(behavior.proportionDelta * 100).toFixed(1)}%
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {behavior.size} conversations
                                </Typography>
                                <Chip
                                  label={config.label}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.7rem',
                                    color: config.color,
                                    borderColor: config.color,
                                    bgcolor: 'background.paper',
                                    fontWeight: 500,
                                    flexShrink: 0
                                  }}
                                  variant="outlined"
                                />
                              </Stack>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}

export default MetricsInsightsOverview;
