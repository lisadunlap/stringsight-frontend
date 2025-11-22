import React from 'react';
import { Box, Table, TableHead, TableRow, TableCell, TableBody, Button, TableContainer, Accordion, AccordionSummary, AccordionDetails, Typography, Chip, Pagination, Fade, Tooltip } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterBar from './FilterBar';
import FormattedCell from './FormattedCell';
import PropertiesOverviewBanner from './PropertiesOverviewBanner';
// @ts-ignore - Plotly types issue
import Plotly from 'plotly.js-dist-min';
// @ts-ignore - React-plotly types issue  
import createPlotlyComponent from 'react-plotly.js/factory';

const Plot = createPlotlyComponent(Plotly);

interface Filter {
  column: string;
  values: string[];
  negated: boolean;
  operator?: 'AND' | 'OR';
}

export default function PropertiesTab({
  rows,
  originalData,
  onOpenProperty,
}: {
  rows: any[];
  originalData?: any[]; // Original dataset to get model_response from
  onOpenProperty: (prop: any) => void;
}) {
  // (No prompt/task description controls here; Properties table remains focused on data only.)

  const [query, setQuery] = React.useState('');
  const [pendingColumn, setPendingColumn] = React.useState<string | null>(null);
  const [pendingValues, setPendingValues] = React.useState<string[]>([]);
  const [pendingNegated, setPendingNegated] = React.useState<boolean>(false);
  const [filters, setFilters] = React.useState<Filter[]>([]);
  const [groupBy, setGroupBy] = React.useState<string | null>(null);

  // Enrich properties with model_response from original data for display
  const enrichedRows = React.useMemo(() => {
    if (!originalData || originalData.length === 0) {
      console.log('[PropertiesTab] No originalData provided, skipping enrichment');
      return rows;
    }

    console.log('[PropertiesTab] Enriching', rows.length, 'properties with data from', originalData.length, 'conversations');

    // Create lookup map: (question_id, model) -> model_response
    // Need to use question_id + model since a question can have multiple models
    const responseMap = new Map<string, any>();
    originalData.forEach((row) => {
      const qid = String(row?.question_id || '');

      // Single model: direct model field
      if (row?.model) {
        const key = `${qid}|${row.model}`;
        responseMap.set(key, row.model_response);
      }

      // Side-by-side: create separate entries for model_a and model_b
      if (row?.model_a) {
        const keyA = `${qid}|${row.model_a}`;
        responseMap.set(keyA, row.model_a_response);
      }
      if (row?.model_b) {
        const keyB = `${qid}|${row.model_b}`;
        responseMap.set(keyB, row.model_b_response);
      }
    });

    console.log('[PropertiesTab] Built response map with', responseMap.size, 'entries');
    console.log('[PropertiesTab] Sample property:', rows[0]);
    console.log('[PropertiesTab] Sample originalData row:', originalData[0]);

    // Enrich properties with model_response
    const enriched = rows.map(prop => {
      const qid = String(prop?.question_id || '');
      const model = String(prop?.model || '');
      const key = `${qid}|${model}`;

      if (responseMap.has(key)) {
        return { ...prop, model_response: responseMap.get(key) };
      }
      return prop;
    });

    console.log('[PropertiesTab] Enriched sample:', enriched[0]);
    console.log('[PropertiesTab] How many have model_response?', enriched.filter(r => r.model_response).length);

    return enriched;
  }, [rows, originalData]);

  // Get all available columns from the enriched properties data with custom ordering
  const availableColumns = React.useMemo(() => {
    if (enrichedRows.length === 0) return [];
    const allKeys = new Set<string>();
    enrichedRows.forEach(row => {
      Object.keys(row).forEach(key => allKeys.add(key));
    });
    
    const allKeysArray = Array.from(allKeys);
    
    // Columns to exclude
    const excludedColumns = new Set(['id', 'meta', 'raw_response', 'row_index', '__index', 'contains_errors']);
    
    // Filter out excluded columns and columns with all NaN/null values
    const validColumns = allKeysArray.filter(col => {
      // Skip excluded columns
      if (excludedColumns.has(col)) {
        console.log(`[PropertiesTab] Excluding column: ${col} (in exclusion list)`);
        return false;
      }
      
      // Check if column has any non-null, non-undefined, non-NaN values
      const hasValidValues = enrichedRows.some(row => {
        const value = row[col];
        return value !== null && 
               value !== undefined && 
               value !== '' && 
               !(typeof value === 'number' && isNaN(value)) &&
               String(value).toLowerCase() !== 'nan';
      });
      
      if (!hasValidValues) {
        console.log(`[PropertiesTab] Excluding column: ${col} (all values are null/NaN/empty)`);
      }
      
      return hasValidValues;
    });
    
    console.log(`[PropertiesTab] Valid columns after filtering:`, validColumns);
    
    // Custom ordering: question_id first, property_description second, then model, then model_response, then the rest
    const orderedColumns: string[] = [];

    // Add question_id first if it exists and is valid
    if (validColumns.includes('question_id')) {
      orderedColumns.push('question_id');
    }

    // Add property_description second if it exists and is valid
    if (validColumns.includes('property_description')) {
      orderedColumns.push('property_description');
    }

    // Add model third if it exists and is valid
    if (validColumns.includes('model')) {
      orderedColumns.push('model');
    }

    // Always add model_response fourth (we ensure it exists in enrichedRows)
    orderedColumns.push('model_response');

    // Add all other valid columns in alphabetical order
    const remainingColumns = validColumns
      .filter(col => col !== 'question_id' && col !== 'property_description' && col !== 'model' && col !== 'model_response')
      .sort();

    orderedColumns.push(...remainingColumns);
    
    return orderedColumns;
  }, [enrichedRows]);

  // Get categorical columns (columns with reasonable number of unique values)
  const categoricalColumns = React.useMemo(() => {
    if (enrichedRows.length === 0) return [];
    const cols = new Set<string>();
    for (const col of availableColumns) {
      const uniq = new Set(enrichedRows.slice(0, 500).map(r => r?.[col])).size;
      if (uniq > 0 && uniq <= 50) cols.add(col);
    }
    return Array.from(cols).sort();
  }, [enrichedRows, availableColumns]);

  // Get unique values for a column
  const uniqueValuesFor = React.useCallback((column: string) => {
    return Array.from(new Set(enrichedRows.map(r => String(r?.[column] || '')).filter(Boolean))).sort();
  }, [enrichedRows]);

  // Apply filters and search
  const filtered = React.useMemo(() => {
    let result = enrichedRows;
    
    // Apply search filter
    if (query.trim()) {
    const q = query.toLowerCase().trim();
      result = result.filter(r => {
        // Search across all text columns
        return availableColumns.some(col => {
          const value = r[col];
          return value != null && String(value).toLowerCase().includes(q);
        });
      });
    }
    
    // Apply column filters with AND/OR logic
    if (filters.length > 0) {
      result = result.filter(row => {
        // For each row, evaluate all filters according to their operators
        let combinedResult = false;

        filters.forEach((filter, index) => {
          const value = String(row?.[filter.column] || '');
          const matches = filter.values.includes(value);
          const filterResult = filter.negated ? !matches : matches;

          if (index === 0) {
            // First filter: no operator, just use the result
            combinedResult = filterResult;
          } else {
            // Subsequent filters: apply operator
            if (filter.operator === 'OR') {
              combinedResult = combinedResult || filterResult;
            } else {
              // Default to AND
              combinedResult = combinedResult && filterResult;
            }
          }
        });

        return combinedResult;
      });
    }
    
    return result;
  }, [enrichedRows, query, filters, availableColumns]);

  // Filter management functions
  const addFilter = React.useCallback(() => {
    if (!pendingColumn || pendingValues.length === 0) return;
    const operator = filters.length > 0 ? 'AND' : undefined;
    const newFilter: Filter = {
      column: pendingColumn,
      values: pendingValues,
      negated: pendingNegated,
      operator
    };
    setFilters(prev => [...prev, newFilter]);
    setPendingColumn(null);
    setPendingValues([]);
    setPendingNegated(false);
  }, [pendingColumn, pendingValues, pendingNegated, filters.length]);

  const removeFilter = React.useCallback((index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  const changeFilterOperator = React.useCallback((index: number, operator: 'AND' | 'OR') => {
    setFilters(prev => prev.map((f, i) => i === index ? { ...f, operator } : f));
  }, []);

  const resetAll = React.useCallback(() => {
    setQuery('');
    setFilters([]);
    setPendingColumn(null);
    setPendingValues([]);
    setPendingNegated(false);
    setGroupBy(null);
  }, []);

  // Helper function to format column names for display
  const formatColumnName = (columnName: string): string => {
    return columnName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Helper function to get behavior type color
  const getBehaviorTypeColor = (behaviorType: string): string => {
    const type = String(behaviorType).toLowerCase().trim();
    
    if (type === 'positive') {
      return '#10B981'; // Green
    } else if (type === 'negative (critical)' || type === 'negative(critical)') {
      return '#EF4444'; // Red
    } else if (type === 'negative (non-critical)' || type === 'negative(non-critical)') {
      return '#F97316'; // Orange
    } else if (type === 'style') {
      return '#8B5CF6'; // Purple
    }
    
    return 'transparent'; // Default/no color
  };

  // Helper function to format cell values
  const formatCellValue = (value: any, columnName: string, rowData: any): React.ReactNode => {
    if (value === null || value === undefined) return '';
    
    // Special handling for model_response - show as button
    if (columnName === 'model_response') {
      return (
        <Button
          size="small"
          variant="text"
          color="secondary"
          startIcon={<VisibilityOutlinedIcon />}
          onClick={(e) => {
            e.stopPropagation();
            console.log('[PropertiesTab] View button clicked! rowData:', {
              fullRowData: rowData,
              keys: Object.keys(rowData),
              question_id: rowData?.question_id,
              model: rowData?.model,
              __index: rowData?.__index
            });
            onOpenProperty(rowData);
          }}
          sx={{ fontWeight: 600 }}
        >
          View
        </Button>
      );
    }
    
    // Handle arrays - join them first
    let displayValue = value;
    if (Array.isArray(value)) {
      displayValue = value.join(', ');
    } else if (typeof value === 'boolean') {
      displayValue = String(value);
    } else {
      displayValue = String(value);
    }
    
    // Special handling for property_description with unexpected behavior flag
    if (columnName === 'property_description') {
      const isUnexpectedBehavior = rowData?.unexpected_behavior === true || 
                                   rowData?.unexpected_behavior === 'true' ||
                                   String(rowData?.unexpected_behavior || '').toLowerCase() === 'true';
      
      if (isUnexpectedBehavior) {
        return (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
            <Tooltip title="Flagged as a strange behavior" arrow>
              <Typography component="span" sx={{ fontSize: '14px', color: '#EF4444' }}>
                ⚠️
              </Typography>
            </Tooltip>
            <FormattedCell 
              text={displayValue} 
              maxLength={300}
              isPrompt={false}
            />
          </Box>
        );
      }
    }
    
    // Use FormattedCell for all text content (with expandable functionality)
    return (
      <FormattedCell 
        text={displayValue} 
        maxLength={columnName === 'property_description' ? 300 : columnName === 'evidence' ? 200 : 150}
        isPrompt={false}
      />
    );
  };

  // Group the filtered data if groupBy is selected
  const groupedData = React.useMemo(() => {
    if (!groupBy) return null;
    
    const groups = new Map<string, any[]>();
    filtered.forEach(row => {
      const key = String(row[groupBy] || 'Unknown');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    });
    
    return Array.from(groups.entries()).map(([value, rows]) => ({
      value,
      count: rows.length,
      rows
    })).sort((a, b) => b.count - a.count); // Sort by count descending
  }, [filtered, groupBy]);

  // Per-group pagination (10 per page)
  const [groupPages, setGroupPages] = React.useState<Map<string, number>>(new Map());
  const getGroupPage = React.useCallback((key: string) => groupPages.get(key) || 1, [groupPages]);
  const setGroupPage = React.useCallback((key: string, pageNum: number) => {
    setGroupPages(prev => new Map(prev).set(key, pageNum));
  }, []);

  // Client-side pagination for ungrouped list (100/page)
  const PAGE_SIZE = 100;
  const [page, setPage] = React.useState(1);
  React.useEffect(() => { setPage(1); }, [filtered, groupBy]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const endIdx = Math.min(filtered.length, startIdx + PAGE_SIZE);
  const pageRows = React.useMemo(() => filtered.slice(startIdx, endIdx), [filtered, startIdx, endIdx]);

  // Calculate property counts by model and behavior type for grouped bar chart
  const propertyCountsByModel = React.useMemo(() => {
    // Find behavior type column
    const behaviorTypeColumn = availableColumns.find(col => 
      col.toLowerCase().includes('behavior') && col.toLowerCase().includes('type')
    );
    
    if (!behaviorTypeColumn || !availableColumns.includes('model')) {
      return null;
    }

    // Initialize counts map: model -> { positive, negativeCritical, negativeNonCritical, style }
    const countsByModel = new Map<string, { positive: number; negativeCritical: number; negativeNonCritical: number; style: number }>();

    filtered.forEach(row => {
      const model = String(row?.model || '');
      if (!model) return;

      if (!countsByModel.has(model)) {
        countsByModel.set(model, { positive: 0, negativeCritical: 0, negativeNonCritical: 0, style: 0 });
      }

      const counts = countsByModel.get(model)!;
      const behaviorType = String(row[behaviorTypeColumn] || '').toLowerCase().trim();
      
      if (behaviorType === 'positive') {
        counts.positive++;
      } else if (behaviorType === 'negative (critical)' || behaviorType === 'negative(critical)') {
        counts.negativeCritical++;
      } else if (behaviorType === 'negative (non-critical)' || behaviorType === 'negative(non-critical)') {
        counts.negativeNonCritical++;
      } else if (behaviorType === 'style') {
        counts.style++;
      }
    });

    return countsByModel;
  }, [filtered, availableColumns]);

  return (
    <Box sx={{ pt: 0.5 }}>
      {/* (Prompt/task description controls intentionally not included here) */}
      {/* Properties Overview Banner */}
      <PropertiesOverviewBanner properties={rows} />
      
      {/* Grouped Bar Chart: Property Distribution by Model (collapsed by default) */}
      {propertyCountsByModel && propertyCountsByModel.size > 0 && (
        <Accordion
          sx={{
            mb: 2,
            borderRadius: 1,
            '&:before': { display: 'none' },
            boxShadow: 'none',
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: 1,
              '& .MuiAccordionSummary-content': { my: 0.25 },
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: '#4B5563',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Property Distribution by Model
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0, pt: 1.5 }}>
            <Box
              sx={{
                p: 1.5,
                backgroundColor: '#ffffff',
                borderRadius: 0,
                borderTop: 'none',
                width: '100%',
                maxWidth: '100%',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                <Plot
            data={(() => {
              const models = Array.from(propertyCountsByModel.keys());
              const values = Array.from(propertyCountsByModel.values());
              
              // Calculate total for each model
              const totals = values.map(c => c.positive + c.negativeCritical + c.negativeNonCritical + c.style);
              
              return [
                {
                  type: 'bar' as const,
                  name: 'Positive',
                  x: models,
                  y: values.map((c, i) => totals[i] > 0 ? c.positive / totals[i] : 0),
                  marker: { color: '#10B981' },
                  hovertemplate: '%{x}<br>Positive: %{y:.2%}<extra></extra>',
                },
                {
                  type: 'bar' as const,
                  name: 'Negative (Critical)',
                  x: models,
                  y: values.map((c, i) => totals[i] > 0 ? c.negativeCritical / totals[i] : 0),
                  marker: { color: '#EF4444' },
                  hovertemplate: '%{x}<br>Negative (Critical): %{y:.2%}<extra></extra>',
                },
                {
                  type: 'bar' as const,
                  name: 'Negative (Non-Critical)',
                  x: models,
                  y: values.map((c, i) => totals[i] > 0 ? c.negativeNonCritical / totals[i] : 0),
                  marker: { color: '#F97316' },
                  hovertemplate: '%{x}<br>Negative (Non-Critical): %{y:.2%}<extra></extra>',
                },
                {
                  type: 'bar' as const,
                  name: 'Style',
                  x: models,
                  y: values.map((c, i) => totals[i] > 0 ? c.style / totals[i] : 0),
                  marker: { color: '#8B5CF6' },
                  hovertemplate: '%{x}<br>Style: %{y:.2%}<extra></extra>',
                },
              ];
            })()}
            layout={{
              height: 280,
              margin: { l: 50, r: 20, t: 10, b: 50 },
              xaxis: { 
                tickangle: 0,
                automargin: true,
                tickfont: { size: 10 },
              },
              yaxis: { 
                title: { text: 'Proportion', font: { size: 11 } },
                gridcolor: '#eee',
                tickfont: { size: 10 },
                tickformat: '.0%',
              },
              barmode: 'group',
              legend: {
                orientation: 'h' as const,
                x: 0.5,
                y: 1.05,
                xanchor: 'center',
                yanchor: 'bottom',
                font: { size: 10 },
              },
              paper_bgcolor: '#FFFFFF',
              plot_bgcolor: '#FFFFFF',
            }}
            config={{ 
              displayModeBar: false,
              displaylogo: false,
              responsive: true,
            }}
            style={{ width: '100%', height: '280px', maxWidth: '100%' }}
            useResizeHandler={true}
          />
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      <FilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search properties..."
        categoricalColumns={categoricalColumns}
        pendingColumn={pendingColumn}
        pendingValues={pendingValues}
        pendingNegated={pendingNegated}
        onPendingColumnChange={(column) => { 
          setPendingColumn(column); 
          setPendingValues([]); 
          setPendingNegated(false); 
        }}
        onPendingValuesChange={setPendingValues}
        onPendingNegatedChange={setPendingNegated}
        onAddFilter={addFilter}
        filters={filters}
        onRemoveFilter={removeFilter}
        onChangeFilterOperator={changeFilterOperator}
        uniqueValuesFor={uniqueValuesFor}
        resultCount={filtered.length}
        resultLabel="properties"
        showGroupBy={true}
        groupByOptions={availableColumns}
        groupByValue={groupBy}
        onGroupByChange={setGroupBy}
        onReset={resetAll}
      />
      
      {/* Render grouped or ungrouped table */}
      {groupedData ? (
        // Grouped view
        <Box sx={{ border: '1px solid #C7D2FE', borderRadius: 0.5, overflow: 'auto', backgroundColor: '#FFFFFF' }}>
          {groupedData.map((group, groupIndex) => (
            <Accordion key={groupIndex} sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: 'none' }}>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon />}
                sx={{ 
                  backgroundColor: '#F5F3FF', 
                  borderBottom: '1px solid #C7D2FE',
                  '&:hover': { backgroundColor: '#EDE9FE' }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {groupBy}: {String(group.value).length > 50 ? String(group.value).slice(0, 50) + '...' : String(group.value)}
                  </Typography>
                  <Chip 
                    label={`${group.count} properties`} 
                    size="small" 
                    sx={{ backgroundColor: '#E0E7FF', color: '#3730A3' }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#EEF2FF' }}>
                    <TableRow>
                      {availableColumns.map((column) => (
                        <TableCell 
                          key={column}
                          sx={{ 
                            color: '#374151', 
                            fontWeight: 700, 
                            fontSize: 12, 
                            letterSpacing: 0.4, 
                            textTransform: 'uppercase',
                            minWidth: column === 'property_description' ? 300 : column === 'evidence' ? 200 : column === 'reason' ? 200 : column === 'category' ? 75 : 'auto'
                          }}
                        >
                          {formatColumnName(column)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      const key = String(group.value);
                      const currentPage = getGroupPage(key);
                      const pageSize = 10;
                      const start = (currentPage - 1) * pageSize;
                      const end = Math.min(group.rows.length, start + pageSize);
                      const rowsSlice = group.rows.slice(start, end);
                      return rowsSlice.map((p, i) => (
                        <TableRow key={i} hover>
                          {availableColumns.map((column) => {
                            const isBehaviorType = column.toLowerCase().includes('behavior') && column.toLowerCase().includes('type');
                            const textColor = isBehaviorType ? getBehaviorTypeColor(p[column]) : 'inherit';
                            
                            return (
                              <TableCell 
                                key={column}
                                sx={{ 
                                  maxWidth: column === 'property_description' ? 400 : column === 'evidence' ? 250 : column === 'reason' ? 250 : column === 'category' ? 100 : 200,
                                  verticalAlign: 'top',
                                  color: textColor,
                                  fontWeight: textColor !== 'inherit' ? 600 : 'inherit'
                                }}
                              >
                                {formatCellValue(p[column], column, p)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
                {(() => {
                  const key = String(group.value);
                  const totalPages = Math.max(1, Math.ceil(group.rows.length / 10));
                  if (totalPages <= 1) return null;
                  const currentPage = getGroupPage(key);
                  return (
                    <Box sx={{ p: 1, display: 'flex', justifyContent: 'center', borderTop: '1px solid #C7D2FE' }}>
                      <Pagination size="small" page={currentPage} count={totalPages} onChange={(_, p) => setGroupPage(key, p)} />
                    </Box>
                  );
                })()}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ) : (
        // Ungrouped view
        <>
          <TableContainer sx={{ border: '1px solid #C7D2FE', borderRadius: 0.5, overflow: 'auto', backgroundColor: '#FFFFFF' }}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#EEF2FF' }}>
                <TableRow>
                  {availableColumns.map((column) => (
                    <TableCell 
                      key={column}
                      sx={{ 
                        color: '#374151', 
                        fontWeight: 700, 
                        fontSize: 12, 
                        letterSpacing: 0.4, 
                        textTransform: 'uppercase',
                        minWidth: column === 'property_description' ? 300 : column === 'evidence' ? 200 : column === 'reason' ? 200 : column === 'category' ? 125 : 'auto'
                      }}
                    >
                      {formatColumnName(column)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((p, i) => {
                  const row = (
                    <TableRow key={i} hover>
                      {availableColumns.map((column) => {
                        const isBehaviorType = column.toLowerCase().includes('behavior') && column.toLowerCase().includes('type');
                        const textColor = isBehaviorType ? getBehaviorTypeColor(p[column]) : 'inherit';
                        
                        return (
                          <TableCell 
                            key={column}
                            sx={{ 
                                  maxWidth: column === 'property_description' ? 400 : column === 'evidence' ? 250 : column === 'reason' ? 250 : column === 'category' ? 100 : 200,
                              verticalAlign: 'top',
                              color: textColor,
                              fontWeight: textColor !== 'inherit' ? 600 : 'inherit'
                            }}
                          >
                            {formatCellValue(p[column], column, p)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                  // Slow staggered fade similar to DataTable
                  if (i < 20) {
                    return (
                      <Fade in timeout={Math.min(1100 + i * 220, 5200)} key={`pfade-${i}`}>
                        {row}
                      </Fade>
                    );
                  }
                  return row;
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {filtered.length > PAGE_SIZE && (
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
              <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} size="small" />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}


