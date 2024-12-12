import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Sidebar } from '@/components/Sidebar';
import { CodeEditor } from '@/components/Editor';
import { AIPanel } from '@/components/AIPanel';
import { ThemeProvider } from '@/lib/theme-context';

function App() {
  return (
    <ThemeProvider>
      <div className="h-screen w-screen bg-background text-foreground flex">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={25}>
          <Sidebar />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={50}>
          <CodeEditor />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={30}>
          <AIPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
    </ThemeProvider>
  );
}

export default App;
