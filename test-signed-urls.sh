#!/bin/bash
# Test the complete signed URLs flow

echo "🧪 Testing Complete Signed URLs Implementation"
echo ""

# Check if backend is running
echo "1️⃣ Checking backend..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "   ✅ Backend is running"
else
    echo "   ❌ Backend not running!"
    echo ""
    echo "   Start it with:"
    echo "   uvicorn stringsight.api:app --reload --host localhost --port 8000"
    exit 1
fi

# Test the new signed URL endpoint
echo ""
echo "2️⃣ Testing signed URL endpoint..."
RESPONSE=$(curl -s http://localhost:8000/s3/signed-url/stringsight/telecom_2026-01-02.zip)

if echo "$RESPONSE" | grep -q "url"; then
    echo "   ✅ Endpoint responding"
    echo ""
    echo "   Response preview:"
    echo "$RESPONSE" | head -c 200
    echo "..."
else
    echo "   ❌ Endpoint error!"
    echo "   Response:"
    echo "$RESPONSE"
    exit 1
fi

# Check if frontend is running
echo ""
echo ""
echo "3️⃣ Checking frontend..."
if curl -s http://localhost:5180 > /dev/null 2>&1; then
    echo "   ✅ Frontend is running"
else
    echo "   ❌ Frontend not running!"
    echo ""
    echo "   Start it with:"
    echo "   npm run dev"
    exit 1
fi

# Test CORS
echo ""
echo "4️⃣ Testing CORS..."
CORS_RESPONSE=$(curl -s -H "Origin: http://localhost:5180" -I http://localhost:8000/s3/signed-url/stringsight/telecom_2026-01-02.zip)

if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin"; then
    echo "   ✅ CORS configured"
else
    echo "   ⚠️  CORS might not be configured (check if needed)"
fi

echo ""
echo "✅ Backend Setup Complete!"
echo ""
echo "🎯 Now test in browser:"
echo "   http://localhost:5180/telecom"
echo ""
echo "📊 Expected console output:"
echo "   🔐 Using signed URL from backend"
echo "   📦 Downloading ZIP from https://stringsight.s3...?X-Amz-..."
echo "   ✅ URL dataset loaded into app state"
echo ""





