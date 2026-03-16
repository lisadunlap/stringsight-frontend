#!/bin/bash

# Setup script to configure backend for local file serving

BACKEND_DIR="${1:-../stringsight}"  # Default to ../stringsight, or pass custom path
FRONTEND_DIR="$(pwd)"
ZIP_FILE="public/telecom_2026-01-02.zip"

echo "🔧 Setting up Backend Local File Serving"
echo "========================================"
echo ""
echo "Backend directory: $BACKEND_DIR"
echo "Frontend directory: $FRONTEND_DIR"
echo ""

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Backend directory not found: $BACKEND_DIR"
    echo ""
    echo "Usage: $0 /path/to/backend"
    echo "Example: $0 ../stringsight"
    exit 1
fi

# Create datasets directory in backend
echo "Step 1: Creating datasets directory in backend..."
mkdir -p "$BACKEND_DIR/datasets"
echo "✅ Created: $BACKEND_DIR/datasets"
echo ""

# Copy ZIP file to backend
if [ -f "$ZIP_FILE" ]; then
    echo "Step 2: Copying dataset file to backend..."
    cp "$ZIP_FILE" "$BACKEND_DIR/datasets/"
    SIZE_MB=$(echo "scale=2; $(stat -f%z "$ZIP_FILE" 2>/dev/null || stat -c%s "$ZIP_FILE" 2>/dev/null) / 1024 / 1024" | bc 2>/dev/null || echo "unknown")
    echo "✅ Copied: telecom_2026-01-02.zip (${SIZE_MB} MB)"
    echo ""
else
    echo "⚠️  File not found: $ZIP_FILE"
    echo "   Run ./use-local-file.sh first, or the file may still be downloading"
    echo ""
fi

# Check if api.py exists
API_FILE="$BACKEND_DIR/stringsight/api.py"
if [ -f "$API_FILE" ]; then
    echo "Step 3: Checking backend API configuration..."

    # Check if StaticFiles is already imported
    if grep -q "StaticFiles" "$API_FILE"; then
        echo "✅ StaticFiles already imported in api.py"
    else
        echo "⚠️  Need to add StaticFiles import to api.py"
        echo ""
        echo "Add to imports in $API_FILE:"
        echo "  from fastapi.staticfiles import StaticFiles"
        echo "  from pathlib import Path"
        echo ""
    fi

    # Check if datasets mount exists
    if grep -q "/datasets" "$API_FILE"; then
        echo "✅ /datasets endpoint already exists"
    else
        echo "⚠️  Need to add /datasets endpoint to api.py"
        echo ""
        echo "Add to $API_FILE:"
        cat << 'EOF'

# Datasets directory
BACKEND_ROOT = Path(__file__).parent.parent
DATASETS_DIR = BACKEND_ROOT / "datasets"
DATASETS_DIR.mkdir(exist_ok=True)

# Mount static files for datasets
app.mount("/datasets", StaticFiles(directory=str(DATASETS_DIR)), name="datasets")
EOF
        echo ""
    fi

    # Check CORS
    if grep -q "CORSMiddleware" "$API_FILE"; then
        echo "✅ CORS middleware configured"
    else
        echo "⚠️  Need to add CORS middleware"
        echo ""
        echo "Add to $API_FILE:"
        cat << 'EOF'

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5180", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
EOF
        echo ""
    fi
else
    echo "⚠️  Could not find api.py at: $API_FILE"
    echo "   Please manually add the endpoints"
fi
echo ""

# Update frontend datasets.yaml
echo "Step 4: Updating frontend datasets.yaml..."
cat > "$FRONTEND_DIR/public/datasets.yaml" << 'EOF'
# StringSight Dataset Configuration
# Datasets served from backend's datasets/ directory

datasets:
  telecom:
    name: "Telecom Dataset"
    description: "Telecom customer service analysis"
    cdn_url: "http://localhost:8000/datasets/telecom_2026-01-02.zip"
    use_signed_urls: false
    files: []
    method: "single_model"
    created_at: "2026-01-02"
EOF
echo "✅ Updated: public/datasets.yaml"
echo ""

echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Add the code snippets shown above to: $API_FILE"
echo "   (if they weren't already present)"
echo ""
echo "2. Restart your backend:"
echo "   cd $BACKEND_DIR"
echo "   uvicorn stringsight.api:app --reload --host localhost --port 8000"
echo ""
echo "3. Test file access:"
echo "   curl -I http://localhost:8000/datasets/telecom_2026-01-02.zip"
echo "   # Should return: HTTP/1.1 200 OK"
echo ""
echo "4. Start frontend:"
echo "   npm run dev"
echo ""
echo "5. Visit: http://localhost:5180/telecom"
echo ""
