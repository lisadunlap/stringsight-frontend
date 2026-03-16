#!/bin/bash
# Just make the ONE file public - simplest approach

echo "Making telecom ZIP file public..."
aws s3api put-object-acl \
  --bucket stringsight \
  --key telecom_2026-01-02.zip \
  --acl public-read \
  --no-cli-pager 2>&1 | head -20

if [ $? -eq 0 ]; then
  echo "✅ File is now public"
else
  echo "❌ Failed - you need different permissions"
  echo ""
  echo "Alternative: Ask someone with admin access to make this file public:"
  echo "  Bucket: stringsight"
  echo "  File: telecom_2026-01-02.zip"
  echo "  Action: Set ACL to 'public-read'"
fi

echo ""
echo "Testing access..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://stringsight.s3.us-east-2.amazonaws.com/telecom_2026-01-02.zip)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ File is accessible!"
  echo ""
  echo "Now test in browser:"
  echo "  http://localhost:5180/telecom"
else
  echo "❌ Still not accessible (HTTP $HTTP_CODE)"
fi





