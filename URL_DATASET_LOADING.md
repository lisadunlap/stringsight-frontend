# URL-Based Dataset Loading

This guide explains how to deploy individual StringSight sites that load specific result files from AWS S3, accessible via URLs like `stringsight.com/{dataset_name}`.

## Overview

The URL-based loading system allows you to:
- Deploy a single React app that serves multiple datasets
- Configure datasets in a YAML file with S3/CDN paths
- Access datasets via clean URLs: `stringsight.com/taubench_airline`
- Add new datasets without redeploying the frontend

## Architecture

```
User visits: stringsight.com/taubench_airline
            ↓
App extracts "taubench_airline" from URL
            ↓
Fetches /datasets.yaml configuration
            ↓
Loads files from S3/CloudFront:
  - conversation.jsonl
  - properties.jsonl
  - clusters.jsonl
  - model_cluster_scores_df.jsonl
            ↓
Renders UI with loaded data
```

## Configuration

### 1. Create `datasets.yaml`

Place this file in `public/datasets.yaml`:

```yaml
datasets:
  taubench_airline:
    name: "TauBench Airline"
    description: "Airline customer service benchmark"
    cdn_url: "https://results.stringsight.com/taubench_airline"
    files:
      - conversation.jsonl
      - properties.jsonl
      - clusters.jsonl
      - model_cluster_scores_df.jsonl
      - cluster_scores_df.jsonl
      - model_scores_df.jsonl
    method: "single_model"
    created_at: "2025-01-02"
  
  my_dataset:
    name: "My Custom Dataset"
    description: "My evaluation results"
    s3_bucket: "my-stringsight-bucket"
    s3_path: "results/my_dataset"
    files:
      - conversation.jsonl
      - properties.jsonl
      - clusters.jsonl
    method: "side_by_side"
    created_at: "2025-01-02"

# Global CDN settings (optional)
cdn:
  enabled: true
  base_url: "https://results.stringsight.com"

# S3 settings (optional)
s3:
  region: "us-west-2"
  public_url_format: "https://{bucket}.s3.{region}.amazonaws.com/{path}/{file}"
```

### 2. AWS S3 Setup

#### Create S3 Bucket
```bash
aws s3 mb s3://stringsight-results --region us-west-2
```

#### Upload Dataset Files
```bash
# Upload your dataset
aws s3 cp results/taubench_airline/ s3://stringsight-results/taubench_airline/ --recursive
```

#### Configure CORS (Required for browser access)
Create `cors.json`:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://stringsight.com", "https://www.stringsight.com", "http://localhost:5180"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Apply CORS:
```bash
aws s3api put-bucket-cors --bucket stringsight-results --cors-configuration file://cors.json
```

#### Set Public Read Access (if public datasets)
```bash
# Make bucket public (use cautiously!)
aws s3api put-bucket-policy --bucket stringsight-results --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::stringsight-results/*"
  }]
}'
```

### 3. CloudFront CDN Setup (Recommended)

For better performance and cost, use CloudFront:

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name stringsight-results.s3.us-west-2.amazonaws.com \
  --default-root-object index.html
```

Then update your `datasets.yaml` to use the CloudFront URL:
```yaml
cdn:
  base_url: "https://d1234567890.cloudfront.net"
```

## Usage

### Option 1: Automatic URL Loading (Recommended)

Integrate into your `App.tsx`:

```typescript
import { useDatasetFromUrl } from './hooks/useDatasetFromUrl';
import { DatasetBrowser } from './components/DatasetBrowser';

function App() {
  const { dataset, isLoading, error, datasetName, availableDatasets } = useDatasetFromUrl();

  // Show loading state
  if (isLoading) {
    return <CircularProgress />;
  }

  // Show error state
  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  // Show dataset browser if no dataset in URL
  if (!datasetName) {
    return <DatasetBrowser datasets={availableDatasets} />;
  }

  // Dataset loaded! Use it in your app
  useEffect(() => {
    if (dataset) {
      setOriginalRows(dataset.conversations);
      setPropertiesRows(dataset.properties);
      setClusters(dataset.clusters);
      setMethod(dataset.config.method);
      // ... etc
    }
  }, [dataset]);

  return (
    <div>
      <h1>{dataset.config.name}</h1>
      {/* Your app UI */}
    </div>
  );
}
```

### Option 2: Manual Loading

```typescript
import { useDatasetLoader } from './hooks/useDatasetFromUrl';

function MyComponent() {
  const { loadDataset, dataset, isLoading, error } = useDatasetLoader();

  const handleLoad = async () => {
    await loadDataset('taubench_airline');
  };

  return (
    <Button onClick={handleLoad}>Load Dataset</Button>
  );
}
```

### Option 3: Direct API Usage

```typescript
import { loadDataset, getDatasetConfig, listDatasets } from './lib/datasetLoader';

// Load a specific dataset
const dataset = await loadDataset('taubench_airline');

