import React, { useState, useMemo } from 'react';
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
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
const Plot = createPlotlyComponent(Plotly);
import ConversationTrace from './ConversationTrace';
import PropertyTraceHeader from './PropertyTraceHeader';
import { ensureOpenAIFormat } from '../lib/traces';

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
      const modelName = String((prop as any).model || '');
      row = operationalRows.find(r => {
        const rq = r?.question_id;
        if (method === 'single_model') {
          return rq === qid && String(r?.model || '') === modelName;
        } else if (method === 'side_by_side') {
          return rq === qid && (String(r?.model_a || '') === modelName || String(r?.model_b || '') === modelName);
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
      ev = rawEvidence
        .split(',')
        .map(s => s.trim())
        .map(s => s.replace(/^["']|["']$/g, ''))
        .filter(s => s.length > 0);
    } else if (rawEvidence) {
      ev = [String(rawEvidence)];
    }

    // Build trace
    let messages: any[] = [];
    let modelName: string | undefined;
    let score: Record<string, any> | undefined;

    if (row) {
      if (method === 'single_model') {
        messages = ensureOpenAIFormat(String(row?.["prompt"] ?? ""), row?.["model_response"]);
        modelName = String(row?.["model"] ?? "");
        score = row?.["score"];
      } else if (method === 'side_by_side') {
        // For side-by-side, determine which model this property applies to
        const targetModel = String((prop as any).model || '');
        if (targetModel === String(row?.["model_a"] || '')) {
          messages = ensureOpenAIFormat(String(row?.["prompt"] ?? ""), row?.["model_a_response"]);
          modelName = String(row?.["model_a"] ?? "Model A");
          score = row?.["score_a"];
        } else if (targetModel === String(row?.["model_b"] || '')) {
          messages = ensureOpenAIFormat(String(row?.["prompt"] ?? ""), row?.["model_b_response"]);
          modelName = String(row?.["model_b"] ?? "Model B");
          score = row?.["score_b"];
        }
      }
    }

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
          <Box sx={{ p: 2, borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={() => {
              setViewMode('cluster-details');
              setSelectedPropertyId(null);
            }} size="small">
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="body2" sx={{ flex: 1 }}>Back to Cluster</Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <PropertyTraceHeader
              selectedRow={row}
              selectedProperty={prop}
              method={method}
              evidenceTargetModel={(prop as any).model}
            />
            {messages.length > 0 ? (
              <ConversationTrace
                messages={messages}
                highlights={ev}
                modelName={modelName}
                score={score}
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
                  fontSize: '0.875rem',
                }}
              >
                {String(enrichedCluster.label || '')}
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
                // Determine chip color based on group name
                let bgColor = '#E0F2FE';
                let textColor = '#0369A1';
                
                const groupLower = group.toLowerCase();
                if (groupLower === 'positive') {
                  bgColor = '#DCFCE7'; // green-100
                  textColor = '#15803D'; // green-700
                } else if (groupLower === 'negative (critical)') {
                  bgColor = '#FEE2E2'; // red-100
                  textColor = '#B91C1C'; // red-700
                } else if (groupLower === 'negative (non-critical)') {
                  bgColor = '#FED7AA'; // orange-200
                  textColor = '#C2410C'; // orange-700
                } else if (groupLower === 'style') {
                  bgColor = '#F3E8FF'; // purple-100
                  textColor = '#7B1FA2'; // purple-700
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
              <Box sx={{ mt: 2, p: 2, backgroundColor: '#F9FAFB', borderRadius: 1, border: '1px solid #E5E7EB' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#334155' }}>Overall Quality</Typography>
                <Stack direction="column" spacing={0.5}>
                  {Object.entries(overallQuality).map(([k, v]) => {
                    const d = overallQualityDelta && typeof overallQualityDelta[k] === 'number' ? overallQualityDelta[k] : undefined;
                    let deltaColor = '#6B7280';
                    if (typeof d === 'number') {
                      if (d > 0.02) deltaColor = '#16A34A';
                      else if (d < -0.02) deltaColor = '#DC2626';
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
            {/* Frequency (Per-model proportions) */}
            {perModelProps && Object.keys(perModelProps).length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0 }}>
                  <Typography variant="subtitle2" sx={{ color: '#334155' }}>Frequency</Typography>
                  <Tooltip title="Fraction of each model's conversations that appear in this cluster">
                    <IconButton size="small"><InfoOutlinedIcon sx={{ fontSize: 16 }} /></IconButton>
                  </Tooltip>
                </Stack>
                {(() => {
                  const entries = Object.entries(perModelProps).sort((a, b) => {
                    const aVal = Number(a[1]);
                    const bVal = Number(b[1]);
                    if (aVal === 0 && bVal === 0) return a[0].localeCompare(b[0]);
                    if (aVal === 0) return 1;
                    if (bVal === 0) return -1;
                    return bVal - aVal;
                  });
                  const x = entries.map(([m]) => m);
                  const y = entries.map(([, v]) => Number(v));
                  
                  // Add error bars if CI data is available AND showCI is enabled
                  const hasCI = showCI && Object.keys(proportionCIByModel).length > 0;
                  const errorY = hasCI ? {
                    type: 'data' as const,
                    array: entries.map(([m]) => {
                      const ci = proportionCIByModel[m];
                      return ci ? Number(ci.upper) - Number(perModelProps[m]) : 0;
                    }),
                    arrayminus: entries.map(([m]) => {
                      const ci = proportionCIByModel[m];
                      return ci ? Number(perModelProps[m]) - Number(ci.lower) : 0;
                    }),
                    visible: true,
                    color: '#6B7280',
                    thickness: 1.5,
                    width: 4,
                  } : undefined;
                  
                  return (
                    <Plot
                      data={[{
                        type: 'bar' as const,
                        x,
                        y,
                        marker: { color: '#3B82F6' },
                        hovertemplate: `%{x}: %{y:.${decimals}f}<extra></extra>`,
                        text: y.map(v => v.toFixed(decimals)),
                        textposition: 'auto' as const,
                        cliponaxis: false,
                        error_y: errorY,
                      }]}
                      layout={{
                        height: 260,
                        margin: { l: 70, r: 10, t: 4, b: 110 },
                        xaxis: { tickangle: -30, automargin: true },
                        yaxis: { title: { text: 'Proportion', standoff: 15 }, rangemode: 'tozero', tickformat: `.${decimals}f` },
                        showlegend: false,
                        paper_bgcolor: '#FFFFFF',
                        plot_bgcolor: '#FFFFFF',
                      }}
                      config={{ displayModeBar: false, responsive: true }}
                      style={{ width: '100%' }}
                    />
                  );
                })()}
              </Box>
            )}

            {/* Quality (Per-model quality delta) */}
            {qualityDeltaByModel && Object.keys(qualityDeltaByModel).length > 0 && (
              <Box sx={{ mb: 0 }}>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0 }}>
                  <Typography variant="subtitle2" sx={{ color: '#334155' }}>Quality</Typography>
                  <Tooltip title="Difference in quality between conversations which exhibit this property VS the average quality of all conversations">
                    <IconButton size="small"><InfoOutlinedIcon sx={{ fontSize: 16 }} /></IconButton>
                  </Tooltip>
                </Stack>
                {(() => {
                  const models = Object.keys(qualityDeltaByModel);
                  const metricKeys = Array.from(new Set(models.flatMap(m => Object.keys(qualityDeltaByModel[m] || {}))));
                  const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6'];
                  
                  // Check if we have CI data AND showCI is enabled
                  const hasCIData = showCI && Object.keys(qualityDeltaCIByModel).length > 0;

                  const traces = metricKeys.map((metric, i) => {
                    const yValues = models.map(m => Number((qualityDeltaByModel[m] || {})[metric] || 0));
                    
                    // Add error bars if CI data is available for this metric
                    let errorY = undefined;
                    if (hasCIData) {
                      const errorArrayUpper = models.map(m => {
                        const ci = qualityDeltaCIByModel[m]?.[metric];
                        const val = (qualityDeltaByModel[m] || {})[metric] || 0;
                        return ci ? Number(ci.upper) - Number(val) : 0;
                      });
                      const errorArrayLower = models.map(m => {
                        const ci = qualityDeltaCIByModel[m]?.[metric];
                        const val = (qualityDeltaByModel[m] || {})[metric] || 0;
                        return ci ? Number(val) - Number(ci.lower) : 0;
                      });
                      
                      // Only add error bars if we have at least one non-zero value
                      if (errorArrayUpper.some(v => v !== 0) || errorArrayLower.some(v => v !== 0)) {
                        errorY = {
                          type: 'data' as const,
                          array: errorArrayUpper,
                          arrayminus: errorArrayLower,
                          visible: true,
                          color: '#6B7280',
                          thickness: 1.5,
                          width: 3,
                        };
                      }
                    }
                    
                    return {
                      type: 'bar' as const,
                      name: metric,
                      x: models,
                      y: yValues,
                      marker: { color: palette[i % palette.length] },
                      hovertemplate: `${metric} · %{x}: %{y:.${decimals}f}<extra></extra>`,
                      text: yValues.map(v => v.toFixed(decimals)),
                      textposition: 'auto' as const,
                      cliponaxis: false,
                      error_y: errorY,
                    };
                  });

                  return (
                    <Plot
                      data={traces}
                      layout={{
                        barmode: 'group',
                        height: 260,
                        margin: { l: 70, r: 10, t: 10, b: 110 },
                        xaxis: { tickangle: -30, automargin: true },
                        yaxis: { title: { text: 'Quality Δ', standoff: 15 }, tickformat: `.${decimals}f` },
                        paper_bgcolor: '#FFFFFF',
                        plot_bgcolor: '#FFFFFF',
                        legend: { orientation: 'h', y: 1.15, x: 0.5, xanchor: 'center', yanchor: 'bottom' },
                      }}
                      config={{ displayModeBar: false, responsive: true }}
                      style={{ width: '100%' }}
                    />
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
                        <Typography variant="body2">{prop.description}</Typography>
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

