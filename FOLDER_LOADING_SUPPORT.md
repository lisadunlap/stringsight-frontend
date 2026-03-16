# Folder-Based Dataset Loading

## Overview

The dataset loader now supports three loading strategies:

1. **Paginated API** (fastest) - For datasets with backend pagination support
2. **Folder path** (new!) - For datasets stored as individual JSONL files in a folder
3. **ZIP file** (legacy) - For datasets packaged as ZIP archives

## How It Works

The loader determines the strategy based on the `cdn_url` field in [public/datasets.yaml](public/datasets.yaml):

| cdn_url | Strategy | Example |
|---------|----------|---------|
| Empty / not set | Paginated API | `telecom` dataset |
| Path without `.zip` | Folder path | `/api/results/zip/medication_qa_2026-01-02` |
| Path ending in `.zip` | ZIP file | `/api/results/zip/dataset.zip` |

## Configuration Examples

### Strategy 1: Paginated API (Fastest)

**Best for**: Large datasets with backend pagination

```yaml
telecom:
  name: "Telecom Dataset"
  description: "Telecom customer service analysis"
  # No cdn_url - uses /api/results/telecom/* endpoints
  files: []
  method: "single_model"
  created_at: "2026-01-02"
```

**Backend endpoints required**:
- `GET /results/telecom/conversations?limit=1000`
- `GET /results/telecom/properties`
- `GET /results/telecom/clusters`
- `GET /results/telecom/metrics`

### Strategy 2: Folder Path (New!)

**Best for**: Datasets stored as individual files in a backend folder

```yaml
medi_qa:
  name: "Medi QA"
  description: "Answering questions about medications"
  cdn_url: "/api/results/zip/final_results/medication_qa_2026-01-02"
  files: []
  method: "single_model"
  created_at: "2025-12-30"
```

**Backend endpoints required**:
- `GET /api/results/zip/final_results/medication_qa_2026-01-02/conversations.jsonl`
- `GET /api/results/zip/final_results/medication_qa_2026-01-02/properties.jsonl`
- `GET /api/results/zip/final_results/medication_qa_2026-01-02/clusters.jsonl`
- `GET /api/results/zip/final_results/medication_qa_2026-01-02/model_cluster_scores_df.jsonl`

**Note**: The folder path is used as-is from `cdn_url`, and individual JSONL files are fetched.

### Strategy 3: ZIP File (Legacy)

**Best for**: Backward compatibility or when files must be bundled

```yaml
old_dataset:
  name: "Old Dataset"
  description: "Legacy dataset in ZIP format"
  cdn_url: "/api/results/zip/old_dataset.zip"
  files: []
  method: "single_model"
  created_at: "2025-12-30"
```

**Backend endpoints required**:
- `GET /api/results/zip/old_dataset.zip` - Returns ZIP file

## Backend Setup for Folder Loading

To support folder-based loading, your backend needs to serve individual JSONL files. Here's an example FastAPI setup:

```python
from fastapi import FastAPI
from fastapi.responses import FileResponse
from pathlib import Path

app = FastAPI()

@app.get("/results/zip/{folder_path:path}/{filename}")
async def serve_folder_file(folder_path: str, filename: str):
    """Serve individual JSONL files from a folder"""
    base_dir = Path("~/StringSightNew/final_results")
    file_path = base_dir / folder_path / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        file_path,
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )
```

## File Requirements

For folder-based loading, the following files are fetched:

**Required**:
- `conversations.jsonl` - Main conversation data

**Optional**:
- `properties.jsonl` - Extracted properties
- `clusters.jsonl` - Cluster assignments
- `model_cluster_scores_df.jsonl` - Model-cluster metrics
- `cluster_scores_df.jsonl` - Cluster scores
- `model_scores_df.jsonl` - Model scores

Missing optional files are silently ignored.

## Performance Comparison

| Strategy | Load Time (50k rows) | Pros | Cons |
|----------|---------------------|------|------|
| Paginated API | 2-5s | Fastest, backend caching | Requires backend pagination |
| Folder path | 5-10s | Simple, no ZIP overhead | Multiple HTTP requests |
| ZIP file | 12-32s | Single download | Slow decompression |

