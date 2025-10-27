/**
 * ClusterScatterGrid - Scatter plot visualization showing frequency vs quality trade-offs.
 *
 * This experimental visualization displays each cluster × model as a point in a 2D space:
 * - X-axis: Frequency Δ (proportion_delta) - how much more/less common the behavior became
 * - Y-axis: Quality Δ (quality_delta) - how much better/worse the quality became
 * - Color: Behavior polarity (red = negative, purple = style, green = positive)
 * - Shape: Alignment (filled = aligned, hollow = misaligned)
 *
 * Alignment is determined by whether frequency and quality changes move in the same direction.
 * For negative behaviors, aligned means both decreased (good outcome).
 * For positive behaviors, aligned means both increased (good outcome).
 * For style behaviors, any change is considered aligned.
 *
 * Quadrant interpretation:
 * - Top-right: More frequent + better quality (good for positive behaviors)
 * - Top-left: Less frequent + better quality (good for negative behaviors)
 * - Bottom-right: More frequent + worse quality (bad - problematic overuse)
 * - Bottom-left: Less frequent + worse quality (depends on behavior type)
 */

import React, { useMemo } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { PlotlyChartBase, getModelColor } from './PlotlyChartBase';
import { getDisplayName, getOriginalMetricName, sanitizeMetricName } from '../utils/metricUtils';
import type { ModelClusterRow, MetricsFilters } from '../../../types/metrics';
// @ts-ignore - Plotly types issue
import type { Data } from 'plotly.js-dist-min';

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
    case 'negative_critical':
    case 'negative_non_critical':
      return '#DC2626'; // red for negative behaviors
    case 'style':
      return '#9C27B0'; // purple for style
    case 'positive':
      return '#16A34A'; // green for positive
    default:
      return '#9E9E9E'; // gray for unknown
  }
}

// Get display name for category
function getCategoryDisplayName(category: string): string {
  switch (category) {
    case 'negative_critical':
      return 'Negative (critical)';
    case 'negative_non_critical':
      return 'Negative (non-critical)';
    case 'style':
      return 'Style';
    case 'positive':
      return 'Positive';
    default:
      return category;
  }
}

/**
 * Determine if a cluster-model point is "aligned" (good outcome).
 *
 * Alignment logic:
 * - Negative behaviors: Aligned if both frequency and quality decreased OR quality improved
 * - Positive behaviors: Aligned if both frequency and quality increased OR quality improved
 * - Style behaviors: Aligned if quality improved (frequency doesn't matter)
 */
function isAligned(
  frequencyDelta: number,
  qualityDelta: number,
  category: string
): boolean {
  // Quality improvement is always aligned
  if (qualityDelta > 0) return true;

  switch (category) {
    case 'negative_critical':
    case 'negative_non_critical':
      // For negative behaviors, decreasing frequency is good
      return frequencyDelta < 0;
    case 'positive':
      // For positive behaviors, increasing frequency is good
      return frequencyDelta > 0;
    case 'style':
      // For style, alignment is neutral - consider quality neutral as aligned
      return qualityDelta >= 0;
    default:
      return qualityDelta >= 0;
  }
}

interface ClusterScatterGridProps {
  /** Model-cluster data */
  data: ModelClusterRow[];
  /** Current filters */
  filters: MetricsFilters;
  /** Pre-computed top clusters (in order) */
  topClusters?: string[];
  /** Chart height */
  height?: number;
}

