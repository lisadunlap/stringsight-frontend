# Performance Analysis & Optimization Guide

## Current Performance Bottlenecks

### Dataset Size
```
Compressed (ZIP):   428 MB
Uncompressed:       428 MB total
  - conversations:  292 MB (68%)
  - properties:     131 MB (31%)
  - clusters:       2 MB
  - metrics:        3 MB
```

### Loading Timeline (Estimated)

For 428 MB dataset over localhost:

1. **Network Download**: 1-3 seconds
   - 428 MB @ ~200 MB/s (localhost)
   - Bottleneck: Network transfer

2. **Blob Conversion**: 0.5-1 second
   - `await response.blob()`
   - Bottleneck: Memory allocation

3. **JSZip Decompression**: 2-5 seconds
   - `await zip.loadAsync(blob)`
   - Bottleneck: Decompression algorithm

4. **File Extraction**: 3-8 seconds
   - Sequential extraction of 6 files
   - `await file.async('text')` for each file
   - Bottleneck: String conversion

5. **JSONL Parsing**: 5-15 seconds
   - Parse ~423 MB of JSON text
   - `JSON.parse()` for each line
   - Bottleneck: JSON parsing

**Total: 12-32 seconds** for full load

## Optimization Strategies

### 1. Stream Processing (High Impact)

**Current**: Load entire ZIP, extract all, parse all
**Better**: Stream and process incrementally

```typescript
// Use streaming ZIP library
import { unzip } from 'unzipit';

async function loadDatasetFromZipStreaming(url: string) {
  const { entries } = await unzip(url);

  // Process files in parallel
  const [conversations, properties, clusters] = await Promise.all([
    entries['conversations.jsonl'].text(),
    entries['properties.jsonl'].text(),
    entries['clusters.jsonl'].text(),
  ]);

  // Parse incrementally
  return {
    conversations: parseJsonlStreaming(conversations),
    properties: parseJsonlStreaming(properties),
    clusters: parseJsonlStreaming(clusters),
  };
}
```

**Impact**: 30-50% faster (parallel extraction + parsing)

### 2. Lazy Loading (High Impact)

**Current**: Load all data upfront
**Better**: Load only what's needed

```typescript
// Load conversations first, properties/clusters on demand
async function loadDatasetLazy(url: string) {
  const { entries } = await unzip(url);

  // Load core data immediately
  const conversations = await entries['conversations.jsonl'].text();

  return {
    conversations: parseJsonl(conversations),
    properties: [], // Load later when needed
    clusters: [],   // Load later when needed

    // Lazy loaders
    loadProperties: async () => {
      const text = await entries['properties.jsonl'].text();
      return parseJsonl(text);
    },
    loadClusters: async () => {
      const text = await entries['clusters.jsonl'].text();
      return parseJsonl(text);
    },
  };
}
```

**Impact**: 60-70% faster initial load (only load 292 MB instead of 428 MB)

### 3. Pagination/Virtualization (Medium Impact)

**Current**: Parse and render all rows
**Better**: Parse only visible rows

```typescript
function parseJsonlChunked(text: string, chunkSize = 1000) {
  const lines = text.trim().split('\n');

  return {
    total: lines.length,
    getChunk: (start: number, end: number) => {
      return lines.slice(start, end).map(line => JSON.parse(line));
    },
  };
}
```

**Impact**: 40-60% faster for large datasets (parse on demand)

### 4. Web Workers (Medium Impact)

**Current**: Parse on main thread (blocks UI)
**Better**: Parse in background worker

```typescript
// worker.ts
self.onmessage = (e) => {
  const { text } = e.data;
  const lines = text.trim().split('\n');
  const parsed = lines.map(line => JSON.parse(line));
  self.postMessage(parsed);
};

// main.ts
const worker = new Worker('worker.ts');
worker.postMessage({ text: conversationsText });
worker.onmessage = (e) => {
  setConversations(e.data);
};
```

**Impact**: UI stays responsive during parsing

### 5. Server-Side Optimization (Highest Impact!)

**Current**: Send full uncompressed ZIP
**Better**: Pre-process and send only needed data

#### Option A: Separate Files
Instead of one 428 MB ZIP:
```
/api/results/dataset/telecom/conversations.jsonl.gz  (compressed individually)
/api/results/dataset/telecom/properties.jsonl.gz
/api/results/dataset/telecom/clusters.jsonl.gz
```

Load only what's needed:
```typescript
// Load just conversations initially
const conversations = await fetch('/api/results/dataset/telecom/conversations.jsonl.gz')
  .then(r => r.text())
  .then(parseJsonl);
```

**Impact**: 70% faster (load 292 MB instead of 428 MB, better compression)

#### Option B: Pagination API
```python
@app.get("/results/{dataset}/conversations")
async def get_conversations(
    dataset: str,
    offset: int = 0,
    limit: int = 100
):
    # Return only requested page
    return conversations[offset:offset+limit]
```

