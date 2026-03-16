#!/bin/bash

# Use the downloaded file locally instead of S3

echo "📁 Setting up local file serving"
echo "================================"
echo ""

# Move file to public directory
if [ -f "./telecom_2026-01-02.zip" ]; then
    echo "Moving file to public directory..."
    mv ./telecom_2026-01-02.zip ./public/telecom_2026-01-02.zip
    echo "✅ File moved to public/telecom_2026-01-02.zip"
    echo ""

    # Update datasets.yaml
    echo "Update your public/datasets.yaml to use local file:"
    echo ""
    cat << 'EOF'
datasets:
  telecom:
    name: "Telecom Dataset"
    description: "Telecom customer service analysis"
    cdn_url: "/telecom_2026-01-02.zip"  # Local file, served by Vite
    use_signed_urls: false
    files: []
    method: "single_model"
    created_at: "2026-01-02"
EOF
    echo ""
    echo "This will serve the file from your dev server."
    echo "The file will be available at: http://localhost:5180/telecom_2026-01-02.zip"
else
    echo "❌ telecom_2026-01-02.zip not found in current directory"
fi
