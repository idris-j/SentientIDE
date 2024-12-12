import { useRef, useEffect, useState } from 'react';
import Editor from "@monaco-editor/react";
import { Card } from '@/components/ui/card';
import type * as Monaco from 'monaco-editor';
import { useFile } from '@/lib/file-context';

interface CodeEditorProps {
  filePath: string;
}

export function CodeEditor({ filePath }: CodeEditorProps) {
  const [content, setContent] = useState<string>('// Loading...');
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`);
        if (response.ok) {
          const text = await response.text();
          setContent(text);
        }
      } catch (error) {
        console.error('Failed to fetch file content:', error);
        setContent(`// Error loading ${filePath}\n// ${error}`);
      }
    };

    fetchContent();
  }, [filePath]);

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
        value={content}
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
