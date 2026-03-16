# Deployment Repository Template - Using Git Branches

Use git branches to manage different deployments with different dataset configurations.

## Quick Setup

```bash
# Create deployment branch for demo
git checkout -b deployment-demo

# Edit dataset configuration  
nano public/datasets.yaml

# Commit and deploy
git add public/datasets.yaml
git commit -m "Configure datasets for demo"
git push -u origin deployment-demo
vercel --prod
```

Done! Your deployment is live at a unique URL with its own datasets.

## How It Works

- **main branch**: Development, all features
- **deployment-X branches**: Production configs, each with different `datasets.yaml`
- Each branch deploys to its own URL
- Code updates: merge from main
- Dataset updates: edit in branch

## Multiple Deployments

```
main                    → dev environment
├── deployment-demo     → demo.vercel.app
├── deployment-prod     → stringsight.com  
└── deployment-client   → client.vercel.app
```

Each gets its own:
- URL
- Dataset configuration
- Backend endpoint



