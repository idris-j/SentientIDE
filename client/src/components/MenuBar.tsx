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
import { FileText, Save, FolderOpen, Settings } from "lucide-react"

export function MenuBar() {
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

  const { theme, setTheme, variant, setVariant } = useTheme()
  const { currentFile, setCurrentFile } = useFile()

  return (
    <Menubar className="border-b px-2 lg:px-4">
      <MenubarMenu>
        <MenubarTrigger className="font-bold">File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            New File <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
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
          <MenubarItem>
            <Save className="mr-2 h-4 w-4" />
            Save <MenubarShortcut>⌘S</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>Save As... <MenubarShortcut>⇧⌘S</MenubarShortcut></MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="font-bold">Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Undo <MenubarShortcut>⌘Z</MenubarShortcut></MenubarItem>
          <MenubarItem>Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut></MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Cut <MenubarShortcut>⌘X</MenubarShortcut></MenubarItem>
          <MenubarItem>Copy <MenubarShortcut>⌘C</MenubarShortcut></MenubarItem>
          <MenubarItem>Paste <MenubarShortcut>⌘V</MenubarShortcut></MenubarItem>
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
