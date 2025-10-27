/**
 * MetricsInsightsOverview - High-level behavioral insights dashboard.
 *
 * Displays:
 * 1. Common Failures (negative behaviors where at least one model has >5% frequency, with model frequency bars)
 * 2. Unique Stylistic Behaviors (top 3 per model where delta > 0, showing freq and delta)
 * 3. Misaligned Patterns (negative behaviors with positive quality delta, or stylistic behaviors with significant quality impact)
 */

import React, { useMemo } from 'react';
import {
  Box,
  Stack,
  Typography,
  Paper,
  Chip,
  Tooltip
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { ModelClusterRow, MetricsFilters } from '../../types/metrics';

// Threshold for displaying common failures (show any pattern where at least one model has > this frequency)
const COMMON_FAILURE_MIN_FREQUENCY = 0.05; // 5%

interface MetricsInsightsOverviewProps {
  data: ModelClusterRow[];
  filters: MetricsFilters;
  qualityMetrics: string[];
  onNavigateToCluster?: (clusterName: string) => void;
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
  modelFrequencies: { model: string; proportion: number; size: number }[];
  category: string;
}

interface UniqueBehavior {
  model: string;
  cluster: string;
  proportion: number;
  proportionDelta: number;
  category: string;
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
  onNavigateToCluster
}: MetricsInsightsOverviewProps) {

  const insights = useMemo(() => {
    if (!data.length || qualityMetrics.length === 0) {
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
        const modelDataMap = new Map(rows.map(r => [r.model, { proportion: r.proportion || 0, size: r.size || 0 }]));

        // Create frequencies for all models, filling in 0 for missing ones
        const modelFrequencies = allModels.map(model => ({
          model,
          proportion: modelDataMap.get(model)?.proportion || 0,
          size: modelDataMap.get(model)?.size || 0
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

    // 2. UNIQUE STYLISTIC BEHAVIORS - Top 3 per model where proportion_delta > 0
    const stylisticRows = filteredData.filter(row => {
      const group = normalizeGroup(row.metadata?.group);
      return (group === 'style' || group === 'positive') && (row.proportion_delta || 0) > 0;
    });

    const modelGroups = new Map<string, ModelClusterRow[]>();
    stylisticRows.forEach(row => {
      if (!modelGroups.has(row.model)) {
        modelGroups.set(row.model, []);
      }
      modelGroups.get(row.model)!.push(row);
    });

    const uniqueBehaviors: UniqueBehavior[] = [];
    modelGroups.forEach((rows, model) => {
      const top3 = rows
        .sort((a, b) => (b.proportion_delta || 0) - (a.proportion_delta || 0))
        .slice(0, 3)
        .map(r => ({
          model,
          cluster: r.cluster,
          proportion: r.proportion || 0,
          proportionDelta: r.proportion_delta || 0,
          category: normalizeGroup(r.metadata?.group)
        }));
      uniqueBehaviors.push(...top3);
    });

    // 3. MISALIGNED PATTERNS
    // - Negative behaviors with positive quality delta
    // - Style behaviors with any quality delta (positive or negative)
    // Aggregate deltas across all models for each cluster

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
    const misalignedPatterns: MisalignedPattern[] = [];

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

    return {
      commonFailures,
      uniqueBehaviors,
      misalignedPatterns,
      allModels
    };
  }, [data, filters, qualityMetrics]);

  if (!data.length || qualityMetrics.length === 0) {
    return null;
  }

  const shortModelName = (model: string) => model.split('/').pop() || model;

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Overview
      </Typography>

      <Stack spacing={3}>
        {/* 1. COMMON FAILURES */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Common Failures (Critical + Non-Critical)
          </Typography>

          {insights.commonFailures.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No common failure patterns found
            </Typography>
          ) : (
            <Stack spacing={2}>
              {insights.commonFailures.map((failure, idx) => {
                // Get category color for the chip
                const categoryColor = failure.category === 'negative_critical' ? '#DC2626' : '#CA8A04';

                return (
                  <Paper
                    key={idx}
                    variant="outlined"
                    onClick={() => onNavigateToCluster?.(failure.cluster)}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative',
                      '&:hover': {
                        bgcolor: 'action.hover',
                        boxShadow: 1
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      {/* Left side: Model bars with names */}
                      <Stack spacing={0.125} sx={{ minWidth: 220 }}>
                        {failure.modelFrequencies.map((mf, mIdx) => {
                          const modelColors = ['#5B8FF9', '#FF9845', '#5AD8A6', '#F46649', '#9270CA'];
                          const barColor = modelColors[insights.allModels.indexOf(mf.model) % modelColors.length];

                          return (
                            <Tooltip
                              key={mIdx}
                              title={`${mf.model}: ${(mf.proportion * 100).toFixed(1)}% (${mf.size} conversations)`}
                              arrow
                              placement="top"
                            >
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
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      left: 0,
                                      top: 0,
                                      height: '100%',
                                      width: `${mf.proportion * 100}%`,
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
                                    fontSize: '0.8rem',
                                    color: 'text.secondary',
                                    minWidth: 100,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {shortModelName(mf.model)}
                                </Typography>
                              </Box>
                            </Tooltip>
                          );
                        })}
                      </Stack>

                      {/* Middle: Cluster description */}
                      <Box sx={{ flex: 1, minWidth: 0, maxWidth: 600 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.primary',
                            lineHeight: 1.6
                          }}
                        >
                          {failure.cluster}
                        </Typography>
                      </Box>

                      {/* Arrow icon - at the very right */}
                      <Tooltip
                        title="View examples from cluster"
                        arrow
                        placement="top"
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', color: 'action.active', ml: 'auto' }}>
                          →
                        </Box>
                      </Tooltip>
                    </Box>

                    {/* Category chip - bottom right */}
                    <Chip
                      label={failure.category === 'negative_critical' ? 'Negative (critical)' : 'Negative (non-critical)'}
                      size="small"
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        height: 20,
                        fontSize: '0.7rem',
                        color: categoryColor,
                        borderColor: categoryColor,
                        bgcolor: 'background.paper',
                        fontWeight: 500
                      }}
                      variant="outlined"
                    />
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>

        {/* 2. UNIQUE STYLISTIC BEHAVIORS */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Unique Stylistic Behaviors
          </Typography>

          {insights.uniqueBehaviors.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No unique stylistic patterns found
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {insights.uniqueBehaviors.map((behavior, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="body2" fontWeight={500} sx={{ minWidth: 80 }}>
                    {shortModelName(behavior.model)} →
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      cursor: 'pointer',
                      '&:hover': { color: 'primary.main', textDecoration: 'underline' }
                    }}
                    onClick={() => onNavigateToCluster?.(behavior.cluster)}
                  >
                    {behavior.cluster}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                    {(behavior.proportion * 100).toFixed(1)}%
                    <Typography component="span" sx={{ color: 'success.main', fontWeight: 500 }}>
                      {' '}(+{(behavior.proportionDelta * 100).toFixed(1)}%)
                    </Typography>
                  </Typography>
                  <Box
                    onClick={() => onNavigateToCluster?.(behavior.cluster)}
                    sx={{
                      cursor: 'pointer',
                      color: 'action.active',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    →
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>

        {/* 3. MISALIGNED PATTERNS */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <WarningAmberIcon sx={{ fontSize: 20, color: 'warning.main' }} />
            <Typography variant="h6">
              Misaligned Patterns
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Shows only statistically significant quality metric impacts. Negative behaviors that improve metrics, and style behaviors with quality impact.
          </Typography>

          {insights.misalignedPatterns.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No misaligned patterns detected
              {filters.significanceOnly && ' (try disabling "Significant Only" filter)'}
            </Typography>
          ) : (() => {
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
                                variant="body2"
                                sx={{
                                  flex: 1,
                                  cursor: 'pointer',
                                  '&:hover': { color: 'primary.main', textDecoration: 'underline' }
                                }}
                                onClick={() => onNavigateToCluster?.(pattern.cluster)}
                              >
                                {pattern.cluster}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                {pattern.metricsImpacted.map((mi, miIdx) => {
                                  const isPositive = mi.avgDelta > 0;
                                  return (
                                    <Typography
                                      key={miIdx}
                                      variant="body2"
                                      sx={{
                                        color: isPositive ? 'success.main' : 'error.main',
                                        fontWeight: 500,
                                        fontSize: '0.85rem'
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
        </Paper>
      </Stack>
    </Box>
  );
}

export default MetricsInsightsOverview;
