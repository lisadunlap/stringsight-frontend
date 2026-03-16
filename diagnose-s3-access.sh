#!/bin/bash
# Comprehensive performance diagnosis script

echo "=== Testing Backend Performance ==="
echo ""

echo "1. Testing /results/telecom/conversations endpoint..."
time curl -s "http://localhost:8000/results/telecom/conversations?limit=100" > /dev/null
echo ""

echo "2. Testing /results/telecom/properties endpoint..."
time curl -s "http://localhost:8000/results/telecom/properties" > /dev/null
echo ""

echo "3. Testing /results/telecom/clusters endpoint..."
time curl -s "http://localhost:8000/results/telecom/clusters" > /dev/null
echo ""

echo "4. Testing /results/telecom/metrics endpoint..."
time curl -s "http://localhost:8000/results/telecom/metrics" > /dev/null
echo ""

echo "5. Size of responses:"
echo "Conversations (first 100):"
curl -s "http://localhost:8000/results/telecom/conversations?limit=100" | wc -c | awk '{print $1/1024/1024 " MB"}'

echo "Properties:"
curl -s "http://localhost:8000/results/telecom/properties" | wc -c | awk '{print $1/1024/1024 " MB"}'

echo "Clusters:"
curl -s "http://localhost:8000/results/telecom/clusters" | wc -c | awk '{print $1/1024/1024 " MB"}'

echo "Metrics:"
curl -s "http://localhost:8000/results/telecom/metrics" | wc -c | awk '{print $1/1024/1024 " MB"}'

echo ""
echo "=== Check what's actually loaded in browser ==="
echo "Open browser console at http://localhost:5180/telecom"
echo "Look for these log messages:"
echo "  🚀 Loading from paginated API endpoints..."
echo "  ⏱️  Loaded via API in XXXms"
echo ""
echo "If you see 'Loading from ZIP file' instead, the API isn't being used!"
