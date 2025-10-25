export type Method = "single_model" | "side_by_side" | "unknown";

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
  function normalizeRows(rows: any[]): any[] {
    if (!rows || !Array.isArray(rows)) return rows;

    return rows.map(row => {
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

      return normalized;
    });
  }

  return {
    model_cluster_scores: normalizeRows(metricsData.model_cluster_scores),
    cluster_scores: normalizeRows(metricsData.cluster_scores),
    model_scores: normalizeRows(metricsData.model_scores)
  };
}


