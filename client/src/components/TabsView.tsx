import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { X, Split } from "lucide-react";
import { useFile } from '@/lib/file-context';
import { CodeEditor } from './Editor';
import { cn } from "@/lib/utils";

export function TabsView() {
  const { currentFile, openFiles, closeFile, setCurrentFile } = useFile();
  const [isSplit, setIsSplit] = React.useState(false);
  const [splitFile, setSplitFile] = React.useState<string | null>(null);
  
  if (!openFiles?.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a file to edit
      </div>
    );
  }

  const toggleSplit = () => {
    if (!isSplit && openFiles.length > 1) {
      setIsSplit(true);
      setSplitFile(openFiles[1]);
    } else {
      setIsSplit(false);
      setSplitFile(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b px-1 bg-background flex items-center">
        <TabsList className="h-10 flex-1 justify-start gap-1 bg-transparent p-0">
          {openFiles.map((file) => (
            <TabsTrigger
              key={file}
              value={file}
              className={cn(
                "relative h-9 rounded-none border-b-2 border-b-transparent px-4 pb-3 pt-2 font-normal hover:bg-muted/30 data-[state=active]:border-b-primary data-[state=active]:bg-muted/40",
                "group flex items-center gap-2 text-sm"
              )}
            >
              <span className="truncate max-w-[120px]">
                {file.split('/').pop()}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close tab</span>
              </button>
            </TabsTrigger>
          ))}
        </TabsList>
        <button
          onClick={toggleSplit}
          className={cn(
            "px-2 py-1 rounded hover:bg-muted/30",
            isSplit && "bg-muted/40"
          )}
          disabled={openFiles.length < 2}
        >
          <Split className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 relative">
        {isSplit ? (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50}>
              <Tabs
                value={currentFile || undefined}
                onValueChange={setCurrentFile}
                className="h-full"
              >
                <TabsContent
                  value={currentFile || ""}
                  className="h-full data-[state=inactive]:hidden"
                >
                  <CodeEditor filePath={currentFile || ""} />
                </TabsContent>
              </Tabs>
            </ResizablePanel>
            
            <ResizableHandle />
            
            <ResizablePanel defaultSize={50}>
              <Tabs
                value={splitFile || undefined}
                onValueChange={setSplitFile}
                className="h-full"
              >
                <TabsContent
                  value={splitFile || ""}
                  className="h-full data-[state=inactive]:hidden"
                >
                  <CodeEditor filePath={splitFile || ""} />
                </TabsContent>
              </Tabs>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <Tabs
            value={currentFile || undefined}
            onValueChange={setCurrentFile}
            className="h-full"
          >
            {openFiles.map((file) => (
              <TabsContent
                key={file}
                value={file}
                className="h-full data-[state=inactive]:hidden"
              >
                <CodeEditor filePath={file} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
