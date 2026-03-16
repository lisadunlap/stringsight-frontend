"""
Backend API additions for serving from final_results directory
Add these snippets to your stringsight/api.py file
"""

# ============================================================================
# 1. ADD THESE IMPORTS AT THE TOP (if not already present)
# ============================================================================

from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path


# ============================================================================
# 2. ADD FINAL_RESULTS DIRECTORY SETUP (after app = FastAPI())
# ============================================================================

# Final results directory configuration
BACKEND_ROOT = Path(__file__).parent.parent
FINAL_RESULTS_DIR = BACKEND_ROOT / "final_results"

# Ensure directory exists (should already exist in your backend)
if not FINAL_RESULTS_DIR.exists():
    print(f"Warning: final_results directory not found at {FINAL_RESULTS_DIR}")


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
# 4. MOUNT final_results AS STATIC FILES
# ============================================================================

# Mount the final_results directory as static files
# This makes files available at http://localhost:8000/final_results/{filename}
app.mount("/final_results", StaticFiles(directory=str(FINAL_RESULTS_DIR)), name="final_results")


# ============================================================================
# COMPLETE MINIMAL EXAMPLE
# ============================================================================

"""
Here's what the relevant part of your api.py should look like:

from fastapi import FastAPI
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

# Final results directory
BACKEND_ROOT = Path(__file__).parent.parent
FINAL_RESULTS_DIR = BACKEND_ROOT / "final_results"

# Mount static files for final_results
app.mount("/final_results", StaticFiles(directory=str(FINAL_RESULTS_DIR)), name="final_results")

# Health check
@app.get("/health")
async def health():
    return {"status": "ok"}

# ... your other endpoints ...
"""


# ============================================================================
# TROUBLESHOOTING: If final_results has subdirectories
# ============================================================================

"""
If your final_results directory structure is:
  final_results/
    telecom/
      telecom_2026-01-02.zip
    other_dataset/
      ...

Then update your datasets.yaml to:
  cdn_url: "http://localhost:8000/final_results/telecom/telecom_2026-01-02.zip"

The StaticFiles mount will serve all subdirectories recursively.
"""
