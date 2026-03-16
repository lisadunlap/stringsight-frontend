# ✅ Signed URLs Implementation Complete!

Your frontend now uses backend-generated signed URLs for secure, private S3 access!

## What Changed

### Frontend ✅
- `src/lib/api.ts` - Added `getSignedUrl()` and `getDatasetSignedUrl()`
- `src/lib/datasetLoader.ts` - Updated to request signed URLs from backend
- `public/datasets.yaml` - Added `use_signed_urls: true` flag

### Backend (You Need to Add)
- Add S3 signed URL endpoints
- Backend uses your AWS credentials to generate temporary URLs
- S3 files stay PRIVATE ✅

## Setup Steps

### 1. Add Backend Endpoint

Add to your Python backend (e.g., `stringsight/api.py`):

```python
import boto3
from fastapi import HTTPException
from botocore.exceptions import ClientError

# Initialize S3 client
s3_client = boto3.client('s3')

@app.get("/s3/signed-url/{bucket}/{key:path}")
async def get_signed_url(bucket: str, key: str, expires_in: int = 3600):
    """Generate a temporary signed URL for S3 object access"""
    try:
        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=expires_in
        )
        return {
            "url": signed_url,
            "expires_in": expires_in,
            "bucket": bucket,
            "key": key
        }
    except ClientError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate signed URL: {str(e)}"
        )
```

See `BACKEND_SIGNED_URLS.md` for complete code.

### 2. Install Backend Dependencies

```bash
pip install boto3 botocore
```

### 3. Restart Backend

```bash
# Make sure backend is running with AWS credentials
uvicorn stringsight.api:app --reload --host localhost --port 8000
```

### 4. Test It!

```bash
# Start frontend (if not already running)
npm run dev

# Visit in browser
http://localhost:5180/telecom
```

## How It Works

```
Browser                Backend               S3 (Private)
   │                      │                      │
   │ 1. Load /telecom     │                      │
   ├─────────────────────>│                      │
   │                      │                      │
   │ 2. Request signed    │                      │
   │    URL for ZIP       │                      │
   ├─────────────────────>│                      │
   │                      │                      │
   │                      │ 3. Generate signed   │
   │                      │    URL using AWS     │
   │                      │    credentials       │
   │                      │                      │
   │ 4. Return signed URL │                      │
   │    (expires in 1h)   │                      │
   │<─────────────────────┤                      │
   │                      │                      │
   │ 5. Download with temporary URL              │
   ├─────────────────────────────────────────────>│
   │                      │                      │
   │ 6. Return data       │                      │
   │<─────────────────────────────────────────────┤
```

## Benefits ✅

- **Private S3 Files**: No need to make bucket public
- **Secure**: URLs expire after 1 hour
- **Uses Your Credentials**: Backend uses your AWS credentials from `~/.aws/`
- **Same UX**: Users don't see any difference

## Testing

### Test Backend Endpoint

```bash
curl http://localhost:8000/s3/signed-url/stringsight/telecom_2026-01-02.zip
```

Should return:
```json
{
  "url": "https://stringsight.s3.us-east-2.amazonaws.com/telecom_2026-01-02.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
  "expires_in": 3600,
  "bucket": "stringsight",
  "key": "telecom_2026-01-02.zip"
}
```

### Test Frontend

1. Open browser: `http://localhost:5180/telecom`
2. Open DevTools console (F12)
3. Should see:
```
🔐 Using signed URL from backend
📦 Downloading ZIP from https://stringsight.s3...?X-Amz-Algorithm=...
```

## Console Output

You should see:
```
🔍 Loading dataset: telecom
📋 Dataset config: {...}
🔐 Using signed URL from backend
📦 Loading from ZIP file: https://stringsight.s3.us-east-2.amazonaws.com/...
📂 Extracting ZIP contents...
  ✓ Extracted: conversation.jsonl
  ✓ Extracted: properties.jsonl
🎯 Loading dataset from URL: telecom
✅ URL dataset loaded into app state
```

## Troubleshooting

### Backend Error: "Unable to locate credentials"
```
botocore.exceptions.NoCredentialsError
```

**Fix**: Backend needs AWS credentials
```bash
# Option 1: Environment variables
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_DEFAULT_REGION="us-east-2"

# Option 2: AWS CLI config (already set up)
aws configure
```

### Frontend Error: "Failed to generate signed URL"
```
Failed to load dataset: Failed to generate signed URL: An error occurred (403)...
```

**Fix**: Your AWS user needs `s3:GetObject` permission for the bucket
```json
{
  "Effect": "Allow",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::stringsight/*"
}
```

### Frontend Error: "Failed to fetch"
```
TypeError: Failed to fetch
```

**Fix**: Make sure backend is running
```bash
uvicorn stringsight.api:app --reload --host localhost --port 8000
```

## Configuration Options

### Per-Dataset Signed URLs

```yaml
datasets:
  private_dataset:
    use_signed_urls: true  # This one uses signed URLs
    cdn_url: "https://stringsight.s3.us-east-2.amazonaws.com/private.zip"
    
  public_dataset:
    use_signed_urls: false  # This one uses direct public URL
    cdn_url: "https://cdn.example.com/public.zip"
```

### Global Signed URLs

```yaml
use_signed_urls: true  # All datasets use signed URLs by default

datasets:
  dataset1:
    # Will use signed URLs (global setting)
    cdn_url: "https://..."
```

## Next Steps

1. ✅ **Add backend endpoint** (see BACKEND_SIGNED_URLS.md)
2. ✅ **Restart backend** with AWS credentials
3. ✅ **Test**: `http://localhost:5180/telecom`
4. ✅ **Deploy**: Backend + Frontend to production

## Production Deployment

For production:
1. Deploy backend with AWS credentials (IAM role or env vars)
2. Deploy frontend (points to production backend via `VITE_BACKEND`)
3. S3 files stay private ✅
4. All access goes through your secure backend ✅

No public bucket policies needed! 🎉