export function ClusterScatterGrid({
  data,
  filters,
  topClusters,
  height = 600
}: ClusterScatterGridProps) {

  const scatterData = useMemo(() => {
    if (!data.length || !filters.qualityMetric) {
      return { plotData: [], isEmpty: true, reason: 'no_data' };
    }

    // Filter data by selected models
    const filteredData = data.filter(row =>
      filters.selectedModels.length === 0 || filters.selectedModels.includes(row.model)
    );

    if (!filteredData.length) {
      return { plotData: [], isEmpty: true, reason: 'no_matches' };
    }

    // Prepare metric name variants
    const originalMetric = getOriginalMetricName(filters.qualityMetric);
    const sanitizedMetric = sanitizeMetricName(filters.qualityMetric);

    // Filter rows with both frequency delta and quality delta data
    const completeData = filteredData.filter(row => {
      // Check frequency delta
      if (typeof row.proportion_delta !== 'number' || !isFinite(row.proportion_delta)) {
        return false;
      }

      // Check quality delta
      const nested = (row as any)?.quality_delta?.[originalMetric];
      if (typeof nested === 'number' && isFinite(nested)) return true;
      const flat1 = (row as any)[`quality_delta_${filters.qualityMetric}`];
      const flat2 = (row as any)[`quality_delta_${sanitizedMetric}`];
      return [flat1, flat2].some(v => typeof v === 'number' && isFinite(v as number));
    });

    if (!completeData.length) {
      return { plotData: [], isEmpty: true, reason: 'no_complete_data' };
    }

    // Apply significance filter if enabled
    let finalData = completeData;
    if (filters.significanceOnly) {
      finalData = completeData.filter(row => {
        const propSig = row.proportion_delta_significant === true;
        const qualSig = row?.quality_delta_significant?.[originalMetric] === true;
        return propSig || qualSig;
      });
    }

    if (!finalData.length && filters.significanceOnly) {
      return { plotData: [], isEmpty: true, reason: 'no_significant' };
    }

    // Get all models
    const allModels = filters.selectedModels.length > 0
      ? filters.selectedModels
      : [...new Set(data.map(row => row.model))].sort();

    // Group data by category and alignment
    interface PointData {
      x: number[];
      y: number[];
      text: string[];
      customdata: Array<{ model: string; cluster: string; category: string }>;
    }

    const groups: Record<string, { aligned: PointData; misaligned: PointData }> = {
      negative_critical: {
        aligned: { x: [], y: [], text: [], customdata: [] },
        misaligned: { x: [], y: [], text: [], customdata: [] }
      },
      negative_non_critical: {
        aligned: { x: [], y: [], text: [], customdata: [] },
        misaligned: { x: [], y: [], text: [], customdata: [] }
      },
      style: {
        aligned: { x: [], y: [], text: [], customdata: [] },
        misaligned: { x: [], y: [], text: [], customdata: [] }
      },
      positive: {
        aligned: { x: [], y: [], text: [], customdata: [] },
        misaligned: { x: [], y: [], text: [], customdata: [] }
      }
    };

    // Process each row
    for (const row of finalData) {
      const frequencyDelta = row.proportion_delta;
      const nested = row?.quality_delta?.[originalMetric];
      const flat1 = (row as any)?.[`quality_delta_${filters.qualityMetric}`];
      const flat2 = (row as any)?.[`quality_delta_${sanitizedMetric}`];
      const qualityDelta = typeof nested === 'number' && isFinite(nested)
        ? nested
        : (typeof flat1 === 'number' && isFinite(flat1) ? flat1 : (typeof flat2 === 'number' && isFinite(flat2) ? flat2 : 0));

      const category = normalizeGroup(row.metadata?.group);
      const alignment = isAligned(frequencyDelta, qualityDelta, category);
      const modelShortName = row.model.split('/').pop() || row.model;
      const clusterShort = row.cluster.length > 50
        ? row.cluster.substring(0, 47) + '...'
        : row.cluster;

      const hoverText = `<b>${clusterShort}</b><br>` +
        `Model: ${modelShortName}<br>` +
        `Category: ${getCategoryDisplayName(category)}<br>` +
        `Frequency Δ: ${(frequencyDelta * 100).toFixed(1)}%<br>` +
        `Quality Δ: ${qualityDelta.toFixed(3)}<br>` +
        `Size: ${row.size}<br>` +
        `Alignment: ${alignment ? 'Aligned' : 'Misaligned'}`;

      if (groups[category]) {
        const alignmentKey = alignment ? 'aligned' : 'misaligned';
        groups[category][alignmentKey].x.push(frequencyDelta);
        groups[category][alignmentKey].y.push(qualityDelta);
        groups[category][alignmentKey].text.push(hoverText);
        groups[category][alignmentKey].customdata.push({
          model: row.model,
          cluster: row.cluster,
          category
        });
      }
    }

    // Create Plotly traces
    const traces: Data[] = [];

    Object.entries(groups).forEach(([category, alignmentData]) => {
      const color = getCategoryColor(category);
      const categoryLabel = getCategoryDisplayName(category);

      // Aligned points (filled circles)
      if (alignmentData.aligned.x.length > 0) {
        traces.push({
          type: 'scatter',
          mode: 'markers',
          name: `${categoryLabel} (aligned)`,
          x: alignmentData.aligned.x,
          y: alignmentData.aligned.y,
          text: alignmentData.aligned.text,
          customdata: alignmentData.aligned.customdata,
          hovertemplate: '%{text}<extra></extra>',
          marker: {
            size: 10,
            color: color,
            symbol: 'circle',
            opacity: 0.7,
            line: {
              color: color,
              width: 2
            }
          },
          showlegend: true
        } as Data);
      }

      // Misaligned points (hollow circles)
      if (alignmentData.misaligned.x.length > 0) {
        traces.push({
          type: 'scatter',
          mode: 'markers',
          name: `${categoryLabel} (misaligned)`,
          x: alignmentData.misaligned.x,
          y: alignmentData.misaligned.y,
          text: alignmentData.misaligned.text,
          customdata: alignmentData.misaligned.customdata,
          hovertemplate: '%{text}<extra></extra>',
          marker: {
            size: 10,
            color: 'white',
            symbol: 'circle',
            opacity: 0.7,
            line: {
              color: color,
              width: 2
            }
          },
          showlegend: true
        } as Data);
      }
    });

    return { plotData: traces, isEmpty: traces.length === 0, reason: traces.length === 0 ? 'no_traces' : undefined };
  }, [data, filters]);

  if (!data.length) {
    return (
      <Box>
        <Alert severity="info">
          No cluster data available for scatter grid analysis.
        </Alert>
      </Box>
    );
  }

  if (!filters.qualityMetric) {
    return (
      <Box>
        <Alert severity="warning">
          Please select a quality metric to display the cluster scatter grid.
        </Alert>
      </Box>
    );
  }

  if (scatterData.isEmpty) {
    if (scatterData.reason === 'no_matches') {
      return (
        <Box>
          <Alert severity="warning">
            No data matches the current filters. Try adjusting your model selection.
          </Alert>
        </Box>
      );
    }
    if (scatterData.reason === 'no_complete_data') {
      return (
        <Box>
          <Alert severity="info">
            No clusters have both frequency and quality delta data for "{getDisplayName(filters.qualityMetric)}".
          </Alert>
        </Box>
      );
    }
    if (scatterData.reason === 'no_significant') {
      return (
        <Box>
          <Alert severity="info">
            No significant changes found for "{getDisplayName(filters.qualityMetric)}".
            Try disabling the significance filter.
          </Alert>
        </Box>
      );
    }
    return (
      <Box>
        <Alert severity="warning">
          No data available for the cluster scatter grid.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h6" component="h3">
          Cluster Scatter Grid
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Frequency vs Quality trade-offs for {getDisplayName(filters.qualityMetric)}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Each point = cluster × model. Filled shapes = aligned (good outcome), hollow = misaligned.
        Top-right = more frequent + better quality. Bottom-right = problematic overuse.
      </Typography>
      <PlotlyChartBase
        data={scatterData.plotData}
        layout={{
          xaxis: {
            title: 'Frequency Δ (proportion change)',
            zeroline: true,
            zerolinewidth: 2,
            zerolinecolor: '#888',
            gridcolor: '#eee'
          },
          yaxis: {
            title: `Quality Δ (${getDisplayName(filters.qualityMetric)})`,
            zeroline: true,
            zerolinewidth: 2,
            zerolinecolor: '#888',
            gridcolor: '#eee'
          },
          hovermode: 'closest',
          legend: {
            orientation: 'v',
            x: 1.02,
            y: 1,
            xanchor: 'left',
            yanchor: 'top'
          }
        }}
        height={height}
        showZeroLine={true}
      />
    </Box>
  );
}

export default ClusterScatterGrid;
