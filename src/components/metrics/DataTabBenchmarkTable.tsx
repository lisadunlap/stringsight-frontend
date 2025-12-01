/**
 * DataTabBenchmarkTable
 *
 * Adapter to reuse Metrics tab's BenchmarkTable in the Data tab.
 * Converts `operationalRows` into per-model aggregates matching
 * `ModelBenchmarkRow[]` and infers available quality metrics.
 *
 * When backend-computed model_scores are available:
 * - Uses them directly (already computed from properties)
 * - Ensures frequencies and quality metrics reflect the actual extracted behaviors per model
 *
 * Otherwise, falls back to computing from operationalRows/propertiesRows:
 * - For side-by-side with properties: uses model field from properties
 * - For side-by-side without properties: counts both models equally
 * - For single_model: uses conversation data directly
 */

import React, { useMemo } from 'react';
import BenchmarkTable from './BenchmarkTable';
import { BenchmarkChart } from './charts/BenchmarkChart';
import type { ModelBenchmarkRow, MetricsFilters } from '../../types/metrics';

interface DataTabBenchmarkTableProps {
  operationalRows: Array<Record<string, unknown>>;
  method: 'single_model' | 'side_by_side' | 'unknown';
  propertiesRows?: Array<Record<string, unknown>>;
  modelScores?: Array<Record<string, unknown>>;
  viewMode?: 'table' | 'graph';
  filters?: MetricsFilters;
  onQualityMetricsChange?: (metrics: string[]) => void;
}

