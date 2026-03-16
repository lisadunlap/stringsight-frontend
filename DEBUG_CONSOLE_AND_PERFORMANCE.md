# Debug Console and Performance Issues

## Current Issues
1. **Console shows nothing** when loading datasets
2. **Loading is slow** but we don't know where the bottleneck is
3. **Score columns show as dicts** instead of flattened (FIXED - see below)

## Fixes Applied

### 1. Score Flattening Fix - Complete Data Layer Separation
**Problem**: URL-loaded datasets showed score columns as `{metric: value}` dicts instead of separate `score_metric` columns. The URL loading flow was bypassing the proper 3-layer data processing that "Load Results" uses.

**Root Cause**: The URL dataset loading (lines 1020-1147) was NOT following the same process as "Load Results" (lines 1362-1451). It was setting all three data layers to the same raw data without proper transformation.

**Fix**: Completely rewrote URL dataset loading to match the "Load Results" flow exactly:

**Before** (broken):
```typescript
// All three layers got the same raw data - NO FLATTENING!
setOriginalRows(urlDataset.conversations);
setOperationalRows(urlDataset.conversations);
setCurrentRows(urlDataset.conversations);  // ❌ Score dicts not flattened!
```

**After** (fixed):
```typescript
// Layer 1: originalRows - raw JSONL format
setOriginalRows(conversations);

// Layer 2: operationalRows - backend format with score objects
const operational = conversations.map((conv, idx) => ({
  __index: idx,
  question_id: conv.question_id || String(idx),
  prompt: conv.prompt,
  model: conv.model,
  model_response: conv.model_response,
  score: conv.score,  // Keep as object for backend operations
  // ... etc
}));
setOperationalRows(operational);

// Layer 3: currentRows - flattened scores for UI display
const { rows: flattened } = flattenScores(operational, detectedMethod, modelNames);
setCurrentRows(flattened);  // ✅ Scores now flattened!
```

