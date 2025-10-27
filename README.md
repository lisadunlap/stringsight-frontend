# StringSight Frontend

Modern React visualization interface for StringSight - explore, filter, and analyze LLM behavioral properties and evaluation datasets.

## Quick Start

### Local Development

```bash
npm install
npm run dev
```

The frontend will run on `http://localhost:5180`

### Environment Variables

Create a `.env.local` file:

```bash
# Backend API URL (optional; only needed for extraction/clustering features)
# If not using a backend, omit this.
# VITE_BACKEND=http://localhost:8000
```

## Backend Connection

This frontend connects to the [StringSight Python backend](https://github.com/lisadunlap/StringSight).

To run the backend locally:

```bash
# In the StringSight repo
pip install "uvicorn[standard]" fastapi pandas python-multipart
uvicorn stringsight.api:app --reload --host localhost --port 8000
```

Check backend health: `curl http://127.0.0.1:8000/health` → `{ "ok": true }`

## Deployment

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Or via CLI:

```bash
npm install -g vercel
vercel
```

The frontend will automatically build and deploy. Configure `VITE_BACKEND` in Vercel environment variables to point to your production backend.

## Features

- **Data Table**: Load and explore evaluation datasets (CSV, JSON, JSONL)
- **Properties Tab**: View extracted behavioral properties from LLM responses
- **Clusters Tab**: Analyze grouped behaviors and patterns
- **Metrics Tab**: Compare model performance across behavioral dimensions
- **Conversation Traces**: Inspect full conversation context with side-by-side comparisons
- **Load Results**: Load pre-computed analysis results from a local folder

## Project Structure

```
src/
├── components/         # React components
│   ├── metrics/       # Metrics visualization components
│   └── cards/         # Reusable card components
├── hooks/             # Custom React hooks
├── lib/               # API client and utilities
└── types/             # TypeScript type definitions
```

## Loading Data

The frontend supports multiple ways to load data:

### Browser-Based Upload
- **Upload File**: Click "Upload File" and select a CSV, JSON, or JSONL file. Parsing happens entirely in the browser; no backend required.
- **Load Demo Data**: Click "Load Demo Data" to auto-load a bundled JSONL sample (`taubench_airline.jsonl`). This file is served from `public/` and demonstrates the expected column mapping flow.

### Load Pre-Computed Results
- **Load Results**: Click "Load Results" to select a local results folder. Your browser will prompt you to select a directory. The system will automatically load all relevant files from that folder:
  - `full_dataset.json` - Bundle containing conversations, properties, and clusters
  - `parsed_properties.jsonl` - (Optional) Extracted properties if not in full_dataset.json
  - `model_cluster_scores_df.jsonl` - Model-cluster metrics (for Metrics tab)
  - `cluster_scores_df.jsonl` - Cluster-level metrics (for Metrics tab)
  - `model_scores_df.jsonl` - Model-level metrics (for Metrics tab)

Supported formats:
- CSV: Standard evaluation datasets
- JSON/JSONL: Structured data or StringSight results

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Tech Stack

- React 19
- TypeScript
- Vite
- Material-UI (MUI)
- TanStack Query & Table
- Plotly.js for visualizations
- React Markdown with KaTeX support

## License

MIT
