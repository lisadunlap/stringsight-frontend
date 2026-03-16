# Quick Start: URL-Based Dataset Loading

Deploy individual StringSight sites at `stringsight.com/{dataset_name}` that load data from AWS S3.

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies

```bash
npm install
# js-yaml was already installed automatically
```

### 2. Upload Your Dataset to S3

```bash
# Set your bucket name (or use default: stringsight-results)
export S3_BUCKET=stringsight-results

# Deploy your dataset
./deploy-dataset.sh taubench_airline ./results/taubench_airline/
```

The script will:
- ✅ Create bucket if needed
- ✅ Configure CORS automatically
- ✅ Upload all JSON/JSONL files
- ✅ Show access URLs

### 3. Configure Dataset

The deployment script shows you what to add. Edit `public/datasets.yaml`:

```yaml
datasets:
  taubench_airline:
    name: "TauBench Airline"
    description: "Airline customer service benchmark"
    cdn_url: "https://stringsight-results.s3.us-west-2.amazonaws.com/taubench_airline"
    files:
      - conversation.jsonl
      - properties.jsonl
      - clusters.jsonl
      - model_cluster_scores_df.jsonl
    method: "single_model"
    created_at: "2025-01-02"
```

### 4. Integrate into App.tsx

See the integration patterns in `src/components/AppWithUrlLoading.example.tsx`.

Basic integration:

```typescript
import { useDatasetFromUrl } from './hooks/useDatasetFromUrl';

function App() {
  const { dataset, isLoading, error } = useDatasetFromUrl();
  
  useEffect(() => {
    if (dataset) {
      setOriginalRows(dataset.conversations);
      setPropertiesRows(dataset.properties);
      setClusters(dataset.clusters);
      // ... etc
    }
  }, [dataset]);
  
  // Your existing app code...
}
```

### 5. Test Locally

```bash
npm run dev

# Visit:
# http://localhost:5180/taubench_airline
```

### 6. Deploy

```bash
npm run build
vercel --prod
```

Done! Your dataset is now accessible at `stringsight.com/taubench_airline`.

## 📚 Files Created

| File | Purpose |
|------|---------|
| `public/datasets.yaml` | Dataset configuration |
| `src/lib/datasetLoader.ts` | Core loading logic |
| `src/hooks/useDatasetFromUrl.ts` | React hooks |
| `src/types/dataset.ts` | TypeScript types |
| `src/components/DatasetBrowser.tsx` | Dataset selection UI |
| `src/components/AppWithUrlLoading.example.tsx` | Integration examples |
| `deploy-dataset.sh` | AWS deployment script |
| `URL_DATASET_LOADING.md` | Full documentation |

## 🔧 Common Tasks

### Add Another Dataset

```bash
# 1. Deploy to S3
./deploy-dataset.sh my_dataset ./results/my_dataset/

# 2. Add to datasets.yaml (script shows you what to add)

# 3. No redeploy needed! Just visit:
# https://stringsight.com/my_dataset
```

### Use CloudFront CDN

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name stringsight-results.s3.us-west-2.amazonaws.com

# Update datasets.yaml with CloudFront URL:
cdn:
  base_url: "https://d1234567890.cloudfront.net"
```

### Test S3 Access

```bash
# Test if files are accessible
curl https://stringsight-results.s3.us-west-2.amazonaws.com/taubench_airline/conversation.jsonl

# Should return the file content (not 403 Forbidden)
```

## 🐛 Troubleshooting

### CORS Error
```
Access blocked by CORS policy
```
**Fix**: Run `./deploy-dataset.sh` again, it will configure CORS.

### 404 Not Found
**Fix**: Check files exist:
```bash
aws s3 ls s3://stringsight-results/taubench_airline/
```

### Dataset Not Found
**Fix**: Add dataset to `public/datasets.yaml`

## 📖 Full Documentation

See `URL_DATASET_LOADING.md` for:
- Detailed architecture
- Security considerations
- Performance optimization
- Cost estimates
- Advanced configurations

## 🎯 URL Structure

- `/` → Dataset browser (shows all available datasets)
- `/taubench_airline` → Loads taubench_airline dataset
- `/my_dataset` → Loads my_dataset

## 💡 Tips

1. **Use CloudFront** for better performance and lower costs
2. **Keep datasets.yaml in git** for version control
3. **Use consistent naming** between S3 paths and URL paths
4. **Test locally** before deploying to production
5. **Monitor S3 costs** with AWS Cost Explorer

## Next Steps

- [ ] Upload your datasets to S3 using `./deploy-dataset.sh`
- [ ] Configure `public/datasets.yaml`
- [ ] Integrate URL loading into your `App.tsx`
- [ ] Test locally with `npm run dev`
- [ ] Deploy to Vercel with `vercel --prod`
- [ ] (Optional) Set up CloudFront CDN for better performance

Happy deploying! 🚀





