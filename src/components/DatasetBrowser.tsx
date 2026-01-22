/**
 * Dataset browser - shows available datasets when no specific dataset is selected
 */

import React from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardActionArea,
  Container,
  Chip,
  Stack
} from '@mui/material';
import Grid from '@mui/material/Grid';
import DatasetIcon from '@mui/icons-material/Dataset';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import type { DatasetConfig } from '../types/dataset';

interface DatasetBrowserProps {
  datasets: Array<{ name: string; config: DatasetConfig }>;
  onSelectDataset: (datasetName: string) => void;
}

export function DatasetBrowser({ datasets, onSelectDataset }: DatasetBrowserProps) {
  const orderedCategories: string[] = [
    'Customer Service & Dialog',
    'Software Engineering',
    'QA & Medical',
    'Experimental / Toy',
  ];

  const grouped = React.useMemo(() => {
    const byCategory = new Map<string, Array<{ datasetKey: string; config: DatasetConfig }>>();
    const seenCategoryOrder: string[] = [];

    for (const { name: datasetKey, config } of datasets) {
      const category = config.category;
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
        seenCategoryOrder.push(category);
      }
      byCategory.get(category)!.push({ datasetKey, config });
    }

    const finalCategoryOrder = [
      ...orderedCategories.filter((c) => byCategory.has(c)),
      ...seenCategoryOrder.filter((c) => !orderedCategories.includes(c)),
    ];

    return finalCategoryOrder.map((category) => ({
      category,
      datasets: byCategory.get(category) ?? [],
    }));
  }, [datasets]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      <Box sx={{ mb: 2.5, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ mb: 0.75, fontWeight: 700, letterSpacing: '-0.02em' }}>
          Browse Benchmarks
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select a dataset to explore behavioral properties and analysis results
        </Typography>
      </Box>

      <Stack spacing={2.5}>
        {grouped.map(({ category, datasets: sectionDatasets }) => {
          if (sectionDatasets.length === 0) return null;

          return (
            <Box key={category}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  mb: 1.25,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                  {category}
                </Typography>
              </Box>

              <Grid container spacing={2}>
                {sectionDatasets.map(({ datasetKey, config }) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={datasetKey}>
                    <Card
                      elevation={0}
                      sx={{
                        height: '100%',
                        border: '1px solid rgba(0,0,0,0.08)',
                        bgcolor: 'background.paper',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 3,
                          borderColor: 'rgba(0,0,0,0.14)',
                        },
                      }}
                    >
                      <CardActionArea
                        onClick={() => onSelectDataset(datasetKey)}
                        sx={{ height: '100%', p: 1.75 }}
                      >
                        <Stack spacing={1.25}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                            {config.method === 'side_by_side' ? (
                              <CompareArrowsIcon color="primary" sx={{ fontSize: 26 }} />
                            ) : (
                              <DatasetIcon color="primary" sx={{ fontSize: 26 }} />
                            )}
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                              {config.name}
                            </Typography>
                          </Box>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {config.description}
                          </Typography>

                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                              label={config.method === 'side_by_side' ? 'Side-by-Side' : 'Single Model'}
                              size="small"
                              color={config.method === 'side_by_side' ? 'secondary' : 'primary'}
                              variant="outlined"
                            />
                          </Box>
                        </Stack>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          );
        })}
      </Stack>

      {datasets.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <Typography variant="body2" color="text.secondary">
            No datasets configured. Add datasets to <code>public/datasets.yaml</code>
          </Typography>
        </Box>
      )}
    </Container>
  );
}


