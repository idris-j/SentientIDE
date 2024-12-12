import { useRef } from 'react';
import Editor from "@monaco-editor/react";
import { Card } from '@/components/ui/card';
import type * as Monaco from 'monaco-editor';

export function CodeEditor() {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount = (editor: Monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    
    // Add editor change listener
    editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      // Trigger AI analysis here
      console.log('Code changed:', value);
    });
  };

  return (
    <Card className="h-full w-full rounded-none border-0 bg-[#1e1e1e]">
      <Editor
        defaultLanguage="typescript"
        defaultValue="// Start coding here\n"
        theme="vs-dark"
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: true,
          scrollBeyondLastLine: false,
          readOnly: false,
          cursorStyle: 'line',
          quickSuggestions: true,
          folding: true,
          lineDecorationsWidth: 10,
          renderLineHighlight: 'all',
          automaticLayout: true,
        }}
        onMount={handleEditorDidMount}
        className="h-full w-full"
      />
    </Card>
  );
}
