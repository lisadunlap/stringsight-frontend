# StringSight URL Loader - Quick Reference

## Access Points

| URL | What It Shows |
|-----|---------------|
| `http://localhost:5180/` | Main app (upload datasets) |
| `http://localhost:5180/results` | **Dataset browser - list all available datasets** |
| `http://localhost:5180/telecom` | Telecom dataset |
| `http://localhost:5180/{dataset-name}` | Any configured dataset |

## Adding New Datasets

**Step 1:** Generate ZIP in backend
```bash
cd ~/StringSightNew
# Your analysis pipeline creates: final_results/dataset_name.zip
```

**Step 2:** Edit config
```bash
nano ~/stringsight-frontend/public/datasets.yaml
```

Add entry:
```yaml
  my-dataset:
    name: "Display Name"
    description: "What this is about"
    cdn_url: "/api/results/zip/dataset_name.zip"
    files: []
    method: "single_model"  # or "side_by_side"
    created_at: "2026-01-02"
```

**Step 3:** Access at `http://localhost:5180/my-dataset`

## Required ZIP Contents

Your ZIP must have (at minimum):
```
conversations.jsonl  ← REQUIRED (plural!)
properties.jsonl     ← optional
clusters.jsonl       ← optional
model_cluster_scores_df.jsonl  ← optional
cluster_scores_df.jsonl        ← optional
model_scores_df.jsonl          ← optional
```

## Deployment (Multiple Instances)

Use git branches for different deployments:

```bash
# Create deployment branch
git checkout -b deployment-demo

# Edit datasets for this deployment
nano public/datasets.yaml

# Deploy
git push -u origin deployment-demo
vercel --prod
```

Each branch gets its own URL with its own datasets.

## File Locations

| What | Where |
|------|-------|
| Dataset config | `public/datasets.yaml` |
| Feature code | `src/features/dataset-url-loader/` |
| Backend ZIPs | `~/StringSightNew/final_results/` |
| Documentation | See below |

## Documentation Files

| File | What It Covers |
|------|----------------|
| [HOW_TO_ADD_DATASETS.md](HOW_TO_ADD_DATASETS.md) | Step-by-step guide for adding datasets |
| [DATASET_URL_LOADER_FEATURE.md](DATASET_URL_LOADER_FEATURE.md) | Feature overview |
| [DEPLOYMENT_REPO_TEMPLATE.md](DEPLOYMENT_REPO_TEMPLATE.md) | Git branch deployment strategy |
| [SEPARATE_REPO_GUIDE.md](SEPARATE_REPO_GUIDE.md) | Alternative deployment approaches |
| [PERFORMANCE_IMPROVEMENTS.md](PERFORMANCE_IMPROVEMENTS.md) | Loading optimization details |
| [src/features/dataset-url-loader/README.md](src/features/dataset-url-loader/README.md) | Complete API documentation |
| [src/features/dataset-url-loader/MIGRATION.md](src/features/dataset-url-loader/MIGRATION.md) | Extract to npm package guide |
| [src/features/dataset-url-loader/PERFORMANCE.md](src/features/dataset-url-loader/PERFORMANCE.md) | Detailed performance strategies |

## Common Tasks

### View All Datasets
Visit: `http://localhost:5180/results`

### Add Dataset
1. Put ZIP in `~/StringSightNew/final_results/`
2. Add to `public/datasets.yaml`
3. Done!

### Create New Deployment
```bash
git checkout -b deployment-customer
nano public/datasets.yaml  # customize
git commit -am "Customer deployment"
vercel --prod
```

### Check Performance
Look at browser console for timing:
```
⏱️  Download complete: XXXms
⏱️  ZIP decompression: XXXms
⏱️  Parsed conversations.jsonl: XXXXX rows in XXXms
```

### Troubleshoot
1. Check browser console (F12)
2. Verify ZIP exists: `ls ~/StringSightNew/final_results/`
3. Test backend: `curl -I http://localhost:8000/results/zip/filename.zip`
4. See [HOW_TO_ADD_DATASETS.md](HOW_TO_ADD_DATASETS.md) troubleshooting section



