import React, { useRef } from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import CloseIcon from '@mui/icons-material/Close';
import { getPrompts, getPromptText, extractSingle, extractJobStart, extractJobStatus, extractJobResult, extractJobCancel, getEmbeddingModels, runClustering, checkBackendHealth, pipelineJobStart, resultsLoad, sendDemoEmail } from '../../lib/api';
import { useTutorial } from '../../context/TutorialContext';

type Method = 'single_model' | 'side_by_side' | 'unknown';

/**
 * Sanitize a row object for JSON serialization by removing non-serializable values
 * and ensuring all values are JSON-safe. Handles circular references.
 */
function sanitizeRowForSerialization(row: Record<string, any>, seen = new WeakSet()): Record<string, any> {
  const sanitized: Record<string, any> = {};

  // Handle circular references
  if (typeof row === 'object' && row !== null) {
    if (seen.has(row)) {
      return { __circular: true };
    }
    seen.add(row);
  }

  for (const [key, value] of Object.entries(row)) {
    // Skip functions, symbols, and undefined
    if (typeof value === 'function' || typeof value === 'symbol') {
      continue;
    }

    // Handle undefined - convert to null or skip
    if (value === undefined) {
      continue; // Skip undefined values
    }

    // Handle null - keep as is
    if (value === null) {
      sanitized[key] = null;
      continue;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      sanitized[key] = value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return sanitizeRowForSerialization(item, seen);
        }
        return item;
      });
      continue;
    }

    // Handle objects (but not Date, RegExp, etc.)
    if (typeof value === 'object') {
      // Check for common non-serializable objects
      if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else if (value instanceof RegExp) {
        sanitized[key] = value.toString();
      } else if (value instanceof Error) {
        sanitized[key] = { message: value.message, name: value.name, stack: value.stack };
      } else {
        // Recursively sanitize nested objects
        try {
          sanitized[key] = sanitizeRowForSerialization(value, seen);
        } catch (e) {
          // If recursion fails, stringify it
          sanitized[key] = String(value);
        }
      }
      continue;
    }

    // Primitive values (string, number, boolean) are safe
    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Validate that a row has the required fields for extraction
 */
function validateRowForExtraction(row: Record<string, any>, method: Method): { valid: boolean; error?: string } {
  if (!row) {
    return { valid: false, error: 'Row is null or undefined' };
  }

  // Check for required prompt field
  if (!row.prompt && row.prompt !== '') {
    return { valid: false, error: 'Row is missing required field: prompt' };
  }

  if (method === 'single_model') {
    if (!row.model_response && row.model_response !== '') {
      return { valid: false, error: 'Row is missing required field: model_response (for single_model method)' };
    }
    if (!row.model) {
      return { valid: false, error: 'Row is missing required field: model (for single_model method)' };
    }
  } else if (method === 'side_by_side') {
    const hasModelA = row.model_a !== undefined && row.model_a !== null;
    const hasModelB = row.model_b !== undefined && row.model_b !== null;
    const hasResponseA = row.model_a_response !== undefined && row.model_a_response !== null;
    const hasResponseB = row.model_b_response !== undefined && row.model_b_response !== null;

    if (!hasModelA && !hasModelB) {
      return { valid: false, error: 'Row is missing required fields: model_a or model_b (for side_by_side method)' };
    }
    if (!hasResponseA && !hasResponseB) {
      return { valid: false, error: 'Row is missing required fields: model_a_response or model_b_response (for side_by_side method)' };
    }
  }

  return { valid: true };
}

/**
 * Transform operationalRows to backend-expected format.
 * For side-by-side: converts model_a/model_b/score_a/score_b to arrays.
 * For single_model: renames fields to match backend expectations.
 */
function transformRowsForBackend(
  rows: Record<string, any>[],
  method: Method
): Record<string, any>[] {
  if (method === 'side_by_side') {
    return rows.map(row => {
      const transformed: Record<string, any> = {
        question_id: String(row.__index ?? row.question_id ?? ''),
        prompt: row.prompt
      };

      // Convert model_a/model_b to model array
      if (row.model_a !== undefined && row.model_b !== undefined) {
        transformed.model = [row.model_a, row.model_b];
      } else if (row.model_a !== undefined) {
        transformed.model = [row.model_a];
      } else if (row.model_b !== undefined) {
        transformed.model = [row.model_b];
      }

      // Convert responses to array
      if (row.model_a_response !== undefined && row.model_b_response !== undefined) {
        transformed.responses = [row.model_a_response, row.model_b_response];
      } else if (row.model_a_response !== undefined) {
        transformed.responses = [row.model_a_response];
      } else if (row.model_b_response !== undefined) {
        transformed.responses = [row.model_b_response];
      }

      // Convert score_a/score_b to scores array
      if (row.score_a !== undefined && row.score_b !== undefined) {
        transformed.scores = [row.score_a, row.score_b];
      } else if (row.score_a !== undefined) {
        transformed.scores = [row.score_a];
      } else if (row.score_b !== undefined) {
        transformed.scores = [row.score_b];
      }

      return transformed;
    });
  } else if (method === 'single_model') {
    return rows.map(row => {
      const transformed: Record<string, any> = {
        question_id: String(row.__index ?? row.question_id ?? ''),
        prompt: row.prompt,
        model: row.model
      };

      // Rename model_response to responses
      if (row.model_response !== undefined) {
        transformed.responses = row.model_response;
      }

      // Rename score to scores
      if (row.score !== undefined) {
        transformed.scores = row.score;
      }

      return transformed;
    });
  }

  // Return as-is for unknown method
  return rows;
}

// Demo mode fixed settings
const DEMO_MODE_SETTINGS = {
  modelName: 'gpt-4.1',
  embeddingModel: 'openai/text-embedding-3-large',
  summarizationModel: 'gpt-4.1-mini',
  matchingModel: 'gpt-4.1-mini',
  groupBy: 'behavior_type' as 'none' | 'category' | 'behavior_type',
};

interface PropertyExtractionPanelProps {
  method: Method;
  uploadedFileName?: string;
  resultsName?: string;
  onResultsNameChange?: (name: string) => void;
  isResultsMode?: boolean;
  getSelectedRow: () => Record<string, any> | null;
  getAllRows: () => Record<string, any>[];
  getOperationalRows: () => any[];
  getPropertiesRows: () => any[];
  getClusters?: () => any[];
  onPropertiesMerged: (props: any[]) => void;
  onSelectEvidence: (evidence: string[], targetModel?: string) => void;
  onBatchLoaded: (rows: any[]) => void;
  onBatchStart?: () => void;
  onBatchStatus?: (progress: number, state: string | null, stage?: 'extraction' | 'clustering', details?: string) => void;
  onBatchDone?: () => void;
  onOpenTrace?: (row: Record<string, any>) => void;
  onCloseTrace?: () => void;
  demoSampleSize?: number; // When set, backend operations will be limited to this sample size
  onClustersUpdated?: (data: {
    clusters: any[];
    total_conversations_by_model?: Record<string, number>;
    total_unique_conversations?: number;
    metrics?: {
      model_cluster_scores: any[];
      cluster_scores: any[];
      model_scores: any[];
    };
  }) => void;
  onNavigateToMetrics?: () => void;
  onNavigateToClusters?: () => void;
  onScrollToProperties?: () => void;
}

