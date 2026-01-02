# Migration Guide: Extracting to Separate Repository

This guide explains how to extract the `dataset-url-loader` feature into its own repository.

## Current Structure

```
src/features/dataset-url-loader/
├── index.ts                  # Public API exports
├── types.ts                  # TypeScript interfaces
├── useDatasetFromUrl.ts     # React hooks
├── datasetLoader.ts         # Core loading logic
├── zipLoader.ts             # ZIP extraction
├── package.json             # Dependencies manifest
├── README.md                # Feature documentation
└── MIGRATION.md             # This file
```

## Step 1: Create New Repository

```bash
mkdir dataset-url-loader
cd dataset-url-loader
git init
npm init -y
```

## Step 2: Copy Files

```bash
# Copy all TypeScript files
cp -r /path/to/stringsight-frontend/src/features/dataset-url-loader/* .

# Copy configuration template
mkdir -p public
cp /path/to/stringsight-frontend/public/datasets.yaml public/datasets.example.yaml
```

## Step 3: Update package.json

Use the `package.json` from this directory as a starting point. Add additional scripts:

```json
{
  "name": "@stringsight/dataset-url-loader",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "js-yaml": "^4.1.0",
    "jszip": "^3.10.1"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "eslint": "^8.0.0"
  }
}
```

## Step 4: Add TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true
  },
  "include": ["*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

## Step 5: Remove Path Aliases (if any)

The current module uses relative imports (`./types`, `./datasetLoader`, etc.), so no changes needed.

## Step 6: Add Tests

Create `__tests__/` directory:

```typescript
// __tests__/zipLoader.test.ts
import { describe, it, expect } from 'vitest';
import { isZipUrl } from '../zipLoader';

describe('zipLoader', () => {
  it('should detect ZIP URLs', () => {
    expect(isZipUrl('/api/results/zip/file.zip')).toBe(true);
    expect(isZipUrl('/api/results/data.jsonl')).toBe(false);
  });
});
```

## Step 7: Update README

The included README.md is already written for standalone use. Just update:
- Repository URL
- Installation instructions
- Any project-specific references

## Step 8: Publish to npm (optional)

```bash
npm login
npm publish --access public
```

## Step 9: Install in Original Project

In StringSight frontend:

```bash
npm install @stringsight/dataset-url-loader
```

Update imports:

```typescript
// Before
import { useDatasetFromUrl } from './features/dataset-url-loader';

// After
import { useDatasetFromUrl } from '@stringsight/dataset-url-loader';
```

## Backend Requirements (Documentation)

Document that consuming projects need a backend with:

### Endpoint Specification

```python
# FastAPI example
from fastapi import FastAPI
from fastapi.responses import FileResponse
from pathlib import Path

app = FastAPI()

@app.get("/results/zip/{zip_name:path}")
async def serve_dataset_zip(zip_name: str):
    """Serve dataset ZIP files"""
    zip_path = Path("final_results") / zip_name

    if not zip_path.exists():
        raise HTTPException(404, f"Not found: {zip_name}")

    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename=zip_path.name
    )
```

### CORS Configuration

If frontend and backend are on different domains:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Configuration Template

Include `datasets.example.yaml`:

```yaml
# Dataset configuration
# Copy to public/datasets.yaml and customize

datasets:
  example-dataset:
    name: "Example Dataset"
    description: "Description here"
    cdn_url: "/api/results/zip/example.zip"
    files: []
    method: "single_model"  # or "side_by_side"
    created_at: "2026-01-02"
```

## Breaking Changes (None!)

This module is fully self-contained with no breaking changes expected during extraction.

## Maintenance

Once extracted:
- Bug fixes go to the separate repo
- Updates are pulled via npm
- Pin version in StringSight: `"@stringsight/dataset-url-loader": "1.0.0"`

## Rollback Plan

If extraction causes issues, revert to local feature:

1. Remove npm package: `npm uninstall @stringsight/dataset-url-loader`
2. Keep `src/features/dataset-url-loader/` directory
3. Change imports back to local path
4. Everything continues working as before
