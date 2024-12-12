import { createContext, useContext, useState } from 'react';

interface FileContextType {
  currentFile: string | null;
  setCurrentFile: (path: string | null) => void;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export function FileProvider({ children }: { children: React.ReactNode }) {
  const [currentFile, setCurrentFile] = useState<string | null>(null);

  return (
    <FileContext.Provider value={{ currentFile, setCurrentFile }}>
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
