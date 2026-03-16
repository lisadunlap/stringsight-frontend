# Debugging Blank UI

## Quick Checks

### 1. Open Browser Console (F12)

Look for these log messages in order:

```
🔍 Loading dataset: telecom
📋 Dataset config: {cdn_url: "/api/results/zip/...", ...}
📦 Loading from ZIP file: /api/results/zip/telecom_2026-01-02.zip
📦 Downloading ZIP from /api/results/zip/...
📂 Extracting ZIP contents...
  ✓ Extracted: conversation.jsonl (XXX KB)
✅ Loaded from ZIP: {conversations: XXX, ...}
🎯 Loading dataset from URL: telecom
   Conversations: XXX
✅ URL dataset loaded into app state
   Final currentRows: XXX
```

### 2. Check for Errors

Look for any red error messages in console. Common issues:

- **404 Not Found** → File doesn't exist at backend path
- **Failed to fetch** → Backend not running or proxy issue
- **Parse error** → ZIP file corrupted or wrong format
- **0 conversations** → Data loaded but empty

### 3. Check Network Tab

1. Open DevTools → Network tab
2. Reload the page
3. Look for request to `/api/results/zip/telecom_2026-01-02.zip`
4. Check:
   - Status: Should be `200 OK`
   - Size: Should be ~428 MB
   - Time: Should complete (not pending forever)

### 4. Check React State

In console, type:
```javascript
// Check if data exists
window.__REACT_DEVTOOLS_GLOBAL_HOOK__
```

Or add this temporarily to App.tsx after line 1064:
```typescript
console.log('DEBUG State:', {
  currentRows: currentRows.length,
  originalRows: originalRows.length,
  operationalRows: operationalRows.length,
  propertiesRows: propertiesRows.length,
  clusters: clusters.length,
  method,
  isResultsMode
});
```

### 5. Check UI Rendering

Possible causes of blank UI:

**A) Data loaded but not displayed**
- Check if `currentRows.length > 0` in console
- Check if any tabs are selected
- Check if filters are hiding all data

**B) Wrong tab selected**
- Try clicking different tabs (Data, Properties, Clusters, Metrics)

**C) Loading state stuck**
- Check if `isLoadingResults` is still true

**D) Error state**
- Check if `resultsError` is set

## Debug Commands

Run these in browser console:

```javascript
// Check what's in the app state
console.log('URL Dataset:', urlDataset);
console.log('Current Rows:', currentRows);
console.log('Properties:', propertiesRows);
console.log('Clusters:', clusters);
console.log('Method:', method);
console.log('Is Results Mode:', isResultsMode);
console.log('Results Error:', resultsError);
```

## Common Issues

### Issue 1: ZIP file not found (404)

**Symptoms:** Network shows 404

**Check:**
```bash
# In backend directory
ls -lh final_results/telecom_2026-01-02.zip
```

**Fix:** Copy file to correct location:
```bash
cp ~/stringsight-frontend/public/telecom_2026-01-02.zip ~/stringsight/final_results/
```

### Issue 2: Backend not running

**Symptoms:** Network shows failed/cancelled

**Fix:**
```bash
cd ~/stringsight
uvicorn stringsight.api:app --reload --host localhost --port 8000
```

### Issue 3: Data loads but UI blank

**Symptoms:** Console shows data loaded (XXX conversations) but nothing visible

**Likely causes:**
- Wrong method detection
- Column mapping issue
- Filter hiding everything
- Tab not switching

**Debug:**
Add logging to see what's happening:
```typescript
// In App.tsx after line 1064, add:
useEffect(() => {
  console.log('=== UI STATE DEBUG ===');
  console.log('currentRows:', currentRows.length);
  console.log('method:', method);
  console.log('tabValue:', tabValue);
  console.log('isResultsMode:', isResultsMode);
  console.log('Sample row:', currentRows[0]);
}, [currentRows, method, tabValue, isResultsMode]);
```

### Issue 4: ZIP extracts but 0 conversations

**Symptoms:** Logs show "✓ Extracted" but conversations: 0

**Check ZIP contents:**
```bash
unzip -l ~/stringsight/final_results/telecom_2026-01-02.zip | grep conversation
```

Should show: `conversation.jsonl`

**Check file format:**
```bash
cd ~/stringsight/final_results
unzip -p telecom_2026-01-02.zip conversation.jsonl | head -1
```

Should be valid JSON (one object per line)

## What to Share

If still stuck, share:

1. Browser console output (all messages)
2. Network tab screenshot showing the ZIP request
3. Output of: `ls -lh ~/stringsight/final_results/`
4. Backend logs when you visit the page