export default function DataTabBenchmarkTable({ 
  operationalRows, 
  method, 
  propertiesRows, 
  modelScores,
  viewMode = 'table',
  filters,
  onQualityMetricsChange
}: DataTabBenchmarkTableProps) {
  const { rows, qualityMetrics } = useMemo(() => {
    // If backend-computed model_scores are available, use them directly
    if (modelScores && modelScores.length > 0) {
      console.log('[DataTabBenchmarkTable] Using backend-computed model_scores:', modelScores);
      const metricSet = new Set<string>();

      // Extract quality metrics from backend data
      for (const row of modelScores) {
        for (const key of Object.keys(row)) {
          if (key.startsWith('quality_')) {
            const metricName = key.replace('quality_', '');
            // Skip CI columns - they're handled via the main metric column
            if (!metricName.endsWith('_ci_lower') &&
                !metricName.endsWith('_ci_mean') &&
                !metricName.endsWith('_ci_upper')) {
              metricSet.add(metricName);
            }
          }
        }
      }

      // Convert backend model_scores to ModelBenchmarkRow format
      const benchmarkRows: ModelBenchmarkRow[] = modelScores.map((row: any) => ({
        model: String(row.model || ''),
        cluster: 'all_clusters' as const,
        size: typeof row.size === 'number' ? row.size : 0,
        proportion: 1,
        ...Object.fromEntries(
          Object.entries(row).filter(([k]) => k.startsWith('quality_'))
        )
      }));

      return {
        rows: benchmarkRows,
        qualityMetrics: Array.from(metricSet).sort()
      };
    }

    // Fallback: compute from operationalRows/propertiesRows
    console.log('[DataTabBenchmarkTable] No model_scores available, computing from operational/properties rows');
    const perModel: Record<string, ModelBenchmarkRow> = {};
    const metricSet = new Set<string>();

    const addObservation = (model: string, scoreObj: Record<string, unknown> | null | undefined) => {
      if (!model || !scoreObj || typeof scoreObj !== 'object') return;
      const row = (perModel[model] ||= { model, cluster: 'all_clusters', size: 0, proportion: 1 });
      row.size += 1;
      for (const [k, v] of Object.entries(scoreObj)) {
        const num = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
        if (!Number.isFinite(num)) continue;
        metricSet.add(k);
        const key = `quality_${k}` as keyof ModelBenchmarkRow;
        const accKey = `__acc_${k}`;
        const cntKey = `__cnt_${k}`;
        const sqKey = `__sq_${k}`;
        // Dynamic accumulation keys
        (row as any)[accKey] = ((row as any)[accKey] || 0) + num;
        (row as any)[cntKey] = ((row as any)[cntKey] || 0) + 1;
        (row as any)[sqKey] = ((row as any)[sqKey] || 0) + num * num;
      }
    };

    // For side-by-side with properties: use model from properties, not from conversations
    if (method === 'side_by_side' && propertiesRows && propertiesRows.length > 0) {
      // Create a map of question_id -> conversation for fast lookup
      const conversationMap = new Map<string, any>();
      for (const r of operationalRows || []) {
        const qid = String((r as any).__index ?? (r as any).question_id ?? '');
        conversationMap.set(qid, r);
      }

      // Iterate through properties and use their model field
      for (const prop of propertiesRows) {
        const propModel = typeof (prop as any)?.model === 'string' ? String((prop as any).model) : '';
        const qid = String((prop as any).question_id ?? '');

        if (!propModel || !qid) continue;

        const conversation = conversationMap.get(qid);
        if (!conversation) continue;

        // Determine which score to use based on the property's model
        // Match property model to conversation model_a or model_b
        const modelA = typeof (conversation as any)?.model_a === 'string' ? String((conversation as any).model_a) : '';
        const modelB = typeof (conversation as any)?.model_b === 'string' ? String((conversation as any).model_b) : '';

        let scoreObj: Record<string, unknown> | null | undefined;
        if (propModel === modelA) {
          scoreObj = (conversation as any)?.score_a as Record<string, unknown> | null | undefined;
        } else if (propModel === modelB) {
          scoreObj = (conversation as any)?.score_b as Record<string, unknown> | null | undefined;
        }

        addObservation(propModel, scoreObj);
      }
    } else {
      // Original logic for single_model or side_by_side without properties
      for (const r of operationalRows || []) {
        if (method === 'single_model') {
          const model = typeof (r as any)?.model === 'string' ? String((r as any).model) : '';
          const score = (r as any)?.score as Record<string, unknown> | null | undefined;
          addObservation(model, score);
        } else if (method === 'side_by_side') {
          const modelA = typeof (r as any)?.model_a === 'string' ? String((r as any).model_a) : '';
          const modelB = typeof (r as any)?.model_b === 'string' ? String((r as any).model_b) : '';
          const scoreA = (r as any)?.score_a as Record<string, unknown> | null | undefined;
          const scoreB = (r as any)?.score_b as Record<string, unknown> | null | undefined;
          addObservation(modelA, scoreA);
          addObservation(modelB, scoreB);
        }
      }
    }

    // Finalize means and confidence intervals per metric (95% CI)
    const rows: ModelBenchmarkRow[] = Object.values(perModel).map((row: any) => {
      metricSet.forEach((k) => {
        const acc = row[`__acc_${k}`];
        const cnt = row[`__cnt_${k}`];
        const sq = row[`__sq_${k}`];
        if (cnt > 0) {
          const mean = acc / cnt;
          row[`quality_${k}`] = mean;
          if (cnt > 1) {
            // sample variance using sum of squares
            const variance = Math.max((sq - cnt * mean * mean) / (cnt - 1), 0);
            const std = Math.sqrt(variance);
            const ciHalf = 1.96 * (std / Math.sqrt(cnt));
            (row as any)[`quality_${k}_ci_lower`] = mean - ciHalf;
            (row as any)[`quality_${k}_ci_upper`] = mean + ciHalf;
          }
        }
        delete row[`__acc_${k}`];
        delete row[`__cnt_${k}`];
        delete row[`__sq_${k}`];
      });
      return row as ModelBenchmarkRow;
    });

    return { rows, qualityMetrics: Array.from(metricSet).sort() };
  }, [operationalRows, method, propertiesRows, modelScores]);

  // Notify parent of available quality metrics
  React.useEffect(() => {
    if (onQualityMetricsChange && qualityMetrics.length > 0) {
      onQualityMetricsChange(qualityMetrics);
    }
  }, [qualityMetrics, onQualityMetricsChange]);

  // Don't render anything if there are no quality metrics
  if (qualityMetrics.length === 0) {
    return null;
  }

  // If graph view and filters are provided, show chart
  if (viewMode === 'graph' && filters) {
    // Ensure a quality metric is selected, default to first one
    const effectiveFilters: MetricsFilters = {
      ...filters,
      qualityMetric: filters.qualityMetric || qualityMetrics[0]
    };
    
    return (
      <BenchmarkChart
        data={rows}
        filters={effectiveFilters}
        qualityMetrics={qualityMetrics}
        showCI={true}
        height={300}
      />
    );
  }

  // Default to table view
  return (
    <BenchmarkTable data={rows} qualityMetrics={qualityMetrics} showCI={true} />
  );
}