**Changes Made**:
- [src/App.tsx:1020-1147](src/App.tsx#L1020-L1147) - Rewrote URL dataset loading to match "Load Results" flow
- Added proper column inference via `inferColumns()`
- Added proper operational row mapping with `__index` and `question_id`
- Added proper score flattening via `flattenScores()`
- Added metrics normalization via `normalizeMetricsColumnNames()`
- Added cluster metadata enrichment via `enrichModelClusterScoresWithMetadata()`

**Expected Result**:
- Score columns should now appear as `score_metric_name` instead of nested dicts
- All data layers properly separated (original/operational/current)
- Metrics and clusters properly enriched
- Behavior identical to "Load Results" button

### 2. Added Early Diagnostic Logging
Added console log in [src/main.tsx:10-12](src/main.tsx#L10-L12) that fires immediately on page load:
```
🚀 StringSight React app initializing...
   URL: [current URL]
   Timestamp: [ISO timestamp]
```

## Diagnostic Steps

### Step 1: Check Browser Console Settings
1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. **Check the filter dropdown** (top-left of console):
   - Should show "All levels" or similar
   - Make sure it's not set to "Errors" or "Warnings" only
4. **Clear console** (trash icon)
5. **Hard refresh** the page (Cmd+Shift+R / Ctrl+Shift+R)

**Expected**: You should immediately see:
```
🚀 StringSight React app initializing...
   URL: https://stringsight.com/telecom
   Timestamp: 2026-01-03T...
```

**If you DON'T see this**: The React app isn't loading - likely cached old version.

### Step 2: Clear Cache and Reload
If console is still empty:

1. **Chrome/Edge**:
   - Open DevTools (F12)
   - Right-click the refresh button
   - Select "Empty Cache and Hard Reload"

2. **Firefox**:
   - Press Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)
   - Clear "Cache" only
   - Reload page

3. **Safari**:
   - Develop menu → Empty Caches
   - Reload page

**Expected**: After clearing cache, the console logs should appear.

### Step 3: Check Network Tab
Even if console is empty, Network tab will show what's happening:

1. Open DevTools → Network tab
2. Reload page
3. Look for these requests:

**Expected requests**:
```
GET /telecom                          → 200 (HTML from Vercel)
GET /assets/index-[hash].js           → 200 (React bundle)
GET /api/results/telecom/conversations?limit=1000 → 200 (API call)
GET /api/results/telecom/properties   → 200 or 404
GET /api/results/telecom/clusters     → 200 or 404
GET /api/results/telecom/metrics      → 200 or 404
```

**Timing to check**:
- Click on `/api/results/telecom/conversations` request
- Look at "Timing" tab
- Note these values:
  - **TTFB (Time To First Byte)**: Backend processing time
  - **Content Download**: Data transfer time
  - **Total**: Sum of both

### Step 4: Check for JavaScript Errors
In Console tab, look for:
- Red error messages
- "Failed to load module" errors
- "Uncaught TypeError" errors
- Any errors mentioning "flattenScores" or "useDatasetFromUrl"

**If you see errors**: Copy the error message - that's the root cause.

### Step 5: Try Incognito/Private Mode
1. Open incognito/private browser window
2. Visit `https://stringsight.com/telecom`
3. Check console

**Expected**: If it works in incognito, the issue is browser cache or extensions.

## Expected Console Output (After Fixes)

When loading `https://stringsight.com/telecom`, you should see this sequence:

```
🚀 StringSight React app initializing...
   URL: https://stringsight.com/telecom
   Timestamp: 2026-01-03T12:34:56.789Z

🚀 Loading from paginated API endpoints (dataset name: telecom)...
📡 Fetching from endpoints: {
  conversations: "/api/results/telecom/conversations?limit=1000",
  properties: "/api/results/telecom/properties",
  clusters: "/api/results/telecom/clusters",
  metrics: "/api/results/telecom/metrics"
}

⏱️  Loaded via API in 1234ms
   Conversations: 1000 (first 1000 of 50000)
   Properties: 123
   Clusters: 45

🎯 Loading dataset from URL: Telecom Dataset
   Conversations: 1000
   Properties: 123
   Clusters: 45

🔄 Flattening scores for URL dataset...
   Method: single_model
   Sample row before flattening: {prompt: "...", model_response: "...", score: {accuracy: 0.8}}

🔄 DEBUG flattenScores called: {rowCount: 1000, method: "single_model", ...}
🔍 DEBUG flattenField called for field "score" with prefix "score"
🔍 DEBUG found keys for score: ["accuracy", "fluency", ...]

✅ Scores flattened
   Sample row after flattening: {prompt: "...", model_response: "...", score_accuracy: 0.8}

✅ URL dataset loaded into app state
   Final currentRows: 1000
```

## Performance Analysis

Once you can see console logs, we can identify the bottleneck:

### Backend Latency
**Look for**: Large "Loaded via API in XXXms" time

**If > 5 seconds**: Backend is slow
- Check backend server resources (CPU, memory)
- Check if backend is reading from disk every time (should cache in memory)
- Look at backend logs for slow queries

### Network Transfer
**Look for**: Large "Content Download" time in Network tab

**If > 2 seconds**: Response is too large
- Check response size (should show in Network tab "Size" column)
- For 50k rows, expect ~10-50 MB depending on data
- Consider implementing streaming responses

### React State Processing
**Look for**: Long gap between "URL dataset loaded" and UI appearing

**If > 2 seconds**: React processing is slow
- This is what we optimized with sampling and `startTransition`
- Open React DevTools Profiler to see which components are slow
- May need to add more `useMemo` or virtualization

## Testing Performance Fix

After clearing cache and reloading:

1. **Check score columns**: Should be `score_accuracy`, `score_fluency` etc., NOT `score: {accuracy: 0.8}`
2. **Measure total load time**: From first console log to UI appearing
3. **Compare**:
   - Before: ~12-32 seconds
   - After: Should be ~2-5 seconds

## Vercel Production Notes

If testing on production (`stringsight.com`):

1. **Vercel rewrites** are configured in [vercel.json](vercel.json):
   ```json
   {
     "rewrites": [
       { "source": "/api/:path*", "destination": "https://api.stringsight.com/:path*" }
     ]
   }
   ```

2. **This means**:
   - Frontend makes request to `/api/results/telecom/conversations`
   - Vercel proxies to `https://api.stringsight.com/results/telecom/conversations`
   - Backend must be running at `https://api.stringsight.com`

3. **To verify backend**:
   ```bash
   curl https://api.stringsight.com/health
   curl https://api.stringsight.com/results/datasets
   curl https://api.stringsight.com/results/telecom/conversations?limit=5
   ```

## Local Testing

If testing locally (`localhost:5180`):

1. **Vite proxy** is configured in [vite.config.ts](vite.config.ts):
   ```typescript
   server: {
     proxy: {
       '/api': {
         target: 'http://localhost:8000',
         changeOrigin: true,
         rewrite: (path) => path.replace(/^\/api/, '')
       }
     }
   }
   ```

2. **This means**:
   - Frontend makes request to `/api/results/telecom/conversations`
   - Vite proxies to `http://localhost:8000/results/telecom/conversations`
   - Backend must be running on port 8000

3. **Start backend**:
   ```bash
   cd ~/StringSightNew
   uvicorn stringsight.api:app --reload --host localhost --port 8000
   ```

## Next Steps

1. **Clear browser cache and hard reload**
2. **Check console for the new diagnostic logs**
3. **Report back**:
   - Do you see the "🚀 StringSight React app initializing..." log?
   - Do you see the API loading logs?
   - Do you see the score flattening logs?
   - Are score columns now showing as `score_metric` instead of dicts?
   - What is the total load time (from page load to UI appearing)?
   - Any errors in console?

4. **If console is still empty**:
   - Share screenshot of Network tab showing the requests
   - Try in incognito mode
   - Try different browser

5. **If console shows logs**:
   - Share the full console output
   - We can identify exactly where the slowness is
   - We can optimize the specific bottleneck
