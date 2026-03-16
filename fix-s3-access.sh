#!/bin/bash
# Fix S3 access using bucket policy instead of ACLs

echo "🔧 Configuring S3 bucket policy for public read access"
echo ""
echo "This creates a bucket policy that allows public read access"
echo "without needing to disable Block Public Access."
echo ""

BUCKET_NAME="stringsight"

# Create bucket policy
cat > /tmp/bucket-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::stringsight/*"
    }
  ]
}
EOF

echo "📝 Bucket policy created:"
cat /tmp/bucket-policy.json
echo ""

# Apply bucket policy
echo "📤 Applying bucket policy to bucket: $BUCKET_NAME"
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file:///tmp/bucket-policy.json

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Success! Bucket policy applied."
  echo ""
  echo "🧪 Testing access..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://${BUCKET_NAME}.s3.us-east-2.amazonaws.com/telecom_2026-01-02.zip)
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ File is now publicly accessible! (HTTP $HTTP_CODE)"
    echo ""
    echo "🎉 Ready to test!"
    echo "   Visit: http://localhost:5180/telecom"
  else
    echo "⚠️  HTTP Status: $HTTP_CODE"
    echo "   Wait a few seconds and try again (policy may be propagating)"
  fi
else
  echo ""
  echo "❌ Failed to apply bucket policy"
  echo ""
  echo "You might need additional permissions. Ask your AWS admin to:"
  echo "  1. Grant you s3:PutBucketPolicy permission"
  echo "  OR"
  echo "  2. Apply this bucket policy manually in AWS Console"
  echo ""
  echo "Policy JSON is saved at: /tmp/bucket-policy.json"
fi

echo ""
echo "Clean up:"
rm -f /tmp/bucket-policy.json





