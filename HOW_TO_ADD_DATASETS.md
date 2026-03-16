# How to Add New Datasets

Quick guide for adding datasets to the URL loader feature.

## Prerequisites

Your dataset must be:
1. **Processed by StringSight backend** - Run your analysis pipeline
2. **Exported as ZIP** - Backend creates a ZIP with JSONL files
3. **Placed in backend directory** - Copy to `~/StringSightNew/final_results/`

## Step-by-Step Guide

### Step 1: Generate Dataset ZIP (Backend)

In your StringSight backend, run your analysis pipeline which should create a ZIP file containing:

**Required file:**
- `conversations.jsonl` - Your main conversation data

**Optional files:**
- `properties.jsonl` - Extracted properties
- `clusters.jsonl` - Cluster assignments
- `model_cluster_scores_df.jsonl` - Model-cluster metrics
- `cluster_scores_df.jsonl` - Cluster scores
- `model_scores_df.jsonl` - Model scores

**Example backend command** (adjust to your pipeline):
```bash
cd ~/StringSightNew

# Run your analysis (example - adjust to your actual command)
python -m stringsight.scripts.analyze \
  --input data/my_dataset.jsonl \
  --output final_results/my_dataset_2026-01-02.zip
```

### Step 2: Verify ZIP Contents

Check that the ZIP has the correct structure:

```bash
unzip -l ~/StringSightNew/final_results/my_dataset_2026-01-02.zip
```

Should show:
```
Archive:  my_dataset_2026-01-02.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
  XXXXXX  2026-01-02 10:30   conversations.jsonl
  XXXXXX  2026-01-02 10:30   properties.jsonl
  XXXXXX  2026-01-02 10:30   clusters.jsonl
  ...
```

**Important**: File must be named `conversations.jsonl` (plural), not `conversation.jsonl`!

### Step 3: Add Dataset to Configuration

Edit `public/datasets.yaml` in the frontend:

```bash
cd ~/stringsight-frontend
nano public/datasets.yaml  # or use your preferred editor
```

Add your dataset entry:

```yaml
datasets:
  # Existing telecom dataset
  telecom:
    name: "Telecom Dataset"
    description: "Telecom customer service analysis"
    cdn_url: "/api/results/zip/telecom_2026-01-02.zip"
    files: []
    method: "single_model"
    created_at: "2026-01-02"

  # Your new dataset
  my-dataset:
    name: "My Dataset Display Name"
    description: "Brief description of what this dataset contains"
    cdn_url: "/api/results/zip/my_dataset_2026-01-02.zip"
    files: []
    method: "single_model"  # or "side_by_side"
    created_at: "2026-01-02"
```

**Configuration fields:**

- **Key** (`my-dataset`): URL slug - what appears in browser URL
- **name**: Display name shown in UI
- **description**: Brief description (shown in dataset browser)
- **cdn_url**: Path to ZIP file (always starts with `/api/results/zip/`)
- **files**: Leave as empty array `[]` for ZIP files
- **method**: Either `"single_model"` or `"side_by_side"`
  - `single_model`: Has `model`, `model_response` columns
  - `side_by_side`: Has `model_a`, `model_b`, `model_a_response`, `model_b_response` columns
- **created_at**: Date dataset was created (YYYY-MM-DD)

### Step 4: Test the Dataset

1. **Ensure backend is running:**
   ```bash
   cd ~/StringSightNew
   uvicorn stringsight.api:app --reload --host localhost --port 8000
   ```

2. **Test backend endpoint directly:**
   ```bash
   curl -I http://localhost:8000/results/zip/my_dataset_2026-01-02.zip
   ```

   Should return:
   ```
   HTTP/1.1 200 OK
   content-type: application/zip
   content-length: XXXXXX
   ```

3. **Start frontend dev server** (if not already running):
   ```bash
   cd ~/stringsight-frontend
   npm run dev
   ```

4. **Visit your dataset in browser:**
   ```
   http://localhost:5180/my-dataset
   ```

5. **Check browser console** (F12) for loading logs:
   ```
   📦 Downloading ZIP from /api/results/zip/my_dataset_2026-01-02.zip
   ⏱️  Download complete: XXXms
   ⏱️  ZIP decompression: XXXms
   ✅ Loaded from ZIP: {conversations: XXXXX, ...}
   ```

### Step 5: Share the Link

Once working, you can share the URL:
```
http://localhost:5180/my-dataset
```

Or for production:
```
https://your-domain.com/my-dataset
```

## Data Format Requirements

### Single Model Format

Each row in `conversations.jsonl` should have:

```jsonl
{
  "question_id": "0",
  "prompt": "User question or input",
  "model": "gpt-4",
  "model_response": "Model's response text or conversation array",
  "score": {
    "accuracy": 0.95,
    "fluency": 0.88
  }
}
```

### Side-by-Side Format

For A/B comparisons:

```jsonl
{
  "question_id": "0",
  "prompt": "User question or input",
  "model_a": "gpt-4",
  "model_b": "claude-3",
  "model_a_response": "Response from model A",
  "model_b_response": "Response from model B",
  "score_a": {"win": 1},
  "score_b": {"win": 0}
}
```

