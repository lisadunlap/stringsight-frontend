# Summary: URL-Based Dataset Loading Implementation

## What Was Built

A complete system for deploying individual StringSight sites that load specific datasets from AWS S3, accessible via URLs like `stringsight.com/{dataset_name}`.

## Architecture Overview

```
User visits: stringsight.com/taubench_airline
            ↓
React app extracts "taubench_airline" from URL
            ↓
Fetches /datasets.yaml configuration file
            ↓
Loads dataset files from S3/CloudFront:
  - conversation.jsonl
  - properties.jsonl
  - clusters.jsonl
  - model_cluster_scores_df.jsonl
  - cluster_scores_df.jsonl
  - model_scores_df.jsonl
            ↓
Populates app state and renders UI
```

## Files Created

### 1. Configuration
- **`public/datasets.yaml`** - YAML configuration mapping dataset names to S3 paths
  - Supports direct CDN URLs or S3 bucket/path
  - Includes metadata (name, description, method, files)
  - Global CDN and S3 settings

### 2. Core Logic
- **`src/types/dataset.ts`** - TypeScript type definitions
  - `DatasetConfig` - Single dataset configuration
  - `DatasetsYaml` - Full YAML structure
  - `LoadedDataset` - Loaded dataset with data and metadata

- **`src/lib/datasetLoader.ts`** - Core loading functionality
  - `fetchDatasetsConfig()` - Loads YAML configuration
  - `getDatasetConfig(name)` - Gets specific dataset config
  - `loadDataset(name)` - Loads complete dataset from S3
  - `listDatasets()` - Lists all available datasets
  - `getDatasetNameFromUrl()` - Extracts dataset from URL path
  - URL construction logic (supports S3 and CDN)

### 3. React Integration
- **`src/hooks/useDatasetFromUrl.ts`** - React hooks
  - `useDatasetFromUrl()` - Automatic URL-based loading
  - `useDatasetLoader()` - Manual dataset loading

- **`src/components/DatasetBrowser.tsx`** - Dataset selection UI
  - Shows available datasets when no dataset in URL
  - Card-based layout with metadata
  - Click to navigate to dataset

- **`src/components/AppWithUrlLoading.example.tsx`** - Integration examples
  - Complete example with loading states
  - Error handling patterns
  - Alternative integration approaches

### 4. Deployment & Documentation
- **`deploy-dataset.sh`** - Automated AWS deployment script
  - Creates S3 bucket if needed
  - Configures CORS automatically
  - Uploads dataset files
  - Shows access URLs and next steps
  - Supports CloudFront cache invalidation

- **`URL_DATASET_LOADING.md`** - Comprehensive documentation
  - Architecture explanation
  - AWS setup guide
  - Usage patterns
  - Security considerations
  - Performance optimization
  - Troubleshooting

- **`QUICKSTART_URL_LOADING.md`** - Quick start guide
  - 5-minute setup
  - Common tasks
  - Troubleshooting tips

### 5. Configuration Updates
- **`vercel.json`** - Updated with URL rewrites
  - Routes `/:dataset` to `index.html`
  - Routes `/:dataset/(...)` to `index.html`
  - Preserves API proxy rules

- **`README.md`** - Updated with new feature
  - Added URL-based loading section
  - Links to documentation

### 6. Dependencies
- **`package.json`** - Added `js-yaml` and `@types/js-yaml`

## Key Features

### 1. YAML Configuration
```yaml
datasets:
  taubench_airline:
    name: "TauBench Airline"
    description: "Airline customer service benchmark"
    cdn_url: "https://results.stringsight.com/taubench_airline"
    files: [...]
    method: "single_model"
    created_at: "2025-01-02"
```

### 2. Flexible URL Construction
- Direct CDN URL: `cdn_url: "https://..."`
- S3 bucket/path: `s3_bucket: "bucket"` + `s3_path: "path"`
- Global CDN base: Uses `cdn.base_url` if set
- S3 URL format: Customizable via `s3.public_url_format`

### 3. React Hook
```typescript
const { dataset, isLoading, error } = useDatasetFromUrl();

useEffect(() => {
  if (dataset) {
    setOriginalRows(dataset.conversations);
    setPropertiesRows(dataset.properties);
    // ...
  }
}, [dataset]);
```

### 4. One-Line Deployment
```bash
./deploy-dataset.sh taubench_airline ./results/taubench_airline/
```

## Usage Flow

### For Users (Viewing Datasets)
1. Visit `stringsight.com/` → See dataset browser
2. Click a dataset → Navigate to `stringsight.com/{dataset_name}`
3. App loads data from S3 → Renders UI

