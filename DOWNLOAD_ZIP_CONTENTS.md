# Download Zip Contents

This document catalogs the files included in the frontend's **Download Results** zip file and explains how they differ from the backend's saved files.

## Overview

When you click "Download Results" in the UI, the frontend creates a zip file containing a clean, reusable subset of the results data. These files are in the input format and can be re-uploaded to the UI for further analysis.

**Zip filename format:** `{resultsName}_{YYYY-MM-DD}.zip`
- `resultsName`: User-specified name or uploaded filename or "clustering_results" (default)
- Date: Current date in ISO format (YYYY-MM-DD)

## Files Included in Download Zip

### Always Included

#### 1. `clusters.jsonl`
**Source:** Frontend `clusters` state array  
**Format:** JSONL (one JSON object per line)  
**Purpose:** Cluster definitions with property and question IDs

**Structure:**
```json
{
  "id": "1",
  "label": "Provides well-formatted code examples",
  "size": 45,
  "property_descriptions": [
    "Provides code with proper syntax highlighting and formatting",
    "Includes markdown code blocks for code snippets"
  ],
  "property_ids": [
    "67891533-db42-45e0-bde2-fe7e1840b4a2",
    "a1b2c3d4-e5f6-4789-abcd-ef1234567890"
  ],
  "question_ids": [
    "352",
    "423"
  ],
  "meta": {}
}
```

#### 2. `properties.jsonl`
**Source:** Frontend `propertiesRows` state array  
**Format:** JSONL (one JSON object per line)  
**Purpose:** Extracted behavioral properties

**Structure:**
```json
{
  "id": "67891533-db42-45e0-bde2-fe7e1840b4a2",
  "question_id": "352",
  "model": "gpt-4",
  "property_description": "Provides code with proper syntax highlighting and formatting",
  "category": "Code Quality",
  "reason": "The model formatted the code in a clear, readable manner",
  "evidence": "\"Here's a function to reverse a string\", \"return s[::-1]\"",
  "behavior_type": "Positive",
  "raw_response": null,
  "contains_errors": false,
  "unexpected_behavior": false,
  "meta": {}
}
```

### Conditionally Included

#### 3. `conversations.jsonl` (if operationalRows.length > 0)
**Source:** Frontend `operationalRows` state array  
**Format:** JSONL (one JSON object per line)  
**Purpose:** Original conversation data with prompts and responses

**Single Model Structure:**
```json
{
  "question_id": "352",
  "prompt": "Write a Python function to reverse a string",
  "model": "gpt-4",
  "model_response": [
    {"role": "user", "content": "Write a Python function to reverse a string"},
    {"role": "assistant", "content": "Here's a function:\n\n```python\ndef reverse_string(s):\n    return s[::-1]\n```"}
  ],
  "score": {"helpfulness": 5.0, "conciseness": 4.5}
}
```

**Side-by-Side Structure:**
```json
{
  "question_id": "352",
  "prompt": "Write a Python function to reverse a string",
  "model_a": "gpt-4",
  "model_b": "claude-3-opus",
  "model_a_response": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "model_b_response": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "score_a": {"helpfulness": 5.0},
  "score_b": {"helpfulness": 4.5},
  "winner": "model_a"
}
```

#### 4. `model_cluster_scores_df.jsonl` (if resultsMetrics exists)
**Source:** Frontend `resultsMetrics.model_cluster_scores` array  
**Format:** JSONL (one JSON object per line)  
**Purpose:** Per-model per-cluster quality metrics

**Structure:**
```json
{
  "model": "gpt-4",
  "cluster": "Provides well-formatted code examples",
  "size": 25,
  "proportion": 0.35,
  "proportion_delta": 0.05,
  "quality_helpfulness": 0.82,
  "quality_helpfulness_delta": 0.03,
  "quality_conciseness": 0.78,
  "quality_conciseness_delta": 0.01
}
```

