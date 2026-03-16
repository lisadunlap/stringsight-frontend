# Clustering & Metrics API Flow Documentation

This document provides a detailed reference for the clustering and metrics workflow in StringSight, including the request format, input data structure, expected output format, and how data is parsed and displayed in the frontend.

## Quick Answer: How Are Metrics Computed?

**Metrics are computed by the backend**, not the frontend. The frontend sends two types of API requests:

1. **POST /cluster/run** - Full clustering + metrics computation
   - Triggered when: User clicks "Cluster Properties" button
   - Input: `operationalRows` (with score **objects**), `properties`, clustering params
   - Output: `clusters` + full `metrics` object (model_cluster_scores, cluster_scores, model_scores)
   - Backend: Clusters properties, joins with conversations by `question_id`, extracts scores, computes statistics

2. **POST /cluster/metrics** - Fast metrics recomputation for filtered subsets
   - Triggered when: User filters clusters in ClustersTab
   - Input: Existing `clusters`, `properties`, `operationalRows`, optional `included_property_ids`
   - Output: Updated `clusters` only (no `metrics` object)
   - Backend: Recomputes metrics for filtered properties without re-clustering

**⚠️ CRITICAL BUG**: The frontend sends `score`/`score_a`/`score_b` but the backend expects **`scores`** (plural) with a different format:
- Single model: `scores: { helpfulness: 0.8 }` (not `score`)
- Side-by-side: `scores: [{ helpfulness: 0.8 }, { helpfulness: 0.7 }]` (not `score_a`/`score_b` as separate fields)

The backend also expects `responses` (not `model_response`/`model_a_response`/`model_b_response`).

**This mismatch is why metrics aren't being computed correctly!**

---

## Table of Contents