// Helper to fetch and parse JSONL file directly from public directory
async function fetchJsonl(url: string): Promise<any[]> {
  try {
    console.log('[fetchJsonl] Fetching:', url);

    const response = await fetch(url, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    console.log('[fetchJsonl] File loaded, length:', text.length);

    const lines = text
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    console.log('[fetchJsonl] Parsed', lines.length, 'lines');
    return lines;
  } catch (error) {
    console.error(`Error loading ${url}:`, error);
    throw error;
  }
}

export default function PropertyExtractionPanel({
  method,
  uploadedFileName,
  resultsName: resultsNameProp,
  onResultsNameChange,
  isResultsMode = false,
  getSelectedRow,
  getAllRows,
  getOperationalRows,
  getPropertiesRows,
  getClusters,
  onPropertiesMerged,
  onSelectEvidence,
  onBatchLoaded,
  onBatchStart,
  onBatchStatus,
  onBatchDone,
  onOpenTrace,
  onCloseTrace,
  demoSampleSize,
  onClustersUpdated,
  onNavigateToMetrics,
  onNavigateToClusters,
  onScrollToProperties,
}: PropertyExtractionPanelProps) {
  const tutorial = useTutorial();

  // Helper function to map prompt names to display labels
  const getPromptDisplayLabel = (name: string): string => {
    const labelMap: Record<string, string> = {
      'default': 'chatbot',
      'agent': 'agents'
    };
    return labelMap[name] || name;
  };

  const [promptOptions, setPromptOptions] = React.useState<{ name: string; label: string; has_task_description: boolean; preview: string; default_task_description_single?: string | null; default_task_description_sbs?: string | null; }[]>([]);
  const [selectedPrompt, setSelectedPrompt] = React.useState<string>(
    () => localStorage.getItem('stringsight.selectedPrompt') || 'default'
  );
  const [taskDescription, setTaskDescription] = React.useState<string>(
    () => localStorage.getItem('stringsight.taskDescription') || ''
  );
  const [userEdited, setUserEdited] = React.useState<boolean>(
    () => (localStorage.getItem('stringsight.taskDescriptionEdited') === 'true') || false
  );
  const [resolvedPrompt, setResolvedPrompt] = React.useState<string>('');

  // Demo mode detection
  const isDemoMode = !!demoSampleSize;

  // Use demo mode settings when applicable
  const [modelName, setModelName] = React.useState<string>(isDemoMode ? DEMO_MODE_SETTINGS.modelName : 'gpt-4.1');
  const [temperature, setTemperature] = React.useState<number>(0.6);
  const [topP, setTopP] = React.useState<number>(0.95);
  const [maxTokens, setMaxTokens] = React.useState<number>(2048);
  const [maxWorkers, setMaxWorkers] = React.useState<number>(16);
  const [sampleSize, setSampleSize] = React.useState<number | null>(null);

  const [busy, setBusy] = React.useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = React.useState<number>(0);
  const [lastExtractProps, setLastExtractProps] = React.useState<any[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [jobId, setJobId] = React.useState<string>('');
  const [jobProgress, setJobProgress] = React.useState<number>(0);
  const [jobState, setJobState] = React.useState<string | null>(null);

  // Clustering configuration
  const [minClusterSize, setMinClusterSize] = React.useState<number>(5);
  const [embeddingModel, setEmbeddingModel] = React.useState<string>(isDemoMode ? DEMO_MODE_SETTINGS.embeddingModel : 'openai/text-embedding-3-large');
  const [embeddingModels, setEmbeddingModels] = React.useState<string[]>([]);
  const [groupBy, setGroupBy] = React.useState<'none' | 'category' | 'behavior_type'>(isDemoMode ? DEMO_MODE_SETTINGS.groupBy : 'behavior_type');
  const [summarizationModel, setSummarizationModel] = React.useState<string>(isDemoMode ? DEMO_MODE_SETTINGS.summarizationModel : 'gpt-4.1');
  const [matchingModel, setMatchingModel] = React.useState<string>(isDemoMode ? DEMO_MODE_SETTINGS.matchingModel : 'gpt-4.1-mini');
  const [clusteringBusy, setClusteringBusy] = React.useState<boolean>(false);
  const [currentStage, setCurrentStage] = React.useState<'extraction' | 'clustering' | null>(null);
  const [email, setEmail] = React.useState<string>('');

  // Controls whether the main control panel is expanded or collapsed.
  // Initially expanded; will auto-collapse after "Run on all traces".
  // If loading from results (clusters already exist), start collapsed.
  const [panelExpanded, setPanelExpanded] = React.useState<boolean>(() => {
    if (getClusters) {
      const existingClusters = getClusters();
      return existingClusters.length === 0;
    }
    return true;
  });

  // Full-screen prompt viewer
  const [promptFullscreen, setPromptFullscreen] = React.useState<boolean>(false);
  const [taskDescFullscreen, setTaskDescFullscreen] = React.useState<boolean>(false);

  const selectedPromptMeta = promptOptions.find(p => p.name === selectedPrompt);
  const canTaskDescribe = selectedPromptMeta?.has_task_description || false;

  // Generate output directory name with custom name (or filename) and timestamp
  const generateOutputDir = React.useCallback(() => {
    const baseName = resultsNameProp?.trim() || uploadedFileName || 'results';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: YYYY-MM-DDTHH-MM-SS
    return `frontend/${baseName}_${timestamp}`;
  }, [resultsNameProp, uploadedFileName]);

  // Load prompts and embedding models on mount
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getPrompts();
        const allowed = new Set(['default', 'agent']);
        const filtered = (res.prompts || []).filter((p: any) => allowed.has(p.name));
        if (mounted) setPromptOptions(filtered);
      } catch (e: any) {
        if (mounted) setErrorMsg(`Failed to load prompts: ${String(e?.message || e)}`);
      }

      // Load embedding models for clustering
      try {
        const embRes = await getEmbeddingModels();
        if (mounted) setEmbeddingModels(embRes.models || []);
        if (mounted && embRes.models && embRes.models.length > 0) setEmbeddingModel(embRes.models[0]);
      } catch (_) {
        // Ignore; keep default
      }
    })();
    return () => { mounted = false; };
  }, []);

  // When promptOptions load or selectedPrompt changes, prefill task description with default if supported and user hasn't edited.
  React.useEffect(() => {
    if (!selectedPromptMeta) return;
    // Persist selected prompt
    localStorage.setItem('stringsight.selectedPrompt', selectedPrompt);
    // If prompt supports task description
    if (selectedPromptMeta.has_task_description) {
      const defaultDesc = method === 'side_by_side' ? (selectedPromptMeta.default_task_description_sbs || '') : (selectedPromptMeta.default_task_description_single || '');
      if (!userEdited) {
        setTaskDescription(defaultDesc);
        localStorage.setItem('stringsight.taskDescription', defaultDesc);
        localStorage.setItem('stringsight.taskDescriptionEdited', 'false');
      }
    } else {
      // Clear task description for prompts that don't support it
      setTaskDescription('');
      localStorage.setItem('stringsight.taskDescription', '');
      localStorage.setItem('stringsight.taskDescriptionEdited', 'false');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPromptMeta?.name, selectedPromptMeta?.has_task_description]);

  // Resolve prompt text when selection changes
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const effectiveTaskDesc = canTaskDescribe && taskDescription.trim().length > 0 ? taskDescription : undefined;
        const methodParam = method === 'unknown' ? undefined : method;
        const res = await getPromptText(selectedPrompt, effectiveTaskDesc, methodParam);
        if (mounted) setResolvedPrompt(res.text);
      } catch (e: any) {
        if (mounted) {
          setResolvedPrompt('');
          setErrorMsg(`Failed to load prompt '${selectedPrompt}': ${String(e?.message || e)}`);
        }
      }
    })();
    return () => { mounted = false; };
  }, [selectedPrompt, canTaskDescribe, taskDescription, method]);

  // Highlight task description inside resolved prompt (visual only)
  const highlightedResolvedPrompt = React.useMemo(() => {
    const text = resolvedPrompt || '';
    const needle = canTaskDescribe && taskDescription.trim().length > 0 ? taskDescription.trim() : '';
    if (!needle) return [text];
    const parts = text.split(needle);
    const nodes: React.ReactNode[] = [];
    parts.forEach((part, idx) => {
      nodes.push(part);
      if (idx < parts.length - 1) {
        nodes.push(
          <span key={`hl-${idx}`} style={{ color: '#1D4ED8', fontWeight: 600 }}>{needle}</span>
        );
      }
    });
    return nodes;
  }, [resolvedPrompt, canTaskDescribe, taskDescription]);

  async function runExtractSingle() {
    const row = getSelectedRow();
    const methodValid = method === 'single_model' || method === 'side_by_side';
    if (!row || !methodValid) return;
    setBusy(true);
    setExtractionProgress(0);
    let progressInterval: NodeJS.Timeout | null = null;
    try {
      setErrorMsg(null);

      // Check if we're in demo mode early to avoid starting the interval unnecessarily
      const isDemoRow = isDemoMode;

      // Simulate progress during extraction (skip for demo mode - we'll handle it separately)
      if (!isDemoRow) {
        progressInterval = setInterval(() => {
          setExtractionProgress((prev) => {
            if (prev >= 90) return prev; // Don't go to 100% until done
            return prev + Math.random() * 15; // Increment by 0-15%
          });
        }, 300);
      }

      // Debug logging
      console.log('[PropertyExtraction] Extracting from row:', {
        hasRow: !!row,
        rowKeys: Object.keys(row),
        method,
        prompt: row.prompt ? 'present' : 'missing',
        model_response: row.model_response ? 'present' : 'missing',
        model: row.model ? 'present' : 'missing',
        model_a: row.model_a ? 'present' : 'missing',
        model_b: row.model_b ? 'present' : 'missing',
        question_id: row.question_id,
        __index: row.__index,
      });

      // Validate row has required fields
      const validation = validateRowForExtraction(row, method);
      if (!validation.valid) {
        console.error('[PropertyExtraction] Row validation failed:', validation.error);
        setErrorMsg(`Row validation failed: ${validation.error}`);
        return;
      }

      // Sanitize row to remove non-serializable data
      let sanitizedRow: Record<string, any>;
      try {
        sanitizedRow = sanitizeRowForSerialization(row);
      } catch (e: any) {
        console.error('[PropertyExtraction] Error sanitizing row:', e);
        setErrorMsg(`Failed to prepare row data: ${e?.message || 'Unknown serialization error'}`);
        return;
      }

      // Test JSON serialization before making the request
      try {
        const testBody = { row: sanitizedRow, method };
        JSON.stringify(testBody);
      } catch (e: any) {
        console.error('[PropertyExtraction] Error serializing request body:', e);
        setErrorMsg(`Failed to serialize request data: ${e?.message || 'JSON serialization error. Check for circular references or non-serializable data.'}`);
        return;
      }

      // Ensure question_id is set to __index if available, to avoid using prompt as ID
      // This matches the behavior in transformRowsForBackend and prevents long prompts from becoming IDs
      if (sanitizedRow.__index !== undefined) {
        sanitizedRow.question_id = String(sanitizedRow.__index);
      }

      const outputDir = generateOutputDir();
      const body: any = {
        row: sanitizedRow,
        method,
        system_prompt: selectedPrompt,
        task_description: canTaskDescribe && taskDescription.trim().length > 0 ? taskDescription : undefined,
        model_name: isDemoMode ? DEMO_MODE_SETTINGS.modelName : modelName,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        max_workers: maxWorkers,
        output_dir: outputDir,
      };

      console.log('[PropertyExtraction] Making API call with:', {
        method,
        system_prompt: selectedPrompt,
        model_name: body.model_name,
        hasRow: !!body.row,
        rowKeys: Object.keys(body.row),
        row_question_id: body.row?.question_id,
        row___index: body.row?.__index,
      });

      // DEMO MODE INTERCEPTION: Load cached properties for the selected row
      if (isDemoMode && (uploadedFileName === 'taubench_airline' || uploadedFileName === 'taubench_airline_sbs')) {
        const rowQuestionId = sanitizedRow.question_id;
        const rowIndex = sanitizedRow.__index;
        console.log('[PropertyExtraction] Demo mode: Loading cached properties for row', { question_id: rowQuestionId, __index: rowIndex });

        // Clear the progress interval that was started earlier
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }

        // Reset progress to 0 and wait a moment for state to update
        setExtractionProgress(0);
        await new Promise(r => setTimeout(r, 50));

        try {
          // Simulate brief loading (1 second)
          for (let i = 0; i <= 100; i += 10) {
            setExtractionProgress(i);
            await new Promise(r => setTimeout(r, 100));
          }

          const dataFolder = method === 'side_by_side' ? 'taubench_airline_data_sbs' : 'taubench_airline_data';
          const allProperties = await fetchJsonl(`/${dataFolder}/validated_properties.jsonl`);

          // Find properties for this specific row using question_id
          // Match by question_id string comparison (handles both string and number formats)
          // Also handle compound IDs (e.g. "0-0" matches "0")
          const rowProperties = allProperties.filter(p => {
            const propQid = String(p.question_id || '');
            const rowQid = String(rowQuestionId || '');

            // Exact match
            if (propQid === rowQid) return true;

            // Compound match (e.g. prop "0-0" matches row "0")
            if (propQid.startsWith(rowQid + '-')) return true;

            return false;
          });

          if (rowProperties.length === 0) {
            throw new Error(`No cached properties found for row with question_id: ${rowQuestionId}`);
          }

          console.log(`[PropertyExtraction] Loaded ${rowProperties.length} cached properties for row with question_id: ${rowQuestionId}`);

          setExtractionProgress(100);
          onPropertiesMerged(rowProperties);
          setLastExtractProps(rowProperties);

          // Mark tutorial step as completed (only for row 0, as the tutorial is specific to row 0)
          if ((rowQuestionId === '0-0' || rowIndex === 0) && tutorial && tutorial.activeTutorialId === 'demo-data' && tutorial.steps && tutorial.steps[tutorial.currentStepIndex]) {
            tutorial.markActionCompleted('demo-data', 'demo-step-3-extract-row-0');
            const step = tutorial.steps[tutorial.currentStepIndex];
            if (step.id === 'demo-step-3-extract-row-0') {
              tutorial.nextStep();
            }
          }

          // Scroll to properties table
          setTimeout(() => {
            if (onScrollToProperties) {
              onScrollToProperties();
            }
          }, 300);

          setBusy(false);
          setTimeout(() => setExtractionProgress(0), 1000);
          return;
        } catch (e: any) {
          console.error('[PropertyExtraction] Failed to load cached properties:', e);
          setErrorMsg(`Failed to load cached demo properties: ${e?.message || String(e)}`);
          setBusy(false);
          setExtractionProgress(0);
          return;
        }
      }

      // Check backend health before making the request
      const backendHealthy = await checkBackendHealth();
      if (!backendHealthy) {
        const apiBase = (import.meta as any).env?.VITE_BACKEND || (globalThis as any)?.VITE_BACKEND || "/api";
        const backendUrl = apiBase === "/api" ? "http://localhost:8000" : apiBase;
        setErrorMsg(
          `Backend is not reachable. ` +
          `\n\nFrontend API path: ${apiBase}/extract/single` +
          `\nBackend URL: ${backendUrl}` +
          `\n\nTroubleshooting steps:` +
          `\n1. Start the backend server:` +
          `\n   uvicorn stringsight.api:app --reload --host localhost --port 8000` +
          `\n2. Test backend health:` +
          `\n   curl http://localhost:8000/health` +
          `\n   (Should return: {"ok": true})` +
          `\n3. Check environment variable:` +
          `\n   VITE_BACKEND=${apiBase === "/api" ? "not set (using default /api proxy)" : apiBase}` +
          `\n4. Check browser console for detailed error messages` +
          `\n5. Ensure OpenAI API key is set: export OPENAI_API_KEY=your_key`
        );
        return;
      }

      const res = await extractSingle({ ...body, return_debug: true });
      if (progressInterval) clearInterval(progressInterval);
      setExtractionProgress(100);

      onPropertiesMerged(res.properties || []);
      setLastExtractProps(res.properties || []);

      // Mark the "Extract row 0" tutorial step as completed when a single-row extraction runs
      if (tutorial && tutorial.activeTutorialId === 'demo-data' && tutorial.steps && tutorial.steps[tutorial.currentStepIndex]) {
        tutorial.markActionCompleted('demo-data', 'demo-step-3-extract-row-0');
        const step = tutorial.steps[tutorial.currentStepIndex];
        if (step.id === 'demo-step-3-extract-row-0') {
          tutorial.nextStep();
        }
      }

      if ((res.failures || []).length > 0) {
        setErrorMsg(`Parsing issues detected (${res.failures.length}). Try a different prompt or check JSON format.`);
      }

      // Scroll to properties table after a short delay to ensure it's rendered
      setTimeout(() => {
        if (onScrollToProperties) {
          onScrollToProperties();
        }
      }, 300);
    } catch (e: any) {
      if (progressInterval) clearInterval(progressInterval);
      setExtractionProgress(0);
      console.error('[PropertyExtraction] Error in runExtractSingle:', e);
      const errorMessage = String(e?.message || e);

      // Provide more helpful error messages
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('Network request failed')) {
        const apiBase = (import.meta as any).env?.VITE_BACKEND || (globalThis as any)?.VITE_BACKEND || "/api";
        const backendUrl = apiBase === "/api" ? "http://localhost:8000" : apiBase;
        setErrorMsg(
          `Network error: Failed to connect to the backend.` +
          `\n\nFrontend API path: ${apiBase}/extract/single` +
          `\nBackend URL: ${backendUrl}` +
          `\n\nTroubleshooting steps:` +
          `\n1. Start the backend server:` +
          `\n   uvicorn stringsight.api:app --reload --host localhost --port 8000` +
          `\n2. Test backend health:` +
          `\n   curl http://localhost:8000/health` +
          `\n   (Should return: {"ok": true})` +
          `\n3. Check environment variable:` +
          `\n   VITE_BACKEND=${apiBase === "/api" ? "not set (using default /api proxy)" : apiBase}` +
          `\n4. Check browser console for detailed error messages` +
          `\n5. Ensure OpenAI API key is set: export OPENAI_API_KEY=your_key` +
          `\n\nNote: The Vite dev server proxies /api requests to the backend.` +
          `\nIf the backend is on a different host/port, set VITE_BACKEND in .env.local`
        );
      } else if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
        setErrorMsg(
          `JSON parsing error: ${errorMessage}\n` +
          'This may indicate:\n' +
          '1. The LLM returned invalid JSON\n' +
          '2. The system prompt needs adjustment\n' +
          '3. The input data format is incompatible'
        );
      } else {
        setErrorMsg(errorMessage);
      }
    } finally {
      setBusy(false);
      // Reset progress after a short delay
      setTimeout(() => setExtractionProgress(0), 1000);
    }
  }

  async function runExtractBatch() {
    console.log('[PropertyExtraction] runExtractBatch called');
    // Use filtered rows from the UI, but map back to operational rows to get the full structure (nested scores, etc.)
    const filteredRows = getAllRows();
    const allOperationalRows = getOperationalRows();
    const rows = filteredRows.map(r => {
      const idx = r.__index;
      return typeof idx === 'number' ? allOperationalRows[idx] : undefined;
    }).filter(Boolean);
    console.log('[PropertyExtraction] Rows retrieved:', rows?.length);

    const methodValid = method === 'single_model' || method === 'side_by_side';
    console.log('[PropertyExtraction] Method:', method, 'Valid:', methodValid);

    if (!rows || rows.length === 0) {
      console.error('[PropertyExtraction] No rows to extract!');
      return;
    }
    if (!methodValid) {
      console.error('[PropertyExtraction] Invalid method:', method);
      return;
    }

    // Collapse the control panel into an accordion when running on all traces.
    setPanelExpanded(false);

    // Close the trace viewer to focus on batch progress
    onCloseTrace?.();

    // DEMO MODE INTERCEPTION
    if (isDemoMode && (uploadedFileName === 'taubench_airline' || uploadedFileName === 'taubench_airline_sbs')) {
      setBusy(true);
      setCurrentStage('extraction');
      onBatchStart?.();
      setErrorMsg(null);
      setJobProgress(0);
      setJobState('processing');

      try {
        // Simulate progress (3 seconds)
        // 50 steps * 60ms = 3000ms
        // Simulate progress (3 seconds)
        // 50 steps * 60ms = 3000ms
        for (let i = 0; i <= 100; i += 2) {
          const progress = i / 100;
          setJobProgress(progress);
          onBatchStatus?.(progress, 'processing', 'extraction', 'Extracting properties (Demo Mode)...');
          await new Promise(r => setTimeout(r, 60));
        }

        const dataFolder = method === 'side_by_side' ? 'taubench_airline_data_sbs' : 'taubench_airline_data';
        const properties = await fetchJsonl(`/${dataFolder}/validated_properties.jsonl`);

        if (onBatchLoaded) {
          onBatchLoaded(properties);
        }

        setBusy(false);
        setCurrentStage(null);

        // Trigger clustering
        await runClusteringWithProperties(properties);

        onBatchDone?.();
      } catch (e) {
        console.error('Demo extraction failed:', e);
        setErrorMsg(`Demo extraction failed: ${String(e)}`);
        setBusy(false);
        setCurrentStage(null);
      }
      return;
    }

    setBusy(true);
    setCurrentStage('extraction');
    onBatchStart?.();

    try {
      setErrorMsg(null);
      setJobProgress(0);
      setJobState('queued');

      // STAGE 1: Extraction Job Only
      onBatchStatus?.(0, 'queued', 'extraction', 'Starting extraction job...');

      const outputDir = generateOutputDir();

      // Only send extraction parameters, NOT clustering parameters
      const extractBody = {
        rows,
        method,
        system_prompt: selectedPrompt,
        task_description: canTaskDescribe && taskDescription.trim().length > 0 ? taskDescription : undefined,
        model_name: isDemoMode ? DEMO_MODE_SETTINGS.modelName : modelName,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        max_workers: maxWorkers,
        sample_size: demoSampleSize || sampleSize || undefined,
        output_dir: outputDir,
        // Clustering params REMOVED - we will run clustering separately after extraction
      };

      // Use extractJobStart instead of pipelineJobStart
      const startRes = await extractJobStart(extractBody);
      setJobId(startRes.job_id);

      await new Promise<void>((resolve, reject) => {
        console.error('[PropertyExtraction] 🚀 STARTING POLLING LOOP for extraction job', startRes.job_id);
        const t = setInterval(async () => {
          try {
            const s = await extractJobStatus(startRes.job_id);
            console.error(`[PropertyExtraction] 🔄 Polling job ${startRes.job_id}: ${s.status} (${Math.round((s.progress || 0) * 100)}%)`);

            setJobState(s.status);
            setJobProgress(s.progress || 0);

            // Update status message based on progress
            let statusMsg = 'Extracting properties...';

            onBatchStatus?.(s.progress || 0, s.status, 'extraction', statusMsg);

            if (s.status === 'completed') {
              clearInterval(t);
              console.log('[PropertyExtraction] Extraction job completed! Fetching results...');

              // Load results from the extraction job
              const r = await extractJobResult(startRes.job_id);
              console.error('[PropertyExtraction] 📊 Job result path:', r.result_path);

              const extractedProperties = r.properties || [];
              console.log('[PropertyExtraction] 📦 Extracted properties:', extractedProperties.length);

              // Update properties table immediately!
              if (onBatchLoaded) {
                console.log('[PropertyExtraction] 📋 Calling onBatchLoaded with', extractedProperties.length, 'properties');
                onBatchLoaded(extractedProperties);
              }

              // Scroll to properties table
              setTimeout(() => {
                if (onScrollToProperties) {
                  onScrollToProperties();
                }
              }, 300);

              setBusy(false);
              setCurrentStage(null);

              // STAGE 2: Trigger clustering automatically
              console.log('[PropertyExtraction] 🚀 Triggering clustering with extracted properties...');
              await runClusteringWithProperties(extractedProperties);

              resolve();
            } else if (s.status === 'cancelled') {
              clearInterval(t);
              setErrorMsg(`Job cancelled.`);
              resolve();
            } else if (s.status === 'failed' || s.status === 'error') {
              clearInterval(t);
              reject(new Error(s.error_message || 'Job error'));
            }
          } catch (e) {
            clearInterval(t);
            reject(e);
          }
        }, 1000);
      });

      onBatchDone?.();
    } catch (error) {
      console.error('Batch extraction failed:', error);
      setErrorMsg(String(error));
      setBusy(false);
      setCurrentStage(null);
    }
  }

  async function handleCancelJob() {
    if (!jobId) return;
    try {
      await extractJobCancel(jobId);
      // Don't set state here - let the polling loop detect the cancelled state from the server
      // to avoid race conditions where local state is overwritten by the next poll
    } catch (e: any) {
      setErrorMsg(`Failed to cancel: ${String(e?.message || e)}`);
    }
  }

  async function runClusteringWithProperties(extractedProperties?: any[]) {
    const operationalRows = getOperationalRows();
    const properties = extractedProperties || getPropertiesRows();

    if (properties.length === 0) {
      console.warn('No properties available for clustering');
      return;
    }

    // Don't clear lastExtractProps - keep properties visible during clustering
    // setLastExtractProps([]);

    setClusteringBusy(true);
    setCurrentStage('clustering');

    // DEMO MODE INTERCEPTION
    if (isDemoMode && (uploadedFileName === 'taubench_airline' || uploadedFileName === 'taubench_airline_sbs')) {
      onBatchStatus?.(0, 'clustering', 'clustering', `Clustering ${properties.length} properties (Demo Mode)...`);

      try {
        // Simulate progress (3 seconds)
        // 50 steps * 60ms = 3000ms
        // Simulate progress (3 seconds)
        // 50 steps * 60ms = 3000ms
        for (let i = 0; i <= 100; i += 2) {
          const progress = i / 100;
          onBatchStatus?.(progress, 'clustering', 'clustering', `Clustering ${properties.length} properties (Demo Mode)...`);
          await new Promise(r => setTimeout(r, 60));
        }

        const dataFolder = method === 'side_by_side' ? 'taubench_airline_data_sbs' : 'taubench_airline_data';

        const [clusters, modelClusterScores, clusterScores, modelScores] = await Promise.all([
          fetchJsonl(`/${dataFolder}/clusters.jsonl`),
          fetchJsonl(`/${dataFolder}/model_cluster_scores_df.jsonl`),
          fetchJsonl(`/${dataFolder}/cluster_scores_df.jsonl`),
          fetchJsonl(`/${dataFolder}/model_scores_df.jsonl`)
        ]);

        const res = {
          clusters,
          metrics: {
            model_cluster_scores: modelClusterScores,
            cluster_scores: clusterScores,
            model_scores: modelScores
          }
        };

        if (onClustersUpdated) {
          onClustersUpdated(res);
        }

        // Send email if provided
        if (email) {
          try {
            onBatchStatus?.(0.9, 'clustering', 'clustering', `Sending email to ${email}...`);
            await sendDemoEmail({
              email: email,
              method: method === 'side_by_side' ? 'side_by_side' : 'single_model'
            });
            console.log('Demo email sent successfully');
          } catch (emailErr) {
            console.error('Failed to send demo email:', emailErr);
            // Don't fail the whole process if email fails
          }
        }

        onBatchStatus?.(1, 'done', 'clustering', 'Clustering complete');
      } catch (e) {
        console.error('Demo clustering failed:', e);
        setErrorMsg(`Demo clustering failed: ${String(e)}`);
        onBatchStatus?.(0, 'error', 'clustering', `Demo clustering failed: ${String(e)}`);
      } finally {
        setClusteringBusy(false);
        setCurrentStage(null);
      }
      return;
    }

    try {
      // Transform operationalRows to backend-expected format
      console.log('🔍 BEFORE TRANSFORM - Operational rows sample:', {
        method,
        totalRows: operationalRows.length,
        firstRowKeys: operationalRows[0] ? Object.keys(operationalRows[0]) : [],
        scoreField: operationalRows[0]?.score,
        scoreAField: operationalRows[0]?.score_a,
        scoreBField: operationalRows[0]?.score_b,
        hasScoreData: !!(operationalRows[0]?.score || operationalRows[0]?.score_a || operationalRows[0]?.score_b)
      });

      const transformedRows = transformRowsForBackend(operationalRows, method);

      console.log('🔍 Clustering:', properties.length, 'properties,', operationalRows.length, 'conversations');
      console.log('🔍 Properties model distribution:',
        properties.reduce((acc: any, p: any) => {
          const model = p.model || 'unknown';
          acc[model] = (acc[model] || 0) + 1;
          return acc;
        }, {})
      );

      // Determine which properties to cluster based on groupBy
      const propertiesToCluster = properties.map((prop: any) => {
        const groupKey = groupBy && groupBy !== 'none' ? prop[groupBy] : undefined;
        return groupKey ? `${groupKey}: ${prop.property_description || ''}` : prop.property_description || '';
      });

      onBatchStatus?.(0, 'clustering', 'clustering', `Clustering ${properties.length} properties...`);

      console.log('🔍 Operational row sample:', {
        method,
        originalScore: operationalRows[0]?.score || operationalRows[0]?.score_a,
        transformedScore: transformedRows[0]?.scores,
        transformedScoreKeys: transformedRows[0]?.scores ? Object.keys(transformedRows[0].scores) : 'no scores',
        transformedScoreValues: transformedRows[0]?.scores,
        allTransformedKeys: transformedRows[0] ? Object.keys(transformedRows[0]) : [],
        note: 'Scores are in nested dict format - backend will auto-detect metrics'
      });

      // For side-by-side: create model-to-column mapping so backend knows which score belongs to which model
      let modelColumnMap: Record<string, string> | undefined;
      if (method === 'side_by_side' && operationalRows[0]) {
        const firstRow = operationalRows[0];
        modelColumnMap = {};

        // Map actual model names to their column identifiers
        if (firstRow.model_a) {
          modelColumnMap[firstRow.model_a] = 'model_a';
        }
        if (firstRow.model_b) {
          modelColumnMap[firstRow.model_b] = 'model_b';
        }
      }

      const outputDir = generateOutputDir();

      const body = {
        operationalRows: transformedRows,
        properties,
        params: {
          minClusterSize,
          embeddingModel: isDemoMode ? DEMO_MODE_SETTINGS.embeddingModel : embeddingModel,
          groupBy: isDemoMode ? DEMO_MODE_SETTINGS.groupBy : groupBy,
          summarizationModel: isDemoMode ? DEMO_MODE_SETTINGS.summarizationModel : summarizationModel,
          matchingModel: isDemoMode ? DEMO_MODE_SETTINGS.matchingModel : matchingModel,
        },
        // score_columns omitted - scores are in nested 'scores' dict format
        // Backend should process ALL keys within the nested dict automatically
        method,
        model_column_map: modelColumnMap,
        output_dir: outputDir,
        sample_size: demoSampleSize || sampleSize || undefined,
        // Enable confidence intervals for metrics
        metrics_kwargs: {
          compute_confidence_intervals: true,
          bootstrap_samples: 100, // Default bootstrap samples
        },
      };

      // DEBUG: Log exact request payload
      console.log('🚀 CLUSTERING REQUEST PAYLOAD:', {
        operationalRowsCount: body.operationalRows.length,
        firstRow: body.operationalRows[0],
        firstRowScores: body.operationalRows[0]?.scores,
        scoresType: typeof body.operationalRows[0]?.scores,
        scoresKeys: body.operationalRows[0]?.scores && typeof body.operationalRows[0].scores === 'object'
          ? Object.keys(body.operationalRows[0].scores)
          : 'N/A',
        method: body.method,
        model_column_map: body.model_column_map,
        hasScoreColumns: !!(body as any).score_columns,
      });

      const res = await runClustering(body as any);

      // DEBUG: Log complete response
      console.log('📥 CLUSTERING RESPONSE:', {
        hasClusters: !!res?.clusters,
        clustersCount: res?.clusters?.length,
        hasMetrics: !!res?.metrics,
        hasModelScores: !!res?.metrics?.model_scores,
        hasModelClusterScores: !!res?.metrics?.model_cluster_scores,
      });

      // Log metrics if available
      if (res?.metrics?.model_scores) {
        console.log('🔵 Backend model_scores:', res.metrics.model_scores);
        console.log('🔍 model_scores quality check:',
          res.metrics.model_scores.map((s: any) => ({
            model: s.model,
            size: s.size,
            allKeys: Object.keys(s),
            qualityKeys: Object.keys(s).filter(k => k.startsWith('quality_')),
            qualitiesCount: Object.keys(s).filter(k => k.startsWith('quality_') && !k.includes('_ci_')).length
          }))
        );
      } else {
        console.warn('⚠️ No model_scores in clustering response!');
      }

      if (res?.metrics?.model_cluster_scores) {
        console.log('🔵 Backend model_cluster_scores sample:', res.metrics.model_cluster_scores[0]);
        console.log('🔍 model_cluster_scores keys:', Object.keys(res.metrics.model_cluster_scores[0] || {}));
        console.log('🔍 Quality columns in model_cluster_scores:',
          Object.keys(res.metrics.model_cluster_scores[0] || {}).filter(k => k.startsWith('quality_'))
        );
      }

      if (!res) {
        throw new Error('Clustering API returned undefined response');
      }

      if (onClustersUpdated) {
        onClustersUpdated(res);
      }


      // Don't navigate automatically - stay in extraction step
      // User will see banner and can navigate manually

      onBatchStatus?.(1, 'done', 'clustering', 'Clustering complete');
    } catch (error) {
      console.error('Clustering failed:', error);
      const errorMessage = String(error);
      // Provide more helpful messages for network/timeout errors
      let userMessage = errorMessage;
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('timeout')) {
        userMessage = 'Network timeout: The clustering request timed out, but the backend may still be processing. ' +
          'Please wait a few minutes and check if results were saved. If you specified an output directory, ' +
          'you can try reloading the results from that location.';
      }
      setErrorMsg(`Clustering failed: ${userMessage}`);
      onBatchStatus?.(0, 'error', 'clustering', `Clustering failed: ${userMessage}`);
    } finally {
      setClusteringBusy(false);
      setCurrentStage(null);
    }
  }

  const methodValid = method === 'single_model' || method === 'side_by_side';

  return (
    <Stack spacing={1}>
      <Accordion
        expanded={panelExpanded}
        onChange={(_, expanded) => setPanelExpanded(expanded)}
        disableGutters
        sx={{
          mb: 1,
          borderRadius: 1,
          '&:before': { display: 'none' },
          ...(isResultsMode && {
            opacity: 0.6,
            bgcolor: '#F9FAFB',
          }),
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{ color: 'white' }} />}
          sx={{
            minHeight: 'auto',
            backgroundColor: 'primary.main',
            color: 'white',
            '& .MuiAccordionSummary-content': { margin: '8px 0' },
            '&:hover': { backgroundColor: 'primary.dark' }
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'white' }}>
            Property extraction controls
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {/* Results mode banner */}
          {isResultsMode && (
            <Box sx={{ mb: 2, bgcolor: '#F97316', color: '#FFFFFF', px: 2, py: 1.25, borderRadius: 1, boxShadow: 1, border: '1px solid #EA580C', textAlign: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Extraction disabled in results mode. Upload raw data to enable extraction.
              </Typography>
            </Box>
          )}

          {/* <Typography variant="body2" sx={{ color: 'primary.main', mb: 1, textAlign: 'center', fontWeight: 500 }}>
            Label interesting behaviors from your traces. Click 'Label Trace at Row 0' to see an example.
          </Typography> */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Extraction Prompt
            </Typography>
            <Stack spacing={2} data-tutorial-id="extract-properties-trace">
              <Autocomplete
                size="small"
                options={promptOptions.map(p => p.name)}
                value={selectedPrompt}
                getOptionLabel={(option) => getPromptDisplayLabel(option)}
                onChange={(_, v) => {
                  if (v) {
                    setSelectedPrompt(v);
                    localStorage.setItem('stringsight.selectedPrompt', v);
                    // Reset edited flag on prompt change
                    setUserEdited(false);
                    localStorage.setItem('stringsight.taskDescriptionEdited', 'false');
                  }
                }}
                renderInput={(params) => <TextField {...params} label="Task Type" />}
              />

              {/* <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {promptOptions.length} prompts available
              </Typography> */}

              {canTaskDescribe && (
                <Stack spacing={1}>
                  <TextField
                    label="Task description"
                    value={taskDescription}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTaskDescription(val);
                      setUserEdited(true);
                      localStorage.setItem('stringsight.taskDescription', val);
                      localStorage.setItem('stringsight.taskDescriptionEdited', 'true');
                    }}
                    minRows={4}
                    maxRows={9}
                    multiline
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 0.5, ml: -1 }}>
                          <IconButton
                            size="small"
                            onClick={() => setTaskDescFullscreen(true)}
                            edge="end"
                            title="Expand to full screen"
                            sx={{ p: 0.5 }}
                          >
                            <FullscreenIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiInputBase-root': {
                        overflow: 'auto',
                        fontSize: '0.9rem',
                      },
                      '& .MuiInputLabel-root': {
                        backgroundColor: 'background.paper',
                        px: 0.5,
                      }
                    }}
                  />
                  <Box>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => {
                        const def = method === 'side_by_side' ? (selectedPromptMeta?.default_task_description_sbs || '') : (selectedPromptMeta?.default_task_description_single || '');
                        setTaskDescription(def);
                        setUserEdited(false);
                        localStorage.setItem('stringsight.taskDescription', def);
                        localStorage.setItem('stringsight.taskDescriptionEdited', 'false');
                      }}
                    >
                      Reset to default
                    </Button>
                  </Box>
                </Stack>
              )}

              {/* Resolved system prompt moved to Advanced settings below */}
            </Stack>
          </Box>

          {/* Advanced Settings Section */}
          <Box sx={{ mt: 3 }}>
            <Accordion>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: 'auto', py: 0.25, '& .MuiAccordionSummary-content': { margin: '4px 0' } }}
              >
                <Typography variant="subtitle2">Advanced settings</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {/* LLM Settings Section */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      LLM Settings
                    </Typography>
                    <Stack spacing={1.5}>
                      <TextField
                        size="small"
                        label="Property Annotator"
                        value={isDemoMode ? DEMO_MODE_SETTINGS.modelName : modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        disabled={isDemoMode}
                        helperText={isDemoMode ? 'Fixed in demo mode' : undefined}
                      />
                      <TextField
                        size="small"
                        label="Sample size"
                        type="number"
                        value={sampleSize || ''}
                        onChange={(e) => setSampleSize(e.target.value ? Number(e.target.value) : null)}
                        placeholder="Leave empty for all prompts"
                        helperText={sampleSize ? `Will sample ${sampleSize} prompts total` : 'Process all prompts'}
                      />
                      <TextField
                        size="small"
                        label="Results folder name"
                        value={resultsNameProp || ''}
                        onChange={(e) => onResultsNameChange?.(e.target.value)}
                        placeholder="Auto-generated from filename"
                        helperText={resultsNameProp ? `Results will be saved to: ${resultsNameProp}_[timestamp]` : 'Defaults to uploaded filename'}
                      />
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2">Full system prompt</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{
                            p: 2,
                            border: '1px dashed',
                            borderColor: 'divider',
                            borderRadius: 1,
                            backgroundColor: 'background.default'
                          }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Resolved system prompt {canTaskDescribe ? '(task description highlighted in blue)' : ''}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => setPromptFullscreen(true)}
                                sx={{ ml: 1 }}
                                title="Expand to full screen"
                              >
                                <FullscreenIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <Box sx={{
                              p: 1.5,
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              backgroundColor: '#FFFFFF',
                              maxHeight: 280,
                              overflow: 'auto',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
                              fontSize: 12,
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.6,
                            }}>
                              {resolvedPrompt ? highlightedResolvedPrompt : 'Loading prompt…'}
                            </Box>
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    </Stack>
                  </Box>

                  {/* Clustering Settings Section */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      Clustering Settings
                    </Typography>
                    <Stack spacing={1.5}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        After extraction, properties will be automatically clustered and metrics computed.
                      </Typography>

                      <TextField
                        size="small"
                        label="Min cluster size"
                        type="number"
                        value={minClusterSize}
                        onChange={(e) => setMinClusterSize(Number(e.target.value))}
                        inputProps={{ min: 1, max: 100 }}
                        helperText="Minimum number of properties required to form a cluster"
                      />

                      <FormControl size="small" disabled={isDemoMode}>
                        <InputLabel id="embedding-model-label">Embedding model</InputLabel>
                        <Select
                          labelId="embedding-model-label"
                          value={isDemoMode ? DEMO_MODE_SETTINGS.embeddingModel : embeddingModel}
                          label="Embedding model"
                          onChange={(e) => setEmbeddingModel(String(e.target.value))}
                        >
                          {(embeddingModels.length ? embeddingModels : [embeddingModel]).map(m => (
                            <MenuItem key={m} value={m}>{m}</MenuItem>
                          ))}
                        </Select>
                        {isDemoMode && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
                            Fixed in demo mode
                          </Typography>
                        )}
                      </FormControl>

                      <FormControl size="small" disabled={isDemoMode}>
                        <InputLabel id="group-by-label">Group by</InputLabel>
                        <Select
                          labelId="group-by-label"
                          value={isDemoMode ? DEMO_MODE_SETTINGS.groupBy : groupBy}
                          label="Group by"
                          onChange={(e) => setGroupBy(e.target.value as any)}
                        >
                          <MenuItem value={'none'}>None</MenuItem>
                          <MenuItem value={'category'}>category</MenuItem>
                          <MenuItem value={'behavior_type'}>behavior_type</MenuItem>
                        </Select>
                        {isDemoMode && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
                            Fixed in demo mode
                          </Typography>
                        )}
                      </FormControl>

                      <TextField
                        size="small"
                        label="Summarization model"
                        value={isDemoMode ? DEMO_MODE_SETTINGS.summarizationModel : summarizationModel}
                        onChange={(e) => setSummarizationModel(e.target.value)}
                        disabled={isDemoMode}
                        helperText={isDemoMode ? 'Fixed in demo mode' : 'Model used for cluster label summarization'}
                      />

                      <TextField
                        size="small"
                        label="Matching model"
                        value={isDemoMode ? DEMO_MODE_SETTINGS.matchingModel : matchingModel}
                        onChange={(e) => setMatchingModel(e.target.value)}
                        disabled={isDemoMode}
                        helperText={isDemoMode ? 'Fixed in demo mode' : 'Model used for cluster/property matching'}
                      />
                    </Stack>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Box>

          {/* Email Notification */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Notifications
            </Typography>
            <TextField
              size="small"
              label="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email for job completion notification"
              fullWidth
              helperText="Receive an email with results when the job completes"
            />
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', mt: 3 }}>
            {busy && (
              <Box sx={{ width: '100%', mb: 1 }}>
                <LinearProgress
                  variant={extractionProgress > 0 ? "determinate" : "indeterminate"}
                  value={extractionProgress}
                  sx={{ height: 6, borderRadius: 1 }}
                />
                <Typography variant="caption" sx={{ mt: 0.5, display: 'block', textAlign: 'center', color: 'text.secondary' }}>
                  {extractionProgress > 0
                    ? `Extracting properties... ${Math.round(extractionProgress)}%`
                    : 'Extracting properties...'}
                </Typography>
              </Box>
            )}
            <Button
              variant="outlined"
              onClick={runExtractSingle}
              disabled={busy || clusteringBusy || !methodValid || !getSelectedRow()}
              sx={{ width: '100%' }}
              data-tutorial-id="extract-row-0"
            >
              {(() => {
                const row = getSelectedRow();
                if (!row) return 'Label Trace at Selected Row';
                const index = (row as any)?.__index;
                return index !== undefined ? `Label Trace at Row ${index}` : 'Label Trace at Selected Row';
              })()}
            </Button>
            <Button
              variant="contained"
              onClick={runExtractBatch}
              disabled={busy || clusteringBusy || !methodValid}
              sx={{ width: '100%' }}
              data-tutorial-id="extract-all-rows"
            >
              {sampleSize && sampleSize > 0
                ? `Label and Cluster Sample (${sampleSize} traces)`
                : `Label and Cluster All Traces (${getAllRows().length})`}
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>

      {errorMsg && (
        <Box sx={{
          p: 2,
          border: '1px solid',
          borderColor: 'error.main',
          backgroundColor: 'error.light',
          color: 'error.contrastText',
          borderRadius: 1
        }}>
          <Typography variant="body2">{errorMsg}</Typography>
        </Box>
      )}



      {/* Full-screen prompt dialog */}
      <Dialog
        open={promptFullscreen}
        onClose={() => setPromptFullscreen(false)}
        maxWidth={false}
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            width: '95vw',
            height: '95vh',
            maxWidth: '95vw',
            maxHeight: '95vh',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6">Full System Prompt</Typography>
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => setPromptFullscreen(false)}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Resolved system prompt {canTaskDescribe ? '(task description highlighted in blue)' : ''}
            </Typography>
          </Box>
          <Box sx={{
            p: 3,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            backgroundColor: '#FFFFFF',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
            fontSize: 14,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.8,
            minHeight: '100%',
          }}>
            {resolvedPrompt ? highlightedResolvedPrompt : 'Loading prompt…'}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromptFullscreen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Full-screen task description dialog */}
      <Dialog
        open={taskDescFullscreen}
        onClose={() => setTaskDescFullscreen(false)}
        maxWidth={false}
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            width: '95vw',
            height: '95vh',
            maxWidth: '95vw',
            maxHeight: '95vh',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6">Task Description</Typography>
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => setTaskDescFullscreen(false)}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Edit your task description for the extraction prompt
            </Typography>
          </Box>
          <TextField
            value={taskDescription}
            onChange={(e) => {
              const val = e.target.value;
              setTaskDescription(val);
              setUserEdited(true);
              localStorage.setItem('stringsight.taskDescription', val);
              localStorage.setItem('stringsight.taskDescriptionEdited', 'true');
            }}
            multiline
            fullWidth
            variant="outlined"
            autoFocus
            sx={{
              '& .MuiInputBase-root': {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
                fontSize: 14,
                lineHeight: 1.8,
                minHeight: '70vh',
                alignItems: 'flex-start',
              },
              '& .MuiInputBase-input': {
                minHeight: '70vh !important',
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          <Button
            onClick={() => {
              const def = method === 'side_by_side' ? (selectedPromptMeta?.default_task_description_sbs || '') : (selectedPromptMeta?.default_task_description_single || '');
              setTaskDescription(def);
              setUserEdited(false);
              localStorage.setItem('stringsight.taskDescription', def);
              localStorage.setItem('stringsight.taskDescriptionEdited', 'false');
            }}
          >
            Reset to default
          </Button>
          <Button onClick={() => setTaskDescFullscreen(false)} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

