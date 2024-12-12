import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FileText, Folder, Settings } from 'lucide-react';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

const demoFiles: FileNode[] = [
  {
    name: 'src',
    type: 'folder',
    children: [
      { name: 'main.ts', type: 'file' },
      { name: 'utils.ts', type: 'file' },
    ]
  },
  { name: 'package.json', type: 'file' },
];

export function Sidebar() {
  const renderFileTree = (node: FileNode, depth = 0) => {
    const Icon = node.type === 'folder' ? Folder : FileText;
    
    return (
      <div key={node.name} style={{ paddingLeft: `${depth * 1.5}rem` }}>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 font-normal hover:bg-accent"
        >
          <Icon size={16} />
          {node.name}
        </Button>
        {node.children?.map(child => renderFileTree(child, depth + 1))}
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
          {demoFiles.map(file => renderFileTree(file))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
          <Settings size={16} />
          Settings
        </Button>
      </div>
    </div>
  );
}
