#!/bin/bash

# Test if backend is running and can generate signed URLs

BACKEND_URL="http://localhost:8000"
BUCKET="stringsight-results"
KEY="telecom_2026-01-02.zip"

echo "🔍 Testing Backend Signed URL Generation"
echo "========================================"
echo ""

# Test 1: Check if backend is running
echo "Test 1: Is backend running?"
if curl -s -f "${BACKEND_URL}/health" >/dev/null 2>&1; then
    echo "✅ Backend is running at $BACKEND_URL"
else
    echo "❌ Backend is NOT running"
    echo ""
    echo "Start your backend:"
    echo "  cd /path/to/stringsight-backend"
    echo "  uvicorn stringsight.api:app --reload --host localhost --port 8000"
    echo ""
    exit 1
fi
echo ""

# Test 2: Try to get a signed URL
echo "Test 2: Can backend generate signed URLs?"
SIGNED_URL_ENDPOINT="${BACKEND_URL}/s3/signed-url/${BUCKET}/${KEY}"
echo "Calling: $SIGNED_URL_ENDPOINT"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$SIGNED_URL_ENDPOINT" 2>&1)
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Backend can generate signed URLs"
    echo ""
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

    # Extract the signed URL
    SIGNED_URL=$(echo "$BODY" | jq -r '.url' 2>/dev/null)

    if [ -n "$SIGNED_URL" ] && [ "$SIGNED_URL" != "null" ]; then
        echo ""
        echo "Test 3: Testing signed URL access..."
        echo "URL: ${SIGNED_URL:0:100}..."

        # Test the signed URL
        if curl -s -f -I "$SIGNED_URL" >/dev/null 2>&1; then
            echo "✅ Signed URL works! File is accessible."
        else
            echo "❌ Signed URL doesn't work"
        fi
    fi
else
    echo "❌ Backend returned error: HTTP $HTTP_STATUS"
    echo ""
    echo "Response:"
    echo "$BODY"
    echo ""
    echo "Possible causes:"
    echo "1. Backend doesn't have the /s3/signed-url endpoint"
    echo "2. Backend doesn't have AWS credentials configured"
    echo "3. Backend doesn't have permission to generate signed URLs"
fi
echo ""

echo "================================"
echo "Summary"
echo "================================"
echo ""
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Everything works! You can use signed URLs."
    echo ""
    echo "The frontend is configured to use signed URLs."
    echo "Just make sure the backend is running when you start the frontend."
    echo ""
    echo "Start frontend:"
    echo "  npm run dev"
    echo ""
    echo "Then visit:"
    echo "  http://localhost:5180/telecom"
else
    echo "⚠️  Backend can't generate signed URLs yet."
    echo ""
    echo "You need to:"
    echo "1. Ensure backend is running"
    echo "2. Add /s3/signed-url endpoint to backend"
    echo "3. Configure AWS credentials in backend"
    echo ""
    echo "OR use local file serving (simpler for development):"
    echo "  Update datasets.yaml to use: cdn_url: \"/telecom_2026-01-02.zip\""
fi
echo ""
