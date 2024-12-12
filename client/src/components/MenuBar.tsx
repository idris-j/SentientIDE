import * as React from "react"
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { useTheme } from "@/lib/theme-context"
import { useFile } from "@/lib/file-context"
import { FileText, Save, FolderOpen, Settings, FileIcon, Copy, Scissors, Clipboard, RotateCcw, RotateCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function MenuBar() {
  const { toast } = useToast();
  const { theme, setTheme, variant, setVariant } = useTheme();
  const { currentFile, setCurrentFile, addFile, saveFile } = useFile();
  
  const toggleTerminal = () => {
    const terminal = document.getElementById('terminal-panel');
    if (terminal) {
      const currentDisplay = terminal.style.display;
      const isHidden = currentDisplay === 'none' || currentDisplay === '';
      terminal.style.display = isHidden ? 'flex' : 'none';
      
      // Trigger a resize event to ensure the terminal fits properly
      window.dispatchEvent(new Event('resize'));
    }
  };

  const handleNewFile = async () => {
    try {
      const response = await fetch('/api/files/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'untitled.ts' }),
      });

      if (!response.ok) {
        throw new Error('Failed to create new file');
      }

      const data = await response.json();
      addFile(data.path);
      toast({
        title: 'Success',
        description: 'New file created',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create file',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!currentFile) {
      toast({
        title: 'Error',
        description: 'No file is currently open',
        variant: 'destructive',
      });
      return;
    }

    try {
      await saveFile(currentFile);
      toast({
        title: 'Success',
        description: 'File saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save file',
        variant: 'destructive',
      });
    }
  };

  const handleCopy = () => {
    const editor = (window as any).monaco?.editor.getActiveEditor();
    if (editor) {
      editor.getAction('editor.action.clipboardCopyAction').run();
      toast({
        title: 'Success',
        description: 'Copied to clipboard',
      });
    }
  };

  const handleCut = () => {
    const editor = (window as any).monaco?.editor.getActiveEditor();
    if (editor) {
      editor.getAction('editor.action.clipboardCutAction').run();
    }
  };

  const handlePaste = () => {
    const editor = (window as any).monaco?.editor.getActiveEditor();
    if (editor) {
      editor.getAction('editor.action.clipboardPasteAction').run();
    }
  };

  const handleUndo = () => {
    const editor = (window as any).monaco?.editor.getActiveEditor();
    if (editor) {
      editor.trigger('keyboard', 'undo', null);
    }
  };

  const handleRedo = () => {
    const editor = (window as any).monaco?.editor.getActiveEditor();
    if (editor) {
      editor.trigger('keyboard', 'redo', null);
    }
  };

  const clearTerminal = () => {
    const terminal = document.querySelector('.xterm-screen');
    if (terminal) {
      terminal.textContent = '';
    }
  };

// Add keyboard shortcut for terminal toggle
React.useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
      e.preventDefault();
      toggleTerminal();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);

  return (
    <Menubar className="border-b px-2 lg:px-4">
      <MenubarMenu>
        <MenubarTrigger className="font-bold">File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={handleNewFile}>
            <FileIcon className="mr-2 h-4 w-4" />
            New File <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={() => window.open(window.location.href, '_blank')}>
            New Window <MenubarShortcut>⇧⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Open</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>
                <FolderOpen className="mr-2 h-4 w-4" />
                Open Folder...
              </MenubarItem>
              <MenubarItem>
                <FileText className="mr-2 h-4 w-4" />
                Open File...
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save <MenubarShortcut>⌘S</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>Save As... <MenubarShortcut>⇧⌘S</MenubarShortcut></MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="font-bold">Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={handleUndo}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Undo <MenubarShortcut>⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={handleRedo}>
            <RotateCw className="mr-2 h-4 w-4" />
            Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={handleCut}>
            <Scissors className="mr-2 h-4 w-4" />
            Cut <MenubarShortcut>⌘X</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy <MenubarShortcut>⌘C</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={handlePaste}>
            <Clipboard className="mr-2 h-4 w-4" />
            Paste <MenubarShortcut>⌘V</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="font-bold">View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Split Editor</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Toggle Terminal <MenubarShortcut>⌘J</MenubarShortcut></MenubarItem>
          <MenubarItem>Toggle Sidebar <MenubarShortcut>⌘B</MenubarShortcut></MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="font-bold">Terminal</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={toggleTerminal}>
            Toggle Terminal <MenubarShortcut>⌘J</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Clear Terminal</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}
