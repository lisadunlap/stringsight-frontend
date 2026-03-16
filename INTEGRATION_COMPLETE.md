# ✅ URL Loading Now Integrated!

The URL-based loading is now wired up to your App! Here's what to test:

## Test It Now

```bash
# Start dev server (if not already running)
npm run dev
```

Then test these URLs in your browser:

### 1. Dataset Browser (Home)
```
http://localhost:5180/
```
**Expected**: Shows dataset browser with available datasets

### 2. Telecom Dataset (ZIP file from S3)
```
http://localhost:5180/telecom
```
**Expected**: 
- Shows loading spinner
- Downloads ZIP from S3
- Extracts and displays data
- All tabs (Data, Properties, Clusters, Metrics) populated

### 3. Check Console
Open browser DevTools (F12) and watch for:
```
🔍 Loading dataset: telecom
📋 Dataset config: {...}
📦 Loading from ZIP file: https://stringsight.s3.us-east-2.amazonaws.com/telecom_2026-01-02.zip
📦 Downloading ZIP from ...
📂 Extracting ZIP contents...
  ✓ Extracted: conversation.jsonl
  ✓ Extracted: properties.jsonl
  ...
🎯 Loading dataset from URL: telecom
✅ URL dataset loaded into app state
```

## If You Still See Base Website

### Issue: CORS Not Configured
**Error in console**: "blocked by CORS policy"

**Fix**:
```bash
cat > /tmp/cors.json <<EOF
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedOrigins": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3000
}]
EOF

aws s3api put-bucket-cors --bucket stringsight --cors-configuration file:///tmp/cors.json
```

### Issue: File Not Public
**Error in console**: "403 Forbidden"

**Fix**:
```bash
aws s3api put-object-acl --bucket stringsight --key telecom_2026-01-02.zip --acl public-read
```

### Issue: Wrong URL
**Error**: "Failed to download ZIP: Not Found"

**Fix**: Check the exact URL
```bash
# List files in bucket
aws s3 ls s3://stringsight/

# Should show: telecom_2026-01-02.zip
```

### Issue: datasets.yaml Not Found
**Error in console**: "Failed to fetch datasets.yaml"

**Fix**: The file should be at `public/datasets.yaml`. Check it's there:
```bash
ls -la public/datasets.yaml
```

If it's missing, it was created at the root. Move it:
```bash
mv datasets.yaml public/
```

## What Changed in App.tsx

1. **Added imports** (line ~56):
```typescript
import { useDatasetFromUrl } from "./hooks/useDatasetFromUrl";
import { DatasetBrowser } from "./components/DatasetBrowser";
```

2. **Added hook** (line ~619):
```typescript
const { dataset: urlDataset, isLoading: urlLoading, error: urlError, 
        datasetName, availableDatasets } = useDatasetFromUrl();
```

3. **Added effect to load data** (line ~1020):
```typescript
React.useEffect(() => {
  if (urlDataset) {
    // Loads conversations, properties, clusters into app state
  }
}, [urlDataset]);
```

4. **Added loading state** (before main render):
```typescript
if (urlLoading) {
  return <CircularProgress />;
}
```

5. **Added error state**:
```typescript
if (urlError) {
  return <Alert severity="error">...</Alert>;
}
```

6. **Added dataset browser**:
```typescript
if (!datasetName && originalRows.length === 0) {
  return <DatasetBrowser datasets={availableDatasets} />;
}
```

## Testing Checklist

- [ ] Visit `/` → Shows dataset browser
- [ ] Click a dataset → Navigates to `/{dataset_name}`
- [ ] Visit `/telecom` directly → Loads dataset
- [ ] Check Data tab → Shows conversations
- [ ] Check Properties tab → Shows properties (if in ZIP)
- [ ] Check Clusters tab → Shows clusters (if in ZIP)
- [ ] Check browser console → No errors
- [ ] Network tab → Shows ZIP download from S3

## What You Should See

### At `/` (Home):
![Dataset Browser with cards for each dataset]

### At `/telecom`:
1. Loading spinner (briefly)
2. Main app with data loaded
3. Data tab showing conversations
4. Properties tab (if properties.jsonl in ZIP)
5. Clusters tab (if clusters.jsonl in ZIP)

## Next Steps After It Works

1. **Add more datasets**:
```bash
# Upload another dataset
aws s3 cp my-other-data.zip s3://stringsight/

# Add to public/datasets.yaml
vim public/datasets.yaml
```

2. **Deploy to production**:
```bash
npm run build
vercel --prod
```

3. **Access in production**:
```
https://your-domain.com/telecom
```

## Still Having Issues?

1. **Check AWS credentials**:
```bash
aws s3 ls s3://stringsight/
# Should list files without error
```

2. **Check file exists**:
```bash
curl -I https://stringsight.s3.us-east-2.amazonaws.com/telecom_2026-01-02.zip
# Should return: HTTP/1.1 200 OK
```

3. **Check datasets.yaml**:
```bash
cat public/datasets.yaml
# Should show telecom dataset config
```

4. **Check console for detailed errors**:
Open DevTools (F12) → Console tab

## Debug Mode

Add this to see what's happening:
```javascript
// In browser console:
localStorage.debug = '*'
// Reload page
```

This will show all debug logs including dataset loading steps.

---

**The integration is complete!** Visit `http://localhost:5180/telecom` and you should see your data loading from S3! 🚀





