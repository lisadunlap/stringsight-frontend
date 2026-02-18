# Dataset URL Loader

Isolated feature module for loading pre-computed datasets via shareable URLs.

## Purpose

This module enables loading dataset results from ZIP files served by a backend, allowing users to share analysis results via simple URLs (e.g., `/telecom`).

## Architecture

```
User visits: /your-dataset
     ↓
useDatasetFromUrl extracts dataset name from URL
     ↓
Reads datasets.yaml configuration
     ↓
datasetLoader fetches ZIP from backend
     ↓
zipLoader extracts and parses JSONL files
     ↓
Returns structured dataset to app
```

## Files

- `index.ts` - Public API exports
- `types.ts` - TypeScript type definitions
- `useDatasetFromUrl.ts` - React hook for URL-based loading
- `datasetLoader.ts` - Dataset fetching and URL construction
- `zipLoader.ts` - ZIP download and extraction logic
- `README.md` - This file

## Usage

### In a React component:

```typescript
import { useDatasetFromUrl } from '@/features/dataset-url-loader';

function App() {
  const urlDataset = useDatasetFromUrl();

  useEffect(() => {
    if (urlDataset) {
      // Dataset loaded from URL
      console.log('Conversations:', urlDataset.conversations);
      console.log('Properties:', urlDataset.properties);
      console.log('Clusters:', urlDataset.clusters);
      console.log('Metrics:', urlDataset.metrics);
    }
  }, [urlDataset]);
}
```

### Programmatic loading:

```typescript
import { loadDatasetByName } from '@/features/dataset-url-loader';

const dataset = await loadDatasetByName('telecom', '/datasets.yaml');
```

## Configuration

Datasets are configured in `public/datasets.yaml`:

```yaml
datasets:
  your-dataset-name:
    name: "Display Name"
    description: "Dataset description"
    cdn_url: "/api/results/zip/filename.zip"
    files: []
    method: "single_model"  # or "side_by_side"
    created_at: "2026-01-02"
```

## Backend Requirements

The backend must serve ZIP files at the endpoint specified in `cdn_url`. For the default setup:

- Endpoint: `GET /results/zip/{filename}`
- Files location: `final_results/` directory
- Response: ZIP file containing JSONL data

### Expected ZIP Contents

The ZIP must contain these JSONL files:

**Required:**
- `conversations.jsonl` - Main conversation data

**Optional:**
- `properties.jsonl` - Extracted properties
- `clusters.jsonl` - Cluster assignments
- `model_cluster_scores_df.jsonl` - Model-cluster metrics
- `cluster_scores_df.jsonl` - Cluster-level metrics
- `model_scores_df.jsonl` - Model-level metrics
- `metrics_insights.json` - LLM-generated sectioned metrics overview

### JSONL Format

Each file contains one JSON object per line:

```jsonl
{"id": 1, "prompt": "...", "model_response": "..."}
{"id": 2, "prompt": "...", "model_response": "..."}
```

## Data Format

### Single Model Format
```typescript
{
  question_id: string;
  prompt: string;
  model: string;
  model_response: string | object[];
  score?: { [key: string]: number };
}
```

### Side-by-Side Format
```typescript
{
  question_id: string;
  prompt: string;
  model_a: string;
  model_b: string;
  model_a_response: string | object[];
  model_b_response: string | object[];
  score_a?: { [key: string]: number };
  score_b?: { [key: string]: number };
}
```

## Dependencies

- `js-yaml` - YAML parsing
- `jszip` - ZIP extraction
- `react` - React hooks
- `react-router-dom` - URL routing

## Extracting to Separate Repo

This module is designed to be self-contained. To extract:

1. Copy the entire `dataset-url-loader/` folder
2. Update import paths (remove `@/` aliases)
3. Include `public/datasets.yaml` as config template
4. Add dependencies to package.json:
   ```json
   {
     "js-yaml": "^4.1.0",
     "jszip": "^3.10.1"
   }
   ```

## Development

### Adding a New Dataset

1. Place ZIP file in backend's `final_results/` directory
2. Add entry to `public/datasets.yaml`
3. Visit `http://localhost:5180/{dataset-name}`

### Testing

```bash
# Test backend endpoint
curl http://localhost:8000/results/zip/your-file.zip -I

# Test frontend proxy
curl http://localhost:5180/api/results/zip/your-file.zip -I
```

## Troubleshooting

**Blank UI / No Data:**
- Check browser console for errors
- Verify ZIP filename matches in datasets.yaml
- Confirm ZIP contains `conversations.jsonl` (plural)
- Check Network tab for 404/500 errors

**404 Errors:**
- Verify file exists in backend's `final_results/` directory
- Check backend is running on port 8000
- Verify Vite proxy configuration

**CORS Errors:**
- Ensure using `/api` prefix (triggers Vite proxy)
- Don't use absolute URLs to localhost:8000

## License

Part of StringSight project.
