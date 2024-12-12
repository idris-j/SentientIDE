import { createContext, useContext, useState } from 'react';

interface FileContextType {
  currentFile: string | null;
  setCurrentFile: (path: string | null) => void;
  openFiles: string[];
  closeFile: (path: string) => void;
  addFile: (path: string) => void;
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

  return (
    <FileContext.Provider value={{ 
      currentFile, 
      setCurrentFile, 
      openFiles, 
      closeFile, 
      addFile 
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
