/**
 * BenchmarkChart - Per-model benchmark metrics bar chart.
 *
 * Displays separate bar charts for each metric, with models as the hue.
 * Shows up to 4 plots per row.
 * Includes optional confidence interval error bars when CI data is available.
 */

import React, { useMemo } from 'react';
import { Box, Typography, Alert, Grid } from '@mui/material';
import { PlotlyChartBase, getModelColor } from './PlotlyChartBase';
import { sanitizeMetricName, getDisplayName } from '../utils/metricUtils';
import type { ModelBenchmarkRow, MetricsFilters } from '../../../types/metrics';

interface BenchmarkChartProps {
  /** Benchmark data from backend */
  data: ModelBenchmarkRow[];
  /** Current filters (for selected quality metric) */
  filters: MetricsFilters;
  /** Available quality metrics */
  qualityMetrics: string[];
  /** Whether to show confidence intervals */
  showCI?: boolean;
  /** Chart height */
  height?: number;
}

export function BenchmarkChart({
  data,
  filters,
  qualityMetrics,
  showCI = false,
  height = 400
}: BenchmarkChartProps) {
  
  // Generate plot data for each metric separately
  const metricPlots = useMemo(() => {
    if (!data.length || !qualityMetrics.length) {
      return [];
    }

    // Get all unique models
    const allModels = [...new Set(data.map(row => row.model))].sort();

    // Create a separate plot for each metric
    return qualityMetrics.map((metric) => {
      const traces: any[] = [];

      // Try both original and sanitized metric names
      const originalKey = `quality_${metric}`;
      const sanitizedKey = `quality_${sanitizeMetricName(metric)}`;

      // Determine which key exists in the data
      const sampleRow = data[0];
      const qualityKey = sampleRow && originalKey in sampleRow ? originalKey : sanitizedKey;
      const ciLowerKey = `${qualityKey}_ci_lower`;
      const ciUpperKey = `${qualityKey}_ci_upper`;

      allModels.forEach((model) => {
        const modelRow = data.find(r => r.model === model);
        if (!modelRow) return;

        const score = modelRow[qualityKey as keyof ModelBenchmarkRow] as number | undefined;
        const scoreValue = typeof score === 'number' && isFinite(score) ? score : 0;

        const ciLower = modelRow[ciLowerKey as keyof ModelBenchmarkRow] as number | undefined;
        const ciUpper = modelRow[ciUpperKey as keyof ModelBenchmarkRow] as number | undefined;

        // Get short model name for display
        const shortName = model.split('/').pop() || model;
        const displayName = shortName.length > 25 ? shortName.substring(0, 22) + '...' : shortName;

        // Create bar trace for this model
        const barData: any = {
          type: 'bar',
          orientation: 'v',
          x: [displayName],
          y: [scoreValue],
          name: displayName,
          marker: {
            color: getModelColor(model, allModels),
            opacity: 0.8
          },
          hovertemplate:
            `<b>${model}</b><br>` +
            `${getDisplayName(metric)}: ${scoreValue.toFixed(3)}<br>` +
            `Conversations: ${modelRow.size || 0}<extra></extra>`,
          showlegend: false // Hide legend for individual plots
        };

        // Add confidence interval error bars if available
        if (showCI && ciLower !== undefined && ciUpper !== undefined) {
          const arrayminus = Math.max(0, scoreValue - ciLower);
          const arrayplus = Math.max(0, ciUpper - scoreValue);

          barData.error_y = {
            type: 'data',
            symmetric: false,
            array: [arrayplus],
            arrayminus: [arrayminus],
            visible: true,
            thickness: 2,
            width: 5,
            color: getModelColor(model, allModels)
          };
        }

        traces.push(barData);
      });

      return {
        metric,
        displayName: getDisplayName(metric),
        traces
      };
    });
  }, [data, qualityMetrics, showCI]);

  // Show error state if no data available
  if (!data.length) {
    return (
      <Box sx={{ height }}>
        <Alert severity="info">
          No benchmark data available. Ensure model scores are computed and available.
        </Alert>
      </Box>
    );
  }

  // Show error if no data available
  if (!metricPlots.length) {
    return (
      <Box sx={{ height }}>
        <Alert severity="warning">
          No data available for quality metrics.
          {qualityMetrics.length === 0 && ' No quality metrics found in the data.'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Quality scores across all clusters
          {showCI && ' (with 95% confidence intervals)'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {metricPlots.map((plot) => (
          <Box
            key={plot.metric}
            sx={{
              minWidth: 300,
              maxWidth: 400,
              flex: '1 1 300px'
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, textAlign: 'center' }}>
              {plot.displayName}
            </Typography>
            <PlotlyChartBase
              data={plot.traces}
              height={300}
              yAxisLabel="Score"
              config={{
                displayModeBar: false,
                staticPlot: false,
                responsive: true
              }}
              layout={{
                margin: { t: 10, r: 20, b: 80, l: 60 },
                barmode: 'group',
                showlegend: false,
                xaxis: {
                  side: 'bottom',
                  tickangle: -45,
                  automargin: true
                },
                yaxis: {
                  tickformat: '.3f',
                  automargin: true
                }
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default BenchmarkChart;
