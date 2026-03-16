# Apply CORS via AWS Console

Since you don't have CLI permissions for `s3:PutBucketCORS`, apply it via the AWS Console:

## Steps

1. **Go to AWS Console**: https://console.aws.amazon.com/s3/
2. **Click on `stringsight` bucket**
3. **Go to "Permissions" tab**
4. **Scroll down to "Cross-origin resource sharing (CORS)"**
5. **Click "Edit"**
6. **Paste this JSON:**

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5180",
      "http://127.0.0.1:5180"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3000
  }
]
```

7. **Click "Save changes"**

## After Applying CORS

1. **Hard refresh browser**: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
2. **Visit**: `http://localhost:5180/telecom`
3. **Check browser console** - the CORS error should be gone!

## For Production

When you deploy to production, add your production domain:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5180",
      "http://127.0.0.1:5180",
      "https://your-production-domain.com",
      "https://your-app.vercel.app"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3000
  }
]
```

## Why This Is Needed

- **Signed URLs** solve authentication but don't solve CORS
- **CORS** is a browser security feature
- The browser needs S3 to say "Yes, this origin can read my response"
- Without CORS headers, the browser blocks JavaScript from accessing the downloaded data

## Alternative: Backend Proxy (If You Can't Change CORS)

If you can't modify bucket CORS, the backend can proxy the download:

1. Frontend requests: `/api/s3/download/stringsight/telecom_2026-01-02.zip`
2. Backend downloads from S3 (no CORS issues server-side)
3. Backend streams to frontend with proper CORS headers

But this is more complex and puts load on your backend. Direct S3 access with CORS is better!


