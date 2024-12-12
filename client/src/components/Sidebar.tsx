import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/lib/theme-context';
import { Button } from '@/components/ui/button';
import { FileText, Folder, Settings, Moon, Sun, Monitor } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { useToast } from '@/hooks/use-toast';
import { FileUpload } from './FileUpload';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

export function Sidebar() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));
  const [files, setFiles] = useState<FileNode[]>([]);

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

  const toggleFolder = (folderName: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
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
      
      // Refresh file list after unzipping
      fetchFiles();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to unzip project',
        variant: 'destructive',
      });
    }
  };

  const renderFileTree = (node: FileNode, depth = 0, path = '') => {
    const Icon = node.type === 'folder' ? Folder : FileText;
    const currentPath = path ? `${path}/${node.name}` : node.name;
    const isExpanded = expandedFolders.has(currentPath);
    
    return (
      <div key={currentPath}>
        <ContextMenu>
          <ContextMenuTrigger>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 font-normal hover:bg-accent"
              style={{ paddingLeft: `${depth * 1.5}rem` }}
              onClick={() => node.type === 'folder' && toggleFolder(currentPath)}
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
          </ContextMenuContent>
        </ContextMenu>
        {node.type === 'folder' && isExpanded && (
          <div>
            {node.children?.map(child => renderFileTree(child, depth + 1, currentPath))}
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
