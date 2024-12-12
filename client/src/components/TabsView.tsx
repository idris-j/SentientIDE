import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { X } from "lucide-react";
import { useFile } from '@/lib/file-context';
import { CodeEditor } from './Editor';
import { cn } from "@/lib/utils";

export function TabsView() {
  const { currentFile, openFiles, closeFile, setCurrentFile } = useFile();
  
  if (!openFiles?.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a file to edit
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Tabs
        value={currentFile || undefined}
        onValueChange={setCurrentFile}
        className="flex-1 flex flex-col"
      >
        <div className="border-b px-1 bg-background">
          <TabsList className="h-10 w-full justify-start gap-1 bg-transparent p-0">
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
        </div>
        <div className="flex-1 relative">
          {openFiles.map((file) => (
            <TabsContent
              key={file}
              value={file}
              className="absolute inset-0 h-full data-[state=inactive]:hidden"
            >
              <CodeEditor filePath={file} />
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
