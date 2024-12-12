import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from 'ws';
import fileUpload from 'express-fileupload';
import AdmZip from 'adm-zip';
import path from 'path';
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
        
        // Mock AI response for now
        const response = {
          id: Date.now().toString(),
          type: 'suggestion',
          content: `Here's a suggestion for improving your code: Consider using const instead of let for values that won't be reassigned.`
        };

        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(response));
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
      const { path: filePath } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: 'Path parameter is required' });
      }

      const absolutePath = path.join(process.cwd(), filePath);
      await fs.unlink(absolutePath);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  app.post('/api/files/duplicate', async (req, res) => {
    try {
      const { path: sourcePath } = req.body;
      if (!sourcePath) {
        return res.status(400).json({ error: 'Path parameter is required' });
      }

      const sourceAbsolutePath = path.join(process.cwd(), sourcePath);
      const ext = path.extname(sourcePath);
      const basename = path.basename(sourcePath, ext);
      const dir = path.dirname(sourcePath);
      let newPath = path.join(dir, `${basename}_copy${ext}`);
      let counter = 1;

      // Handle case where copy already exists
      while (fs.existsSync(path.join(process.cwd(), newPath))) {
        newPath = path.join(dir, `${basename}_copy_${counter}${ext}`);
        counter++;
      }

      await fs.copyFile(sourceAbsolutePath, path.join(process.cwd(), newPath));
      res.json({ success: true, newPath });
    } catch (error) {
      console.error('Error duplicating file:', error);
      res.status(500).json({ error: 'Failed to duplicate file' });
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

      if (await fs.exists(newAbsolutePath)) {
        return res.status(400).json({ error: 'A file with that name already exists' });
      }

      await fs.rename(oldAbsolutePath, newAbsolutePath);
      res.json({ success: true, newPath });
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
