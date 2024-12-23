import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Sidebar } from '@/components/Sidebar';
import { CodeEditor } from '@/components/Editor';
import { AIPanel } from '@/components/AIPanel';
import { Terminal } from '@/components/Terminal';
import { MenuBar } from '@/components/MenuBar';
import { TabsView } from '@/components/TabsView';
import { ThemeProvider } from '@/lib/theme-context';
import { FileProvider } from '@/lib/file-context';

function App() {
  return (
    <ThemeProvider>
      <FileProvider>
        <div className="h-screen w-screen bg-background text-foreground flex flex-col">
          <MenuBar />
          <div className="flex-1">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={20} minSize={15} maxSize={25}>
                <Sidebar />
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={50}>
                <div className="h-full flex flex-col">
                  <TabsView />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={30}>
                <AIPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>
      </FileProvider>
    </ThemeProvider>
  );
}

export default App;