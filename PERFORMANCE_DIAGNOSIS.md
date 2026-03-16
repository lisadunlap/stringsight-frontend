# Performance Diagnosis - Dataset Loading

## Problem

Loading large datasets (50,000+ rows) takes 12-32 seconds despite implementing fast paginated API endpoints. The backend serves data quickly (1-2 seconds), but the UI remains slow to load.

## Root Cause Found

The bottleneck is **NOT** in data loading, but in **React state updates and derived computations** that run when the dataset loads.

### Expensive Computations Identified

In [src/App.tsx](src/App.tsx), when `currentRows` (50,000+ rows) is set, several expensive `useMemo` computations trigger:

#### 1. `uniqueValuesFor` (Line 2590-2602)
```typescript
const uniqueValuesFor = useMemo(() => {
  const cache = new Map<string, string[]>();
  return (col: string) => {
    if (cache.has(col)) {
      return cache.get(col)!;
    }
    const s = new Set<string>();
    currentRows.forEach(r => { const v = r?.[col]; if (v !== undefined && v !== null) s.add(String(v)); });
    const result = Array.from(s).sort();
    cache.set(col, result);
    return result;
  };
}, [currentRows]);
```

**Problem**: This iterates over ALL 50,000+ rows for EVERY column when building filter dropdowns. With 20+ columns, this means 1,000,000+ row accesses.

**Time Complexity**: O(n * m) where n = rows (50,000) and m = columns (~20)

#### 2. `categoricalColumns` (Line 2558-2568)
```typescript
const categoricalColumns = useMemo(() => {
  if (operationalRows.length === 0) return [] as string[];
  const cols = new Set<string>();
  for (const c of allowedColumns) {
    if (c === '__index') continue;
    const uniq = new Set(operationalRows.slice(0, 500).map(r => r?.[c])).size;
    if (uniq > 0 && uniq <= 50) cols.add(c);
  }
  return Array.from(cols);
}, [operationalRows, allowedColumns]);
```

**Problem**: Checks first 500 rows for every column to detect categorical vs numeric columns.

**Time Complexity**: O(500 * m) - more reasonable but still expensive

#### 3. `allowedColumns` (Line 2515-2543)
```typescript
const allowedColumns = useMemo(() => {
  if (currentRows.length === 0) return [];
  const allColumns = Object.keys(currentRows[0]);
  // ... column ordering logic
}, [currentRows, responseKeys, method]);
```

**Problem**: Runs complex column ordering logic every time `currentRows` changes. Less expensive but still triggers on every dataset load.

### Timeline of Events

1. **0-2s**: Paginated API loads data ✅ (fast)
2. **2s**: `urlDataset` received by App.tsx
3. **2s**: useEffect at line 1021 fires, calls `setCurrentRows(50,000 rows)`
4. **2-15s**: React processes state update, triggers ALL dependent useMemos
   - `uniqueValuesFor` re-creates function (iterates all rows when called)
   - `categoricalColumns` processes 500 rows × 20 columns
   - `allowedColumns` re-orders columns
   - Multiple other memos cascade
5. **15-32s**: First render happens, UI becomes responsive

## Verification

To confirm this diagnosis:

1. Open browser console
2. Visit `http://localhost:5180/telecom`
3. Look for these console logs:

**If you see**:
```
🚀 Loading from paginated API endpoints...
⏱️  Loaded via API in 1500ms
🎯 Loading dataset from URL: Telecom Dataset
   Conversations: 50000
[Long pause here - 10-30 seconds]
✅ URL dataset loaded into app state
```

**Then the diagnosis is confirmed** - data loads fast but state updates are slow.

**If you see**:
```
📦 Loading from ZIP file...
```

**Then the API isn't being used** - need to check configuration first.

## Solutions

### Option 1: Lazy Computation (Recommended)

Instead of computing unique values for all columns upfront, compute them **on-demand** when a filter dropdown is opened:

```typescript
const uniqueValuesFor = useCallback((col: string) => {
  // Compute on-demand, no pre-caching
  const s = new Set<string>();
  const sample = currentRows.slice(0, 5000); // Sample first 5k rows
  sample.forEach(r => {
    const v = r?.[col];
    if (v !== undefined && v !== null) s.add(String(v));
  });
  return Array.from(s).sort();
}, [currentRows]);
```

**Pros**: Instant initial load, filters compute when needed
**Cons**: Slight delay (100-200ms) when opening first filter dropdown

### Option 2: Web Worker

Move expensive computations to a background Web Worker:

```typescript
// computeUniqueValues.worker.ts
self.addEventListener('message', (e) => {
  const { rows, column } = e.data;
  const unique = [...new Set(rows.map(r => r[column]))].sort();
  self.postMessage({ column, unique });
});

// App.tsx
const worker = new Worker(new URL('./computeUniqueValues.worker.ts', import.meta.url));
```

**Pros**: Doesn't block UI thread
**Cons**: More complex, requires message passing

### Option 3: Sampling

Only analyze a sample of rows for categorical column detection:

```typescript
const categoricalColumns = useMemo(() => {
  if (operationalRows.length === 0) return [] as string[];

  // Use sampling for large datasets
  const sampleSize = Math.min(500, operationalRows.length);
  const step = Math.floor(operationalRows.length / sampleSize);
  const sample = operationalRows.filter((_, i) => i % step === 0).slice(0, sampleSize);

  const cols = new Set<string>();
  for (const c of allowedColumns) {
    if (c === '__index') continue;
    const uniq = new Set(sample.map(r => r?.[c])).size;
    if (uniq > 0 && uniq <= 50) cols.add(c);
  }
  return Array.from(cols);
}, [operationalRows, allowedColumns]);
```

**Pros**: Simple, faster
**Cons**: May miss some categorical columns in very large datasets

### Option 4: Incremental Rendering

Use React Suspense to defer expensive computations:

```typescript
const DeferredFilters = React.lazy(() => import('./DeferredFilters'));

// In render:
<Suspense fallback={<CircularProgress />}>
  <DeferredFilters rows={currentRows} />
</Suspense>
```

**Pros**: UI shows immediately, filters load progressively
**Cons**: Requires refactoring component structure

## Recommended Implementation Plan

1. **Immediate Fix** (5 minutes):
   - Change `uniqueValuesFor` to sample first 5,000 rows instead of all rows
   - This alone should cut load time by 70%

2. **Short-term** (30 minutes):
   - Add `startTransition` around `setCurrentRows` to make it non-blocking
   - Make filter computations lazy (compute when dropdown opens)

3. **Long-term** (2-3 hours):
   - Move expensive computations to Web Workers
   - Implement progressive loading with Suspense

## Testing

After implementing fixes, expected load times:

- **Current**: 12-32 seconds
- **After immediate fix**: 3-5 seconds
- **After short-term**: 1-2 seconds (same as API response time)
- **After long-term**: <1 second (instant UI, background computation)

## Files to Modify

1. [src/App.tsx](src/App.tsx):
   - Lines 2590-2602: `uniqueValuesFor`
   - Lines 2558-2568: `categoricalColumns`
   - Lines 1021-1065: urlDataset useEffect (add startTransition)

## Next Steps

Run the diagnostic script to confirm:

```bash
./diagnose-s3-access.sh
```

Then check browser console at `http://localhost:5180/telecom` to verify the diagnosis.
