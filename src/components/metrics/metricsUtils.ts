import type { ModelClusterRow } from '../../types/metrics';

/**
 * Compute the overall (global) proportion for a cluster from its per-model rows.
 * Attempts to use row.proportion_overall when available; returns undefined otherwise.
 *
 * Inputs:
 * - rows: ModelClusterRow[] (array of per-model rows for a single cluster)
 *
 * Output:
 * - number | undefined: overall proportion in [0,1], or undefined if not available
 */
export function computeOverallProportion(rows: ModelClusterRow[]): number | undefined {
  for (const r of rows) {
    const anyRow = r as unknown as Record<string, any>;
    if (typeof anyRow.proportion_overall === 'number' && isFinite(anyRow.proportion_overall)) {
      return anyRow.proportion_overall as number;
    }
  }
  return undefined;
}

/**
 * Compute a global delta in quality for a cluster by averaging the selected
 * quality metric's delta across models (ignoring missing values).
 *
 * Inputs:
 * - rows: ModelClusterRow[] (array of per-model rows for a single cluster)
 * - metric: string | undefined (selected quality metric name)
 *
 * Output:
 * - number | undefined: average delta across models, or undefined if none present
 */
export function computeGlobalQualityDelta(rows: ModelClusterRow[], metric: string | undefined): number | undefined {
  if (!metric) return undefined;
  const values: number[] = [];
  for (const r of rows) {
    // Prefer nested object if present
    const nested = r.quality_delta?.[metric];
    if (typeof nested === 'number' && isFinite(nested)) {
      values.push(nested);
      continue;
    }
    // Fallback to flat key if provided by backend
    const flat = (r as unknown as Record<string, any>)[`quality_delta_${metric}`];
    if (typeof flat === 'number' && isFinite(flat)) {
      values.push(flat);
    }
  }
  if (!values.length) return undefined;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}




