# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StringSight is a React-based frontend for visualizing and analyzing LLM behavioral properties and evaluation datasets. It connects to an optional Python backend for advanced features (extraction, clustering) but can also operate standalone for basic data exploration.

## Common Development Commands

```bash
# Development
npm install                  # Install dependencies
npm run dev                  # Start dev server on http://localhost:5180
npm run build                # Production build
npm run build:check          # Build with TypeScript validation
npm run preview              # Preview production build
npm run lint                 # Run ESLint

# Backend (optional - in separate StringSight repo)
uvicorn stringsight.api:app --reload --host localhost --port 8000
curl http://127.0.0.1:8000/health  # Check backend health
```

## Environment Variables

- `VITE_BACKEND`: Backend API URL (optional; defaults to `/api` proxy in dev, allows features like extraction/clustering)
- Example: `VITE_BACKEND=http://localhost:8000`

## Architecture Overview

### Data Flow Layers

The application manages data through three distinct layers:

1. **originalRows**: Raw uploaded data, never modified
2. **operationalRows**: Cleaned data with consolidated score objects (`score`, `score_a`, `score_b`) matching backend contract format
3. **currentRows**: Display data with flattened score columns (`score_*`, `score_a_*`, `score_b_*`) for UI tables

This separation is critical: backend operations use `operationalRows` (with score dicts), while UI components use `currentRows` (with flattened scores).

### Method Detection

The app supports two evaluation methods:
- `single_model`: Single model responses (columns: `prompt`, `model_response`, `model`)
- `side_by_side`: A/B comparison (columns: `prompt`, `model_a_response`, `model_b_response`, `model_a`, `model_b`)

Method is detected from column names during upload and can be customized via the ColumnSelector component.

### Score Handling

Scores are stored as dictionaries in operational data:
- Single model: `{ score: { accuracy: 0.8, fluency: 0.9 } }`
- Side-by-side: `{ score_a: { win: 1 }, score_b: { win: 0 } }`

The `flattenScores()` function in `src/lib/normalize.ts` converts these to flat columns for display (`score_accuracy`, `score_a_win`, etc.).

### Operation Chain Pattern

Data transformations are tracked via an operation chain (`DataOperation[]` in `src/types/operations.ts`):
- **Filter**: Column-based filtering with negation support
- **Sort**: Single-column sorting (asc/desc)
- **Custom**: Python code executed on backend

Operations are applied sequentially to `operationalRows`, then results are flattened for display. This provides data provenance and undo capability.

## Key Components

### Main App (`src/App.tsx`)

Central state management hub with ~1900 lines. Key responsibilities:
- Multi-layer data management (original/operational/current)
- Tab switching (Data/Properties/Clusters/Metrics)
- Sidebar state (permanent icon sidebar + expandable panels)
- Column mapping flow (upload → ColumnSelector → processDataWithMapping)
- Drawer management for trace viewing

### Sidebar Architecture

Two-tier sidebar system:
1. **PermanentIconSidebar** (60px, always visible): Icon-based section navigation
2. **ExpandedSidebar** (400px, toggleable): Context panels for active section

Sections: Data, Extraction, Clustering, Metrics

### API Layer (`src/lib/api.ts`)

All backend communication goes through `/api` proxy (configured in `vite.config.ts`). Backend is optional - app gracefully degrades when unavailable.

Key endpoints:
- `/health`: Backend availability check
- `/extract/*`: Property extraction (single/batch/jobs)
- `/cluster/*`: Clustering and metrics computation
- `/df/*`: DataFrame operations (select/groupby/custom)

### Trace Visualization

- **ConversationTrace**: Single model response viewer with fuzzy evidence highlighting
- **SideBySideTrace**: A/B comparison viewer
- Both support evidence highlighting from property extraction
- Traces use OpenAI message format: `[{ role: 'user'|'assistant', content: string }]`

**Evidence Highlighting Implementation:**
The `highlightContent()` function in ConversationTrace uses a two-strategy approach:
1. **Exact match**: Case-insensitive regex match (fast path)
2. **Fuzzy match**: Normalized text matching with sliding window and Jaccard similarity (≥75% word overlap)

This handles LLM-extracted evidence that may have whitespace variations, punctuation differences, or slight paraphrasing. The fuzzy matcher:
- Normalizes whitespace (collapses multiple spaces)
- Normalizes quotes and dashes (smart quotes → regular quotes)
- Uses word-based similarity scoring
- Maps normalized positions back to original text for accurate highlighting
- Merges overlapping matches to avoid duplicate highlights

### Browser-Based File Parsing

The `parseFile()` function in `src/lib/parse.ts` handles CSV/JSON/JSONL parsing entirely in-browser using PapaParse. No backend required for data loading.

## Important Patterns

### Question ID Matching

Backend joins use `question_id` as the stable identifier. During processing, each row gets `question_id = String(index)` to ensure backend can correlate properties with original data.

### Flattened vs Consolidated Scores

When sending data to backend endpoints, always use `operationalRows` (has score dicts). When displaying in tables, use `currentRows` (has flattened score_* columns). The debug logs in `App.tsx` track this transformation.

### Backend Availability

Check `backendAvailable` state before enabling extraction/clustering features. When false, display overlay warnings in relevant panels.

### Results Mode

When `isResultsMode=true` (loading pre-computed `full_dataset.json`), extraction/clustering are disabled since the data is already processed.

## Component Organization

```
src/
├── components/
│   ├── metrics/           # Metrics visualization (MetricsTab, DataTabBenchmarkTable)
│   ├── sidebar-sections/  # Sidebar panels (DataStatsPanel, PropertyExtractionPanel, etc.)
│   └── cards/             # Reusable card components
├── hooks/                 # Custom React hooks
├── lib/
│   ├── api.ts            # Backend client
│   ├── normalize.ts      # Score flattening logic
│   ├── parse.ts          # File parsing (CSV/JSON/JSONL)
│   └── traces.ts         # Trace format conversion
└── types/                # TypeScript definitions
```

## Tech Stack

- React 19 + TypeScript
- Vite (dev server + build)
- Material-UI (MUI) for components
- TanStack Query & Table for data management
- Plotly.js for visualizations
- React Markdown with KaTeX for rich text rendering
- PapaParse for CSV parsing

## Demo Data

`public/taubench_airline.jsonl` is bundled for quick testing. Loaded via "Load Demo Data" button, demonstrates the column mapping flow.

## Notes from README

- Server browsing removed; all uploads are browser-based
- Backend connection optional; core visualization works standalone
- Deploy to Vercel via CLI or button
- Supports full conversation traces with side-by-side model comparisons
