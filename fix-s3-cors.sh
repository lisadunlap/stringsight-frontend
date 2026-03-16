#!/bin/bash
# Apply CORS configuration to S3 bucket for browser access

BUCKET_NAME="stringsight"

echo "🔧 Configuring CORS for S3 bucket: $BUCKET_NAME"
echo ""

# Create CORS configuration
cat > /tmp/s3-cors.json <<'EOF'
[
  {
    "AllowedOrigins": [
      "http://localhost:5180",
      "http://127.0.0.1:5180",
      "https://*.vercel.app"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3000
  }
]
EOF

echo "📝 CORS configuration:"
cat /tmp/s3-cors.json
echo ""

# Apply CORS configuration
echo "📤 Applying CORS to bucket: $BUCKET_NAME"
aws s3api put-bucket-cors --bucket $BUCKET_NAME --cors-configuration file:///tmp/s3-cors.json

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ CORS applied successfully!"
  echo ""
  echo "🧪 Test again:"
  echo "   1. Hard refresh browser: Ctrl+Shift+R"
  echo "   2. Visit: http://localhost:5180/telecom"
  echo ""
  echo "📊 You should now see the ZIP downloading successfully!"
else
  echo ""
  echo "❌ Failed to apply CORS"
  echo ""
  echo "Manual steps:"
  echo "1. Go to AWS Console → S3 → stringsight bucket"
  echo "2. Go to Permissions tab"
  echo "3. Scroll to CORS configuration"
  echo "4. Paste the JSON from /tmp/s3-cors.json"
fi

# Clean up
rm -f /tmp/s3-cors.json

echo ""
echo "Note: Add your production domain to AllowedOrigins when deploying!"





