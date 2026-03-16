#!/bin/bash

# Simple script to download S3 file locally (no AWS credentials needed if file is public)

URL="${1:-https://stringsight-results.s3.us-east-2.amazonaws.com/telecom_2026-01-02.zip}"
OUTPUT_FILE="${2:-telecom_2026-01-02.zip}"

echo "📥 Downloading S3 file (public access test)"
echo "==========================================="
echo ""
echo "URL: $URL"
echo "Output: $OUTPUT_FILE"
echo ""

# Method 1: Try curl (works if file is public)
echo "Method 1: Using curl (no AWS credentials)..."
if curl -f -L -o "$OUTPUT_FILE" "$URL" 2>&1; then
    if [ -f "$OUTPUT_FILE" ]; then
        SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
        SIZE_MB=$(echo "scale=2; $SIZE / 1024 / 1024" | bc)
        echo ""
        echo "✅ Download successful!"
        echo "   File: $OUTPUT_FILE"
        echo "   Size: ${SIZE_MB} MB"
        echo ""
        echo "This means the file IS publicly accessible! ✅"
        echo "The browser issue must be CORS-related."
        exit 0
    fi
else
    echo "❌ curl download failed"
    echo ""
fi

# Method 2: Try wget
echo "Method 2: Using wget (no AWS credentials)..."
if wget -O "$OUTPUT_FILE" "$URL" 2>&1; then
    if [ -f "$OUTPUT_FILE" ]; then
        SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
        SIZE_MB=$(echo "scale=2; $SIZE / 1024 / 1024" | bc)
        echo ""
        echo "✅ Download successful!"
        echo "   File: $OUTPUT_FILE"
        echo "   Size: ${SIZE_MB} MB"
        echo ""
        echo "This means the file IS publicly accessible! ✅"
        echo "The browser issue must be CORS-related."
        exit 0
    fi
else
    echo "❌ wget download failed"
    echo ""
fi

# Method 3: Try AWS CLI (requires credentials)
echo "Method 3: Using AWS CLI (requires credentials)..."
BUCKET=$(echo "$URL" | sed -E 's|https://([^.]+)\.s3\..+\.amazonaws\.com/(.+)|\1|')
KEY=$(echo "$URL" | sed -E 's|https://[^/]+/(.+)|\1|')

if aws s3 cp "s3://${BUCKET}/${KEY}" "$OUTPUT_FILE" 2>&1; then
    if [ -f "$OUTPUT_FILE" ]; then
        SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
        SIZE_MB=$(echo "scale=2; $SIZE / 1024 / 1024" | bc)
        echo ""
        echo "✅ Download successful via AWS CLI!"
        echo "   File: $OUTPUT_FILE"
        echo "   Size: ${SIZE_MB} MB"
        echo ""
        echo "⚠️  File downloaded with AWS credentials."
        echo "   This doesn't tell us if it's publicly accessible."
        exit 0
    fi
else
    echo "❌ AWS CLI download failed"
    echo ""
fi

echo "================================"
echo "❌ All download methods failed"
echo "================================"
echo ""
echo "Possible causes:"
echo "1. File doesn't exist at this URL"
echo "2. File is not publicly accessible"
echo "3. Network/firewall blocking access"
echo ""
echo "To debug:"
echo "  curl -I \"$URL\""
echo ""
