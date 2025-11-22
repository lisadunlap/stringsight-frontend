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

### Install the StringSight Python backend

You can either install from **PyPI** (recommended for most users) or from **source** (for local development and contributing).

```bash
# (Optional) create and activate a dedicated environment
conda create -n stringsight python=3.11
conda activate stringsight

# Install the core library from PyPI
pip install stringsight

# Install with all optional extras (recommended for notebooks and advanced workflows)
pip install "stringsight[full]"
```

For local development or contributing, you can install from source in editable mode:

```bash
# Clone the repository
git clone https://github.com/lisadunlap/StringSight.git
cd stringsight

# (Optional) create and activate a dedicated environment
conda create -n stringsight python=3.11
conda activate stringsight

# Install StringSight in editable mode with full extras
pip install -e ".[full]"

# Install StringSight in editable mode with dev dependencies
pip install -e ".[dev]"

# Set API keys
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"  # optional
export GOOGLE_API_KEY="your-google-key"        # optional
```

For more details, see the backend README at [`https://github.com/lisadunlap/StringSight`](https://github.com/lisadunlap/StringSight).

### Run the backend API locally

With the `stringsight` conda environment activated and from the backend repo:

```bash
uvicorn stringsight.api:app --reload --host localhost --port 8000
```

Check backend health: `curl http://127.0.0.1:8000/health` → `{ "ok": true }`

Keep this terminal window running while you use the frontend.

### End-to-end: backend + frontend (for first-time users)

If you've never launched a frontend before, here's the full flow using **two terminal windows**:

1. **Terminal 1 – Start the backend**
   - Follow the steps in **Install the StringSight Python backend** above.
   - From the `StringSight` backend repo, run:
     ```bash
     uvicorn stringsight.api:app --reload --host localhost --port 8000
     ```
   - Leave this terminal window open; the backend API will be available at `http://localhost:8000`.
2. **Terminal 2 – Start the frontend**
   - From this `stringsight-frontend` repo:
     ```bash
     npm install        # first time only
     npm run dev
     ```
   - The frontend will start at `http://localhost:5180`.
3. **Connect the frontend to the backend**
   - In this repo, create `.env.local` (if you haven't already) and set:
     ```bash
     VITE_BACKEND=http://localhost:8000
     ```
   - Refresh the frontend page in your browser. Backend-powered features (extraction, clustering) will now call your local backend.

You can still use many parts of the UI (e.g., loading pre-computed results) without running a backend; the steps above are only required for live extraction/clustering.

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

### Conversation Trace Evidence Highlighting

- **Evidence-based highlighting**: When you select text evidence for a conversation trace, the frontend highlights matching spans in the full trace.
- **Fuzzy, punctuation-tolerant matching**:
  - Matching is case-insensitive and uses both exact and fuzzy matching to find the best span in the trace.
  - Ellipses are handled specially:
    - Trailing ellipses in evidence (e.g. `"being addressed..."` or `"being addressed…"` ) are ignored for matching, so they still match `"being addressed"` in the trace.
    - Ellipses inside a quote (e.g. `"Mitchell ... was experiencing issues"`) are treated as separators, and each side is highlighted as separate evidence segments when they meet the minimum length requirement.

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
