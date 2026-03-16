#!/bin/bash
# Quick commands for your telecom dataset

echo "🔧 Quick Setup Commands for Telecom Dataset"
echo ""

# AWS Credentials
echo "1️⃣  Setup AWS Credentials:"
echo "   aws configure"
echo "   # Enter your AWS Access Key ID and Secret when prompted"
echo ""

# Test access
echo "2️⃣  Test S3 Access:"
echo "   aws s3 ls s3://stringsight/telecom_2026-01-02.zip"
echo "   curl -I https://stringsight.s3.us-east-2.amazonaws.com/telecom_2026-01-02.zip"
echo ""

# CORS setup
echo "3️⃣  Configure CORS:"
cat << 'EOF'
cat > /tmp/cors.json <<JSON
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedOrigins": ["http://localhost:5180", "https://*.vercel.app", "https://your-domain.com"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3000
}]
JSON

aws s3api put-bucket-cors --bucket stringsight --cors-configuration file:///tmp/cors.json
EOF
echo ""

# Make public
echo "4️⃣  Make File Public:"
echo "   aws s3api put-object-acl --bucket stringsight --key telecom_2026-01-02.zip --acl public-read"
echo ""

# Test locally
echo "5️⃣  Test Locally:"
echo "   npm run dev"
echo "   # Open: http://localhost:5180/telecom"
echo ""

# Verify ZIP contents
echo "📦 Verify ZIP Contents:"
echo "   aws s3 cp s3://stringsight/telecom_2026-01-02.zip /tmp/"
echo "   unzip -l /tmp/telecom_2026-01-02.zip"
echo ""

echo "✅ After setup, your dataset will be available at:"
echo "   Local:      http://localhost:5180/telecom"
echo "   Production: https://your-domain.com/telecom"
echo ""
echo "📚 For more help, see TESTING_TELECOM_DATASET.md"





