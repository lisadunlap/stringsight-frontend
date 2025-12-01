import React from 'react';
import { Box, Button, Typography, Stack } from '@mui/material';
import type { DataOperation } from '../types/operations';
import { getOperationDescription } from '../types/operations';

interface FilterSummaryProps {
  operations: DataOperation[];
  onRemoveOperation: (operationId: string) => void;
}

const FilterSummary: React.FC<FilterSummaryProps> = ({
  operations,
  onRemoveOperation
}) => {
  if (operations.length === 0) {
    return null;
  }

  const getOperationColor = (type: string) => {
    // All operations use dark yellow color
    return { text: '#92400E' };
  };

  const getOperationTypeLabel = (type: string) => {
    switch (type) {
      case 'filter': return 'Filter';
      case 'custom': return 'Custom';
      case 'sort': return 'Sort';
      default: return 'Unknown';
    }
  };

  return (
    <Box sx={{
      mb: 2,
      pb: 1.5,
      borderBottom: '2px solid',
      borderColor: '#D1D5DB',
    }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle2" sx={{
          color: '#6B7280',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          mr: 1
        }}>
          Operations ({operations.length}):
        </Typography>

        {operations.map((operation, index) => {
          const colors = getOperationColor(operation.type);
          // Calculate filter-specific index for operator display
          const filterOperations = operations.filter(op => op.type === 'filter');
          const filterIndex = operation.type === 'filter'
            ? filterOperations.findIndex(op => op.id === operation.id)
            : undefined;

          return (
            <Box
              key={operation.id}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: '0.875rem',
                color: colors.text,
                pb: 0.5,
                borderBottom: '2px solid',
                borderColor: colors.text,
              }}
            >
              <Box component="span" sx={{ fontFamily: operation.type === 'custom' ? 'monospace' : 'inherit' }}>
                {index + 1}. {getOperationTypeLabel(operation.type)}: {getOperationDescription(operation, filterIndex)}
              </Box>
              <Button
                size="small"
                onClick={() => onRemoveOperation(operation.id)}
                sx={{
                  minWidth: 'auto',
                  p: 0,
                  color: colors.text,
                  '&:hover': {
                    color: 'error.main',
                    bgcolor: 'transparent'
                  }
                }}
              >
                ✕
              </Button>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

export default FilterSummary;
