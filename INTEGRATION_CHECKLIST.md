# Integration Checklist

Use this checklist to integrate URL-based dataset loading into your StringSight frontend.

## Phase 1: Setup & Testing (30 minutes)

### 1. Verify Files Created ✓
- [x] `public/datasets.yaml` - Configuration file
- [x] `src/types/dataset.ts` - TypeScript types
- [x] `src/lib/datasetLoader.ts` - Core loading logic
- [x] `src/hooks/useDatasetFromUrl.ts` - React hooks
- [x] `src/components/DatasetBrowser.tsx` - Dataset browser UI
- [x] `src/components/AppWithUrlLoading.example.tsx` - Integration examples
- [x] `deploy-dataset.sh` - AWS deployment script
- [x] `vercel.json` - Updated with URL rewrites
- [x] `package.json` - Added js-yaml dependency
- [x] Documentation files

### 2. Test Dataset Upload to S3
```bash
# Set your AWS credentials if not already set
# export AWS_ACCESS_KEY_ID=...
# export AWS_SECRET_ACCESS_KEY=...

# Test upload with existing dataset
cd /home/lisabdunlap/stringsight-frontend
./deploy-dataset.sh taubench_airline ./public/taubench_airline_data/

# Expected: Script creates bucket, configures CORS, uploads files, shows URLs
```

- [ ] Script runs without errors
- [ ] Files uploaded to S3
- [ ] CORS configured
- [ ] URLs shown in output

### 3. Update datasets.yaml
Copy the YAML config from the script output into `public/datasets.yaml`:

- [ ] Configuration added to datasets.yaml
- [ ] All file names match uploaded files
- [ ] Method set correctly (single_model or side_by_side)
- [ ] CDN URL or S3 bucket/path configured

### 4. Test File Access
```bash
# Test if files are publicly accessible
curl https://stringsight-results.s3.us-west-2.amazonaws.com/taubench_airline/conversation.jsonl

# Expected: Should return JSON content, not 403 Forbidden
```

- [ ] Files are accessible without CORS errors
- [ ] Returns actual file content

### 5. Test Locally
```bash
npm run dev

# Visit in browser:
# http://localhost:5180/taubench_airline
```

- [ ] App loads without errors
- [ ] Dataset loads from S3
- [ ] Console shows loading messages
- [ ] UI populates with data
- [ ] No CORS errors in console

## Phase 2: App Integration (1-2 hours)

### Option A: Minimal Integration (Recommended First)

Add URL loading alongside existing manual upload:

1. **Import the hook in App.tsx:**
```typescript
import { useDatasetFromUrl } from './hooks/useDatasetFromUrl';
```

2. **Add hook call at top of App() function:**
```typescript
const { dataset: urlDataset, isLoading: urlLoading } = useDatasetFromUrl();
```

3. **Add effect to load URL dataset:**
```typescript
useEffect(() => {
  if (urlDataset) {
    console.log('Loading dataset from URL:', urlDataset.name);
    // Call your existing data loading function
    // or set state directly:
    setOriginalRows(urlDataset.conversations);
    setPropertiesRows(urlDataset.properties);
    setClusters(urlDataset.clusters);
    setMethod(urlDataset.config.method);
    // ... etc
  }
}, [urlDataset]);
```

4. **Add loading indicator:**
```typescript
if (urlLoading) {
  return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
    <CircularProgress />
  </Box>;
}
```

**Testing:**
- [ ] Visit `/taubench_airline` → Dataset loads
- [ ] Visit `/` → Normal app behavior (manual upload works)
- [ ] URL dataset populates all tabs correctly
- [ ] Properties tab shows data
- [ ] Clusters tab shows data
- [ ] Metrics tab shows data

### Option B: Full Integration with Dataset Browser

Replace your home page with the dataset browser:

1. **Import components:**
```typescript
import { useDatasetFromUrl } from './hooks/useDatasetFromUrl';
import { DatasetBrowser } from './components/DatasetBrowser';
```

2. **Use hook at top of App():**
```typescript
const { 
  dataset, 
  isLoading, 
  error, 
  datasetName, 
  availableDatasets 
} = useDatasetFromUrl();
```

3. **Add loading state:**
```typescript
if (isLoading) {
  return <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 8 }}>
    <CircularProgress size={60} />
    <Typography>Loading dataset {datasetName}...</Typography>
  </Box>;
}
```

4. **Add error state:**
```typescript
if (error) {
  return <Box sx={{ p: 4, maxWidth: 600, mx: 'auto', mt: 8 }}>
    <Alert severity="error">{error.message}</Alert>
    <DatasetBrowser datasets={availableDatasets} onSelectDataset={(name) => {
      window.location.pathname = `/${name}`;
    }} />
  </Box>;
}
```

5. **Add dataset browser for home page:**
```typescript
if (!datasetName) {
  return <DatasetBrowser datasets={availableDatasets} onSelectDataset={(name) => {
    window.location.pathname = `/${name}`;
  }} />;
}
```

6. **Load dataset data:**
```typescript
useEffect(() => {
  if (dataset) {
    // Populate state as in Option A
  }
}, [dataset]);
```

**Testing:**
- [ ] Visit `/` → Shows dataset browser
- [ ] Click dataset → Navigates to `/{dataset_name}`
- [ ] Dataset loads and displays
- [ ] Error handling works (try `/nonexistent_dataset`)
- [ ] Back button works

