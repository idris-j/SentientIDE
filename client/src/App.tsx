import { Route, Switch } from 'wouter';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Sidebar } from '@/components/Sidebar';
import { CodeEditor } from '@/components/Editor';
import { AIPanel } from '@/components/AIPanel';
import { Terminal } from '@/components/Terminal';
import { MenuBar } from '@/components/MenuBar';
import { TabsView } from '@/components/TabsView';
import { ThemeProvider } from '@/lib/theme-context';
import { FileProvider } from '@/lib/file-context';
import { LandingPage } from '@/components/LandingPage';
import { CommandPalette } from '@/components/CommandPalette';

function IDELayout() {
  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col overflow-hidden">
      <MenuBar />
      <CommandPalette />
      <div className="flex-1 relative">
        <ResizablePanelGroup 
          direction="horizontal" 
          className="h-full rounded-lg bg-background"
        >
          <ResizablePanel 
            defaultSize={20} 
            minSize={15} 
            maxSize={25}
            className="bg-sidebar p-2"
          >
            <Sidebar />
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border" />

          <ResizablePanel 
            defaultSize={50}
            className="bg-editor-bg"
          >
            <div className="h-full flex flex-col">
              <TabsView />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border" />

          <ResizablePanel 
            defaultSize={30}
            className="bg-card"
          >
            <AIPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <FileProvider>
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/editor" component={IDELayout} />
        </Switch>
      </FileProvider>
    </ThemeProvider>
  );
}

export default App;