1. [Overview](#overview)
2. [How Are Metrics Computed?](#how-are-metrics-computed)
3. [POST /cluster/metrics](#post-clustermetrics)
4. [POST /cluster/run](#post-clusterrun)
5. [Metrics Data Structure](#metrics-data-structure)
6. [Frontend Parsing & Display](#frontend-parsing--display)
7. [Common Issues & Debugging](#common-issues--debugging)

---

## Overview

The clustering flow involves three main steps:

1. **Frontend sends clustering request** to `/api/cluster/run` with operational data, properties, and parameters
2. **Backend clusters properties** and computes metrics with quality scores and confidence intervals
3. **Frontend receives and normalizes metrics** for display in the Clusters and Metrics tabs

### Key Data Transformations

The frontend maintains three data layers:
- **originalRows**: Raw uploaded data (never modified)
- **operationalRows**: Cleaned data with **consolidated score objects** (e.g., `score: { helpfulness: 0.8 }`)
- **currentRows**: Display data with **flattened score columns** (e.g., `score_helpfulness: 0.8`)

**IMPORTANT**: Backend operations use `operationalRows` (score dictionaries), while UI tables use `currentRows` (flattened scores).

---

## How Are Metrics Computed?

Metrics are computed **on the backend** using the Python StringSight library. There are two API endpoints that compute metrics:

| Endpoint | Purpose | When Called | Returns `metrics` Object? | Speed |
|----------|---------|-------------|---------------------------|-------|
| **POST /cluster/run** | Initial clustering + metrics | User clicks "Cluster Properties" | ✅ Yes (model_cluster_scores, cluster_scores, model_scores) | Slow (full clustering) |
| **POST /cluster/metrics** | Recompute metrics for filtered subset | User filters clusters in ClustersTab | ❌ No (only updated clusters) | Fast (no re-clustering) |

### Two Ways Metrics Are Computed:

### 1. Initial Clustering (POST /cluster/run)

When you click "Cluster Properties", the backend:
1. **Clusters properties** using HDBSCAN embeddings
2. **Joins clustered properties with operationalRows** by `question_id`
3. **Computes metrics** from the score data:
   - `proportion`: % of model's conversations showing this cluster behavior
   - `proportion_delta`: Difference from average across all models
   - `quality_<metric>`: Average score for this metric in this cluster
   - `quality_<metric>_delta`: Difference from model's overall average
   - Confidence intervals using bootstrap resampling (default: 100 samples)
   - Significance flags using statistical tests

**Key Point**: The backend needs the `score` field from `operationalRows` to compute quality metrics. Without score data, you'll only get frequency metrics (proportion, size) but not quality metrics.

### 2. Recompute Metrics (POST /cluster/metrics)

When you filter clusters in the ClustersTab, the frontend calls `/cluster/metrics` to recompute metrics for the filtered subset **without re-running clustering**. This is much faster than full clustering.

**Location in code**: [src/App.tsx:1807-1835](src/App.tsx#L1807-L1835)

The recompute process:
1. Filters properties to the selected subset
2. Re-joins with operationalRows
3. Recomputes all metrics (proportion, quality, deltas, CIs) for the filtered data
4. Returns updated clusters with new metrics

**Note**: The `/cluster/metrics` response does **NOT** include the full `metrics` object (model_cluster_scores, cluster_scores, model_scores). It only returns updated `clusters` with recalculated metadata. The original metrics from `/cluster/run` are cached and reused for the Metrics tab.

### Metrics Computation Details

The backend metrics computation happens in the Python StringSight library's `compute_metrics()` function. Here's what it does:

**For each (model, cluster) pair:**

1. **Find matching properties**: Filter properties to those in this cluster for this model
2. **Join with conversations**: Match properties to operationalRows by `question_id`
3. **Extract scores**: Read the `score` dict from each matched conversation
4. **Compute aggregates**:
   - **Size**: Count of properties
   - **Proportion**: `size / total_conversations_for_model`
   - **Proportion Delta**: `proportion - average_proportion_across_all_models`
   - **Quality metrics** (for each metric in score dict):
   - `quality_<metric>`: Mean of score values for this metric
   - `quality_<metric>_delta`: **Attributable Impact** for this cluster and metric (the delta in quality between conversations containing this behavior vs quality of all conversations)
5. **Bootstrap confidence intervals** (if enabled):
   - Resample conversations with replacement
   - Recompute metrics on each sample
   - Calculate 95% CI from distribution
6. **Significance tests**:
   - `proportion_delta_significant`: True if proportion CI doesn't contain 0
   - `quality_<metric>_delta_significant`: True if quality impact (quality_delta) CI doesn't contain 0

**Example:**
```python
# Backend receives operationalRows like:
[
  {"question_id": "0", "model": "gpt-4", "score": {"helpfulness": 0.8, "accuracy": 0.9}},
  {"question_id": "1", "model": "gpt-4", "score": {"helpfulness": 0.7, "accuracy": 0.85}},
  ...
]

# And properties like:
[
  {"id": "prop_0_gpt-4", "question_id": "0", "model": "gpt-4", "cluster_id": 0},
  {"id": "prop_1_gpt-4", "question_id": "1", "model": "gpt-4", "cluster_id": 0},
  ...
]

# Backend computes:
{
  "model": "gpt-4",
  "cluster": "Cluster 0: ...",
  "size": 2,
  "proportion": 0.067,  # 2/30 conversations
  "quality_helpfulness": 0.75,  # mean([0.8, 0.7])
  "quality_accuracy": 0.875,  # mean([0.9, 0.85])
  "quality_helpfulness_delta": -0.05,  # Attributable Impact: this behavior lowers the model's overall helpfulness score by 0.05
  # ... plus CIs and significance
}
```

**Critical Dependencies:**
- `operationalRows` must contain `score` as a **nested dict** (not flattened columns)
- `question_id` must match between operationalRows and properties
- Score dict keys become the quality metric names (e.g., `{"helpfulness": 0.8}` → `quality_helpfulness`)

---

## POST /cluster/metrics

This endpoint is used to **recompute metrics without re-running clustering**. It's much faster than full clustering and is called when you filter clusters in the ClustersTab.

### When Is It Called?

**Location in code**: [src/App.tsx:1807-1835](src/App.tsx#L1807-L1835)

The frontend calls `/cluster/metrics` in these scenarios:
1. **Filtering clusters in ClustersTab**: When you toggle filters for behavior types, categories, or models
2. **Selecting specific properties**: When you want metrics for a subset of properties

### Endpoint

```
POST /api/cluster/metrics
```

### Request Format

```typescript
{
  clusters: any[];                    // Existing cluster objects from /cluster/run
  properties: any[];                  // All extracted properties
  operationalRows: any[];             // Conversation data (same as /cluster/run)
  included_property_ids?: string[];   // Optional: filter to specific properties
  score_columns?: string[];           // Optional: score column names
}
```

**Key Difference from `/cluster/run`:**
- `/cluster/run`: Clusters properties + computes metrics → returns `clusters` + full `metrics` object
- `/cluster/metrics`: Uses existing clusters + recomputes metrics → returns only updated `clusters` (no `metrics` object)

### Response Format

```typescript
{
  clusters: any[];                              // Updated clusters with recalculated metrics
  total_conversations_by_model?: Record<string, number>;
  total_unique_conversations?: number;
}
```

**Important**: The response does **NOT** include the `metrics` object (model_cluster_scores, cluster_scores, model_scores). The frontend caches the original metrics from `/cluster/run` and continues to use them in the Metrics tab.

### Example Usage in Frontend

```typescript
// User filters clusters in ClustersTab
const onRequestRecompute = async (included_property_ids?: string[]) => {
  const res = await recomputeClusterMetrics({
    clusters,                // Existing clusters
    properties: propertiesRows,
    operationalRows,
    included_property_ids,   // Filtered subset
    score_columns: ["score_helpfulness", "score_accuracy"]
  });

  // Update clusters with new metrics
  setClusters(res.clusters);

  // Note: resultsMetrics stays the same (cached from /cluster/run)
};
```

### What Gets Recomputed?

For the filtered subset, the backend recalculates:
- Cluster sizes (number of properties in each cluster)
- Proportions (% of conversations showing this behavior)
- Quality scores (average scores for filtered properties)
- Deltas and confidence intervals
- Significance flags

The cluster assignments themselves (which properties belong to which cluster) remain unchanged.

---

## POST /cluster/run

### Endpoint

```
POST /api/cluster/run
```

### Request Format

**Location in code**: [src/components/sidebar-sections/ClusteringPanel.tsx:74-80](src/components/sidebar-sections/ClusteringPanel.tsx#L74-L80)

```typescript
const body = {
  operationalRows: any[];        // Conversation data with score OBJECTS
  properties: any[];             // Extracted properties
  params: {
    minClusterSize: number;      // Default: 5
    embeddingModel: string;      // e.g., "openai/text-embedding-3-large"
    groupBy: 'none' | 'category' | 'behavior_type';  // Default: 'behavior_type'
    summarizationModel?: string; // e.g., "gpt-4.1" (optional)
    matchingModel?: string;      // e.g., "gpt-4.1-mini" (optional)
  };
  score_columns?: string[];      // Auto-detected flattened score column names (for backend reference)
}
```

### Input Data Structure

#### operationalRows Format

**⚠️ CRITICAL BUG IDENTIFIED**: The frontend currently sends `score`/`score_a`/`score_b` but the backend expects `scores` (plural) with a different structure!

**What Frontend Currently Sends (INCORRECT):**

Single Model:
```json
{
  "question_id": "0",
  "prompt": "What is AI?",
  "model": "gpt-4",
  "model_response": "AI is artificial intelligence...",
  "score": {                    // ❌ Wrong: should be "scores" (plural)
    "helpfulness": 0.8,
    "accuracy": 0.9
  }
}
```

Side-by-Side:
```json
{
  "question_id": "0",
  "prompt": "Compare these models",
  "model_a": "gpt-4",
  "model_b": "claude-3",
  "model_a_response": "...",
  "model_b_response": "...",
  "score_a": {                  // ❌ Wrong: should be "scores": [score_a, score_b]
    "helpfulness": 0.8
  },
  "score_b": {
    "helpfulness": 0.7
  }
}
```

**What Backend Expects (From ConversationRecord dataclass):**

Single Model:
```json
{
  "question_id": "0",
  "prompt": "What is AI?",
  "model": "gpt-4",
  "responses": "AI is artificial intelligence...",  // Note: "responses" not "model_response"
  "scores": {                   // ✅ Correct: "scores" (plural)
    "helpfulness": 0.8,
    "accuracy": 0.9
  }
}
```

Side-by-Side:
```json
{
  "question_id": "0",
  "prompt": "Compare these models",
  "model": ["gpt-4", "claude-3"],               // ✅ List of models
  "responses": ["AI is...", "Artificial..."],   // ✅ List of responses
  "scores": [                                    // ✅ List of score dicts
    {"helpfulness": 0.8},
    {"helpfulness": 0.7}
  ]
}
```

**Backend Migration Fallback**: The backend's `ConversationRecord.__post_init__` has a migration path for `score_a`/`score_b` in the `meta` field, but this doesn't help if they're sent as top-level fields.

**Fix Required**: Update [src/App.tsx:838, 867-868](src/App.tsx#L838) to:
1. Use `scores` instead of `score`/`score_a`/`score_b`
2. For side-by-side, send `scores` as a list: `[scoreADict, scoreBDict]`
3. Use `responses` instead of `model_response`/`model_a_response`/`model_b_response`

#### properties Format

```json
{
  "id": "prop_0_gpt-4",         // Unique property ID
  "question_id": "0",           // Links back to operationalRows
  "model": "gpt-4",
  "property_description": "Provides structured definition with examples",
  "category": "Response Style",
  "reason": "The response breaks down the concept methodically",
  "evidence": "AI is...[quote from response]",
  "behavior_type": "positive",  // "positive" | "negative" | "neutral"
  "contains_errors": false,
  "unexpected_behavior": false
}
```

#### score_columns (Auto-detected)

The frontend automatically detects flattened score column names from `operationalRows[0]`:

```typescript
const scoreColumns = operationalRows[0]
  ? Object.keys(operationalRows[0]).filter(k => k.startsWith('score_'))
  : [];
```

Example: `["score_helpfulness", "score_accuracy"]`

This helps the backend understand which quality metrics exist, though the backend primarily reads from the nested `score` objects.

---

## Response Format

### Expected Output Structure

**Location in code**: [src/lib/api.ts:273-283](src/lib/api.ts#L273-L283)

```typescript
{
  clusters: any[];
  total_conversations_by_model?: Record<string, number>;
  total_unique_conversations?: number;
  metrics?: {
    model_cluster_scores: any[];
    cluster_scores: any[];
    model_scores: any[];
  };
}
```

### clusters Array

Each cluster object contains:

```json
{
  "id": 0,
  "label": "Cluster 0: Detailed explanations with examples",
  "size": 45,                           // Number of properties in this cluster
  "property_descriptions": [
    "Provides structured definition with examples",
    "Uses analogies to explain concepts"
  ],
  "property_ids": ["prop_0_gpt-4", "prop_5_gpt-4"],
  "question_ids": ["0", "5", "8"],     // Conversation IDs
  "meta": {
    "proportion_overall": 0.15,         // % of all conversations showing this behavior
    "property_items": [                 // Full property objects
      {
        "property_id": "prop_0_gpt-4",
        "model": "gpt-4",
        "property_description": "..."
      }
    ]
  }
}
```

### total_conversations_by_model

Maps model names to conversation counts:

```json
{
  "gpt-4": 150,
  "claude-3": 150
}
```

### total_unique_conversations

Total number of unique conversations (deduplicated by `question_id`):

```json
300
```

---

## Metrics Data Structure

The `metrics` object contains three arrays that power the Metrics tab visualizations.

### model_cluster_scores

**Purpose**: Per-model, per-cluster metrics (used for cluster plots and model cards)

**Backend Column Names** (before normalization):
```json
{
  "model": "gpt-4",
  "cluster": "Cluster 0: Detailed explanations with examples",
  "cluster_id": 0,
  "size": 45,                                    // Number of properties
  "proportion": 0.30,                            // % of model's conversations with this behavior
  "proportion_delta": 0.05,                      // Difference from average across all models
  "proportion_ci_lower": 0.27,                   // 95% CI lower bound
  "proportion_ci_upper": 0.33,                   // 95% CI upper bound
  "proportion_delta_significant": true,          // Statistical significance

  // Quality metrics (dynamic based on score columns)
  "quality_helpfulness": 0.82,                   // Average score for this metric
  "quality_helpfulness_delta": 0.03,             // Attributable Impact on overall model helpfulness
  "quality_helpfulness_ci_lower": 0.78,          // 95% CI
  "quality_helpfulness_ci_upper": 0.86,
  "quality_helpfulness_delta_significant": true,

  "quality_accuracy": 0.88,
  "quality_accuracy_delta": 0.02,
  // ... more quality metrics

  "metadata": {
    "group": "Response Style"                    // For filtering
  },
  "examples": [
    ["0", "gpt-4", "prop_0_gpt-4"],             // [conversation_id, model, property_id]
    ["5", "gpt-4", "prop_5_gpt-4"]
  ]
}
```

**Frontend Column Names** (after normalization):

The frontend **normalizes** quality delta columns (Attributable Impact, shown in the UI as **Quality Impact**) from:
- `quality_helpfulness_delta` → `quality_delta_helpfulness`
- `quality_helpfulness_delta_ci_lower` → `quality_delta_helpfulness_ci_lower`
- `quality_helpfulness_delta_significant` → `quality_delta_helpfulness_significant`

This normalization happens in [src/lib/normalize.ts:77-147](src/lib/normalize.ts#L77-L147).

### cluster_scores

**Purpose**: Aggregated cluster metrics across all models

```json
{
  "cluster": "Cluster 0: Detailed explanations with examples",
  "cluster_id": 0,
  "size": 150,                              // Total properties (all models)
  "proportion": 0.25,                       // % of all conversations
  "quality_helpfulness": 0.80,              // Average across all models
  "quality_accuracy": 0.88,
  // CI and significance fields similar to model_cluster_scores
}
```

### model_scores

**Purpose**: Overall model performance (used for benchmark table)

```json
{
  "model": "gpt-4",
  "cluster": "all_clusters",                // Always this value
  "size": 150,                              // Total conversations
  "proportion": 1.0,                        // Always 1.0 for aggregates
  "quality_helpfulness": 0.81,              // Overall model average
  "quality_helpfulness_ci_lower": 0.79,
  "quality_helpfulness_ci_upper": 0.83,
  // ... more quality metrics
}
```

---

## Frontend Parsing & Display

### Step 1: Receive Response

**Location**: [src/App.tsx:2086-2125](src/App.tsx#L2086-L2125)

```typescript
onClustersUpdated={(data) => {
  // 1. Enrich clusters with quality data
  let enrichedClusters = data.clusters || [];
  if (data.metrics?.model_cluster_scores) {
    const normalizedMetrics = normalizeMetricsColumnNames(data.metrics);
    enrichedClusters = enrichClustersWithQualityData(
      data.clusters || [],
      normalizedMetrics.model_cluster_scores
    );
  }

  // 2. Save clusters
  setClusters(enrichedClusters);
  setTotalConversationsByModel(data.total_conversations_by_model || null);
  setTotalUniqueConversations(data.total_unique_conversations || null);

  // 3. Normalize and save metrics
  if (data.metrics) {
    const normalizedMetrics = normalizeMetricsColumnNames(data.metrics);
    setResultsMetrics(normalizedMetrics);

    // 4. Switch to Metrics tab
    setActiveSection('metrics');
  }
})
```

### Step 2: Normalize Metrics Column Names

**Location**: [src/lib/normalize.ts:77-147](src/lib/normalize.ts#L77-L147)

The `normalizeMetricsColumnNames()` function transforms backend column naming to frontend expectations:

**Transformations:**
```
quality_{metric}_delta                 → quality_delta_{metric}
quality_{metric}_delta_significant     → quality_delta_{metric}_significant
quality_{metric}_delta_ci_lower        → quality_delta_{metric}_ci_lower
quality_{metric}_delta_ci_upper        → quality_delta_{metric}_ci_upper
quality_{metric}_delta_ci_mean         → quality_delta_{metric}_ci_mean
```

**Example:**
```typescript
// Backend format
{
  quality_helpfulness_delta: 0.03,
  quality_helpfulness_delta_significant: true
}

// After normalization
{
  quality_delta_helpfulness: 0.03,
  quality_delta_helpfulness_significant: true
}
```

### Step 3: Enrich Clusters with Quality Data

**Location**: [src/App.tsx:75-140](src/App.tsx#L75-L140)

The `enrichClustersWithQualityData()` function adds per-model quality metrics to cluster objects:

```typescript
// Before enrichment
cluster = {
  id: 0,
  label: "Cluster 0: ...",
  property_ids: [...]
}

// After enrichment
cluster = {
  id: 0,
  label: "Cluster 0: ...",
  property_ids: [...],
  quality_by_model: {
    "gpt-4": {
      quality_helpfulness: 0.82,
      quality_accuracy: 0.88
    },
    "claude-3": {
      quality_helpfulness: 0.79,
      quality_accuracy: 0.85
    }
  },
  quality_delta_by_model: {
    "gpt-4": {
      quality_delta_helpfulness: 0.03,
      quality_delta_helpfulness_significant: true
    }
  }
}
```

### Step 4: Extract Quality Metrics

**Location**: [src/components/metrics/MetricsTab.tsx:108-117](src/components/metrics/MetricsTab.tsx#L108-L117)

The MetricsTab component extracts available quality metric names from the data:

```typescript
const qualityMetrics = new Set<string>();
modelClusterScores.forEach((row: any) => {
  Object.keys(row).forEach(key => {
    // Match pattern: quality_<metric_name>
    // Exclude: quality_*_delta, quality_*_significant, quality_*_ci_*
    if (key.startsWith('quality_') &&
        !key.endsWith('_delta') &&
        !key.endsWith('_significant') &&
        !key.includes('_ci_')) {
      const metric = key.replace('quality_', '');
      qualityMetrics.add(metric);
    }
  });
});
```

**Example**: If the data contains `quality_helpfulness` and `quality_accuracy`, the set will be `["helpfulness", "accuracy"]`.

### Step 5: Display in UI

#### Clusters Tab

**Location**: [src/components/ClustersTab.tsx](src/components/ClustersTab.tsx)

Displays clusters with:
- Cluster ID and label
- Size and proportion
- Property descriptions
- Per-model quality metrics (from `quality_by_model`)
- Examples

#### Metrics Tab

**Location**: [src/components/metrics/MetricsTab.tsx](src/components/metrics/MetricsTab.tsx)

Displays three sections:

1. **Benchmark Table** (uses `model_scores`):
   - Overall model performance across all clusters
   - Quality metrics with confidence intervals

2. **Cluster Plots** (uses `model_cluster_scores`):
   - **Frequency Plot**: Shows `proportion` per model/cluster
   - **Frequency Delta Plot**: Shows `proportion_delta` with zero baseline
   - **Quality Plot**: Shows `quality_<metric>` per model/cluster
   - **Quality Delta Plot**: Shows `quality_delta_<metric>` with zero baseline

3. **Model Cards** (uses `model_cluster_scores`):
   - Two-column grid showing top N clusters per model
   - Significance badges for frequency and quality deltas
   - Tag chips for metadata (e.g., group)

---

## Common Issues & Debugging

### Issue 1: Missing Metrics in Response

**Symptom**: `metrics` object is undefined or empty in clustering response

**Possible Causes**:
1. **Backend didn't receive score data**: Check that `operationalRows` contains `score` objects (not flattened columns)
2. **score_columns mismatch**: Verify that detected `score_columns` match the actual nested keys in `score` objects
3. **Backend error during metrics computation**: Check backend logs for exceptions

**Debug Logs** (in [ClusteringPanel.tsx:54-94](src/components/sidebar-sections/ClusteringPanel.tsx#L54-L94)):
```typescript
console.log('🔍 Sending to backend:');
console.log('  - operationalRows count:', operationalRows.length);
console.log('  - Sample row score:', operationalRows[0]?.score);
console.log('  - Sample row score type:', typeof operationalRows[0]?.score);
console.log('  - Score-related columns found:', scoreColumns);
```

**Check**:
```typescript
// Correct: score is an object
operationalRows[0].score // → { helpfulness: 0.8, accuracy: 0.9 }

// Incorrect: score is flattened
operationalRows[0].score_helpfulness // → 0.8
```

### Issue 2: Quality Metrics Not Appearing in Charts

**Symptom**: Charts show "No quality data available" or don't display quality metrics

**Possible Causes**:
1. **Column name mismatch**: Frontend expects `quality_<metric>` but backend returns different format
2. **Normalization failed**: Check that `normalizeMetricsColumnNames()` properly transformed delta columns
3. **Metric extraction failed**: Verify that quality metric names are correctly extracted

**Debug Logs** (in [App.tsx:2105-2117](src/App.tsx#L2105-L2117)):
```typescript
console.log('🟢 Raw metrics from backend:', data.metrics);
console.log('🟢 model_cluster_scores length:', data.metrics.model_cluster_scores?.length);
console.log('🟢 Sample row before normalization:', data.metrics.model_cluster_scores?.[0]);
console.log('🟢 Quality columns:', Object.keys(...).filter(k => k.startsWith('quality_')));
console.log('🟢 After normalization:', normalizedMetrics.model_cluster_scores?.[0]);
```

**Check**:
```typescript
// Correct format (after normalization)
{
  quality_helpfulness: 0.82,
  quality_delta_helpfulness: 0.03,  // NOT quality_helpfulness_delta
  quality_delta_helpfulness_significant: true
}
```

### Issue 3: Clusters Appear But Metrics Tab Is Empty

**Symptom**: Clusters tab populates, but Metrics tab shows no data

**Possible Causes**:
1. **metrics object not returned**: Backend returned `clusters` but not `metrics`
2. **Metrics state not set**: `setResultsMetrics()` not called or failed
3. **Data processing error**: Exception in `MetricsTab` data processing

**Debug Logs** (in [App.tsx:2104](src/App.tsx#L2104)):
```typescript
if (data.metrics) {
  console.log('🟢 Raw metrics from backend:', data.metrics);
  // ...
} else {
  console.warn('⚠️ No metrics in clustering response!');
}
```

**Check**:
```typescript
// Verify metrics state is set
console.log('resultsMetrics:', resultsMetrics);
console.log('model_cluster_scores length:', resultsMetrics?.model_cluster_scores?.length);
```

### Issue 4: Backend Column Naming Issues

**Symptom**: Quality impact (quality deltas) doesn't match expected pattern

**Backend Should Return**:
- `quality_helpfulness` (absolute value)
- `quality_helpfulness_delta` (delta from average)
- `quality_helpfulness_delta_significant` (boolean)
- `quality_helpfulness_ci_lower` (confidence interval)
- `quality_helpfulness_ci_upper` (confidence interval)

**Frontend Expects After Normalization**:
- `quality_helpfulness` (absolute value)
- `quality_delta_helpfulness` (Attributable Impact from average) ← **NOTE THE REORDERING**
- `quality_delta_helpfulness_significant` (boolean)
- `quality_delta_helpfulness_ci_lower` (confidence interval)
- `quality_delta_helpfulness_ci_upper` (confidence interval)

**If backend returns wrong format**, update the normalization regex patterns in [src/lib/normalize.ts:92-129](src/lib/normalize.ts#L92-L129).

---

## Quick Reference: Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User clicks "Cluster Properties" in ClusteringPanel         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Frontend sends POST /api/cluster/run                        │
│    - operationalRows (with score OBJECTS)                      │
│    - properties (extracted)                                     │
│    - params (clustering config)                                 │
│    - score_columns (auto-detected)                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Backend clusters properties and computes metrics            │
│    - Groups properties by embeddings                            │
│    - Joins with operationalRows by question_id                  │
│    - Computes proportion, quality, deltas, CIs                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Backend returns response with:                              │
│    - clusters (with labels, sizes, property_ids)                │
│    - total_conversations_by_model                               │
│    - metrics.model_cluster_scores (per-model, per-cluster)      │
│    - metrics.cluster_scores (per-cluster aggregates)            │
│    - metrics.model_scores (per-model benchmarks)                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Frontend processes response (App.tsx onClustersUpdated)     │
│    a. Normalize metrics column names                            │
│       (quality_X_delta → quality_delta_X)                       │
│    b. Enrich clusters with quality_by_model                     │
│    c. Set state: clusters, resultsMetrics                       │
│    d. Switch to Metrics section                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. MetricsTab processes data                                    │
│    a. Extract quality metric names (helpfulness, accuracy, ...) │
│    b. Extract available models and groups                       │
│    c. Build modelClusterData and benchmarkData payloads         │
│    d. Render charts and model cards                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. User views results in Clusters and Metrics tabs             │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Type Definitions

### TypeScript Interfaces

**Request** (defined in [src/lib/api.ts:265-270](src/lib/api.ts#L265-L270)):
```typescript
interface ClusterRunRequest {
  operationalRows: any[];
  properties: any[];
  params: {
    minClusterSize?: number | null;
    embeddingModel: string;
    groupBy?: 'none' | 'category' | 'behavior_type';
    summarizationModel?: string;
    matchingModel?: string;
  };
  score_columns?: string[];
}
```

**Response** (defined in [src/lib/api.ts:273-283](src/lib/api.ts#L273-L283)):
```typescript
interface ClusterRunResponse {
  clusters: any[];
  total_conversations_by_model?: Record<string, number>;
  total_unique_conversations?: number;
  metrics?: {
    model_cluster_scores: any[];
    cluster_scores: any[];
    model_scores: any[];
  };
}
```

**Metrics Types** (defined in [src/types/metrics.ts](src/types/metrics.ts)):
```typescript
interface ModelClusterRow {
  model: string;
  cluster: string;
  size: number;
  proportion: number;
  proportion_delta: number;
  proportion_delta_significant?: boolean;

  // Dynamic quality metrics
  [key: `quality_${string}`]: number;
  [key: `quality_delta_${string}`]: number;
  [key: `quality_delta_${string}_significant`]: boolean;
  [key: `quality_${string}_ci_lower`]: number;
  [key: `quality_${string}_ci_upper`]: number;

  metadata?: Record<string, any>;
  examples?: any[];
}
```

---

## Related Files

### API Layer
- [src/lib/api.ts](src/lib/api.ts) - Backend communication
- [src/lib/normalize.ts](src/lib/normalize.ts) - Metrics column normalization

### Components
- [src/components/sidebar-sections/ClusteringPanel.tsx](src/components/sidebar-sections/ClusteringPanel.tsx) - Clustering UI and request handling
- [src/components/ClustersTab.tsx](src/components/ClustersTab.tsx) - Clusters display
- [src/components/metrics/MetricsTab.tsx](src/components/metrics/MetricsTab.tsx) - Metrics visualization

### State Management
- [src/App.tsx](src/App.tsx) - Main state container (lines 2086-2125 for clustering handler)

### Type Definitions
- [src/types/metrics.ts](src/types/metrics.ts) - Metrics type definitions