## Troubleshooting

### Problem: 404 Not Found

**Symptoms:** Browser shows "Failed to download ZIP: Not Found"

**Solution:**
1. Check file exists:
   ```bash
   ls -lh ~/StringSightNew/final_results/my_dataset_2026-01-02.zip
   ```
2. Verify filename in `datasets.yaml` matches exactly
3. Ensure backend is running

### Problem: Blank UI / 0 Conversations

**Symptoms:** Data loads but UI shows no conversations

**Solutions:**
1. Check filename is `conversations.jsonl` (plural):
   ```bash
   unzip -l ~/StringSightNew/final_results/my_dataset_2026-01-02.zip | grep conv
   ```

2. Verify JSONL format (one JSON object per line):
   ```bash
   unzip -p ~/StringSightNew/final_results/my_dataset_2026-01-02.zip conversations.jsonl | head -1
   ```

3. Check method matches data:
   - If you have `model_a` and `model_b` columns, use `method: "side_by_side"`
   - If you have single `model` column, use `method: "single_model"`

### Problem: Slow Loading

**Symptoms:** Takes 20+ seconds to load

**Solutions:**
1. Check file size:
   ```bash
   ls -lh ~/StringSightNew/final_results/my_dataset_2026-01-02.zip
   ```

2. If > 100 MB, consider:
   - Splitting into smaller datasets
   - Using backend pagination (future feature)
   - See [PERFORMANCE.md](src/features/dataset-url-loader/PERFORMANCE.md) for optimization strategies

### Problem: Parse Errors

**Symptoms:** Console shows "Failed to parse conversations.jsonl"

**Solutions:**
1. Validate JSONL format - each line must be valid JSON:
   ```bash
   unzip -p ~/StringSightNew/final_results/my_dataset_2026-01-02.zip conversations.jsonl | \
     head -10 | \
     python3 -m json.tool
   ```

2. Check for empty lines or trailing commas

3. Ensure UTF-8 encoding:
   ```bash
   file ~/StringSightNew/final_results/my_dataset_2026-01-02.zip
   ```

## Example: Adding a New Analysis

Let's say you analyzed a new domain called "healthcare":

**1. Backend - Generate ZIP:**
```bash
cd ~/StringSightNew
python -m stringsight.scripts.analyze \
  --input data/healthcare_conversations.jsonl \
  --output final_results/healthcare_2026-01-02.zip
```

**2. Frontend - Add config:**
```yaml
# In public/datasets.yaml
datasets:
  telecom:
    # ... existing ...

  healthcare:
    name: "Healthcare Support Analysis"
    description: "Medical customer support conversation analysis"
    cdn_url: "/api/results/zip/healthcare_2026-01-02.zip"
    files: []
    method: "single_model"
    created_at: "2026-01-02"
```

**3. Test:**
```bash
# Visit in browser
http://localhost:5180/healthcare
```

**4. Share:**
```
Send link to collaborators: http://localhost:5180/healthcare
```

## Multiple Datasets

You can add as many datasets as you want. Each one gets its own URL:

```yaml
datasets:
  telecom:
    name: "Telecom"
    cdn_url: "/api/results/zip/telecom_2026-01-02.zip"
    method: "single_model"
    created_at: "2026-01-02"

  healthcare:
    name: "Healthcare"
    cdn_url: "/api/results/zip/healthcare_2026-01-02.zip"
    method: "single_model"
    created_at: "2026-01-02"

  finance-sbs:
    name: "Finance A/B Test"
    cdn_url: "/api/results/zip/finance_sbs_2026-01-03.zip"
    method: "side_by_side"
    created_at: "2026-01-03"
```

Access via:
- `http://localhost:5180/telecom`
- `http://localhost:5180/healthcare`
- `http://localhost:5180/finance-sbs`

## Dataset Browser (Future Feature)

In the future, you could add a dataset browser homepage that lists all available datasets. For now, users need the direct URL.

## Production Deployment

When deploying to production:

1. **Build frontend:**
   ```bash
   npm run build
   ```

2. **Ensure backend serves files:**
   - Backend must be accessible from production URL
   - Update Vite proxy config if needed

3. **Update dataset URLs** (if using different backend URL):
   ```yaml
   cdn_url: "https://api.your-domain.com/results/zip/dataset.zip"
   ```

## Quick Reference

| Step | Command/File | Description |
|------|--------------|-------------|
| 1. Generate | Backend pipeline | Create ZIP with JSONL files |
| 2. Verify | `unzip -l file.zip` | Check ZIP contents |
| 3. Configure | `public/datasets.yaml` | Add dataset entry |
| 4. Test | Visit `http://localhost:5180/dataset-name` | Load in browser |
| 5. Share | Send URL to users | Share the link |

## Need Help?

Check these files for more info:
- [DATASET_URL_LOADER_FEATURE.md](DATASET_URL_LOADER_FEATURE.md) - Feature overview
- [src/features/dataset-url-loader/README.md](src/features/dataset-url-loader/README.md) - Detailed API docs
- [debug-blank-ui.md](debug-blank-ui.md) - Troubleshooting guide