#### 5. `cluster_scores_df.jsonl` (if resultsMetrics exists)
**Source:** Frontend `resultsMetrics.cluster_scores` array  
**Format:** JSONL (one JSON object per line)  
**Purpose:** Aggregated per-cluster metrics across all models

**Structure:**
```json
{
  "cluster": "Provides well-formatted code examples",
  "size": 120,
  "proportion": 0.40,
  "avg_quality_overall": 0.79,
  "avg_quality_helpfulness": 0.81,
  "avg_quality_conciseness": 0.77
}
```

#### 6. `model_scores_df.jsonl` (if resultsMetrics exists)
**Source:** Frontend `resultsMetrics.model_scores` array  
**Format:** JSONL (one JSON object per line)  
**Purpose:** Aggregated per-model metrics across all clusters

**Structure:**
```json
{
  "model": "gpt-4",
  "size": 300,
  "avg_quality_overall": 0.81,
  "avg_quality_helpfulness": 0.83,
  "avg_quality_conciseness": 0.79,
  "avg_quality_harmlessness": 0.95
}
```

## Comparison: Frontend Download vs Backend Saved Files

### Frontend Download Zip (This Document)
Files created by the frontend when clicking "Download Results":

**Core Files (always included):**
- `clusters.jsonl` - Cluster definitions
- `properties.jsonl` - Extracted properties

**Conditional Files:**
- `conversations.jsonl` - Original conversations (if available)
- `model_cluster_scores_df.jsonl` - Per-model-cluster metrics (if computed)
- `cluster_scores_df.jsonl` - Per-cluster metrics (if computed)
- `model_scores_df.jsonl` - Per-model metrics (if computed)

**Characteristics:**
- Input format (can be re-uploaded to UI)
- Clean, minimal file set
- Optimized for sharing and reuse
- No intermediate pipeline files
- No embeddings or stats files

### Backend Saved Files (Python API)
Files saved by the backend when `output_dir` is specified:

**Essential Files:**
- `full_dataset.json` - Complete PropertyDataset
- `summary.txt` - Human-readable summary

**Extraction Stage:**
- `raw_properties.jsonl` - Raw LLM responses
- `extraction_stats.json` - Extraction statistics
- `extraction_samples.jsonl` - Sample inputs/outputs

**Parsing Stage:**
- `parsed_properties.jsonl` - Parsed property objects
- `parsing_stats.json` - Parsing statistics
- `parsing_failures.jsonl` - Failed parsing attempts

**Validation Stage:**
- `validated_properties.jsonl` - Validated properties
- `validation_stats.json` - Validation statistics

**Clustering Stage:**
- `clustered_results.jsonl` - Complete data with cluster assignments
- `clustered_results_lightweight.jsonl` - Without embeddings
- `embeddings.parquet` - Property embeddings (if `include_embeddings=True`)
- `summary_table.jsonl` - Cluster summary

**Metrics Stage:**
- `model_cluster_scores_df.jsonl` - Per-model-cluster metrics (JSONL)
- `model_scores_df.jsonl` - Per-model metrics (JSONL)
- `cluster_scores_df.jsonl` - Per-cluster metrics (JSONL)
- `model_cluster_scores.json` - Same as above (JSON)
- `cluster_scores.json` - Same as above (JSON)
- `model_scores.json` - Same as above (JSON)

**Characteristics:**
- Comprehensive pipeline artifacts
- Internal format (uses `scores` instead of `score`, etc.)
- Includes intermediate stages and debugging files
- Includes statistics and failure logs
- Optimized for analysis and debugging

### Key Differences

| Aspect | Frontend Download | Backend Saved Files |
|--------|------------------|---------------------|
| **Purpose** | Share & reuse results | Debug & analyze pipeline |
| **Format** | Input format (re-uploadable) | Internal format |
| **File Count** | 2-6 files | 20+ files |
| **Size** | Minimal | Comprehensive |
| **Conversations** | `conversations.jsonl` | Inside `full_dataset.json` only |
| **Properties** | `properties.jsonl` (clean) | `parsed_properties.jsonl`, `validated_properties.jsonl`, etc. |
| **Clusters** | `clusters.jsonl` (standalone) | Inside `clustered_results.jsonl`, `summary_table.jsonl` |
| **Metrics** | `*_df.jsonl` only | Both `*_df.jsonl` and `*.json` formats |
| **Intermediate Files** | None | Raw properties, stats, failures, samples |
| **Embeddings** | Not included | `embeddings.parquet` (if enabled) |
| **Summary** | Not included | `summary.txt` |

