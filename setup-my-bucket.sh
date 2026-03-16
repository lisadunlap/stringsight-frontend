#!/bin/bash

# Setup your own S3 bucket for StringSight datasets
# This creates a new bucket with proper permissions

# Configuration
MY_BUCKET="stringsight-${USER}-results"  # e.g., stringsight-lisabdunlap-results
REGION="us-east-2"
FILE_TO_UPLOAD="$1"  # Path to your telecom ZIP file

echo "🚀 Setting up your own S3 bucket for StringSight"
echo "================================================"
echo ""
echo "Bucket name: $MY_BUCKET"
echo "Region: $REGION"
echo ""

# Step 1: Create bucket
echo "Step 1: Creating bucket..."
if aws s3 mb "s3://${MY_BUCKET}" --region "$REGION" 2>/dev/null; then
    echo "✅ Bucket created: $MY_BUCKET"
elif aws s3 ls "s3://${MY_BUCKET}" >/dev/null 2>&1; then
    echo "ℹ️  Bucket already exists: $MY_BUCKET"
else
    echo "❌ Failed to create bucket"
    echo "💡 The bucket name might be taken globally. Try a different name."
    exit 1
fi
echo ""

# Step 2: Disable public access blocks (needed for public files)
echo "Step 2: Configuring public access settings..."
if aws s3api put-public-access-block \
    --bucket "$MY_BUCKET" \
    --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"; then
    echo "✅ Public access blocks disabled"
else
    echo "⚠️  Could not configure public access blocks (might need admin permissions)"
fi
echo ""

# Step 3: Set bucket policy for public read
echo "Step 3: Setting bucket policy..."
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${MY_BUCKET}/*"
    }
  ]
}
EOF

if aws s3api put-bucket-policy \
    --bucket "$MY_BUCKET" \
    --policy file:///tmp/bucket-policy.json; then
    echo "✅ Bucket policy set (all files will be publicly readable)"
else
    echo "⚠️  Could not set bucket policy"
fi
echo ""

# Step 4: Configure CORS
echo "Step 4: Configuring CORS..."
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
    --bucket "$MY_BUCKET" \
    --cors-configuration file:///tmp/cors.json; then
    echo "✅ CORS configured"
else
    echo "❌ Failed to configure CORS"
fi
echo ""

# Step 5: Upload file if provided
if [ -n "$FILE_TO_UPLOAD" ] && [ -f "$FILE_TO_UPLOAD" ]; then
    FILENAME=$(basename "$FILE_TO_UPLOAD")
    echo "Step 5: Uploading $FILENAME..."

    if aws s3 cp "$FILE_TO_UPLOAD" "s3://${MY_BUCKET}/${FILENAME}"; then
        echo "✅ File uploaded"

        # Get the URL
        URL="https://${MY_BUCKET}.s3.${REGION}.amazonaws.com/${FILENAME}"
        echo ""
        echo "================================"
        echo "✅ Setup Complete!"
        echo "================================"
        echo ""
        echo "Your file URL:"
        echo "  $URL"
        echo ""
        echo "Test it:"
        echo "  curl -I \"$URL\""
        echo ""
        echo "Update your datasets.yaml:"
        echo "  cdn_url: \"$URL\""
    else
        echo "❌ Failed to upload file"
    fi
else
    echo "Step 5: Skipping file upload (no file provided)"
    echo ""
    echo "================================"
    echo "✅ Bucket Setup Complete!"
    echo "================================"
    echo ""
    echo "Upload your files:"
    echo "  aws s3 cp your-file.zip s3://${MY_BUCKET}/"
    echo ""
    echo "Your bucket URL pattern:"
    echo "  https://${MY_BUCKET}.s3.${REGION}.amazonaws.com/{filename}"
fi
echo ""

echo "Next steps:"
echo "1. Update public/datasets.yaml with your new bucket URL"
echo "2. Test access: http://localhost:5180/test-simple-fetch.html"
echo ""
