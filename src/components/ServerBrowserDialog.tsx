import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DescriptionIcon from '@mui/icons-material/Description';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { listPath } from '../lib/api';

interface ServerBrowserDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectPath: (path: string) => void;
  title?: string;
  description?: string;
  initialPath?: string;
  selectMode?: 'file' | 'directory';
}

/**
 * Dialog for browsing server directories and files
 */
export function ServerBrowserDialog({
  open,
  onClose,
  onSelectPath,
  title = 'Browse Server',
  description = 'Select a directory or file from the server',
  initialPath = '.',
  selectMode = 'directory',
}: ServerBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [files, setFiles] = useState<string[]>([]);
  const [dirs, setDirs] = useState<string[]>([]);
  const [parent, setParent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [actualCurrentPath, setActualCurrentPath] = useState<string>(''); // Track server's actual path

  // Load directory contents
  useEffect(() => {
    if (!open) return;

    const loadPath = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await listPath(currentPath);
        setFiles(result.files || []);
        setDirs(result.dirs || []);
        setParent(result.parent);
        setActualCurrentPath(result.current); // Use server's reported current path
        if (result.error) {
          setError(result.error);
        }
      } catch (e: any) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    };

    void loadPath();
  }, [currentPath, open]);

  // Parse breadcrumb path - use actualCurrentPath from server
  const pathParts = actualCurrentPath ? actualCurrentPath.split('/').filter(Boolean) : [];

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setSelectedPath(null);
  };

  const handleSelect = () => {
    if (selectedPath) {
      onSelectPath(selectedPath);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>

        {/* Breadcrumb navigation */}
        <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#F3F4F6', borderRadius: 1 }}>
          <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
            <Link
              component="button"
              variant="body2"
              onClick={() => handleNavigate(initialPath)}
              sx={{ cursor: 'pointer' }}
            >
              Home
            </Link>
            {pathParts.map((part, index) => {
              // Reconstruct absolute path from root for each breadcrumb
              const path = '/' + pathParts.slice(0, index + 1).join('/');
              const isLast = index === pathParts.length - 1;
              return isLast ? (
                <Typography key={path} variant="body2" color="text.primary">
                  {part}
                </Typography>
              ) : (
                <Link
                  key={path}
                  component="button"
                  variant="body2"
                  onClick={() => handleNavigate(path)}
                  sx={{ cursor: 'pointer' }}
                >
                  {part}
                </Link>
              );
            })}
          </Breadcrumbs>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Current: {actualCurrentPath || currentPath}
          </Typography>
        </Box>

        {/* Error message */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Loading indicator */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Directory and file list */}
        {!loading && (
          <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 1, maxHeight: 400, overflow: 'auto' }}>
            <List dense>
              {/* Parent directory link */}
              {parent && (
                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleNavigate(parent)}>
                    <ListItemIcon>
                      <FolderOpenIcon />
                    </ListItemIcon>
                    <ListItemText primary=".." secondary="Parent directory" />
                  </ListItemButton>
                </ListItem>
              )}

              {/* Directories */}
              {dirs.map((dir) => {
                // Backend returns just directory names; construct full path properly
                // Use actualCurrentPath if available, otherwise fall back to currentPath
                const basePath = actualCurrentPath || currentPath;
                const fullPath = basePath === '.' || basePath === '' 
                  ? dir 
                  : basePath.endsWith('/') 
                    ? `${basePath}${dir}` 
                    : `${basePath}/${dir}`;
                const isSelected = selectedPath === fullPath;
                return (
                  <ListItem
                    key={dir}
                    disablePadding
                    sx={{
                      backgroundColor: isSelected ? '#E0E7FF' : 'transparent',
                    }}
                  >
                    <ListItemButton
                      onClick={() => {
                        if (selectMode === 'directory') {
                          setSelectedPath(fullPath);
                        }
                      }}
                      onDoubleClick={() => handleNavigate(fullPath)}
                    >
                      <ListItemIcon>
                        <FolderIcon />
                      </ListItemIcon>
                      <ListItemText primary={dir} />
                    </ListItemButton>
                  </ListItem>
                );
              })}

              {/* Files */}
              {selectMode === 'file' &&
                files.map((file) => {
                  // Backend returns just file names; construct full path properly
                  const basePath = actualCurrentPath || currentPath;
                  const fullPath = basePath === '.' || basePath === '' 
                    ? file 
                    : basePath.endsWith('/') 
                      ? `${basePath}${file}` 
                      : `${basePath}/${file}`;
                  const isSelected = selectedPath === fullPath;
                  return (
                    <ListItem
                      key={file}
                      disablePadding
                      sx={{
                        backgroundColor: isSelected ? '#E0E7FF' : 'transparent',
                      }}
                    >
                      <ListItemButton onClick={() => setSelectedPath(fullPath)}>
                        <ListItemIcon>
                          <DescriptionIcon />
                        </ListItemIcon>
                        <ListItemText primary={file} />
                      </ListItemButton>
                    </ListItem>
                  );
                })}

              {/* Empty state */}
              {dirs.length === 0 && (selectMode === 'directory' || files.length === 0) && (
                <ListItem>
                  <ListItemText
                    primary="No items"
                    secondary={selectMode === 'directory' ? 'No directories found' : 'No files or directories found'}
                    sx={{ textAlign: 'center', color: 'text.secondary' }}
                  />
                </ListItem>
              )}
            </List>
          </Box>
        )}

        {/* Selected path display */}
        {selectedPath && (
          <Box sx={{ mt: 2, p: 1.5, backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Selected:
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
              {selectedPath}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSelect}
          variant="contained"
          disabled={!selectedPath}
        >
          Select
        </Button>
      </DialogActions>
    </Dialog>
  );
}