## Phase 3: Multi-Dataset Setup (30 minutes)

### 1. Upload Additional Datasets
```bash
# Upload second dataset
./deploy-dataset.sh taubench_airline_sbs ./public/taubench_airline_data_sbs/

# Add to datasets.yaml (script shows config)
```

- [ ] Second dataset uploaded
- [ ] Added to datasets.yaml
- [ ] Accessible at URL

### 2. Test Multi-Dataset Navigation
- [ ] Visit `/` → Both datasets shown
- [ ] Click first dataset → Loads correctly
- [ ] Navigate to second dataset → Loads correctly
- [ ] Data switches properly between datasets

## Phase 4: CloudFront CDN Setup (Optional, 30 minutes)

### 1. Create CloudFront Distribution
```bash
aws cloudfront create-distribution \
  --origin-domain-name stringsight-results.s3.us-west-2.amazonaws.com \
  --default-root-object index.html
```

- [ ] Distribution created
- [ ] Domain name noted (e.g., d1234567890.cloudfront.net)

### 2. Update datasets.yaml
```yaml
cdn:
  enabled: true
  base_url: "https://d1234567890.cloudfront.net"
```

- [ ] CDN configuration added
- [ ] Datasets still load correctly

### 3. Test CDN
- [ ] Files load from CloudFront (check network tab)
- [ ] Loading is faster
- [ ] CORS still works

## Phase 5: Production Deployment (15 minutes)

### 1. Pre-Deployment Checks
- [ ] All datasets load locally
- [ ] No console errors
- [ ] No linter errors: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Preview build works: `npm run preview`

### 2. Deploy to Vercel
```bash
vercel --prod
```

- [ ] Deployment succeeds
- [ ] Visit production URL
- [ ] All datasets load in production
- [ ] CORS works in production

### 3. Post-Deployment Verification
- [ ] Visit `/` → Dataset browser works
- [ ] Visit `/{dataset_name}` → Each dataset loads
- [ ] Check browser console → No errors
- [ ] Test on mobile → Responsive
- [ ] Test all tabs → Data displays correctly

## Phase 6: Documentation & Handoff (15 minutes)

### 1. Update Project Documentation
- [ ] Add deployment instructions to README
- [ ] Document how to add new datasets
- [ ] Note any custom configuration

### 2. Create Operations Guide
Document for team members:
- [ ] How to add new datasets
- [ ] How to update existing datasets
- [ ] How to troubleshoot common issues

### 3. Monitor & Iterate
- [ ] Monitor S3 costs (first week)
- [ ] Check CloudFront metrics
- [ ] Gather user feedback
- [ ] Optimize based on usage patterns

## Troubleshooting

### Issue: CORS Errors
```
Access to fetch blocked by CORS policy
```

**Solution:**
```bash
# Re-run deployment script which configures CORS
./deploy-dataset.sh taubench_airline ./public/taubench_airline_data/
```

### Issue: 404 Not Found
```
Failed to load conversation.jsonl: 404
```

**Solution:**
- Verify files exist: `aws s3 ls s3://stringsight-results/taubench_airline/`
- Check paths in datasets.yaml match S3 structure
- Ensure files were uploaded with correct names

### Issue: Dataset Not Found
```
Dataset "xyz" not found in configuration
```

**Solution:**
- Add dataset to `public/datasets.yaml`
- Check spelling matches URL exactly
- Restart dev server: `npm run dev`

### Issue: Build Fails
```
Module not found: js-yaml
```

**Solution:**
```bash
npm install
npm run build
```

### Issue: Slow Loading
**Solution:**
- Set up CloudFront CDN (Phase 4)
- Enable compression on CloudFront
- Consider smaller file sizes

## Success Criteria

You've successfully integrated URL-based loading when:

- [ ] Users can visit `/{dataset_name}` and see data
- [ ] Dataset browser shows all available datasets
- [ ] Navigation between datasets works
- [ ] All tabs (Data, Properties, Clusters, Metrics) populate
- [ ] Error handling is graceful
- [ ] Loading states are clear
- [ ] Production deployment works
- [ ] Team can add new datasets easily

## Next Steps After Integration

1. **Add more datasets** - Use `./deploy-dataset.sh`
2. **Set up monitoring** - Track S3 usage and costs
3. **Optimize performance** - CloudFront, compression, lazy loading
4. **Add features** - Dataset search, favorites, recent datasets
5. **Improve UX** - Better loading states, dataset metadata display

## Questions or Issues?

See documentation:
- `QUICKSTART_URL_LOADING.md` - Quick reference
- `URL_DATASET_LOADING.md` - Detailed guide
- `IMPLEMENTATION_SUMMARY.md` - Technical overview
- `ARCHITECTURE_DIAGRAM.txt` - Visual architecture
- `src/components/AppWithUrlLoading.example.tsx` - Code examples

## Estimated Time

- **Phase 1** (Setup & Testing): 30 minutes
- **Phase 2** (App Integration): 1-2 hours
- **Phase 3** (Multi-Dataset): 30 minutes
- **Phase 4** (CloudFront): 30 minutes
- **Phase 5** (Deployment): 15 minutes
- **Phase 6** (Documentation): 15 minutes

**Total: 3-4 hours** for complete integration

Good luck! 🚀





