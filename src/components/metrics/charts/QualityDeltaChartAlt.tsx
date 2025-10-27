/**
 * QualityDeltaChartAlt - Text-based list visualization for quality delta data.
 *
 * Alternative to QualityDeltaChart with:
 * - Compact list format (cluster name + multiple model bars)
 * - Full cluster names visible without truncation
 * - Diverging visual bars centered on zero (positive right, negative left)
 * - Inline delta value labels with +/- signs
 */

import React, { useMemo } from 'react';
import { Box, Typography, Alert, Stack, Paper, Chip } from '@mui/material';
import { getModelColor } from './PlotlyChartBase';
import { getDisplayName, getOriginalMetricName, sanitizeMetricName } from '../utils/metricUtils';
import type { ModelClusterRow, MetricsFilters } from '../../../types/metrics';

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
    default: return category;
  }
}

interface QualityDeltaChartAltProps {
  /** Model-cluster data */
  data: ModelClusterRow[];
  /** Current filters */
  filters: MetricsFilters;
  /** Pre-computed top clusters (in order) */
  topClusters?: string[];
  /** Whether to show confidence intervals */
  showCI?: boolean;
  /** Chart height (ignored in list view) */
  height?: number;
}

export function QualityDeltaChartAlt({
  data,
  filters,
  topClusters,
  showCI = false
}: QualityDeltaChartAltProps) {

  const listData = useMemo(() => {
    if (!data.length || !filters.qualityMetric) {
      return { clusterData: [], maxAbsDelta: 0 };
    }

    // Filter data by selected models
    const filteredData = data.filter(row =>
      filters.selectedModels.length === 0 || filters.selectedModels.includes(row.model)
    );

    if (!filteredData.length) {
      return { clusterData: [], maxAbsDelta: 0 };
    }

    // Prepare metric name variants
    const originalMetric = getOriginalMetricName(filters.qualityMetric);
    const sanitizedMetric = sanitizeMetricName(filters.qualityMetric);

    // Filter rows with quality delta data
    const dataWithQualityDelta = filteredData.filter(row => {
      const nested = (row as any)?.quality_delta?.[originalMetric];
      if (typeof nested === 'number' && isFinite(nested)) return true;
      const flat1 = (row as any)[`quality_delta_${filters.qualityMetric}`];
      const flat2 = (row as any)[`quality_delta_${sanitizedMetric}`];
      return [flat1, flat2].some(v => typeof v === 'number' && isFinite(v as number));
    });

    if (!dataWithQualityDelta.length) {
      return { clusterData: [], maxAbsDelta: 0 };
    }

    // Apply significance filter if enabled
    let finalData = dataWithQualityDelta;
    if (filters.significanceOnly) {
      finalData = dataWithQualityDelta.filter(row => {
        const significant = row?.quality_delta_significant?.[originalMetric];
        return significant === true;
      });
    }

    if (!finalData.length && filters.significanceOnly) {
      return { clusterData: [], maxAbsDelta: 0 };
    }

    // Group by cluster
    const clusterGroups = finalData.reduce((groups, row) => {
      if (!groups[row.cluster]) {
        groups[row.cluster] = [];
      }
      groups[row.cluster].push(row);
      return groups;
    }, {} as Record<string, ModelClusterRow[]>);

    // Use pre-computed top clusters
    const clustersToShow = topClusters || (() => {
      const seenClusters = new Set<string>();
      const localTopClusters: string[] = [];
      for (const row of finalData) {
        if (!seenClusters.has(row.cluster) && localTopClusters.length < filters.topN) {
          seenClusters.add(row.cluster);
          localTopClusters.push(row.cluster);
        }
      }
      return localTopClusters;
    })();

    // Get all models
    const allModels = filters.selectedModels.length > 0
      ? filters.selectedModels
      : [...new Set(data.map(row => row.model))].sort();

    // Build cluster data with model bars
    let maxAbsDelta = 0;
    const clusterData = clustersToShow.map(cluster => {
      const clusterRows = clusterGroups[cluster] || [];
      const category = clusterRows.length > 0 ? normalizeGroup(clusterRows[0].metadata?.group) : '';

      const modelBars = allModels.map(model => {
        const row = clusterGroups[cluster]?.find(r => r.model === model);
        const nested = row?.quality_delta?.[originalMetric];
        const flat1 = (row as any)?.[`quality_delta_${filters.qualityMetric}`];
        const flat2 = (row as any)?.[`quality_delta_${sanitizedMetric}`];
        const deltaValue = typeof nested === 'number' && isFinite(nested)
          ? nested
          : (typeof flat1 === 'number' && isFinite(flat1) ? flat1 : (typeof flat2 === 'number' && isFinite(flat2) ? flat2 : 0));

        maxAbsDelta = Math.max(maxAbsDelta, Math.abs(deltaValue));

        return {
          model,
          modelShortName: model.split('/').pop() || model,
          qualityDelta: deltaValue,
          ciLower: showCI ? (
            row?.quality_delta_ci?.[originalMetric]?.lower ||
            (row as any)?.[`quality_delta_${filters.qualityMetric}_ci_lower`] ||
            (row as any)?.[`quality_delta_${sanitizedMetric}_ci_lower`]
          ) : undefined,
          ciUpper: showCI ? (
            row?.quality_delta_ci?.[originalMetric]?.upper ||
            (row as any)?.[`quality_delta_${filters.qualityMetric}_ci_upper`] ||
            (row as any)?.[`quality_delta_${sanitizedMetric}_ci_upper`]
          ) : undefined,
          size: row?.size || 0,
          significant: row?.quality_delta_significant?.[originalMetric] || false,
          color: getModelColor(model, allModels)
        };
      });

      return {
        cluster,
        category,
        modelBars: modelBars.filter(bar => bar.qualityDelta !== 0 || allModels.includes(bar.model))
      };
    });

    return { clusterData, maxAbsDelta };
  }, [data, filters, topClusters, showCI]);

  if (!data.length) {
    return (
      <Box>
        <Alert severity="info">
          No cluster data available for quality delta analysis.
        </Alert>
      </Box>
    );
  }

  if (!filters.qualityMetric) {
    return (
      <Box>
        <Alert severity="warning">
          Please select a quality metric to display quality deltas.
        </Alert>
      </Box>
    );
  }

  if (!listData.clusterData.length) {
    if (filters.significanceOnly) {
      return (
        <Box>
          <Alert severity="info">
            No significant quality differences found for "{getDisplayName(filters.qualityMetric)}".
            Try disabling the significance filter.
          </Alert>
        </Box>
      );
    }
    return (
      <Box>
        <Alert severity="warning">
          No data available for quality metric "{getDisplayName(filters.qualityMetric)}".
          Try selecting a different metric or adjusting filters.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h6" component="h3">
          Quality Δ by Cluster
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {getDisplayName(filters.qualityMetric)} performance vs. model baseline
        </Typography>
      </Box>

      <Stack spacing={1}>
        {listData.clusterData.map(({ cluster, category, modelBars }) => (
          <Paper
            key={cluster}
            variant="outlined"
            sx={{
              p: 1.5,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: 'action.hover',
                boxShadow: 1
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              {/* Left side: Model bars with names */}
              <Stack spacing={0.5} sx={{ minWidth: 220 }}>
                {modelBars.map(bar => {
                  const isPositive = bar.qualityDelta >= 0;
                  const barWidthPercent = (Math.abs(bar.qualityDelta) / Math.max(listData.maxAbsDelta, 0.01)) * 100;

                  // Build tooltip with CI if available
                  const hasCI = bar.ciLower !== undefined && bar.ciUpper !== undefined;
                  const tooltip = `${bar.modelShortName}: ${isPositive ? '+' : ''}${bar.qualityDelta.toFixed(3)}${hasCI ? ` (95% CI: [${bar.ciLower.toFixed(3)}, ${bar.ciUpper.toFixed(3)}])` : ''} (${bar.size} conversations)${bar.significant ? ' *significant' : ''}`;

                  return (
                    <Box
                      key={bar.model}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      title={tooltip}
                    >
                      {/* Diverging bar */}
                      <Box
                        sx={{
                          width: 100,
                          height: 16,
                          display: 'flex',
                          alignItems: 'center',
                          position: 'relative'
                        }}
                      >
                        {/* Center line */}
                        <Box
                          sx={{
                            position: 'absolute',
                            left: '50%',
                            top: 0,
                            bottom: 0,
                            width: 1,
                            bgcolor: 'grey.400',
                            zIndex: 1
                          }}
                        />

                        {/* Background */}
                        <Box
                          sx={{
                            width: '100%',
                            height: '100%',
                            bgcolor: 'grey.100',
                            borderRadius: 0.5,
                            position: 'absolute',
                            top: 0,
                            left: 0
                          }}
                        />

                        {/* The delta bar */}
                        <Box
                          sx={{
                            position: 'absolute',
                            left: isPositive ? '50%' : `calc(50% - ${barWidthPercent / 2}%)`,
                            top: 0,
                            height: '100%',
                            width: `${barWidthPercent / 2}%`,
                            bgcolor: bar.color,
                            opacity: 0.8,
                            transition: 'width 0.3s ease',
                            zIndex: 0,
                            borderRadius: 0.5
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
                  );
                })}
              </Stack>

              {/* Right side: Cluster description */}
              <Box sx={{ flex: 1, minWidth: 0, maxWidth: 600 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.primary',
                    lineHeight: 1.6
                  }}
                >
                  {cluster}
                </Typography>
                {category && (
                  <Chip
                    label={getCategoryDisplayName(category)}
                    size="small"
                    sx={{
                      mt: 0.5,
                      height: 20,
                      fontSize: '0.7rem',
                      color: getCategoryColor(category),
                      borderColor: getCategoryColor(category),
                      bgcolor: 'transparent',
                      fontWeight: 500
                    }}
                    variant="outlined"
                  />
                )}
              </Box>

              {/* Arrow icon */}
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'action.active' }}>
                →
              </Box>
            </Box>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

export default QualityDeltaChartAlt;
