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
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(true);
  const [isEditorSplit, setIsEditorSplit] = React.useState(false);

  const handleOpenFolder = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.onchange = async (e) => {
        const files = e.target.files;
        if (files?.length) {
          // Handle folder upload logic
          toast({
            title: 'Success',
            description: 'Folder opened successfully',
          });
        }
      };
      input.click();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to open folder',
        variant: 'destructive',
      });
    }
  };

  const handleOpenFile = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const content = e.target?.result;
            // Handle file content
            addFile(file.name);
          };
          reader.readAsText(file);
        }
      };
      input.click();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to open file',
        variant: 'destructive',
      });
    }
  };

  const handleToggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
    // Emit event for sidebar toggle
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  };

  const handleSplitEditor = () => {
    setIsEditorSplit(!isEditorSplit);
    // Emit event for editor split
    window.dispatchEvent(new CustomEvent('split-editor'));
  };

  const handleNewFile = async () => {
    try {
      const fileName = prompt('Enter file name:', 'untitled.ts');
      if (!fileName) return;

      // Create new file on server
      const response = await fetch('/api/files/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: fileName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to create new file');
      }

      const data = await response.json();
      
      // Initialize Monaco editor model with empty content
      const monaco = (window as any).monaco;
      if (monaco) {
        const uri = monaco.Uri.parse(data.path);
        
        // Always dispose existing model to ensure clean state
        const existingModel = monaco.editor.getModel(uri);
        if (existingModel) {
          existingModel.dispose();
        }

        // Detect language from file extension
        const fileExtension = data.path.split('.').pop() || '';
        const language = monaco.languages.getLanguages()
          .find((lang: any) => 
            lang.extensions?.some((ext: string) => 
              ext.toLowerCase() === `.${fileExtension.toLowerCase()}`
            )
          )?.id || 'plaintext';

        // Create new model with empty content
        monaco.editor.createModel('', language, uri);
      }
      
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

  const handleSaveAs = async () => {
    if (!currentFile) {
      toast({
        title: 'Error',
        description: 'No file is currently open',
        variant: 'destructive',
      });
      return;
    }

    try {
      const newPath = prompt('Save as:', currentFile);
      if (!newPath) return;

      await saveFileAs(currentFile, newPath);
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
              <MenubarItem onClick={handleOpenFolder}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Open Folder...
              </MenubarItem>
              <MenubarItem onClick={handleOpenFile}>
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
          <MenubarItem onClick={handleSaveAs}>Save As... <MenubarShortcut>⇧⌘S</MenubarShortcut></MenubarItem>
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
          <MenubarItem onClick={handleSplitEditor}>Split Editor</MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={handleToggleSidebar}>
            Toggle Sidebar <MenubarShortcut>⌘B</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

    </Menubar>
  )
}