// Get just the configuration
const config = await getDatasetConfig('taubench_airline');

// List all available datasets
const datasets = await listDatasets();
```

## Deployment

### Deploy to Vercel

1. **Update `vercel.json`** (already done):
```json
{
  "rewrites": [
    { "source": "/:dataset/(.*)", "destination": "/index.html" },
    { "source": "/:dataset", "destination": "/index.html" }
  ]
}
```

2. **Deploy**:
```bash
npm run build
vercel --prod
```

3. **Configure Environment** (if needed):
```bash
vercel env add VITE_BACKEND
```

### Test Locally

```bash
# Start dev server
npm run dev

# Test URLs
# Home page (dataset browser)
http://localhost:5180/

# Specific dataset
http://localhost:5180/taubench_airline
```

## File Structure

```
public/
  datasets.yaml           # Dataset configuration

src/
  types/
    dataset.ts            # TypeScript types
  
  lib/
    datasetLoader.ts      # Core loading logic
  
  hooks/
    useDatasetFromUrl.ts  # React hooks
  
  components/
    DatasetBrowser.tsx    # Dataset selection UI
    AppWithUrlLoading.example.tsx  # Integration example
```

## URL Structure

- `/` - Home page, shows DatasetBrowser
- `/taubench_airline` - Loads taubench_airline dataset
- `/taubench_airline_sbs` - Loads side-by-side dataset
- `/my_custom_dataset` - Loads any configured dataset

## Adding New Datasets

1. **Upload files to S3**:
```bash
aws s3 cp my_results/ s3://stringsight-results/my_dataset/ --recursive
```

2. **Add to `datasets.yaml`**:
```yaml
datasets:
  my_dataset:
    name: "My Dataset"
    description: "My description"
    cdn_url: "https://results.stringsight.com/my_dataset"
    files:
      - conversation.jsonl
      - properties.jsonl
      - clusters.jsonl
    method: "single_model"
    created_at: "2025-01-02"
```

3. **No redeploy needed!** Just visit `/my_dataset`

## Security Considerations

### Public Datasets
- Use S3 public bucket + CloudFront
- CORS properly configured
- No authentication needed

### Private Datasets
- Keep S3 bucket private
- Use Lambda@Edge for authentication
- Generate signed URLs with expiration
- Add authentication check in frontend

Example Lambda@Edge authentication:
```javascript
exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;
  
  // Check authorization header
  const authHeader = headers['authorization'];
  if (!authHeader || !isValidToken(authHeader[0].value)) {
    return {
      status: '403',
      statusDescription: 'Forbidden',
    };
  }
  
  return request;
};
```

## Troubleshooting

### CORS Errors
```
Access to fetch at 'https://...' from origin 'https://stringsight.com' has been blocked by CORS
```

**Solution**: Add your domain to S3 CORS configuration (see AWS S3 Setup above)

### 404 Not Found
```
Failed to load conversation.jsonl: 404 Not Found
```

**Solution**: 
- Check files exist in S3: `aws s3 ls s3://stringsight-results/taubench_airline/`
- Verify paths in `datasets.yaml` match S3 structure
- Check S3 bucket policy allows public read

### Dataset Not in Configuration
```
Dataset "xyz" not found in configuration. Available datasets: ...
```

**Solution**: Add the dataset to `public/datasets.yaml`

### Slow Loading
**Solution**: 
- Use CloudFront CDN instead of direct S3
- Enable gzip compression on CloudFront
- Consider using `.json` instead of `.jsonl` for smaller files

## Performance Optimization

### Enable Compression
CloudFront automatically compresses files. For S3 direct:
```bash
aws s3 cp conversation.jsonl s3://bucket/path/ --content-encoding gzip
```

### Cache Configuration
CloudFront cache behavior:
- Cache `.jsonl` and `.json` files for 24 hours
- Cache `datasets.yaml` for 1 hour (for updates)

### Lazy Loading
Load only required files:
```typescript
const dataset = await loadDataset('taubench_airline');
// Only conversation.jsonl loaded initially
// Load metrics on demand when user opens Metrics tab
```

## Cost Estimates

For a 10MB dataset with 1000 requests/month:

| Service | Cost |
|---------|------|
| S3 Storage (10MB) | $0.0002/month |
| S3 Requests (1000 GET) | $0.0004/month |
| CloudFront Data Transfer (10GB) | $0.85/month |
| **Total** | **~$0.85/month** |

Using CloudFront is cost-effective and provides better performance.

## Next Steps

1. ✅ Configuration created (`datasets.yaml`)
2. ✅ Code implemented (loader, hooks, components)
3. ⏭️ Update your `App.tsx` to integrate URL loading
4. ⏭️ Upload datasets to S3
5. ⏭️ Configure CloudFront
6. ⏭️ Deploy to Vercel

See `src/components/AppWithUrlLoading.example.tsx` for integration code examples.





