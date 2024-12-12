import { createContext, useContext, useState } from 'react';

interface FileContextType {
  currentFile: string | null;
  setCurrentFile: (path: string | null) => void;
  openFiles: string[];
  closeFile: (path: string) => void;
  addFile: (path: string) => void;
  saveFile: (path: string) => Promise<void>;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export function FileProvider({ children }: { children: React.ReactNode }) {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);

  const closeFile = (path: string) => {
    setOpenFiles((files) => files.filter((f) => f !== path));
    if (currentFile === path) {
      const remainingFiles = openFiles.filter((f) => f !== path);
      setCurrentFile(remainingFiles.length > 0 ? remainingFiles[0] : null);
    }
  };

  const addFile = (path: string) => {
    setOpenFiles((files) => {
      if (!files.includes(path)) {
        return [...files, path];
      }
      return files;
    });
    setCurrentFile(path);
  };

  const saveFile = async (path: string) => {
    const editor = (window as any).monaco?.editor
      .getModels()
      .find((model: any) => model.uri.path === path);
    
    if (!editor) {
      throw new Error('File not found in editor');
    }

    const content = editor.getValue();
    
    const response = await fetch(`/api/files/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, content }),
    });

    if (!response.ok) {
      throw new Error('Failed to save file');
    }
  };

  const saveFileAs = async (oldPath: string, newPath: string) => {
    const editor = (window as any).monaco?.editor
      .getModels()
      .find((model: any) => model.uri.path === oldPath);
    
    if (!editor) {
      throw new Error('File not found in editor');
    }

    const content = editor.getValue();
    
    const response = await fetch(`/api/files/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: newPath, content }),
    });

    if (!response.ok) {
      throw new Error('Failed to save file');
    }

    setOpenFiles((files) => {
      if (!files.includes(newPath)) {
        return [...files.filter(f => f !== oldPath), newPath];
      }
      return files;
    });
    setCurrentFile(newPath);
  };

  return (
    <FileContext.Provider value={{ 
      currentFile, 
      setCurrentFile, 
      openFiles, 
      closeFile, 
      addFile,
      saveFile
    }}>
      {children}
    </FileContext.Provider>
  );
}

export function useFile() {
  const context = useContext(FileContext);
  if (context === undefined) {
    throw new Error('useFile must be used within a FileProvider');
  }
  return context;
}
