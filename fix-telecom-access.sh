#!/bin/bash

# Quick fix for telecom dataset S3 access
# This script fixes the most common issues preventing browser access

BUCKET="stringsight-results"
FILE="telecom_2026-01-02.zip"

echo "🔧 Fixing S3 access for telecom dataset"
echo "========================================"
echo ""

# Step 1: Make the file publicly readable
echo "Step 1: Making file publicly readable..."
if aws s3api put-object-acl \
    --bucket "$BUCKET" \
    --key "$FILE" \
    --acl public-read; then
    echo "✅ File ACL set to public-read"
else
    echo "❌ Failed to set file ACL"
    echo "💡 Make sure you have AWS credentials configured:"
    echo "   aws configure"
    exit 1
fi
echo ""

# Step 2: Configure CORS
echo "Step 2: Configuring CORS..."
cat > /tmp/cors.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

if aws s3api put-bucket-cors \
    --bucket "$BUCKET" \
    --cors-configuration file:///tmp/cors.json; then
    echo "✅ CORS configured"
else
    echo "❌ Failed to configure CORS"
    exit 1
fi
echo ""

# Step 3: Verify
echo "Step 3: Verifying access..."
URL="https://${BUCKET}.s3.us-east-2.amazonaws.com/${FILE}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")

echo "HTTP Status: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ File is accessible"

    # Check CORS headers
    CORS=$(curl -s -I -H "Origin: http://localhost:5180" "$URL" | grep -i "access-control-allow-origin" || echo "")
    if [ -n "$CORS" ]; then
        echo "✅ CORS headers present"
        echo "$CORS"
    else
        echo "⚠️  CORS headers not found (might take a moment to propagate)"
    fi
else
    echo "❌ File still not accessible (Status: $HTTP_STATUS)"
    echo "💡 You might also need a bucket policy. Run:"
    echo "   ./diagnose-s3-access.sh"
fi
echo ""

echo "================================"
echo "✅ Fix Complete!"
echo "================================"
echo ""
echo "Test the file access:"
echo "  curl -I $URL"
echo ""
echo "Then test in your browser:"
echo "  http://localhost:5180/test-simple-fetch.html"
echo ""
