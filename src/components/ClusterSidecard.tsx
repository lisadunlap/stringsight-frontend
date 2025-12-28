import React, { useState, useMemo, useRef } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Stack,
  Divider,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
const Plot = createPlotlyComponent(Plotly);
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import ConversationTrace from './ConversationTrace';
import SideBySideTrace from './SideBySideTrace';
import PropertyTraceHeader from './PropertyTraceHeader';
import { ensureOpenAIFormat } from '../lib/traces';
import html2pdf from 'html2pdf.js';
import { generatePdfFilename } from '../lib/utils';
import { retroColors } from '../theme';

interface ClusterSidecardProps {
  open: boolean;
  onClose: () => void;
  cluster: any | null;
  method: 'single_model' | 'side_by_side' | 'unknown';
  decimals?: number;

  // Data access functions
  getPropertiesRows?: () => any[];
  getOperationalRows?: () => any[];

  // Model cluster scores for enrichment
  modelClusterScores?: any[];
  totalUniqueConversations?: number | null;

  // Show confidence intervals
  showCI?: boolean;

  // Show significance tags
  showSignificance?: boolean;
}

function formatPercent(p?: number): string {
  if (typeof p !== 'number' || !isFinite(p)) return '';
  return `${(p * 100).toFixed(1)}%`;
}

