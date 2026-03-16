#!/bin/bash

# Make S3 file public by re-uploading with public-read ACL
# This works even if you don't have PutObjectAcl permission

BUCKET="stringsight-results"
FILE="telecom_2026-01-02.zip"
LOCAL_FILE="./telecom_2026-01-02.zip"

echo "🔄 Making S3 file public via re-upload"
echo "======================================"
echo ""

# Check if we already downloaded it
if [ ! -f "$LOCAL_FILE" ]; then
    echo "❌ Local file not found: $LOCAL_FILE"
    echo "   The download script should have created this file."
    echo "   Please wait for the download to complete."
    exit 1
fi

echo "✅ Local file found: $LOCAL_FILE"
SIZE_MB=$(echo "scale=2; $(stat -f%z "$LOCAL_FILE" 2>/dev/null || stat -c%s "$LOCAL_FILE" 2>/dev/null) / 1024 / 1024" | bc 2>/dev/null || echo "unknown")
echo "   Size: ${SIZE_MB} MB"
echo ""

# Re-upload with public-read ACL
echo "Uploading with public-read ACL..."
if aws s3 cp "$LOCAL_FILE" "s3://${BUCKET}/${FILE}" --acl public-read; then
    echo "✅ File uploaded with public-read ACL"
else
    echo "❌ Upload failed"
    echo ""
    echo "You might not have permission to set ACLs."
    echo "Ask your AWS administrator to grant you these permissions:"
    echo "  - s3:PutObject"
    echo "  - s3:PutObjectAcl"
    exit 1
fi
echo ""

# Verify it's now public
echo "Verifying public access..."
URL="https://${BUCKET}.s3.us-east-2.amazonaws.com/${FILE}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ File is now publicly accessible!"
    echo ""
    echo "Test it:"
    echo "  curl -I \"$URL\""
else
    echo "⚠️  File may not be public yet (HTTP $HTTP_STATUS)"
    echo "   This could be due to:"
    echo "   1. S3 eventual consistency (wait a few seconds)"
    echo "   2. Bucket public access blocks"
    echo "   3. Missing bucket CORS configuration"
fi
echo ""

# Check CORS
echo "Checking CORS configuration..."
if aws s3api get-bucket-cors --bucket "$BUCKET" >/dev/null 2>&1; then
    echo "✅ CORS is configured"
else
    echo "❌ CORS is NOT configured"
    echo ""
    echo "Configure CORS:"
    cat > /tmp/cors.json << 'EOFCORS'
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
EOFCORS
    echo "  aws s3api put-bucket-cors --bucket $BUCKET --cors-configuration file:///tmp/cors.json"
fi
echo ""

echo "================================"
echo "Next Steps"
echo "================================"
echo ""
if [ "$HTTP_STATUS" = "200" ]; then
    echo "1. Configure CORS (if not already done):"
    echo "   aws s3api put-bucket-cors --bucket $BUCKET --cors-configuration file:///tmp/cors.json"
    echo ""
    echo "2. Test in browser:"
    echo "   http://localhost:5180/test-simple-fetch.html"
else
    echo "1. Wait a few seconds for S3 to update"
    echo "2. Test again: curl -I \"$URL\""
    echo "3. If still failing, check bucket public access blocks"
fi
echo ""
