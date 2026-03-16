#!/bin/bash
# Deploy StringSight dataset to AWS S3
# Usage: ./deploy-dataset.sh <dataset-name> <local-results-path>

set -e

DATASET_NAME=$1
LOCAL_PATH=$2
S3_BUCKET=${S3_BUCKET:-"stringsight-results"}
AWS_REGION=${AWS_REGION:-"us-west-2"}

if [ -z "$DATASET_NAME" ] || [ -z "$LOCAL_PATH" ]; then
  echo "Usage: ./deploy-dataset.sh <dataset-name> <local-results-path>"
  echo ""
  echo "Example:"
  echo "  ./deploy-dataset.sh taubench_airline ./results/taubench_airline/"
  echo ""
  echo "Environment variables:"
  echo "  S3_BUCKET (default: stringsight-results)"
  echo "  AWS_REGION (default: us-west-2)"
  exit 1
fi

if [ ! -d "$LOCAL_PATH" ]; then
  echo "Error: Directory not found: $LOCAL_PATH"
  exit 1
fi

echo "🚀 Deploying dataset: $DATASET_NAME"
echo "📁 Local path: $LOCAL_PATH"
echo "☁️  S3 bucket: s3://$S3_BUCKET/$DATASET_NAME"
echo ""

# Check if bucket exists
if ! aws s3 ls "s3://$S3_BUCKET" 2>&1 > /dev/null; then
  echo "❌ Bucket does not exist: $S3_BUCKET"
  read -p "Create bucket? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Creating bucket..."
    aws s3 mb "s3://$S3_BUCKET" --region "$AWS_REGION"
    
    # Configure CORS
    echo "🔧 Configuring CORS..."
    cat > /tmp/cors.json <<EOF
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
EOF
    aws s3api put-bucket-cors --bucket "$S3_BUCKET" --cors-configuration file:///tmp/cors.json
    rm /tmp/cors.json
    
    # Make bucket public (optional)
    read -p "Make bucket public? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "🌐 Making bucket public..."
      aws s3api put-bucket-policy --bucket "$S3_BUCKET" --policy "{
        \"Version\": \"2012-10-17\",
        \"Statement\": [{
          \"Sid\": \"PublicReadGetObject\",
          \"Effect\": \"Allow\",
          \"Principal\": \"*\",
          \"Action\": \"s3:GetObject\",
          \"Resource\": \"arn:aws:s3:::$S3_BUCKET/*\"
        }]
      }"
    fi
  else
    echo "Aborted."
    exit 1
  fi
fi

# Upload files
echo "📤 Uploading files..."
aws s3 sync "$LOCAL_PATH" "s3://$S3_BUCKET/$DATASET_NAME/" \
  --region "$AWS_REGION" \
  --exclude "*" \
  --include "*.json" \
  --include "*.jsonl" \
  --delete

echo ""
echo "✅ Upload complete!"
echo ""
echo "📊 Uploaded files:"
aws s3 ls "s3://$S3_BUCKET/$DATASET_NAME/" --human-readable

# Generate URLs
S3_URL="https://$S3_BUCKET.s3.$AWS_REGION.amazonaws.com/$DATASET_NAME"
echo ""
echo "🔗 Access URLs:"
echo "   S3 Direct: $S3_URL"
echo ""

# Check if CloudFront distribution exists
CLOUDFRONT_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='$S3_BUCKET.s3.$AWS_REGION.amazonaws.com']].Id" --output text 2>/dev/null || echo "")

if [ -n "$CLOUDFRONT_ID" ]; then
  CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution --id "$CLOUDFRONT_ID" --query "Distribution.DomainName" --output text)
  echo "   CloudFront: https://$CLOUDFRONT_DOMAIN/$DATASET_NAME"
  echo ""
  echo "💡 Invalidating CloudFront cache..."
  aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_ID" --paths "/$DATASET_NAME/*" > /dev/null
  echo "   Cache invalidation started (may take 5-10 minutes)"
fi

echo ""
echo "📝 Next steps:"
echo "1. Add dataset to public/datasets.yaml:"
echo ""
echo "  $DATASET_NAME:"
echo "    name: \"Your Dataset Name\""
echo "    description: \"Your description\""
echo "    cdn_url: \"$S3_URL\""
echo "    files:"
echo "      - conversation.jsonl"
echo "      - properties.jsonl"
echo "      - clusters.jsonl"
echo "      - model_cluster_scores_df.jsonl"
echo "    method: \"single_model\"  # or \"side_by_side\""
echo "    created_at: \"$(date +%Y-%m-%d)\""
echo ""
echo "2. Commit and push changes to git"
echo "3. Deploy to Vercel"
echo "4. Visit: https://stringsight.com/$DATASET_NAME"
echo ""





