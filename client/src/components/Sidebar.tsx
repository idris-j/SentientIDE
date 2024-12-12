import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/lib/theme-context';
import { useFile } from '@/lib/file-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Folder, Settings, Moon, Sun, Monitor } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
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
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
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

  const handleDelete = async (filePath: string) => {
    try {
      const response = await fetch('/api/files/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      toast({
        title: 'Success',
        description: 'File deleted successfully',
      });
      
      fetchFiles();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete file',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (filePath: string) => {
    try {
      const response = await fetch('/api/files/duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath }),
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate file');
      }

      toast({
        title: 'Success',
        description: 'File duplicated successfully',
      });
      
      fetchFiles();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to duplicate file',
        variant: 'destructive',
      });
    }
  };

  const handleRename = (filePath: string) => {
    const basename = filePath.split('/').pop() || '';
    setFileToRename({ path: filePath, name: basename });
    setNewFileName(basename);
    setRenameDialogOpen(true);
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
        throw new Error('Failed to rename file');
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

  const toggleFileSelection = (filePath: string, event: React.MouseEvent) => {
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
    } else {
      setSelectedFiles(new Set([filePath]));
    }
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
          destination: '.', // Extract to current directory
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
    const Icon = node.type === 'folder' ? Folder : FileText;
    const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
    const isExpanded = expandedFolders.has(fullPath);
    
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
                } else {
                  toggleFileSelection(fullPath, e);
                  setCurrentFile(fullPath);
                }
              }}
              className={cn(
                "w-full justify-start gap-2 font-normal hover:bg-accent",
                selectedFiles.has(fullPath) && "bg-accent"
              )}
            >
              {node.type === 'folder' && (
                <div className="w-4 h-4 flex items-center justify-center">
                  {isExpanded ? '▼' : '▶'}
                </div>
              )}
              <Icon size={16} />
              {node.name}
            </Button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {node.name.endsWith('.zip') && (
              <ContextMenuItem onClick={() => handleUnzip(node.name)}>
                Extract Here
              </ContextMenuItem>
            )}
            {node.type === 'file' && (
              <>
                <ContextMenuItem onClick={() => handleDuplicate(fullPath)}>
                  Duplicate
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleDelete(fullPath)}>
                  Delete
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleRename(fullPath)}>
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

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename {fileToRename?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right">New name</label>
              <Input
                className="col-span-3"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRenameSubmit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
