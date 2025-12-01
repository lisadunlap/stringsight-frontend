/**
 * BenchmarkChart - Per-model benchmark metrics bar chart.
 * 
 * Displays horizontal bars showing quality scores for each model across all clusters.
 * Includes optional confidence interval error bars when CI data is available.
 */

import React, { useMemo } from 'react';
import { Box, Typography, Alert } from '@mui/material';
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
  
  const plotData = useMemo(() => {
    if (!data.length || !qualityMetrics.length) {
      return [];
    }

    // Get all unique models
    const allModels = [...new Set(data.map(row => row.model))].sort();
    const modelLabels = allModels.map(model => {
      const shortName = model.split('/').pop() || model;
      return shortName.length > 25 ? shortName.substring(0, 22) + '...' : shortName;
    });

    // Create a trace for each metric
    const traces: any[] = [];
    const metricColors = ['#5B8FF9', '#FF9845', '#5AD8A6', '#F46649', '#9270CA', '#FF6B9D', '#C44569', '#F8B500', '#6C5CE7', '#00D2D3'];

    qualityMetrics.forEach((metric, metricIndex) => {
      // Try both original and sanitized metric names
      const originalKey = `quality_${metric}`;
      const sanitizedKey = `quality_${sanitizeMetricName(metric)}`;
      
      // Determine which key exists in the data  
      const sampleRow = data[0];
      const qualityKey = sampleRow && originalKey in sampleRow ? originalKey : sanitizedKey;
      const ciLowerKey = `${qualityKey}_ci_lower`;
      const ciUpperKey = `${qualityKey}_ci_upper`;

      // Get scores for this metric for each model
      const scores: number[] = [];
      const ciLowers: (number | undefined)[] = [];
      const ciUppers: (number | undefined)[] = [];
      const sizes: number[] = [];

      allModels.forEach(model => {
        const row = data.find(r => r.model === model);
        if (row) {
          const score = row[qualityKey as keyof ModelBenchmarkRow] as number | undefined;
          scores.push(typeof score === 'number' && isFinite(score) ? score : 0);
          
          if (showCI) {
            ciLowers.push(row[ciLowerKey as keyof ModelBenchmarkRow] as number | undefined);
            ciUppers.push(row[ciUpperKey as keyof ModelBenchmarkRow] as number | undefined);
          } else {
            ciLowers.push(undefined);
            ciUppers.push(undefined);
          }
          
          sizes.push(row.size || 0);
        } else {
          scores.push(0);
          ciLowers.push(undefined);
          ciUppers.push(undefined);
          sizes.push(0);
        }
      });

      // Create bar trace for this metric
      const barData: any = {
        type: 'bar',
        orientation: 'v',
        x: modelLabels,
        y: scores,
        name: getDisplayName(metric),
        marker: {
          color: metricColors[metricIndex % metricColors.length],
          opacity: 0.8
        },
        hovertemplate: allModels.map((model, i) => 
          `<b>${model}</b><br>` +
          `${getDisplayName(metric)}: ${scores[i].toFixed(3)}<br>` +
          `Conversations: ${sizes[i]}<extra></extra>`
        )
      };

      // Add confidence interval error bars if available
      if (showCI && ciLowers.some(l => l !== undefined) && ciUppers.some(u => u !== undefined)) {
        const arrayminus = scores.map((score, i) => 
          ciLowers[i] !== undefined 
            ? Math.max(0, score - ciLowers[i]!) 
            : 0
        );
        const arrayplus = scores.map((score, i) => 
          ciUppers[i] !== undefined 
            ? Math.max(0, ciUppers[i]! - score)
            : 0
        );

        barData.error_y = {
          type: 'data',
          symmetric: false,
          array: arrayplus,
          arrayminus: arrayminus,
          visible: true,
          thickness: 2,
          width: 5,
          color: metricColors[metricIndex % metricColors.length] // Match bar color
        };
      }

      traces.push(barData);
    });

    return traces;
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
  if (!plotData.length) {
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Quality scores across all clusters
          {showCI && ' (with 95% confidence intervals)'}
        </Typography>
      </Box>
      
      <PlotlyChartBase
        data={plotData}
        height={height}
        yAxisLabel="Quality Score"
        layout={{
          margin: { t: 30, r: 60, b: 60, l: 80 },
          barmode: 'group', // Group bars by model
          showlegend: true, // Show legend for metrics
          legend: {
            orientation: 'h',
            y: -0.15,
            x: 0.5,
            xanchor: 'center'
          },
          xaxis: {
            side: 'bottom'
          },
          yaxis: {
            tickformat: '.3f'
          }
        }}
      />
    </Box>
  );
}

export default BenchmarkChart;