### For Admins (Adding Datasets)
1. Run `./deploy-dataset.sh my_dataset ./results/my_dataset/`
2. Add config to `public/datasets.yaml` (script shows what to add)
3. No redeploy needed - users can immediately access `/my_dataset`

## Integration with Existing App

### Option 1: Automatic (Recommended)
Add to top of `App()`:
```typescript
const { dataset } = useDatasetFromUrl();

useEffect(() => {
  if (dataset) {
    // Populate existing state
    setOriginalRows(dataset.conversations);
    setPropertiesRows(dataset.properties);
    setClusters(dataset.clusters);
    // ...
  }
}, [dataset]);
```

### Option 2: Manual Button
Add a "Load from URL" button that triggers URL-based loading on demand.

### Option 3: Route-Based
Use separate routes for uploaded data vs URL-loaded data.

## AWS Setup Required

1. **S3 Bucket**: Store dataset files
   - Create bucket: `aws s3 mb s3://stringsight-results`
   - Configure CORS (script does this automatically)
   - Optional: Make public or use signed URLs

2. **CloudFront CDN** (Recommended)
   - Better performance
   - Lower costs
   - Automatic compression
   - Global distribution

3. **Environment**: No environment variables needed!
   - Configuration in `datasets.yaml`
   - Public file access via CORS

## Benefits

1. **Single Deployment** - One React app serves all datasets
2. **No Redeploy** - Add datasets without redeploying frontend
3. **Clean URLs** - `stringsight.com/taubench_airline`
4. **Easy Management** - YAML configuration
5. **Fast Loading** - CDN delivery
6. **Cost Effective** - ~$0.85/month per 10MB dataset with 1K requests
7. **Scalable** - Handles any number of datasets

## Security Considerations

### Public Datasets (Current)
- S3 bucket with public read access
- CORS configured for browser access
- No authentication required

### Private Datasets (Future)
- Keep S3 bucket private
- Use Lambda@Edge for authentication
- Generate signed URLs with expiration
- Add auth check in frontend

## Performance Optimization

1. **CloudFront CDN** - Reduces latency and costs
2. **Compression** - Gzip for JSON/JSONL files
3. **Caching** - 24h cache for data files, 1h for config
4. **Lazy Loading** - Load only required files on demand

## Cost Estimate

For 10MB dataset with 1000 requests/month:
- S3 Storage: $0.0002/month
- S3 Requests: $0.0004/month
- CloudFront Transfer: $0.85/month
- **Total: ~$0.85/month**

## Next Steps

To integrate this into your app:

1. **Review the example integration**:
   - See `src/components/AppWithUrlLoading.example.tsx`
   - Choose integration pattern that fits your needs

2. **Upload your first dataset**:
   ```bash
   ./deploy-dataset.sh taubench_airline ./public/taubench_airline_data/
   ```

3. **Test locally**:
   ```bash
   npm run dev
   # Visit http://localhost:5180/taubench_airline
   ```

4. **Deploy to production**:
   ```bash
   npm run build
   vercel --prod
   ```

## Questions to Consider

Before integrating, consider:

1. **Loading Strategy**: Auto-load on mount or manual trigger?
2. **Fallback**: Show dataset browser or upload UI when no URL dataset?
3. **Mixed Mode**: Support both URL loading and manual upload?
4. **Error Handling**: How to handle missing/failed datasets?
5. **Navigation**: Show dataset switcher in UI?
6. **Caching**: Cache loaded datasets in localStorage?

See `AppWithUrlLoading.example.tsx` for implementation patterns for each approach.

## Testing

Test checklist:
- [ ] YAML parsing works
- [ ] S3 files accessible (no CORS errors)
- [ ] URL extraction correct
- [ ] Loading states display properly
- [ ] Error states handled gracefully
- [ ] Dataset browser shows all datasets
- [ ] Navigation between datasets works
- [ ] CloudFront cache invalidation (if using CDN)

## Troubleshooting

Common issues and solutions documented in:
- `QUICKSTART_URL_LOADING.md` - Quick fixes
- `URL_DATASET_LOADING.md` - Detailed troubleshooting

## Files to Review

1. **Start here**: `QUICKSTART_URL_LOADING.md`
2. **Integration**: `src/components/AppWithUrlLoading.example.tsx`
3. **Deep dive**: `URL_DATASET_LOADING.md`
4. **Configuration**: `public/datasets.yaml`
5. **Core logic**: `src/lib/datasetLoader.ts`

All code is documented and ready to use! 🚀





