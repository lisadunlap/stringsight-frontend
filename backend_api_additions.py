"""
Backend API additions for local file serving
Add these snippets to your stringsight/api.py file
"""

# ============================================================================
# 1. ADD THESE IMPORTS AT THE TOP
# ============================================================================

from fastapi.staticfiles import StaticFiles
from pathlib import Path

# If you don't already have CORS:
from fastapi.middleware.cors import CORSMiddleware


# ============================================================================
# 2. ADD DATASETS DIRECTORY SETUP (after app = FastAPI())
# ============================================================================

# Datasets directory configuration
BACKEND_ROOT = Path(__file__).parent.parent
DATASETS_DIR = BACKEND_ROOT / "datasets"
DATASETS_DIR.mkdir(exist_ok=True)


# ============================================================================
# 3. ADD CORS MIDDLEWARE (if not already present)
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5180",  # Vite default
        "http://localhost:5173",  # Alternative Vite port
        "http://localhost:3000",  # Common dev port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# 4. ADD STATIC FILE SERVING FOR DATASETS
# ============================================================================

# Mount the datasets directory as static files
# This makes files available at http://localhost:8000/datasets/{filename}
app.mount("/datasets", StaticFiles(directory=str(DATASETS_DIR)), name="datasets")


# ============================================================================
# ALTERNATIVE: Use a custom endpoint instead of mounting static files
# (Use this if you want more control or logging)
# ============================================================================

from fastapi import HTTPException
from fastapi.responses import FileResponse

@app.get("/datasets/{filename}")
async def get_dataset_file(filename: str):
    """
    Serve dataset files from the datasets directory

    Example: GET /datasets/telecom_2026-01-02.zip
    """
    file_path = DATASETS_DIR / filename

    # Security: prevent directory traversal
    if not file_path.resolve().is_relative_to(DATASETS_DIR.resolve()):
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")

    # Determine media type
    media_type = "application/octet-stream"
    if filename.endswith(".zip"):
        media_type = "application/zip"
    elif filename.endswith(".json"):
        media_type = "application/json"
    elif filename.endswith(".jsonl"):
        media_type = "application/x-ndjson"

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=filename
    )


# ============================================================================
# COMPLETE EXAMPLE: Full minimal api.py
# ============================================================================

"""
Here's what your complete api.py should look like:

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

app = FastAPI(title="StringSight API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5180", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Datasets directory
BACKEND_ROOT = Path(__file__).parent.parent
DATASETS_DIR = BACKEND_ROOT / "datasets"
DATASETS_DIR.mkdir(exist_ok=True)

# Mount static files
app.mount("/datasets", StaticFiles(directory=str(DATASETS_DIR)), name="datasets")

# Health check
@app.get("/health")
async def health():
    return {"status": "ok"}

# ... your other endpoints ...
"""
