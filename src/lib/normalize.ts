export type Method = "single_model" | "side_by_side" | "unknown";

/**
 * Get display name for a model. Returns the full model name as-is.
 * This replaces the old pattern of .split('/').pop() which truncated model names.
 */
export function getModelDisplayName(model: string): string {
  return model;
}

// Flatten score dictionaries into scalar columns: score_* (single), score_{modelA}_*, score_{modelB}_* (sbs)
export function flattenScores(rows: Record<string, any>[], method: Method, modelNames?: { modelA?: string; modelB?: string }) {
  console.log('🔄 DEBUG flattenScores called:', { rowCount: rows.length, method, sampleRow: rows[0] });
  const out = rows.map((r) => ({ ...r }));

  function flattenField(field: string, prefix: string) {
    console.log(`🔍 DEBUG flattenField called for field "${field}" with prefix "${prefix}"`);
    const keySet = new Set<string>();
    for (const row of out) {
      const val = row[field];
      if (val && typeof val === "object" && !Array.isArray(val)) {
        for (const k of Object.keys(val)) keySet.add(k);
      }
    }
    console.log(`🔍 DEBUG found keys for ${field}:`, Array.from(keySet));
    if (keySet.size === 0) {
      console.log(`⚠️ DEBUG: No keys found for field "${field}", skipping flattening`);
      return;
    }
    for (const row of out) {
      const val = row[field] || {};
      for (const k of keySet) {
        const col = `${prefix}_${k}`;
        const v = val && typeof val === "object" ? val[k] : undefined;
        (row as any)[col] = v;
      }
      delete (row as any)[field];
    }
  }

  if (method === "single_model") {
    const hasScoreObjects = out.some((r) => typeof r?.score === "object");
    console.log(`DEBUG single_model: hasScoreObjects=${hasScoreObjects}, sampleScore:`, out[0]?.score);
    if (hasScoreObjects) {
      flattenField("score", "score");
    }
  } else if (method === "side_by_side") {
    const hasScoreAObjects = out.some((r) => typeof r?.score_a === "object");
    const hasScoreBObjects = out.some((r) => typeof r?.score_b === "object");
    console.log(`DEBUG side_by_side: hasScoreAObjects=${hasScoreAObjects}, hasScoreBObjects=${hasScoreBObjects}`);
    console.log(`DEBUG sample scores:`, { score_a: out[0]?.score_a, score_b: out[0]?.score_b });
    
    // Use actual model names if provided, otherwise fallback to 'a' and 'b'
    const prefixA = modelNames?.modelA ? `score_${modelNames.modelA}` : "score_a";
    const prefixB = modelNames?.modelB ? `score_${modelNames.modelB}` : "score_b";
    
    if (hasScoreAObjects) {
      flattenField("score_a", prefixA);
    }
    if (hasScoreBObjects) {
      flattenField("score_b", prefixB);
    }
  }

  const columnSet = out.reduce<Set<string>>((set, r) => {
    Object.keys(r).forEach((k) => set.add(k));
    return set;
  }, new Set<string>());
  
  const columns = Array.from(columnSet);

  return { rows: out, columns };
}

/**
 * Normalize metrics column names to match frontend expectations.
 *
 * Backend returns: quality_{metric}_delta, quality_{metric}_ci_lower, etc.
 * Frontend expects: quality_delta_{metric}, quality_delta_{metric}_ci_lower, etc.
 *
 * This function renames columns to match the frontend pattern.
 */
