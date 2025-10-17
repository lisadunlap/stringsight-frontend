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
# Backend API URL (default: http://localhost:8000)
VITE_BACKEND=http://localhost:8000
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
- **Server File Browser**: Load results directly from backend file system

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

## Loading Results

The frontend can load precomputed StringSight analysis results in two ways:

1. **Browser Upload**: Click "Load File" and select `full_dataset.json`
2. **Server Browser**: Use the built-in file browser to load results from the backend

Expected file structure from StringSight pipeline:
- `full_dataset.json` - Main results file (required)
- `model_cluster_scores.json` - Cluster metrics (optional)
- `cluster_scores.json` - Cluster statistics (optional)
- `model_scores.json` - Model performance metrics (optional)

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
