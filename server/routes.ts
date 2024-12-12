import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from 'ws';
import fileUpload from 'express-fileupload';
import AdmZip from 'adm-zip';
import path from 'path';
function analyzeCode(code: string): string {
  // Basic code analysis
  const suggestions = [];
  
  if (code.includes('var ')) {
    suggestions.push('Consider using const or let instead of var for better scoping');
  }
  
  if (code.includes('function ') && !code.includes(': ')) {
    suggestions.push('Add TypeScript type annotations to improve type safety');
  }
  
  if (code.includes('any')) {
    suggestions.push('Avoid using "any" type, specify a more precise type instead');
  }
  
  if (code.includes('console.log')) {
    suggestions.push('Remember to remove console.log statements in production code');
  }
  
  return suggestions.join('\n');
}
import fs from 'fs/promises';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Configure file upload middleware
  app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    useTempFiles: true,
    tempFileDir: '/tmp/',
    debug: true
  }));

  // Create WebSocket server with a specific path
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws/ide',
    handleProtocols: (protocols: string[]) => {
      // Handle vite-hmr protocol
      if (protocols.includes('vite-hmr')) {
        return 'vite-hmr';
      }
      return protocols[0];
    }
  });

  wss.on('connection', (ws, request) => {
    // Skip handling vite-hmr connections
    if (request.headers['sec-websocket-protocol'] === 'vite-hmr') {
      return;
    }

    console.log('WebSocket client connected');

    const heartbeat = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        const { type, content, currentFile } = data;

        if (type === 'analyze') {
          // Analyze code in real-time
          const response = {
            id: Date.now().toString(),
            type: 'suggestion',
            content: analyzeCode(content),
            fileName: currentFile,
            codeLanguage: 'typescript'
          };
          
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(response));
          }
        } else if (type === 'query') {
          // For now, provide mock responses based on query content
          let response;
          
          if (content.toLowerCase().includes('improve') || content.toLowerCase().includes('suggest')) {
            response = {
              id: Date.now().toString(),
              type: 'suggestion',
              content: `// Here's an improved version of your code:
function improvedFunction() {
  const result = [];
  // Add your implementation here
  return result;
}`,
              fileName: currentFile,
              codeLanguage: 'typescript'
            };
          } else if (content.toLowerCase().includes('explain')) {
            response = {
              id: Date.now().toString(),
              type: 'explanation',
              content: 'This code implements a function that processes data efficiently by using modern JavaScript features like array methods and proper type safety.',
            };
          } else if (content.toLowerCase().includes('code') || content.toLowerCase().includes('example')) {
            response = {
              id: Date.now().toString(),
              type: 'code',
              content: `function exampleCode() {
  // This is an example implementation
  const data = [];
  return data;
}`,
              codeLanguage: 'typescript'
            };
          } else {
            response = {
              id: Date.now().toString(),
              type: 'text',
              content: "I can help you with code suggestions, explanations, and examples. Try asking me to improve your code, explain a concept, or show an example.",
            };
          }

          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(response));
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            id: Date.now().toString(),
            type: 'error',
            content: 'Failed to process message'
          }));
        }
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clearInterval(heartbeat);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clearInterval(heartbeat);
    });
  });

  app.post('/api/upload', async (req, res) => {
    try {
      console.log('Upload request received:', req.files);
      
      if (!req.files || !req.files.project) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const projectFile = req.files.project;
      const uploadPath = path.join(process.cwd(), 'uploads');
      
      console.log('Creating upload directory:', uploadPath);
      // Create uploads directory if it doesn't exist
      await fs.mkdir(uploadPath, { recursive: true });
      
      if (Array.isArray(projectFile)) {
        return res.status(400).json({ error: 'Multiple file upload not supported' });
      }

      const filePath = path.join(uploadPath, projectFile.name);
      console.log('Moving file to:', filePath);
      
      await projectFile.mv(filePath);
      console.log('File uploaded successfully');

      res.json({ success: true, filename: projectFile.name });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to upload file',
        details: error 
      });
    }
  });

  app.post('/api/unzip', async (req, res) => {
    try {
      const { filename, destination } = req.body;
      const zipPath = path.join(process.cwd(), 'uploads', filename);
      const extractPath = path.join(process.cwd(), destination);

      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);

      await fs.unlink(zipPath); // Clean up the zip file
      res.json({ success: true });
    } catch (error) {
      console.error('Error unzipping file:', error);
      res.status(500).json({ error: 'Failed to unzip file' });
    }
  });

  app.get('/api/files/content', async (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) {
        return res.status(400).json({ error: 'Path parameter is required' });
      }

      const absolutePath = path.join(process.cwd(), filePath);
      const content = await fs.readFile(absolutePath, 'utf-8');
      res.send(content);
    } catch (error) {
      console.error('Error reading file:', error);
      res.status(500).json({ error: 'Failed to read file' });
    }
  });

  app.get('/api/files', async (_req, res) => {
    try {
      const rootPath = process.cwd();
      
      async function listFilesRecursive(dir: string, baseDir: string = ''): Promise<any[]> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(
          entries.map(async (entry) => {
            const relativePath = path.join(baseDir, entry.name);
            const fullPath = path.join(dir, entry.name);
            
            // Skip node_modules and hidden directories
            if (entry.name.startsWith('.') || entry.name === 'node_modules') {
              return [];
            }
            
            if (entry.isDirectory()) {
              const children = await listFilesRecursive(fullPath, relativePath);
              return {
                name: entry.name,
                type: 'folder',
                children
              };
            }
            
            return {
              name: entry.name,
              type: 'file'
            };
          })
        );
        
        return files.flat();
      }
      
      const fileList = await listFilesRecursive(rootPath);
      res.json(fileList);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Failed to list files' });
    }
  });
  // File operations
  app.post('/api/files/delete', async (req, res) => {
    try {
      const { paths } = req.body;
      if (!paths || !Array.isArray(paths)) {
        return res.status(400).json({ error: 'Paths array is required' });
      }

      const results = await Promise.all(
        paths.map(async (filePath) => {
          try {
            const absolutePath = path.join(process.cwd(), filePath);
            await fs.unlink(absolutePath);
            return { path: filePath, success: true };
          } catch (err) {
            return { path: filePath, success: false, error: 'Failed to delete file' };
          }
        })
      );

      const success = results.every(r => r.success);
      if (success) {
        res.json({ success: true, results });
      } else {
        res.status(500).json({ 
          error: 'Some files failed to delete', 
          results 
        });
      }
    } catch (error) {
      console.error('Error deleting files:', error);
      res.status(500).json({ error: 'Failed to delete files' });
    }
  });

  app.post('/api/files/duplicate', async (req, res) => {
    try {
      const { paths } = req.body;
      if (!paths || !Array.isArray(paths)) {
        return res.status(400).json({ error: 'Paths array is required' });
      }

      const results = await Promise.all(
        paths.map(async (sourcePath) => {
          try {
            const sourceAbsolutePath = path.join(process.cwd(), sourcePath);
            const ext = path.extname(sourcePath);
            const basename = path.basename(sourcePath, ext);
            const dir = path.dirname(sourcePath);
            let newPath = path.join(dir, `${basename}_copy${ext}`);
            let counter = 1;

            // Handle case where copy already exists
            let exists = true;
            while (exists) {
              try {
                await fs.access(path.join(process.cwd(), newPath));
                newPath = path.join(dir, `${basename}_copy_${counter}${ext}`);
                counter++;
              } catch {
                exists = false;
              }
            }

            await fs.copyFile(sourceAbsolutePath, path.join(process.cwd(), newPath));
            return { path: sourcePath, success: true, newPath };
          } catch (err) {
            return { path: sourcePath, success: false, error: 'Failed to duplicate file' };
          }
        })
      );

      const success = results.every(r => r.success);
      if (success) {
        res.json({ success: true, results });
      } else {
        res.status(500).json({
          error: 'Some files failed to duplicate',
          results
        });
      }
    } catch (error) {
      console.error('Error duplicating files:', error);
      res.status(500).json({ error: 'Failed to duplicate files' });
    }
  });

  app.post('/api/files/rename', async (req, res) => {
    try {
      const { oldPath, newName } = req.body;
      if (!oldPath || !newName) {
        return res.status(400).json({ error: 'Both oldPath and newName are required' });
      }

      const oldAbsolutePath = path.join(process.cwd(), oldPath);
      const dir = path.dirname(oldPath);
      const newPath = path.join(dir, newName);
      const newAbsolutePath = path.join(process.cwd(), newPath);

      try {
        await fs.access(newAbsolutePath);
        return res.status(400).json({ error: 'A file with that name already exists' });
      } catch {
        // File doesn't exist, we can proceed with rename

      await fs.rename(oldAbsolutePath, newAbsolutePath);
        res.json({ success: true, newPath });
      }
    } catch (error) {
      console.error('Error renaming file:', error);
      res.status(500).json({ error: 'Failed to rename file' });
    }
  });

  app.post('/api/theme', async (req, res) => {
    const { variant, primary, appearance, radius } = req.body;
    try {
      const fs = await import('fs/promises');
      await fs.writeFile('theme.json', JSON.stringify({ variant, primary, appearance, radius }, null, 2));
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating theme:', error);
      res.status(500).json({ error: 'Failed to update theme' });
    }
  });

  app.post('/api/analyze', async (req, res) => {
    const { code } = req.body;
    // Mock AI analysis response
    res.json({
      suggestions: [
        {
          id: Date.now().toString(),
          type: 'explanation',
          content: 'This code looks good! Here are some potential improvements...'
        }
      ]
    });
  });

  return httpServer;
}
