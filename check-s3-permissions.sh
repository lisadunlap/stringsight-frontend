#!/bin/bash

# Check what S3 permissions you actually have

BUCKET="stringsight-results"
FILE="telecom_2026-01-02.zip"

echo "🔍 Checking S3 Permissions"
echo "=========================="
echo ""

# Check if you can list buckets
echo "Test 1: Can you list buckets?"
if aws s3 ls >/dev/null 2>&1; then
    echo "✅ Yes, you can list buckets"
else
    echo "❌ No, you cannot list buckets"
fi
echo ""

# Check if you can list this specific bucket
echo "Test 2: Can you list $BUCKET?"
if aws s3 ls "s3://${BUCKET}/" >/dev/null 2>&1; then
    echo "✅ Yes, you can list this bucket"
    echo ""
    echo "Files in bucket (first 10):"
    aws s3 ls "s3://${BUCKET}/" --recursive | head -10
else
    echo "❌ No, you cannot list this bucket"
    echo "💡 This bucket might belong to someone else's AWS account"
    echo "   You need to create your own bucket"
fi
echo ""

# Check if the specific file exists
echo "Test 3: Does $FILE exist?"
if aws s3 ls "s3://${BUCKET}/${FILE}" >/dev/null 2>&1; then
    echo "✅ Yes, the file exists"
    aws s3 ls "s3://${BUCKET}/${FILE}"
else
    echo "❌ No, the file does not exist (or you can't see it)"
fi
echo ""

# Check your IAM identity
echo "Test 4: Your AWS Identity"
IDENTITY=$(aws sts get-caller-identity 2>/dev/null)
if [ -n "$IDENTITY" ]; then
    echo "$IDENTITY" | jq '.' 2>/dev/null || echo "$IDENTITY"
else
    echo "❌ Could not get identity"
fi
echo ""

# Try to get bucket location (read-only operation)
echo "Test 5: Can you get bucket location?"
if aws s3api get-bucket-location --bucket "$BUCKET" >/dev/null 2>&1; then
    LOCATION=$(aws s3api get-bucket-location --bucket "$BUCKET" | jq -r '.LocationConstraint // "us-east-1"')
    echo "✅ Yes, bucket is in region: $LOCATION"
else
    echo "❌ No, cannot get bucket location"
    echo "💡 This likely means the bucket is owned by a different AWS account"
fi
echo ""

# Summary
echo "================================"
echo "📊 Summary"
echo "================================"
echo ""

if aws s3 ls "s3://${BUCKET}/" >/dev/null 2>&1; then
    echo "You have READ access to $BUCKET"
    echo "But you likely don't have WRITE access (can't modify ACLs)"
    echo ""
    echo "Options:"
    echo "1. Ask the bucket owner to:"
    echo "   - Make the file public-read"
    echo "   - Configure CORS"
    echo ""
    echo "2. Create your own bucket:"
    echo "   ./setup-my-bucket.sh /path/to/telecom_2026-01-02.zip"
    echo ""
    echo "3. Use a different bucket you own"
else
    echo "You don't have access to $BUCKET"
    echo ""
    echo "This bucket is likely owned by someone else."
    echo ""
    echo "Create your own bucket:"
    echo "  ./setup-my-bucket.sh /path/to/telecom_2026-01-02.zip"
fi
echo ""
