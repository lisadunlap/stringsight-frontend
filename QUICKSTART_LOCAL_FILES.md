# Quick Start: Local File Serving

The simplest way to get your dataset loading working right now.

## What We're Doing

Instead of S3, serve the ZIP file directly from your backend. No AWS permissions needed, no CORS issues.

## Step-by-Step Setup

### 1. Find your backend directory

```bash
# Usually something like:
cd ~/stringsight  # or wherever your backend is
```

### 2. Create datasets directory and copy file

```bash
# In your backend directory
mkdir -p datasets

# Copy the file from frontend
cp ~/stringsight-frontend/public/telecom_2026-01-02.zip datasets/
```

### 3. Add code to backend

Edit `stringsight/api.py` and add these lines:

```python
# At the top with other imports:
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

# After app = FastAPI():
BACKEND_ROOT = Path(__file__).parent.parent
DATASETS_DIR = BACKEND_ROOT / "datasets"
DATASETS_DIR.mkdir(exist_ok=True)

# Add CORS (if not already present):
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5180"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount datasets directory:
app.mount("/datasets", StaticFiles(directory=str(DATASETS_DIR)), name="datasets")
```

See [backend_api_additions.py](backend_api_additions.py) for complete code.

### 4. Restart backend

```bash
cd ~/stringsight  # your backend directory
uvicorn stringsight.api:app --reload --host localhost --port 8000
```

### 5. Test file access

```bash
curl -I http://localhost:8000/datasets/telecom_2026-01-02.zip
```

Should return:
```
HTTP/1.1 200 OK
content-length: 448790528
content-type: application/zip
```

### 6. Frontend is already configured!

The file `public/datasets.yaml` is already updated to point to:
```
http://localhost:8000/datasets/telecom_2026-01-02.zip
```

### 7. Start frontend and test

```bash
cd ~/stringsight-frontend
npm run dev
```

Visit: **http://localhost:5180/telecom**

## Troubleshooting

### "Failed to fetch"
- Make sure backend is running on port 8000
- Test: `curl -I http://localhost:8000/datasets/telecom_2026-01-02.zip`

### "File not found"
- Check file exists: `ls ~/stringsight/datasets/telecom_2026-01-02.zip`
- File must be in backend's `datasets/` directory

### CORS error
- Add CORS middleware to backend (see step 3)
- Make sure origin includes `http://localhost:5180`

## File Locations

```
backend/
  └── datasets/
      └── telecom_2026-01-02.zip  ← Your 428MB file goes here

frontend/
  └── public/
      └── datasets.yaml  ← Already configured
```

## Why This Works

- ✅ No AWS permissions needed
- ✅ No CORS issues (backend serves to frontend)
- ✅ No public S3 bucket required
- ✅ Fast local development
- ✅ Works offline

## Production Deployment

For production, you'd want to:
1. Use S3 + CloudFront (or similar CDN)
2. Keep dataset files out of your Git repo
3. Use signed URLs if files should be private

But for development, this local serving is perfect!
