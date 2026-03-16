import React, { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

/**
 * A single pairwise correlation entry returned by the backend.
 */
export interface CorrelationEntry {
  /** Numeric metadata column name. */
  column: string;
  /** Score column name. */
  score_column: string;
  /** Pearson correlation coefficient in [-1, 1]. */
  pearson_r: number;
  /** Number of non-null pairs used to compute the correlation. */
  count: number;
}

interface CorrelationTableProps {
  /** Flat list of pairwise correlation results from the backend. */
  correlations: CorrelationEntry[];
}

/**
 * Map a Pearson r value to a background color.
 * Positive correlations are shades of green, negative are shades of red,
 * values near zero are neutral gray.
 */
function rToColor(r: number): string {
  const abs = Math.min(Math.abs(r), 1);
  if (r > 0) {
    const alpha = abs * 0.45;
    return `rgba(16, 185, 129, ${alpha})`;
  }
  const alpha = abs * 0.45;
  return `rgba(239, 68, 68, ${alpha})`;
}

/**
 * Compact, collapsible table showing Pearson correlations between numeric
 * metadata columns (rows) and score columns (columns). Cells are color-coded
 * by sign and magnitude. Hover to see sample count.
 */
export default function CorrelationTable({ correlations }: CorrelationTableProps) {
  const [expanded, setExpanded] = useState(true);

  if (correlations.length === 0) return null;

  const scoreColumns = Array.from(new Set(correlations.map(c => c.score_column)));
  const numericColumns = Array.from(new Set(correlations.map(c => c.column)));

  const lookup = new Map<string, CorrelationEntry>();
  for (const entry of correlations) {
    lookup.set(`${entry.column}::${entry.score_column}`, entry);
  }

  const shortLabel = (col: string) =>
    col.replace(/^score_/, '');

  return (
    <Box
      sx={{
        mb: 1.5,
        backgroundColor: '#ffffff',
        borderRadius: 2,
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.5,
          cursor: 'pointer',
          '&:hover': { backgroundColor: '#f9fafb' },
        }}
        onClick={() => setExpanded(prev => !prev)}
      >
        <Typography
          variant="caption"
          sx={{
            color: '#6b7280',
            textTransform: 'uppercase',
            fontWeight: 600,
            letterSpacing: '0.5px',
          }}
        >
          Column Correlations (Pearson r)
        </Typography>
        <IconButton size="small" sx={{ color: '#9ca3af' }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    color: '#374151',
                    backgroundColor: '#f9fafb',
                    borderBottom: '2px solid #e5e7eb',
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                  }}
                >
                  Column
                </TableCell>
                {scoreColumns.map(sc => (
                  <TableCell
                    key={sc}
                    align="center"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: '#374151',
                      backgroundColor: '#f9fafb',
                      borderBottom: '2px solid #e5e7eb',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {shortLabel(sc)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {numericColumns.map(nc => (
                <TableRow key={nc} hover>
                  <TableCell
                    sx={{
                      fontWeight: 500,
                      fontSize: '0.8rem',
                      color: '#111827',
                      whiteSpace: 'nowrap',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#ffffff',
                      zIndex: 1,
                    }}
                  >
                    {nc}
                  </TableCell>
                  {scoreColumns.map(sc => {
                    const entry = lookup.get(`${nc}::${sc}`);
                    if (!entry) {
                      return (
                        <TableCell key={sc} align="center" sx={{ color: '#d1d5db', fontSize: '0.8rem' }}>
                          --
                        </TableCell>
                      );
                    }
                    return (
                      <Tooltip
                        key={sc}
                        title={`r = ${entry.pearson_r.toFixed(4)}, n = ${entry.count}`}
                        arrow
                        placement="top"
                      >
                        <TableCell
                          align="center"
                          sx={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            backgroundColor: rToColor(entry.pearson_r),
                            color: '#111827',
                            cursor: 'default',
                          }}
                        >
                          {entry.pearson_r.toFixed(2)}
                        </TableCell>
                      </Tooltip>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Box>
  );
}
