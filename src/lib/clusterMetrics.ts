/**
 * Compute cluster metrics on-the-fly from conversations, properties, and clusters
 * This avoids needing to load pre-computed model_cluster_scores_df.jsonl
 */

export interface ClusterMetrics {
  cluster_id: string;
  cluster_label: string;
  total_unique_conversations: number;
  proportion_overall: number;
  proportion_by_model: Record<string, number>;
  quality_by_model: Record<string, Record<string, number>>;
  quality_delta_by_model: Record<string, Record<string, number>>;
}

interface ConversationRow {
  question_id: string;
  model: string;
  score?: Record<string, number>; // e.g., {Helpfulness: 5.0, Conciseness: 4.0}
}

interface PropertyRow {
  id: string;
  question_id: string;
  model: string;
  property_description?: string;
}

interface ClusterRow {
  id: string;
  label: string;
  property_ids: string[];
  question_ids: string[];
}

/**
 * Compute metrics for all clusters
 */
export function computeClusterMetrics(
  conversations: ConversationRow[],
  properties: PropertyRow[],
  clusters: ClusterRow[]
): ClusterMetrics[] {
  console.log('🔢 Computing cluster metrics from raw data:', {
    conversations: conversations.length,
    properties: properties.length,
    clusters: clusters.length
  });

  // Build lookup maps for efficient joins
  const convByQuestionModel = new Map<string, ConversationRow>();
  conversations.forEach(conv => {
    const key = `${conv.question_id}|${conv.model}`;
    convByQuestionModel.set(key, conv);
  });

  const propById = new Map<string, PropertyRow>();
  properties.forEach(prop => {
    propById.set(prop.id, prop);
  });

  // Total unique conversations across all data
  const totalUniqueConversations = new Set(conversations.map(c => c.question_id)).size;

  // Get all models
  const allModels = Array.from(new Set(conversations.map(c => c.model)));

  // Compute baseline (average scores across all conversations per model)
  const baselineByModel = computeBaseline(conversations, allModels);

  // Compute total properties per model (for proportion calculation)
  const totalPropertiesByModel = new Map<string, number>();
  properties.forEach(prop => {
    totalPropertiesByModel.set(
      prop.model,
      (totalPropertiesByModel.get(prop.model) || 0) + 1
    );
  });

  // Compute metrics for each cluster
  return clusters.map(cluster => {
    // Get properties in this cluster
    const clusterPropertyIds = new Set(cluster.property_ids);
    const clusterProperties = properties.filter(p => clusterPropertyIds.has(p.id));

    console.log(`🔢 Cluster "${cluster.label}": ${clusterProperties.length} properties`);

    // Join properties with conversations to get scores
    const propertyConversations: Array<{
      property: PropertyRow;
      conversation: ConversationRow;
    }> = [];

    clusterProperties.forEach(prop => {
      const key = `${prop.question_id}|${prop.model}`;
      const conv = convByQuestionModel.get(key);
      if (conv && conv.score) {
        propertyConversations.push({ property: prop, conversation: conv });
      }
    });

    // Group by model
    const byModel = new Map<string, ConversationRow[]>();
    propertyConversations.forEach(({ conversation }) => {
      const model = conversation.model;
      if (!byModel.has(model)) byModel.set(model, []);
      byModel.get(model)!.push(conversation);
    });

    // Compute metrics per model
    const proportionByModel: Record<string, number> = {};
    const qualityByModel: Record<string, Record<string, number>> = {};
    const qualityDeltaByModel: Record<string, Record<string, number>> = {};

    byModel.forEach((convs, model) => {
      // Proportion: # properties in cluster / total properties for this model
      const modelPropertiesInCluster = clusterProperties.filter(p => p.model === model).length;
      const totalModelProperties = totalPropertiesByModel.get(model) || 1;
      proportionByModel[model] = modelPropertiesInCluster / totalModelProperties;

      // Average scores per metric for this model in this cluster
      const avgScores = computeAverageScores(convs);
      qualityByModel[model] = avgScores;

      // Quality delta: cluster avg - baseline avg per metric
      const baseline = baselineByModel.get(model) || {};
      const deltas: Record<string, number> = {};
      Object.keys(avgScores).forEach(metric => {
        const clusterAvg = avgScores[metric];
        const baselineAvg = baseline[metric] || 0;
        deltas[metric] = clusterAvg - baselineAvg;
      });
      qualityDeltaByModel[model] = deltas;
    });

    // Count unique conversations in this cluster
    const uniqueQuestionIds = new Set(clusterProperties.map(p => p.question_id));
    const totalUniqueConversationsInCluster = uniqueQuestionIds.size;

    return {
      cluster_id: cluster.id,
      cluster_label: cluster.label,
      total_unique_conversations: totalUniqueConversationsInCluster,
      proportion_overall: totalUniqueConversationsInCluster / totalUniqueConversations,
      proportion_by_model: proportionByModel,
      quality_by_model: qualityByModel,
      quality_delta_by_model: qualityDeltaByModel
    };
  });
}

/**
 * Compute baseline average scores per model across all conversations
 */
function computeBaseline(
  conversations: ConversationRow[],
  models: string[]
): Map<string, Record<string, number>> {
  const baselineByModel = new Map<string, Record<string, number>>();

  models.forEach(model => {
    const modelConvs = conversations.filter(c => c.model === model && c.score);
    const avgScores = computeAverageScores(modelConvs);
    baselineByModel.set(model, avgScores);
  });

  console.log('🔢 Computed baseline:', Object.fromEntries(baselineByModel));
  return baselineByModel;
}

/**
 * Compute average scores per metric from a list of conversations
 */
function computeAverageScores(conversations: ConversationRow[]): Record<string, number> {
  if (conversations.length === 0) return {};

  // Collect all metric names
  const metricNames = new Set<string>();
  conversations.forEach(conv => {
    if (conv.score) {
      Object.keys(conv.score).forEach(m => metricNames.add(m));
    }
  });

  // Compute average per metric
  const avgScores: Record<string, number> = {};
  metricNames.forEach(metric => {
    const values = conversations
      .map(c => c.score?.[metric])
      .filter((v): v is number => v !== undefined && typeof v === 'number');

    if (values.length > 0) {
      avgScores[metric] = values.reduce((sum, v) => sum + v, 0) / values.length;
    }
  });

  return avgScores;
}
