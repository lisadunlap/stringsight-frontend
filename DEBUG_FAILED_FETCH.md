# Quick Debug Guide

The error "Failed to fetch" means the frontend can't reach the backend endpoint.

## Check Browser Console

Open browser DevTools (F12) → Console tab

Look for:
1. What URL is being called?
2. What's the full error message?
3. Is there a CORS error?

## Common Issues

### Issue 1: Frontend calling wrong URL

**Check in console:**
```
[stringsight] API_BASE: /api
```

Should show `/api` (not `http://localhost:8000`)

**Fix if wrong:**
```bash
# Don't set VITE_BACKEND for local dev
unset VITE_BACKEND
npm run dev
```

### Issue 2: Signed URL endpoint path mismatch

**Expected call:**
```
GET /api/s3/signed-url/stringsight/telecom_2026-01-02.zip
```

**Check if backend endpoint matches:**
```bash
curl http://localhost:8000/s3/signed-url/stringsight/telecom_2026-01-02.zip
```

### Issue 3: Browser DevTools Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Click "Telecom Dataset"
4. Look for red/failed requests
5. Click on the failed request to see details

## Quick Tests

### Test 1: Direct backend
```bash
curl http://localhost:8000/s3/signed-url/stringsight/telecom_2026-01-02.zip
```
Should return JSON with `"url": "https://..."`

### Test 2: Through proxy
```bash
curl http://localhost:5180/api/s3/signed-url/stringsight/telecom_2026-01-02.zip
```
Should return same JSON

### Test 3: Check frontend logs
Look in browser console for:
```
🔍 Loading dataset: telecom
📋 Dataset config: {...}
```

Then look for error after that.

## Most Likely Issue

The frontend is probably calling `/api/s3/signed-url/...` but the backend router might be registered at a different path.

**Check backend registration:**
Your backend agent should have added something like:
```python
app.include_router(s3.router, prefix="/s3", tags=["s3"])
```

If it's registered with a different prefix, the path won't match.

## What to Share

Please share:
1. Browser console output (all messages)
2. Network tab - show the failed request URL
3. The full error message

This will tell us exactly what's wrong!





