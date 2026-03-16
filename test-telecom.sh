#!/bin/bash
# Quick test script for telecom dataset

echo "🧪 Testing Telecom Dataset Loading"
echo ""
echo "Prerequisites:"
echo "  ✅ npm run dev is running"
echo "  ✅ AWS credentials configured"
echo "  ✅ S3 file is public and CORS configured"
echo ""

# Check if dev server is running
if ! curl -s http://localhost:5180 > /dev/null 2>&1; then
  echo "❌ Dev server not running!"
  echo ""
  echo "Start it with: npm run dev"
  exit 1
fi

echo "✅ Dev server is running"
echo ""

# Check datasets.yaml
if [ ! -f "public/datasets.yaml" ]; then
  echo "❌ public/datasets.yaml not found!"
  exit 1
fi

echo "✅ datasets.yaml exists"
echo ""

# Test S3 access
echo "Testing S3 access..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://stringsight.s3.us-east-2.amazonaws.com/telecom_2026-01-02.zip)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ S3 file accessible (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "403" ]; then
  echo "❌ S3 file not public (HTTP 403)"
  echo ""
  echo "Fix with:"
  echo "  aws s3api put-object-acl --bucket stringsight --key telecom_2026-01-02.zip --acl public-read"
  exit 1
elif [ "$HTTP_CODE" = "404" ]; then
  echo "❌ S3 file not found (HTTP 404)"
  echo ""
  echo "Check file exists:"
  echo "  aws s3 ls s3://stringsight/telecom_2026-01-02.zip"
  exit 1
else
  echo "⚠️  Unexpected HTTP code: $HTTP_CODE"
fi

echo ""
echo "📱 Test URLs:"
echo ""
echo "  1. Dataset Browser:"
echo "     http://localhost:5180/"
echo ""
echo "  2. Telecom Dataset:"
echo "     http://localhost:5180/telecom"
echo ""
echo "Open these in your browser and check:"
echo "  • Browser console for loading messages"
echo "  • Data tab shows conversations"
echo "  • Properties/Clusters tabs if data exists"
echo ""
echo "Console should show:"
echo "  🔍 Loading dataset: telecom"
echo "  📦 Downloading ZIP from ..."
echo "  📂 Extracting ZIP contents..."
echo "  🎯 Loading dataset from URL: telecom"
echo "  ✅ URL dataset loaded into app state"
echo ""