export function normalizeMetricsColumnNames(metricsData: {
  model_cluster_scores?: any[];
  cluster_scores?: any[];
  model_scores?: any[];
}) {
  console.log('[normalize] normalizeMetricsColumnNames called with:', {
    has_model_cluster_scores: !!metricsData.model_cluster_scores,
    model_cluster_scores_length: metricsData.model_cluster_scores?.length,
    sample_row_keys: metricsData.model_cluster_scores?.[0] ? Object.keys(metricsData.model_cluster_scores[0]) : []
  });

  function normalizeRows(rows: any[]): any[] {
    if (!rows || !Array.isArray(rows)) return rows;

    return rows.map((row, index) => {
      if (index === 0) {
        console.log('[normalize] First row before normalization:', row);
        console.log('[normalize] Has quality object?', typeof row.quality === 'object' && row.quality !== null);
        console.log('[normalize] Has quality_delta object?', typeof row.quality_delta === 'object' && row.quality_delta !== null);
      }
      const normalized = { ...row };
      const keysToRename: Array<{ oldKey: string; newKey: string }> = [];

      // Find all columns that need renaming
      Object.keys(row).forEach(key => {
        // Pattern: quality_{metric}_delta -> quality_delta_{metric}
        const deltaMatch = key.match(/^quality_(.+)_delta$/);
        if (deltaMatch) {
          const metric = deltaMatch[1];
          keysToRename.push({ oldKey: key, newKey: `quality_delta_${metric}` });
          return;
        }

        // Pattern: quality_{metric}_delta_significant -> quality_delta_{metric}_significant
        const deltaSigMatch = key.match(/^quality_(.+)_delta_significant$/);
        if (deltaSigMatch) {
          const metric = deltaSigMatch[1];
          keysToRename.push({ oldKey: key, newKey: `quality_delta_${metric}_significant` });
          return;
        }

        // Pattern: quality_{metric}_delta_ci_lower -> quality_delta_{metric}_ci_lower
        const deltaCiLowerMatch = key.match(/^quality_(.+)_delta_ci_lower$/);
        if (deltaCiLowerMatch) {
          const metric = deltaCiLowerMatch[1];
          keysToRename.push({ oldKey: key, newKey: `quality_delta_${metric}_ci_lower` });
          return;
        }

        // Pattern: quality_{metric}_delta_ci_upper -> quality_delta_{metric}_ci_upper
        const deltaCiUpperMatch = key.match(/^quality_(.+)_delta_ci_upper$/);
        if (deltaCiUpperMatch) {
          const metric = deltaCiUpperMatch[1];
          keysToRename.push({ oldKey: key, newKey: `quality_delta_${metric}_ci_upper` });
          return;
        }

        // Pattern: quality_{metric}_delta_ci_mean -> quality_delta_{metric}_ci_mean
        const deltaCiMeanMatch = key.match(/^quality_(.+)_delta_ci_mean$/);
        if (deltaCiMeanMatch) {
          const metric = deltaCiMeanMatch[1];
          keysToRename.push({ oldKey: key, newKey: `quality_delta_${metric}_ci_mean` });
          return;
        }
      });

      // Apply renames
      keysToRename.forEach(({ oldKey, newKey }) => {
        normalized[newKey] = normalized[oldKey];
        delete normalized[oldKey];
      });

      // Flatten nested quality objects (quality: {metric: value} -> quality_metric: value)
      if (normalized.quality && typeof normalized.quality === 'object' && !Array.isArray(normalized.quality)) {
        Object.entries(normalized.quality).forEach(([metric, value]) => {
          normalized[`quality_${metric}`] = value;
        });
        delete normalized.quality;
      }

      // Flatten nested quality_delta objects (quality_delta: {metric: value} -> quality_delta_metric: value)
      if (normalized.quality_delta && typeof normalized.quality_delta === 'object' && !Array.isArray(normalized.quality_delta)) {
        Object.entries(normalized.quality_delta).forEach(([metric, value]) => {
          normalized[`quality_delta_${metric}`] = value;
        });
        delete normalized.quality_delta;
      }

      // Flatten nested quality_ci objects if present
      if (normalized.quality_ci && typeof normalized.quality_ci === 'object' && !Array.isArray(normalized.quality_ci)) {
        Object.entries(normalized.quality_ci).forEach(([metric, value]) => {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Handle nested CI structure like {metric: {lower: x, upper: y}}
            Object.entries(value as Record<string, any>).forEach(([ciKey, ciValue]) => {
              normalized[`quality_${metric}_ci_${ciKey}`] = ciValue;
            });
          } else {
            normalized[`quality_${metric}_ci`] = value;
          }
        });
        delete normalized.quality_ci;
      }

      // Flatten nested quality_delta_ci objects if present
      if (normalized.quality_delta_ci && typeof normalized.quality_delta_ci === 'object' && !Array.isArray(normalized.quality_delta_ci)) {
        Object.entries(normalized.quality_delta_ci).forEach(([metric, value]) => {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Handle nested CI structure like {metric: {lower: x, upper: y}}
            Object.entries(value as Record<string, any>).forEach(([ciKey, ciValue]) => {
              normalized[`quality_delta_${metric}_ci_${ciKey}`] = ciValue;
            });
          } else {
            normalized[`quality_delta_${metric}_ci`] = value;
          }
        });
        delete normalized.quality_delta_ci;
      }

      // Flatten nested quality_delta_significant objects if present
      if (normalized.quality_delta_significant && typeof normalized.quality_delta_significant === 'object' && !Array.isArray(normalized.quality_delta_significant)) {
        Object.entries(normalized.quality_delta_significant).forEach(([metric, value]) => {
          normalized[`quality_delta_${metric}_significant`] = value;
        });
        delete normalized.quality_delta_significant;
      }

      if (index === 0) {
        console.log('[normalize] First row after normalization:', normalized);
        const qualityKeys = Object.keys(normalized).filter(k => k.startsWith('quality_'));
        console.log('[normalize] Quality keys in normalized row:', qualityKeys);
      }

      return normalized;
    });
  }

  const result = {
    model_cluster_scores: normalizeRows(metricsData.model_cluster_scores),
    cluster_scores: normalizeRows(metricsData.cluster_scores),
    model_scores: normalizeRows(metricsData.model_scores)
  };

  console.log('[normalize] Normalization complete. Result sample keys:',
    result.model_cluster_scores?.[0] ? Object.keys(result.model_cluster_scores[0]) : []);

  return result;
}

/**
 * Enrich model_cluster_scores with metadata.group from clusters array.
 *
 * Clusters have meta.group which indicates behavior type (positive, negative_critical, etc.)
 * but model_cluster_scores loaded from JSONL often have empty metadata objects.
 * This function joins them by cluster label to propagate the group information.
 */
export function enrichModelClusterScoresWithMetadata(
  modelClusterScores: any[] | undefined,
  clusters: any[]
): any[] | undefined {
  if (!modelClusterScores || !clusters) {
    return modelClusterScores;
  }

  console.log('[normalize] Enriching model_cluster_scores with cluster metadata');

  // Build map from cluster label -> cluster meta
  const clusterMetaMap = new Map<string, any>();
  clusters.forEach(cluster => {
    const label = cluster.label || cluster.cluster_label || cluster.cluster || '';
    if (label) {
      clusterMetaMap.set(label, cluster.meta || {});
    }
  });

  console.log(`[normalize] Built metadata map for ${clusterMetaMap.size} clusters`);

  // Enrich each model_cluster_score row
  const enriched = modelClusterScores.map(row => {
    const clusterLabel = row.cluster || '';
    const clusterMeta = clusterMetaMap.get(clusterLabel);

    if (clusterMeta) {
      return {
        ...row,
        metadata: {
          ...(row.metadata || {}),
          ...clusterMeta
        }
      };
    }

    return row;
  });

  console.log('[normalize] Enrichment complete. Sample enriched row:', enriched[1]);

  return enriched;
}


