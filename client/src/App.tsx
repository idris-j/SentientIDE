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
import { useState } from 'react';

function IDELayout() {
  const [showTerminal, setShowTerminal] = useState(false);

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col overflow-hidden">
      <MenuBar onToggleTerminal={() => setShowTerminal(prev => !prev)} />
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
            className="bg-sidebar-background p-2"
          >
            <Sidebar />
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border" />

          <ResizablePanel 
            defaultSize={50}
            className="bg-editor-bg flex flex-col"
          >
            <TabsView />
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={70}>
                <CodeEditor />
              </ResizablePanel>

              {showTerminal && (
                <>
                  <ResizableHandle withHandle className="bg-border" />
                  <ResizablePanel
                    defaultSize={30}
                    minSize={20}
                    className="bg-background"
                  >
                    <div id="terminal-panel" className="w-full h-full">
                      <Terminal className="w-full h-full p-2" />
                    </div>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
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