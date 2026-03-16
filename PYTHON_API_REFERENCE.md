# Backend API Changes for Faster Loading

## Problem

Current setup: 428 MB ZIP with all files
- Takes 12-32 seconds to load
- Downloads everything upfront (conversations, properties, clusters, metrics)

## Solution: Serve Files Separately

Instead of one big ZIP, serve individual files on-demand.

### Backend Changes

Add these endpoints to your FastAPI backend:

```python
# In stringsight/routers/validation.py

from fastapi import HTTPException
from fastapi.responses import FileResponse, StreamingResponse
import gzip
from pathlib import Path

@router.get("/results/{dataset}/conversations")
async def get_conversations(dataset: str, offset: int = 0, limit: int = 1000):
    """
    Get conversations with pagination
    Returns only the requested slice, not entire file
    """
    final_results_dir = Path("final_results") / dataset
    conversations_file = final_results_dir / "conversations.jsonl"
    
    if not conversations_file.exists():
        raise HTTPException(404, f"Dataset not found: {dataset}")
    
    # Read and paginate
    conversations = []
    with open(conversations_file) as f:
        for i, line in enumerate(f):
            if i < offset:
                continue
            if i >= offset + limit:
                break
            conversations.append(json.loads(line))
    
    return {
        "data": conversations,
        "offset": offset,
        "limit": limit,
        "has_more": len(conversations) == limit
    }

@router.get("/results/{dataset}/properties")
async def get_properties(dataset: str):
    """Get properties (usually smaller, can load all at once)"""
    final_results_dir = Path("final_results") / dataset
    properties_file = final_results_dir / "properties.jsonl"
    
    if not properties_file.exists():
        return {"data": []}
    
    properties = []
    with open(properties_file) as f:
        for line in f:
            properties.append(json.loads(line))
    
    return {"data": properties}

@router.get("/results/{dataset}/clusters")
async def get_clusters(dataset: str):
    """Get clusters"""
    final_results_dir = Path("final_results") / dataset
    clusters_file = final_results_dir / "clusters.jsonl"
    
    if not clusters_file.exists():
        return {"data": []}
    
    clusters = []
    with open(clusters_file) as f:
        for line in f:
            clusters.append(json.loads(line))
    
    return {"data": clusters}

@router.get("/results/{dataset}/metrics")
async def get_metrics(dataset: str):
    """Get all metrics files"""
    final_results_dir = Path("final_results") / dataset
    
    metrics = {}
    
    # Load each metrics file
    for metric_type in ["model_cluster_scores_df", "cluster_scores_df", "model_scores_df"]:
        metric_file = final_results_dir / f"{metric_type}.jsonl"
        if metric_file.exists():
            data = []
            with open(metric_file) as f:
                for line in f:
                    data.append(json.loads(line))
            metrics[metric_type] = data
    
    return metrics

@router.get("/results/{dataset}/summary")
async def get_dataset_summary(dataset: str):
    """
    Get dataset summary (fast - just metadata, no full data)
    Use this for the /results browser page
    """
    final_results_dir = Path("final_results") / dataset
    
    # Count lines without loading full data
    def count_lines(filepath):
        try:
            with open(filepath) as f:
                return sum(1 for _ in f)
        except FileNotFoundError:
            return 0
    
    return {
        "name": dataset,
        "total_conversations": count_lines(final_results_dir / "conversations.jsonl"),
        "total_properties": count_lines(final_results_dir / "properties.jsonl"),
        "total_clusters": count_lines(final_results_dir / "clusters.jsonl"),
        "has_metrics": (final_results_dir / "model_scores_df.jsonl").exists()
    }
```

### Unzip Your Datasets

Since you currently have ZIPs, unzip them first:

```bash
cd ~/StringSightNew/final_results

# Unzip each dataset into its own folder
unzip telecom_2026-01-02.zip -d telecom/

# Structure should be:
# final_results/
#   telecom/
#     conversations.jsonl
#     properties.jsonl
#     clusters.jsonl
#     model_cluster_scores_df.jsonl
#     cluster_scores_df.jsonl
#     model_scores_df.jsonl
```

### Frontend Changes

Update dataset loader to use new endpoints:

```typescript
// In src/features/dataset-url-loader/datasetLoader.ts

export async function loadDataset(datasetName: string): Promise<LoadedDataset> {
  console.log(`🔍 Loading dataset: ${datasetName}`);
  
  // Load in parallel
  const [conversationsRes, propertiesRes, clustersRes, metricsRes] = await Promise.all([
    fetch(`/api/results/${datasetName}/conversations?limit=1000`), // Load first 1000
    fetch(`/api/results/${datasetName}/properties`),
    fetch(`/api/results/${datasetName}/clusters`),
    fetch(`/api/results/${datasetName}/metrics`)
  ]);
  
  const conversations = (await conversationsRes.json()).data;
  const properties = (await propertiesRes.json()).data;
  const clusters = (await clustersRes.json()).data;
  const metrics = await metricsRes.json();
  
  return {
    name: datasetName,
    conversations,
    properties,
    clusters,
    metrics: {
      model_cluster_scores: metrics.model_cluster_scores_df,
      cluster_scores: metrics.cluster_scores_df,
      model_scores: metrics.model_scores_df
    },
    // ... rest of fields
  };
}
```

### Update datasets.yaml

```yaml
datasets:
  telecom:
    name: "Telecom Dataset"
    description: "Telecom customer service analysis"
    # Remove cdn_url, use dataset name instead
    method: "single_model"
    created_at: "2026-01-02"
```

## Expected Performance Improvement

**Before (ZIP):** 12-32 seconds
**After (Separate files with pagination):** 1-3 seconds

Why:
- Only load first 1000 conversations initially (not all 50,000)
- Load properties/clusters in parallel
- No ZIP decompression overhead
- Can add more as user scrolls (infinite scroll)

## Migration Steps

1. **Backend**: Add new endpoints
2. **Unzip datasets**: Extract ZIPs to folders
3. **Frontend**: Update datasetLoader.ts
4. **Test**: Should be 10x faster

Want me to implement the frontend part of this?
