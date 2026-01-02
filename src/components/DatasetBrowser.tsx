/**
 * Dataset browser - shows available datasets when no specific dataset is selected
 */

import React from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  CardActionArea,
  Container,
  Grid,
  Chip,
  Stack
} from '@mui/material';
import DatasetIcon from '@mui/icons-material/Dataset';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import type { DatasetConfig } from '../types/dataset';

interface DatasetBrowserProps {
  datasets: Array<{ name: string; config: DatasetConfig }>;
  onSelectDataset: (datasetName: string) => void;
}

export function DatasetBrowser({ datasets, onSelectDataset }: DatasetBrowserProps) {
  const handleClick = (datasetName: string) => {
    // Navigate to the dataset URL
    window.location.pathname = `/${datasetName}`;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ mb: 2, fontWeight: 600 }}>
          StringSight Datasets
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Select a dataset to explore behavioral properties and analysis results
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {datasets.map(({ name, config }) => (
          <Grid item xs={12} md={6} lg={4} key={name}>
            <Card 
              elevation={2}
              sx={{ 
                height: '100%',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
            >
              <CardActionArea 
                onClick={() => handleClick(name)}
                sx={{ height: '100%', p: 2 }}
              >
                <CardContent>
                  <Stack spacing={2}>
                    {/* Icon and title */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {config.method === 'side_by_side' ? (
                        <CompareArrowsIcon color="primary" sx={{ fontSize: 32 }} />
                      ) : (
                        <DatasetIcon color="primary" sx={{ fontSize: 32 }} />
                      )}
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {config.name}
                      </Typography>
                    </Box>

                    {/* Description */}
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ minHeight: 40 }}
                    >
                      {config.description}
                    </Typography>

                    {/* Metadata chips */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip 
                        label={config.method === 'side_by_side' ? 'Side-by-Side' : 'Single Model'}
                        size="small"
                        color={config.method === 'side_by_side' ? 'secondary' : 'primary'}
                        variant="outlined"
                      />
                      {config.created_at && (
                        <Chip 
                          label={config.created_at}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    {/* File count */}
                    <Typography variant="caption" color="text.secondary">
                      {config.files.length} files available
                    </Typography>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {datasets.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary">
            No datasets configured. Add datasets to <code>public/datasets.yaml</code>
          </Typography>
        </Box>
      )}
    </Container>
  );
}


