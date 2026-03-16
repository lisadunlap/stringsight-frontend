# Dataset URL Loader Feature - Isolated Module

The URL-based dataset loading feature has been organized into an isolated, self-contained module that can easily be extracted to a separate repository.

## Location

All feature code is now in:
```
src/features/dataset-url-loader/
```

## Files Structure

```
src/features/dataset-url-loader/
├── index.ts                  # Public API - import from here
├── types.ts                  # TypeScript type definitions
├── useDatasetFromUrl.ts     # React hooks for URL-based loading
├── datasetLoader.ts         # Core dataset fetching logic
├── zipLoader.ts             # ZIP file extraction utilities
├── package.json             # Dependencies and metadata
├── README.md                # Complete feature documentation
└── MIGRATION.md             # Guide for extracting to separate repo
```

## Usage in App

Import from the feature module:

```typescript
// In App.tsx
import { useDatasetFromUrl } from "./features/dataset-url-loader";

function App() {
  const { dataset, isLoading, error } = useDatasetFromUrl();

  // Use the loaded dataset...
}
```

## What This Feature Does

Enables loading pre-computed analysis results via shareable URLs:

1. User visits: `http://localhost:5180/telecom`
2. Hook extracts "telecom" from URL
3. Loads config from `public/datasets.yaml`
4. Fetches ZIP from backend: `/api/results/zip/telecom_2026-01-02.zip`
5. Extracts and parses JSONL files
6. Returns structured dataset to app

## Configuration

Datasets are configured in `public/datasets.yaml`:

```yaml
datasets:
  telecom:
    name: "Telecom Dataset"
    description: "Telecom customer service analysis"
    cdn_url: "/api/results/zip/telecom_2026-01-02.zip"
    files: []
    method: "single_model"
    created_at: "2026-01-02"
```

## Backend Integration

The backend must serve ZIP files at the configured endpoint. For the default setup:

**Backend Repository:** `~/StringSightNew`

**Endpoint:** `GET /results/zip/{filename}` (in `stringsight/routers/validation.py`)

**Files Location:** `~/StringSightNew/final_results/`

**Example Request:**
```bash
curl http://localhost:8000/results/zip/telecom_2026-01-02.zip -o dataset.zip
```

**Frontend Proxy:** Vite dev server proxies `/api/*` → `http://localhost:8000`

## Recent Bug Fix

Fixed filename mismatch in [src/features/dataset-url-loader/zipLoader.ts](src/features/dataset-url-loader/zipLoader.ts):
- Was looking for: `conversation.jsonl` (singular)
- ZIP actually has: `conversations.jsonl` (plural)
- Fixed in lines 61 and 110

## Dependencies

The feature requires:
- `js-yaml` - YAML configuration parsing
- `jszip` - ZIP file extraction
- `react` - React hooks (peer dependency)

These are already in your main `package.json`.

## Extracting to Separate Repository

When you're ready to move this to another repo:

1. Read [src/features/dataset-url-loader/MIGRATION.md](src/features/dataset-url-loader/MIGRATION.md)
2. Copy the entire `dataset-url-loader/` folder
3. Follow the migration steps
4. Install as npm package: `npm install @stringsight/dataset-url-loader`
5. Update import: `from "./features/dataset-url-loader"` → `from "@stringsight/dataset-url-loader"`

The module is designed to be completely self-contained with no external dependencies on StringSight-specific code.

## Why Isolated?

- ✅ **Easy to extract**: All code in one folder
- ✅ **Self-contained**: No dependencies on parent app internals
- ✅ **Reusable**: Can be used in other projects
- ✅ **Testable**: Can be tested independently
- ✅ **Maintainable**: Clear boundaries and responsibilities

## Adding New Datasets

1. Place ZIP in backend: `~/StringSightNew/final_results/your_dataset.zip`

2. Add to `public/datasets.yaml`:
   ```yaml
   your_dataset:
     name: "Display Name"
     description: "Description"
     cdn_url: "/api/results/zip/your_dataset.zip"
     files: []
     method: "single_model"
     created_at: "2026-01-02"
   ```

3. Visit: `http://localhost:5180/your_dataset`

## ZIP File Format

Required file: `conversations.jsonl` (note: plural!)

Optional files:
- `properties.jsonl`
- `clusters.jsonl`
- `model_cluster_scores_df.jsonl`
- `cluster_scores_df.jsonl`
- `model_scores_df.jsonl`

All files are JSONL format (one JSON object per line).

## Documentation

For complete documentation, see:
- [Feature README](src/features/dataset-url-loader/README.md) - Complete API and usage docs
- [Migration Guide](src/features/dataset-url-loader/MIGRATION.md) - How to extract to separate repo
- [Debug Guide](debug-blank-ui.md) - Troubleshooting loading issues

## Testing

To verify the feature works:

```bash
# 1. Ensure backend is running
cd ~/StringSightNew
uvicorn stringsight.api:app --reload --host localhost --port 8000

# 2. Start frontend
cd ~/stringsight-frontend
npm run dev

# 3. Visit in browser
http://localhost:5180/telecom

# 4. Check browser console for:
✅ Loaded from ZIP: { conversations: XXXXX, ... }
```

## Previous Locations (Now Consolidated)

The following files were moved into the feature folder:
- `src/hooks/useDatasetFromUrl.ts` → Feature module
- `src/lib/datasetLoader.ts` → Feature module
- `src/lib/zipLoader.ts` → Feature module
- Types from `src/types/dataset.ts` → `types.ts` in feature module

Original files can be deleted after confirming everything works.