## Alignment with Backend

### Files That Match
The following files in the frontend download zip match the backend format:
- `model_cluster_scores_df.jsonl` ✓
- `cluster_scores_df.jsonl` ✓
- `model_scores_df.jsonl` ✓

### Files That Don't Match
The following files are **frontend-specific** and not saved by the backend:
- `clusters.jsonl` - Backend saves cluster data in `clustered_results.jsonl` and `summary_table.jsonl`
- `properties.jsonl` - Backend saves properties in `parsed_properties.jsonl` (deprecated format with cluster joins)
- `conversations.jsonl` - Backend only saves conversations inside `full_dataset.json`

### Recommendations for Backend Alignment

**Option 1: Backend Adds New Files (Recommended)**
If you want the backend to match the frontend download format, add these files to the backend's save routine:
1. `conversations.jsonl` - Export conversations in input format (separate from `full_dataset.json`)
2. `properties.jsonl` - Export properties as standalone objects (without cluster joins)
3. `clusters.jsonl` - Export cluster metadata as standalone objects

**Option 2: Frontend Uses Backend Files**
Alternatively, the frontend could download existing backend files:
- Use `clustered_results_lightweight.jsonl` instead of `conversations.jsonl` (deprecated path)
- Use `parsed_properties.jsonl` instead of `properties.jsonl` (deprecated format)
- Extract clusters from `summary_table.jsonl` or `full_dataset.json`

**Recommendation:** Option 1 is preferred because:
- Frontend format is cleaner and more reusable
- Input format can be re-uploaded without transformation
- Simpler for users to understand and share
- Aligns with modern best practices (standalone entities vs. denormalized joins)

## Implementation Details

The download functionality is implemented in `src/App.tsx` around line 2988:

```typescript
<Button
  startIcon={<DownloadIcon />}
  onClick={async () => {
    try {
      const zip = new JSZip();
      zip.file('clusters.jsonl', clusters.map(c => JSON.stringify(c)).join('\n'));
      zip.file('properties.jsonl', propertiesRows.map(p => JSON.stringify(p)).join('\n'));
      
      if (operationalRows.length > 0) {
        zip.file('conversations.jsonl', operationalRows.map(r => JSON.stringify(r)).join('\n'));
      }
      
      if (resultsMetrics?.model_cluster_scores && resultsMetrics.model_cluster_scores.length > 0) {
        zip.file('model_cluster_scores_df.jsonl', 
          resultsMetrics.model_cluster_scores.map(m => JSON.stringify(m)).join('\n'));
      }
      
      if (resultsMetrics?.cluster_scores && resultsMetrics.cluster_scores.length > 0) {
        zip.file('cluster_scores_df.jsonl',
          resultsMetrics.cluster_scores.map(m => JSON.stringify(m)).join('\n'));
      }
      
      if (resultsMetrics?.model_scores && resultsMetrics.model_scores.length > 0) {
        zip.file('model_scores_df.jsonl',
          resultsMetrics.model_scores.map(m => JSON.stringify(m)).join('\n'));
      }
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const baseName = resultsName.trim() || uploadedFileName || 'clustering_results';
      const filename = `${baseName}_${new Date().toISOString().slice(0,10)}.zip`;
      saveAs(blob, filename);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download results');
    }
  }}
>
  Download Results
</Button>
```

## Related Documentation

- `frontend-results-files.md` - Detailed documentation of files the UI reads
- `PYTHON_API_REFERENCE.md` - Backend API and saved files reference
- `API_REFERENCE.md` - Additional API documentation

