import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
} from '@mui/material';
import {
  CompareArrows as SideBySideIcon,
  Analytics as StandardIcon,
} from '@mui/icons-material';

interface DemoModeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: 'single_model' | 'side_by_side') => void;
}

export default function DemoModeSelector({
  open,
  onClose,
  onSelect,
}: DemoModeSelectorProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Choose Demo Mode
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          We will analyze TauBench, a benchmark that simulates a customer service agent for airlines. Select how you want to analyze this data.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Card
            sx={{
              flex: 1,
              border: '2px solid',
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'primary.main',
                boxShadow: 2,
              },
            }}
          >
            <CardActionArea onClick={() => onSelect('single_model')}>
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <StandardIcon
                  sx={{
                    fontSize: 48,
                    color: 'primary.main',
                    mb: 2,
                  }}
                />
                <Typography variant="h6" gutterBottom>
                  Standard
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Analyze each of your model traces individually. Ideal for when you have responses for only 1 model or want to compare 3+ models.
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>

          <Card
            sx={{
              flex: 1,
              border: '2px solid',
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'primary.main',
                boxShadow: 2,
              },
            }}
          >
            <CardActionArea onClick={() => onSelect('side_by_side')}>
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <SideBySideIcon
                  sx={{
                    fontSize: 48,
                    color: 'primary.main',
                    mb: 2,
                  }}
                />
                <Typography variant="h6" gutterBottom>
                  Side-by-Side
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Compare responses from two models (A vs B). Perfect for A/B testing, preference evaluation, and understanding model differences.
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
