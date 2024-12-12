import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/lib/theme-context';
import { useFile } from '@/lib/file-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Folder, Settings, Moon, Sun, Monitor } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { useToast } from '@/hooks/use-toast';
import { FileUpload } from './FileUpload';
import { cn } from '@/lib/utils';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

export function Sidebar() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { setCurrentFile } = useFile();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [fileToRename, setFileToRename] = useState<{ path: string; name: string } | null>(null);
  const [newFileName, setNewFileName] = useState('');

  const fetchFiles = async () => {
    try {
      const response = await fetch('/api/files');
      if (response.ok) {
        const fileList = await response.json();
        setFiles(fileList);
      } else {
        throw new Error('Failed to fetch files');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch file list',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleDelete = async (filePath: string | string[]) => {
    const paths = Array.isArray(filePath) ? filePath : [filePath];
    
    try {
      const response = await fetch('/api/files/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paths }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete files');
      }

      const failedFiles = data.results?.filter(r => !r.success) || [];
      if (failedFiles.length > 0) {
        toast({
          title: 'Warning',
          description: `Failed to delete ${failedFiles.length} files`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: `${paths.length} file(s) deleted successfully`,
        });
      }
      
      fetchFiles();
      setSelectedFiles(new Set());
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete files',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (filePath: string | string[]) => {
    const paths = Array.isArray(filePath) ? filePath : [filePath];
    
    try {
      const response = await fetch('/api/files/duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paths }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to duplicate files');
      }

      const failedFiles = data.results?.filter(r => !r.success) || [];
      if (failedFiles.length > 0) {
        toast({
          title: 'Warning',
          description: `Failed to duplicate ${failedFiles.length} files`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: `${paths.length} file(s) duplicated successfully`,
        });
      }
      
      fetchFiles();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to duplicate files',
        variant: 'destructive',
      });
    }
  };

  const handleRename = (filePath: string, nodeType: 'file' | 'folder') => {
    const basename = filePath.split('/').pop() || '';
    setFileToRename({ path: filePath, name: basename });
    setNewFileName(basename);
  };

  const handleRenameSubmit = async () => {
    if (!fileToRename || !newFileName) return;
    
    try {
      const response = await fetch('/api/files/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oldPath: fileToRename.path, newName: newFileName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rename file');
      }

      toast({
        title: 'Success',
        description: 'File renamed successfully',
      });
      
      setRenameDialogOpen(false);
      fetchFiles();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to rename file',
        variant: 'destructive',
      });
    }
  };

  const handleFileSelection = (filePath: string, nodeType: 'file' | 'folder', event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey) {
      setSelectedFiles(prev => {
        const next = new Set(prev);
        if (next.has(filePath)) {
          next.delete(filePath);
        } else {
          next.add(filePath);
        }
        return next;
      });
    } else if (event.shiftKey && selectedFiles.size > 0) {
      const allFiles = getAllFiles(files);
      const lastSelected = Array.from(selectedFiles).pop()!;
      const currentIndex = allFiles.findIndex(f => f.path === filePath);
      const lastIndex = allFiles.findIndex(f => f.path === lastSelected);
      
      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);
        const rangeSelection = allFiles.slice(start, end + 1).map(f => f.path);
        setSelectedFiles(new Set(rangeSelection));
      }
    } else {
      setSelectedFiles(new Set([filePath]));
    }

    if (nodeType === 'file') {
      setCurrentFile(filePath);
    }
  };

  const getAllFiles = (nodes: FileNode[], parentPath = ''): Array<{ path: string; node: FileNode }> => {
    return nodes.reduce((acc, node) => {
      const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
      if (node.type === 'folder' && node.children) {
        return [...acc, { path: currentPath, node }, ...getAllFiles(node.children, currentPath)];
      }
      return [...acc, { path: currentPath, node }];
    }, [] as Array<{ path: string; node: FileNode }>);
  };

  const handleUnzip = async (filename: string) => {
    try {
      const response = await fetch('/api/unzip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename,
          destination: '.',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to unzip file');
      }

      toast({
        title: 'Success',
        description: 'Project unzipped successfully',
      });
      
      fetchFiles();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to unzip project',
        variant: 'destructive',
      });
    }
  };

  const renderFileTree = (node: FileNode, depth = 0, currentPath = '') => {
    const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
    const isExpanded = expandedFolders.has(fullPath);
    const isSelected = selectedFiles.has(fullPath);
    
    return (
      <div key={fullPath}>
        <ContextMenu>
          <ContextMenuTrigger>
            <Button
                variant="ghost"
                size="sm"
                style={{ paddingLeft: `${depth * 1.5}rem` }}
                onClick={(e) => {
                  if (node.type === 'folder') {
                    toggleFolder(fullPath);
                  }
                  handleFileSelection(fullPath, node.type, e);
                }}
                className={cn(
                  "w-full justify-start gap-2 font-normal",
                  isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 hover:text-accent-foreground",
                  "focus-visible:bg-accent focus-visible:text-accent-foreground"
                )}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handleFileSelection(fullPath, node.type, e as unknown as React.MouseEvent);
                  }
                }}
              >
                {node.type === 'folder' && (
                  <div className="w-4 h-4 flex items-center justify-center">
                    {isExpanded ? '▼' : '▶'}
                  </div>
                )}
                {node.type === 'folder' ? <Folder size={16} /> : <FileText size={16} />}
                {node.name}
              </Button>
              {fileToRename?.path === fullPath && (
                <Popover open={true} onOpenChange={(open) => !open && setFileToRename(null)}>
                  <PopoverContent 
                    className="w-72 p-4" 
                    side="bottom" 
                    align="start" 
                    sideOffset={5}
                  >
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Rename {fileToRename.name}</h4>
                        <Input
                          id="name"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleRenameSubmit();
                            } else if (e.key === 'Escape') {
                              setFileToRename(null);
                            }
                          }}
                          placeholder="Enter new name"
                          className="h-8"
                          autoFocus
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setFileToRename(null)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="sm"
                          onClick={handleRenameSubmit}
                        >
                          Rename
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
          </ContextMenuTrigger>
          <ContextMenuContent>
            {selectedFiles.size > 1 ? (
              // Multiple files selected
              <>
                <ContextMenuItem onClick={() => handleDuplicate(Array.from(selectedFiles))}>
                  Duplicate Selected Files
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleDelete(Array.from(selectedFiles))}>
                  Delete Selected Files
                </ContextMenuItem>
              </>
            ) : (
              // Single file selected
              <>
                {node.name.endsWith('.zip') && (
                  <ContextMenuItem onClick={() => handleUnzip(fullPath)}>
                    Extract Here
                  </ContextMenuItem>
                )}
                <ContextMenuItem onClick={() => handleDuplicate(fullPath)}>
                  Duplicate
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleDelete(fullPath)}>
                  Delete
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleRename(fullPath, node.type)}>
                  Rename
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
        {node.type === 'folder' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderFileTree(child, depth + 1, fullPath))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-sidebar border-r">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Files</h2>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          {files.map(file => renderFileTree(file))}
        </div>
      </ScrollArea>

      <FileUpload onUploadSuccess={fetchFiles} />

      <div className="p-4 border-t">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
              <Settings size={16} />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Theme</label>
                <Select
                  defaultValue={theme}
                  onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun size={16} />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon size={16} />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Monitor size={16} />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