## Testing

To test folder-based loading:

1. **Ensure backend serves files**:
   ```bash
   # Test if file is accessible
   curl http://localhost:8000/api/results/zip/final_results/medication_qa_2026-01-02/conversations.jsonl | head -5
   ```

2. **Visit dataset in browser**:
   ```
   http://localhost:5180/medi_qa
   ```

3. **Check browser console** (F12) for logs:
   ```
   📁 Loading from folder path: /api/results/zip/final_results/medication_qa_2026-01-02
   ⏱️  Loaded from folder in XXXms
      Conversations: XXXX
      Properties: XXXX
      Clusters: XXXX
   ```

## Troubleshooting

### Problem: 404 Not Found

**Symptoms**: Browser console shows "Failed to load from folder path"

**Solutions**:
1. Verify backend is running
2. Check folder path in `datasets.yaml` matches actual folder structure
3. Test endpoint directly with curl:
   ```bash
   curl -I http://localhost:8000/api/results/zip/final_results/medication_qa_2026-01-02/conversations.jsonl
   ```

### Problem: CORS errors

**Symptoms**: Browser shows CORS policy error

**Solution**: Ensure backend has CORS headers configured:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5180"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Problem: Empty data

**Symptoms**: UI loads but shows 0 conversations

**Solutions**:
1. Check file is not empty:
   ```bash
   curl http://localhost:8000/api/results/zip/final_results/medication_qa_2026-01-02/conversations.jsonl | wc -l
   ```

2. Verify JSONL format (one JSON object per line):
   ```bash
   curl http://localhost:8000/api/results/zip/final_results/medication_qa_2026-01-02/conversations.jsonl | head -1 | python3 -m json.tool
   ```

## Implementation Details

The folder loading logic is in [src/features/dataset-url-loader/datasetLoader.ts](src/features/dataset-url-loader/datasetLoader.ts) lines 166-203:

```typescript
// Strategy 2: Load from folder path
if (conversations.length === 0 && useFolderPath) {
  console.log(`📁 Loading from folder path: ${datasetConfig.cdn_url}`);

  const folderPath = datasetConfig.cdn_url;

  const [conversationsRes, propertiesRes, clustersRes, metricsRes] = await Promise.all([
    fetch(`${folderPath}/conversations.jsonl`).then(r => r.ok ? r.text() : null),
    fetch(`${folderPath}/properties.jsonl`).then(r => r.ok ? r.text() : null),
    fetch(`${folderPath}/clusters.jsonl`).then(r => r.ok ? r.text() : null),
    fetch(`${folderPath}/model_cluster_scores_df.jsonl`).then(r => r.ok ? r.text() : null),
  ]);

  // Parse JSONL files
  if (conversationsRes) {
    conversations = conversationsRes.trim().split('\n').map(line => JSON.parse(line));
  }
  // ... etc
}
```

## Migration Guide

To migrate from ZIP to folder-based loading:

1. **Extract ZIP files** on backend:
   ```bash
   cd ~/StringSightNew/final_results
   unzip medication_qa_2026-01-02.zip -d medication_qa_2026-01-02/
   ```

2. **Update datasets.yaml**:
   ```yaml
   # Before
   cdn_url: "/api/results/zip/medication_qa_2026-01-02.zip"

   # After
   cdn_url: "/api/results/zip/medication_qa_2026-01-02"
   ```

3. **Test the change**:
   ```bash
   # Should return file contents
   curl http://localhost:8000/api/results/zip/medication_qa_2026-01-02/conversations.jsonl | head -5
   ```

## Next Steps

Consider migrating to **Paginated API** for even better performance:

1. Implement backend pagination endpoints (see [PYTHON_API_REFERENCE.md](PYTHON_API_REFERENCE.md))
2. Remove `cdn_url` from dataset config
3. Enjoy 2-5s load times instead of 5-10s