**Impact**: 95% faster initial load (only load what's visible)

#### Option C: Pre-aggregated Summaries
```python
# Generate summary on upload
{
  "total_conversations": 50000,
  "models": ["gpt-4", "claude"],
  "preview": [...first 100 conversations...],
  "full_data_url": "/api/results/zip/..."
}
```

Load summary first, full data on demand.

**Impact**: 99% faster initial load (show preview immediately)

## Recommended Approach

### Phase 1: Quick Wins (No Backend Changes)

1. **Parallel extraction** - Extract files concurrently
   ```typescript
   const filePromises = ['conversations.jsonl', 'properties.jsonl', ...].map(
     filename => zipContents.files[filename]?.async('text')
   );
   const [convText, propsText, ...] = await Promise.all(filePromises);
   ```

2. **Chunked parsing** - Parse in smaller batches
   ```typescript
   function parseJsonlChunked(text: string, chunkSize = 5000) {
     const lines = text.trim().split('\n');
     const result = [];
     for (let i = 0; i < lines.length; i += chunkSize) {
       const chunk = lines.slice(i, i + chunkSize);
       result.push(...chunk.map(line => JSON.parse(line)));
       // Allow UI to breathe
       await new Promise(resolve => setTimeout(resolve, 0));
     }
     return result;
   }
   ```

3. **Progress indicators** - Show what's happening
   ```typescript
   setLoadingMessage('Downloading dataset (428 MB)...');
   // download
   setLoadingMessage('Extracting files...');
   // extract
   setLoadingMessage('Parsing conversations (292 MB)...');
   // parse
   ```

**Expected improvement**: 20-30% faster, much better UX

### Phase 2: Lazy Loading (No Backend Changes)

1. Load only conversations initially
2. Load properties when user clicks "Properties" tab
3. Load clusters when user clicks "Clusters" tab

**Expected improvement**: 60-70% faster initial load

### Phase 3: Backend Optimization (Requires Backend Changes)

1. Split ZIP into separate files
2. Serve with gzip compression
3. Add pagination endpoints

**Expected improvement**: 90%+ faster

## Measuring Performance

Add timing logs to zipLoader.ts:

```typescript
async function loadAndExtractZip(url: string) {
  const t0 = performance.now();
  console.log(`📦 Downloading ZIP from ${url}`);

  const response = await fetch(url);
  console.log(`⏱️  Download: ${Math.round(performance.now() - t0)}ms`);

  const t1 = performance.now();
  const blob = await response.blob();
  console.log(`⏱️  Blob conversion: ${Math.round(performance.now() - t1)}ms`);

  const t2 = performance.now();
  const zip = new JSZip();
  const zipContents = await zip.loadAsync(blob);
  console.log(`⏱️  ZIP decompression: ${Math.round(performance.now() - t2)}ms`);

  // ... extraction timing
}
```

## Current Limitations

1. **Browser Memory**: 428 MB of strings in memory is heavy
   - Can cause slowdowns on lower-end devices
   - May hit memory limits on mobile

2. **Main Thread Blocking**: Large JSON.parse() blocks UI
   - User can't interact during parsing
   - Browser may show "Page Unresponsive" warning

3. **No Caching**: Re-downloads on every page reload
   - Should cache ZIP in IndexedDB
   - Or cache parsed results

## Recommended Implementation Order

1. ✅ **Add timing logs** (5 min) - Understand current bottlenecks
2. **Parallel extraction** (15 min) - Easy win
3. **Progress indicators** (30 min) - Better UX
4. **Lazy loading** (1 hour) - Biggest frontend-only improvement
5. **Web Workers** (2 hours) - Non-blocking parsing
6. **IndexedDB caching** (3 hours) - Avoid re-downloads
7. **Backend split files** (Backend work) - Ultimate solution

## Code Example: Quick Win (Parallel + Progress)

```typescript
export async function loadDatasetFromZip(
  zipUrl: string,
  onProgress?: (message: string) => void
): Promise<LoadedDataset> {
  onProgress?.('Downloading dataset (428 MB)...');

  const t0 = performance.now();
  const response = await fetch(zipUrl);
  const blob = await response.blob();

  onProgress?.('Extracting ZIP files...');
  const zip = new JSZip();
  const zipContents = await zip.loadAsync(blob);

  // Parallel extraction
  const fileNames = [
    'conversations.jsonl',
    'properties.jsonl',
    'clusters.jsonl',
    'model_cluster_scores_df.jsonl',
    'cluster_scores_df.jsonl',
    'model_scores_df.jsonl',
  ];

  onProgress?.('Extracting files in parallel...');
  const texts = await Promise.all(
    fileNames.map(name =>
      zipContents.files[name]?.async('text').catch(() => null)
    )
  );

  onProgress?.('Parsing conversations...');
  const conversations = texts[0] ? parseJsonl(texts[0]) : [];

  onProgress?.('Parsing properties...');
  const properties = texts[1] ? parseJsonl(texts[1]) : [];

  console.log(`⏱️  Total load time: ${Math.round(performance.now() - t0)}ms`);

  return { conversations, properties, ... };
}
```

Use in hook:
```typescript
const [loadingMessage, setLoadingMessage] = useState('');

const dataset = await loadDatasetFromZip(url, setLoadingMessage);
```