export default function ClusterSidecard({
  open,
  onClose,
  cluster,
  method,
  decimals = 3,
  getPropertiesRows,
  getOperationalRows,
  modelClusterScores,
  totalUniqueConversations,
  showCI = false,
  showSignificance = false,
}: ClusterSidecardProps) {
  const [viewMode, setViewMode] = useState<'cluster-details' | 'property-trace'>('cluster-details');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  // PDF print setup - must be at top level (Rules of Hooks)
  const propertyTracePrintRef = useRef<HTMLDivElement>(null);
  const currentPromptTextRef = useRef<string>('');

  const handlePropertyTracePrint = () => {
    if (!propertyTracePrintRef.current) return;

    const filename = currentPromptTextRef.current ? generatePdfFilename(currentPromptTextRef.current) : 'property_trace.pdf';

    const opt = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(propertyTracePrintRef.current).save();
  };

  // Reset to cluster details view when cluster changes or drawer closes
  React.useEffect(() => {
    if (!open || !cluster) {
      setViewMode('cluster-details');
      setSelectedPropertyId(null);
    }
  }, [open, cluster]);

  // Enrich cluster with model cluster scores data (same logic as ClustersTab)
  const enrichedCluster = React.useMemo(() => {
    if (!cluster || !modelClusterScores || modelClusterScores.length === 0) {
      return cluster;
    }

    const clusterLabel = cluster.label || cluster.cluster_label || String(cluster.id);

    // Find all metrics rows for this cluster
    const clusterMetrics = modelClusterScores.filter((m: any) =>
      m.cluster === clusterLabel || String(m.cluster_id) === String(cluster.id)
    );

    if (clusterMetrics.length === 0) {
      return cluster;
    }

    // Build proportion_by_model, quality_by_model, and quality_delta_by_model
    const proportionByModel: Record<string, number> = {};
    const proportionCIByModel: Record<string, { lower: number; upper: number }> = {};
    const qualityByModel: Record<string, any> = {};
    const qualityDeltaByModel: Record<string, any> = {};
    const qualityDeltaCIByModel: Record<string, Record<string, { lower: number; upper: number }>> = {};
    const proportionDeltaSignificantByModel: Record<string, boolean> = {};
    const qualityDeltaSignificantByModel: Record<string, Record<string, boolean>> = {};
    let proportionOverall: number | undefined = undefined;

    clusterMetrics.forEach((m: any) => {
      const model = m.model;
      if (model) {
        proportionByModel[model] = m.proportion;

        // Capture proportion confidence intervals
        if (m.proportion_ci_lower !== undefined && m.proportion_ci_upper !== undefined) {
          proportionCIByModel[model] = {
            lower: m.proportion_ci_lower,
            upper: m.proportion_ci_upper
          };
        }

        // Capture overall proportion if available
        if (m.proportion_overall !== undefined && proportionOverall === undefined) {
          proportionOverall = m.proportion_overall;
        }

        // Capture proportion delta significance
        if (m.proportion_delta_significant !== undefined) {
          proportionDeltaSignificantByModel[model] = m.proportion_delta_significant;
        }

        // Extract quality scores and deltas
        const qualityScores: Record<string, number> = {};
        const qualityDeltas: Record<string, number> = {};
        const qualityDeltaCIs: Record<string, { lower: number; upper: number }> = {};
        const qualityDeltaSignificant: Record<string, boolean> = {};

        Object.keys(m).forEach(key => {
          if (key.startsWith('quality_delta_')) {
            const metricName = key.replace('quality_delta_', '');
            if (key.endsWith('_significant')) {
              const metricNameClean = metricName.replace('_significant', '');
              qualityDeltaSignificant[metricNameClean] = m[key];
            } else if (!key.includes('_ci_') && !key.includes('_significant')) {
              qualityDeltas[metricName] = m[key];

              // Check for CI bounds
              const ciLowerKey = `quality_delta_${metricName}_ci_lower`;
              const ciUpperKey = `quality_delta_${metricName}_ci_upper`;
              if (m[ciLowerKey] !== undefined && m[ciUpperKey] !== undefined) {
                qualityDeltaCIs[metricName] = {
                  lower: m[ciLowerKey],
                  upper: m[ciUpperKey]
                };
              }
            }
          } else if (key.startsWith('quality_')) {
            if (key.endsWith('_delta')) {
              const metricName = key.replace('quality_', '').replace('_delta', '');
              qualityDeltas[metricName] = m[key];
            } else if (!key.includes('_ci_') && !key.includes('_significant')) {
              const metricName = key.replace('quality_', '');
              qualityScores[metricName] = m[key];
            }
          }
        });

        qualityByModel[model] = qualityScores;
        qualityDeltaByModel[model] = qualityDeltas;
        if (Object.keys(qualityDeltaCIs).length > 0) {
          qualityDeltaCIByModel[model] = qualityDeltaCIs;
        }
        if (Object.keys(qualityDeltaSignificant).length > 0) {
          qualityDeltaSignificantByModel[model] = qualityDeltaSignificant;
        }
      }
    });

    // Calculate unique conversation count from proportion_overall * totalUniqueConversations
    const clusterConversationCount = (proportionOverall !== undefined && totalUniqueConversations)
      ? Math.round(proportionOverall * totalUniqueConversations)
      : cluster.meta?.total_unique_conversations;

    return {
      ...cluster,
      meta: {
        ...cluster.meta,
        proportion_by_model: proportionByModel,
        proportion_ci_by_model: proportionCIByModel,
        proportion_delta_significant_by_model: proportionDeltaSignificantByModel,
        quality_by_model: qualityByModel,
        quality_delta_by_model: qualityDeltaByModel,
        quality_delta_ci_by_model: qualityDeltaCIByModel,
        quality_delta_significant_by_model: qualityDeltaSignificantByModel,
        total_unique_conversations: clusterConversationCount,
        proportion_overall: proportionOverall ?? cluster.meta?.proportion_overall
      }
    };
  }, [cluster, modelClusterScores, totalUniqueConversations]);

  // Build properties and operational rows maps
  const propertiesById = useMemo(() => {
    const map = new Map<string, any>();
    const props = typeof getPropertiesRows === 'function' ? getPropertiesRows() : [];
    (props || []).forEach((p: any) => {
      const id = p?.id != null ? String(p.id) : null;
      if (id) map.set(id, p);
    });
    return map;
  }, [getPropertiesRows]);

  const operationalRows = useMemo(() => {
    return typeof getOperationalRows === 'function' ? getOperationalRows() : [];
  }, [getOperationalRows]);

  // Create consistent model color mapping - must be before any conditional returns
  const modelColors = useMemo(() => {
    if (!enrichedCluster || !enrichedCluster.meta) return {};

    const meta = enrichedCluster.meta || {};
    const perModelProps = meta.proportion_by_model || {};
    const qualityDeltaByModel = meta.quality_delta_by_model || {};

    const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6'];
    const models = Array.from(new Set([
      ...Object.keys(perModelProps),
      ...Object.keys(qualityDeltaByModel)
    ])).sort();

    const colorMap: Record<string, string> = {};
    models.forEach((model, idx) => {
      colorMap[model] = palette[idx % palette.length];
    });
    return colorMap;
  }, [enrichedCluster]);

  if (!enrichedCluster) return null;

  const meta = (enrichedCluster && enrichedCluster.meta) || {};
  const overallQuality: Record<string, number> = meta.quality || {};
  const overallQualityDelta: Record<string, number> = meta.quality_delta || {};
  const overallProp: number | undefined = meta.proportion_overall;
  const group: string | undefined = meta.group;
  const perModelProps: Record<string, number> = meta.proportion_by_model || {};
  const proportionCIByModel: Record<string, { lower: number; upper: number }> = meta.proportion_ci_by_model || {};
  const proportionDeltaSignificantByModel: Record<string, boolean> = meta.proportion_delta_significant_by_model || {};
  const qualityDeltaByModel: Record<string, Record<string, number>> = meta.quality_delta_by_model || {};
  const qualityDeltaCIByModel: Record<string, Record<string, { lower: number; upper: number }>> = meta.quality_delta_ci_by_model || {};
  const qualityDeltaSignificantByModel: Record<string, Record<string, boolean>> = meta.quality_delta_significant_by_model || {};
  const clusterUniqueConversations: number | undefined = meta.total_unique_conversations;

  // Compute overall significance flags
  const isSignificantInFrequency = Object.values(proportionDeltaSignificantByModel).some(v => v === true);
  const isSignificantInQuality = Object.values(qualityDeltaSignificantByModel).some(metrics =>
    Object.values(metrics).some(v => v === true)
  );

  console.log('[ClusterSidecard] Enriched cluster meta:', meta);
  console.log('[ClusterSidecard] qualityDeltaByModel:', qualityDeltaByModel);
  console.log('[ClusterSidecard] qualityDeltaByModel keys:', Object.keys(qualityDeltaByModel));
  console.log('[ClusterSidecard] qualityDeltaCIByModel:', qualityDeltaCIByModel);
  console.log('[ClusterSidecard] Significance flags:', {
    isSignificantInFrequency,
    isSignificantInQuality,
    proportionDeltaSignificantByModel,
    qualityDeltaSignificantByModel
  });

  // Property trace view logic
  if (viewMode === 'property-trace' && selectedPropertyId) {
    const prop = propertiesById.get(selectedPropertyId);
    if (!prop) {
      // Property not found, return to cluster details
      setViewMode('cluster-details');
      setSelectedPropertyId(null);
      return null;
    }

    // Find the corresponding row in operationalRows
    const idx = (prop as any).__index ?? (prop as any).row_index;
    let row: any | null = null;
    if (idx != null) {
      row = operationalRows.find(r => Number(r?.__index) === Number(idx)) || null;
    }
    if (!row) {
      const qid = (prop as any).question_id;
      const modelName = String((prop as any).model || '').trim();
      row = operationalRows.find(r => {
        // Normalize question_id comparison (handle string vs number)
        const rq = r?.question_id;
        const qidMatch = String(rq) === String(qid) || Number(rq) === Number(qid);
        if (!qidMatch) return false;

        if (method === 'single_model') {
          const rModel = String(r?.model || '').trim();
          return rModel === modelName;
        } else if (method === 'side_by_side') {
          // For side-by-side, just match question_id - the row contains both models
          // We'll determine which model's response to show later based on the property's model
          return true;
        }
        return false;
      }) || null;
    }

    // Process evidence
    const rawEvidence = (prop as any).evidence;
    let ev: string[] = [];
    if (Array.isArray(rawEvidence)) {
      ev = rawEvidence;
    } else if (rawEvidence && typeof rawEvidence === 'string') {
      const trimmed = rawEvidence.trim();
      // Split on quote/comma patterns: ", " between double-quoted items
      const parts = trimmed.split(/"\s*,\s*"|\n|,\s(?=[\w\d])/g).map(s => s.replace(/^"|"$/g, '').trim());
      ev = parts.filter(Boolean);
    } else if (rawEvidence) {
      ev = [String(rawEvidence)];
    }

    // Build trace
    let messages: any[] = [];
    let messagesA: any[] = [];
    let messagesB: any[] = [];
    let modelName: string | undefined;
    let modelA: string | undefined;
    let modelB: string | undefined;
    let score: Record<string, any> | undefined;
    let scoreA: Record<string, any> | undefined;
    let scoreB: Record<string, any> | undefined;
    let promptText: string | undefined;
    let isSideBySide = false;

    if (row) {
      promptText = String(row?.["prompt"] ?? "");
      if (method === 'single_model') {
        messages = ensureOpenAIFormat(promptText, row?.["model_response"]);
        modelName = String(row?.["model"] ?? "");
        score = row?.["score"];
      } else if (method === 'side_by_side') {
        // For side-by-side, show both models side-by-side
        isSideBySide = true;
        modelA = String(row?.["model_a"] || '').trim() || "Model A";
        modelB = String(row?.["model_b"] || '').trim() || "Model B";
        messagesA = ensureOpenAIFormat(promptText, row?.["model_a_response"]);
        messagesB = ensureOpenAIFormat(promptText, row?.["model_b_response"]);
        scoreA = row?.["score_a"];
        scoreB = row?.["score_b"];
      }
    }

    // Update current prompt text for PDF filename
    currentPromptTextRef.current = promptText || '';

    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: '60%',
            minWidth: 600,
            maxWidth: 1000,
          },
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header - Back, Download, Close */}
          <Box sx={{ p: 2, borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={() => {
                setViewMode('cluster-details');
                setSelectedPropertyId(null);
              }} size="small">
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="body2">Back to Cluster</Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handlePropertyTracePrint}
                sx={{ textTransform: 'none' }}
              >
                Download PDF
              </Button>
              <IconButton onClick={onClose} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 0 }}>
            <Box ref={propertyTracePrintRef}>
              <PropertyTraceHeader
                selectedRow={row}
                selectedProperty={prop}
                method={method}
                evidenceTargetModel={(prop as any).model}
                disableNegativeMargin={true}
              />
              <Box sx={{ p: 2 }}>

                {isSideBySide && messagesA.length > 0 && messagesB.length > 0 ? (
                  <SideBySideTrace
                    messagesA={messagesA}
                    messagesB={messagesB}
                    modelA={modelA || "Model A"}
                    modelB={modelB || "Model B"}
                    highlights={ev}
                    targetModel={(prop as any).model}
                    rawResponseA={row?.["model_a_response"]}
                    rawResponseB={row?.["model_b_response"]}
                    scoreA={scoreA}
                    scoreB={scoreB}
                  />
                ) : messages.length > 0 ? (
                  <ConversationTrace
                    messages={messages}
                    highlights={ev}
                    modelName={modelName}
                    score={score}
                    promptText={promptText}
                    hideDownloadButton={true}
                  />
                ) : (
                  <Box sx={{ p: 3, border: '1px dashed #E5E7EB', borderRadius: 1, background: '#FAFAFA' }}>
                    <Typography variant="body2" color="text.secondary">
                      Conversation not available for this property.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Drawer>
    );
  }

  // Cluster details view
  const hasItems = Array.isArray((enrichedCluster.meta && (enrichedCluster.meta as any).property_items)) && (enrichedCluster.meta as any).property_items.length > 0;
  const items: any[] = hasItems ? (enrichedCluster.meta as any).property_items : [];
  const descriptions: string[] = Array.isArray(enrichedCluster.property_descriptions) ? enrichedCluster.property_descriptions : [];
  const ids: any[] = Array.isArray((enrichedCluster as any).property_ids) ? (enrichedCluster as any).property_ids : [];

  // Build property list with model names
  const propertyList = hasItems
    ? items.map((item: any) => ({
      id: item.property_id,
      description: item.property_description || '',
      model: item.model || '',
    }))
    : descriptions.map((pd, i) => {
      const pid = ids[i] != null ? String(ids[i]) : undefined;
      const prop = pid ? propertiesById.get(String(pid)) : null;
      const modelName = prop?.model != null ? String(prop.model) : null;
      return {
        id: pid,
        description: pd,
        model: modelName,
      };
    });

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: '60%',
          minWidth: 600,
          maxWidth: 1000,
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {(() => {
            // Determine bubble color based on group
            let bgColor = 'rgba(233, 213, 255, 0.1)'; // default light purple
            let textColor = '#581C87'; // darker purple

            if (group) {
              const groupLower = group.toLowerCase();
              if (groupLower === 'positive') {
                bgColor = 'rgba(34, 197, 94, 0.1)'; // light green
                textColor = '#14532D'; // darker green
              } else if (groupLower === 'negative (critical)') {
                bgColor = 'rgba(239, 68, 68, 0.1)'; // light red
                textColor = '#991B1B'; // darker red
              } else if (groupLower === 'negative (non-critical)') {
                bgColor = 'rgba(245, 158, 11, 0.1)'; // light orange
                textColor = '#9A3412'; // darker orange
              } else if (groupLower === 'style') {
                bgColor = 'rgba(156, 39, 176, 0.1)'; // light purple
                textColor = '#6B21A8'; // darker purple
              }
            }

            return (
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  backgroundColor: bgColor,
                  color: textColor,
                  fontSize: '0.75rem',
                  '& p': { margin: '4px 0' },
                  '& code': { backgroundColor: 'rgba(0, 0, 0, 0.1)', padding: '2px 4px', borderRadius: '4px', fontSize: '0.9em' },
                  '& pre': { backgroundColor: 'rgba(0, 0, 0, 0.1)', padding: '8px', borderRadius: '4px', overflow: 'auto' },
                  '& h1, & h2, & h3, & h4, & h5, & h6': { margin: '8px 0 4px 0', fontWeight: 600 },
                  '& ul, & ol': { margin: '4px 0', paddingLeft: '20px' },
                  '& blockquote': { borderLeft: '3px solid rgba(0, 0, 0, 0.2)', paddingLeft: '12px', margin: '4px 0' },
                  '& .katex': { fontSize: '1em' },
                  '& .katex-display': { margin: '8px 0' },
                }}
              >
                <Typography component="div" sx={{ color: textColor, fontSize: '0.9rem' }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      a: ({ href, children, ...props }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: textColor }} {...props}>
                          {children}
                        </a>
                      ),
                      p: ({ children }) => <span>{children}</span>,
                    }}
                  >
                    {String(enrichedCluster.label || '')}
                  </ReactMarkdown>
                </Typography>
              </Box>
            );
          })()}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {/* Cluster metadata */}
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
              <Tooltip title="Number of unique conversations in this cluster and their percentage of total conversations">
                <Box sx={{ color: '#6B7280', fontSize: 14 }}>
                  {(() => {
                    if (clusterUniqueConversations !== undefined && clusterUniqueConversations > 0) {
                      const propText = overallProp !== undefined ? ` (${formatPercent(overallProp)})` : '';
                      return `${clusterUniqueConversations.toLocaleString()} conversations${propText}`;
                    }
                    const clusterSize = enrichedCluster.size ?? 0;
                    return `${clusterSize.toLocaleString()} properties`;
                  })()}
                </Box>
              </Tooltip>
              {group && (() => {
                // Determine chip color based on group name using retro palette
                let bgColor = `${retroColors.blue}15`;
                let textColor = retroColors.blue;

                const groupLower = group.toLowerCase();
                if (groupLower === 'positive') {
                  bgColor = `${retroColors.green}15`;
                  textColor = retroColors.green;
                } else if (groupLower === 'negative (critical)') {
                  bgColor = `${retroColors.red}15`;
                  textColor = retroColors.red;
                } else if (groupLower === 'negative (non-critical)') {
                  bgColor = `${retroColors.orange}15`;
                  textColor = retroColors.orange;
                } else if (groupLower === 'style') {
                  bgColor = `${retroColors.purple}15`;
                  textColor = retroColors.purple;
                }

                return (
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1,
                      backgroundColor: bgColor,
                      color: textColor,
                      fontWeight: 600,
                    }}
                  >
                    {group}
                  </Typography>
                );
              })()}

              {/* Significance tags */}
              {showSignificance && (
                <>
                  {isSignificantInFrequency && (
                    <Tooltip title="This cluster shows statistically significant differences in frequency across models">
                      <Typography
                        variant="caption"
                        sx={{
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1,
                          backgroundColor: '#DBEAFE',
                          color: '#1E40AF',
                          fontWeight: 600,
                        }}
                      >
                        Sig. Freq
                      </Typography>
                    </Tooltip>
                  )}
                  {isSignificantInQuality && (
                    <Tooltip title="This cluster shows statistically significant differences in quality across models">
                      <Typography
                        variant="caption"
                        sx={{
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1,
                          backgroundColor: '#FCE7F3',
                          color: '#9F1239',
                          fontWeight: 600,
                        }}
                      >
                        Sig. Quality
                      </Typography>
                    </Tooltip>
                  )}
                </>
              )}
            </Stack>

            {/* Overall quality metrics */}
            {overallQuality && Object.keys(overallQuality).length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Stack direction="column" spacing={0.5}>
                  {Object.entries(overallQuality).map(([k, v]) => {
                    const d = overallQualityDelta && typeof overallQualityDelta[k] === 'number' ? overallQualityDelta[k] : undefined;
                    let deltaColor = '#6B7280';
                    if (typeof d === 'number') {
                      if (d > 0.02) deltaColor = retroColors.green;
                      else if (d < -0.02) deltaColor = retroColors.red;
                    }
                    return (
                      <Typography key={k} variant="body2" sx={{ color: '#334155' }}>
                        {k}: {typeof v === 'number' ? v.toFixed(decimals) : String(v)}
                        {typeof d === 'number' && (
                          <Box component="span" sx={{ ml: 0.5, color: deltaColor }}>
                            ({d >= 0 ? '+' : ''}{d.toFixed(decimals)})
                          </Box>
                        )}
                      </Typography>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Plots */}
          <Box sx={{ mb: 0.5 }}>
            {/* Scatter plots: Quality Impact vs Frequency (one per metric) */}
            {perModelProps && Object.keys(perModelProps).length > 0 && qualityDeltaByModel && Object.keys(qualityDeltaByModel).length > 0 && (() => {
              const models = Object.keys(qualityDeltaByModel);
              const metricKeys = Array.from(new Set(models.flatMap(m => Object.keys(qualityDeltaByModel[m] || {}))));
              return metricKeys.length > 0;
            })() && (
              <Box sx={{ mb: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0 }}>
                  <Typography variant="subtitle2" sx={{ color: '#334155' }}>Quality Impact vs Frequency</Typography>
                  <Tooltip title="The delta in quality between conversations containing this behavior vs quality of all conversations.">
                    <IconButton size="small"><InfoOutlinedIcon sx={{ fontSize: 16 }} /></IconButton>
                  </Tooltip>
                </Stack>
                {(() => {
                  const models = Object.keys(qualityDeltaByModel);
                  const metricKeys = Array.from(new Set(models.flatMap(m => Object.keys(qualityDeltaByModel[m] || {}))));

                  // Check if we have CI data AND showCI is enabled
                  const hasCIData = showCI && Object.keys(qualityDeltaCIByModel).length > 0;
                  const hasFreqCI = showCI && Object.keys(proportionCIByModel).length > 0;

                  // Group metrics into rows of max 2
                  const metricsPerRow = 2;
                  const metricRows: string[][] = [];
                  for (let i = 0; i < metricKeys.length; i += metricsPerRow) {
                    metricRows.push(metricKeys.slice(i, i + metricsPerRow));
                  }

                  return (
                    <Stack direction="column" spacing={1} sx={{ width: '100%' }}>
                      {/* Global legend at the top */}
                      <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2, py: 0.5 }}>
                        {models.map(model => (
                          <Box key={model} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: modelColors[model] || '#6B7280',
                                border: '1.5px solid #FFFFFF',
                                boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                              }}
                            />
                            <Typography variant="caption" sx={{ color: '#334155', fontSize: '0.875rem' }}>
                              {model}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                      {metricRows.map((rowMetrics, rowIdx) => (
                        <Stack key={rowIdx} direction="row" spacing={2} sx={{ width: '100%' }}>
                          {rowMetrics.map((metric, i) => {
                        // Build scatter data for this metric
                        const scatterData = models.map(model => {
                          const qualityDelta = Number((qualityDeltaByModel[model] || {})[metric] || 0);
                          const frequency = Number(perModelProps[model] || 0);

                          // Error bars for quality delta (x-axis)
                          let errorX = undefined;
                          if (hasCIData) {
                            const ci = qualityDeltaCIByModel[model]?.[metric];
                            if (ci) {
                              errorX = {
                                type: 'data' as const,
                                array: [Number(ci.upper) - qualityDelta],
                                arrayminus: [qualityDelta - Number(ci.lower)],
                                visible: true,
                                color: '#6B7280',
                                thickness: 1.5,
                                width: 3,
                              };
                            }
                          }

                          // Error bars for frequency (y-axis)
                          let errorY = undefined;
                          if (hasFreqCI) {
                            const ci = proportionCIByModel[model];
                            if (ci) {
                              errorY = {
                                type: 'data' as const,
                                array: [Number(ci.upper) - frequency],
                                arrayminus: [frequency - Number(ci.lower)],
                                visible: true,
                                color: '#6B7280',
                                thickness: 1.5,
                                width: 4,
                              };
                            }
                          }

                          return {
                            type: 'scatter' as const,
                            mode: 'markers' as const,
                            name: model,
                            x: [qualityDelta],
                            y: [frequency],
                            marker: {
                              color: modelColors[model] || '#6B7280',
                              size: 10,
                              line: {
                                color: '#FFFFFF',
                                width: 1.5,
                              },
                            },
                            hovertemplate: `${model}<br>Quality Impact: %{x:.${decimals}f}<br>Frequency: %{y:.${decimals}f}<extra></extra>`,
                            error_x: errorX,
                            error_y: errorY,
                            showlegend: false, // Legend is now shown globally at the top
                          };
                        });

                        // Calculate x-axis range to center the 0 line
                        let xMin = 0;
                        let xMax = 0;
                        scatterData.forEach(trace => {
                          const xVal = trace.x[0] as number;
                          // Include error bars in range calculation if present
                          let minX = xVal;
                          let maxX = xVal;
                          if (trace.error_x) {
                            const errorX = trace.error_x as any;
                            if (errorX.array && errorX.array.length > 0) {
                              maxX = xVal + errorX.array[0];
                            }
                            if (errorX.arrayminus && errorX.arrayminus.length > 0) {
                              minX = xVal - errorX.arrayminus[0];
                            }
                          }
                          xMin = Math.min(xMin, minX);
                          xMax = Math.max(xMax, maxX);
                        });

                        // Make range symmetric around 0
                        const maxAbs = Math.max(Math.abs(xMin), Math.abs(xMax));
                        // Add a small padding (10% of range, or 0.1 if range is 0)
                        const padding = maxAbs > 0 ? maxAbs * 0.1 : 0.1;
                        const symmetricRange = maxAbs > 0 ? maxAbs + padding : 0.1;

                        // Create shaded regions: red for left (negative), green for right (positive)
                        const shadedRegions = [
                          {
                            type: 'rect',
                            x0: -symmetricRange,
                            x1: 0,
                            y0: 0,
                            y1: 1,
                            yref: 'paper',
                            fillcolor: 'rgba(220, 38, 38, 0.05)', // Very light red
                            line: { width: 0 },
                            layer: 'below'
                          },
                          {
                            type: 'rect',
                            x0: 0,
                            x1: symmetricRange,
                            y0: 0,
                            y1: 1,
                            yref: 'paper',
                            fillcolor: 'rgba(5, 150, 105, 0.05)', // Very light green
                            line: { width: 0 },
                            layer: 'below'
                          }
                        ];

                        return (
                          <Box key={metric} sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mb: 0.5, textAlign: 'center', fontSize: '0.9rem', fontWeight: 500 }}>
                              {metric}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0, px: 1, width: '100%' }}>
                              <Typography variant="caption" sx={{ color: '#DC2626', fontSize: '11px', fontWeight: 500, display: 'block' }}>
                                behavior is bad
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#059669', fontSize: '11px', fontWeight: 500, display: 'block' }}>
                                behavior is good
                              </Typography>
                            </Box>
                            <Plot
                              data={scatterData}
                              layout={{
                                height: 300,
                                margin: { l: 60, r: 10, t: 2, b: 50 },
                                xaxis: {
                                  title: { text: 'Quality Impact', standoff: 15 },
                                  tickformat: `.${decimals}f`,
                                  zeroline: true,
                                  zerolinecolor: '#374151',
                                  zerolinewidth: 2,
                                  range: [-symmetricRange, symmetricRange],
                                },
                                yaxis: {
                                  title: { text: 'Frequency', standoff: 15 },
                                  rangemode: 'tozero',
                                  tickformat: `.${decimals}f`
                                },
                                shapes: shadedRegions,
                                paper_bgcolor: '#FFFFFF',
                                plot_bgcolor: '#FFFFFF',
                                showlegend: false,
                              }}
                              config={{ displayModeBar: false, responsive: true }}
                              style={{ width: '100%' }}
                            />
                          </Box>
                        );
                      })}
                        </Stack>
                      ))}
                    </Stack>
                  );
                })()}
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Properties list */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#334155' }}>
              Properties ({propertyList.length})
            </Typography>
            {propertyList.length > 0 ? (
              <Box sx={{ maxHeight: '600px', overflow: 'auto' }}>
                <Stack spacing={1}>
                  {propertyList.map((prop, i) => (
                    <Box
                      key={prop.id || i}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid #E5E7EB',
                        borderRadius: 1,
                        p: 1.5,
                        background: '#FAFAFA',
                        '&:hover': { background: '#F3F4F6' },
                      }}
                    >
                      <Box sx={{ mr: 2, flex: 1 }}>
                        <Box
                          sx={{
                            '& p': { margin: '4px 0' },
                            '& code': { backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '4px', fontSize: '0.9em' },
                            '& pre': { backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', overflow: 'auto' },
                            '& h1, & h2, & h3, & h4, & h5, & h6': { margin: '8px 0 4px 0', fontWeight: 600 },
                            '& ul, & ol': { margin: '4px 0', paddingLeft: '20px' },
                            '& blockquote': { borderLeft: '3px solid #ddd', paddingLeft: '12px', margin: '4px 0' },
                            '& .katex': { fontSize: '1em' },
                            '& .katex-display': { margin: '8px 0' },
                          }}
                        >
                          <Typography variant="body2" component="div">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                a: ({ href, children, ...props }) => (
                                  <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                                    {children}
                                  </a>
                                ),
                                p: ({ children }) => <span>{children}</span>,
                              }}
                            >
                              {prop.description}
                            </ReactMarkdown>
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                        {prop.model && (() => {
                          const modelColor = modelColors[prop.model] || '#6B7280';
                          return (
                            <Typography
                              variant="caption"
                              sx={{
                                color: modelColor,
                                fontSize: '0.75rem',
                                backgroundColor: `${modelColor}15`,
                                px: 1,
                                py: 0.25,
                                borderRadius: 0.75,
                              }}
                            >
                              {prop.model}
                            </Typography>
                          );
                        })()}
                        {prop.id && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSelectedPropertyId(prop.id!);
                              setViewMode('property-trace');
                            }}
                          >
                            View
                          </Button>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No properties listed for this cluster.
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}

