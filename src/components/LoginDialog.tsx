import React from 'react';
import { Dialog, DialogContent, IconButton, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Login } from './Login';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export function LoginDialog({ open, onClose, onLoginSuccess }: LoginDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box position="absolute" right={8} top={8}>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent>
        <Login onLoginSuccess={onLoginSuccess} />
      </DialogContent>
    </Dialog>
  );
}
