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
      const uploadPath = path.join(process.cwd(), 'uploads');
      const files = await fs.readdir(uploadPath);
      
      const fileList = await Promise.all(files.map(async (name) => {
        const filePath = path.join(uploadPath, name);
        const stats = await fs.stat(filePath);
        return {
          name,
          type: stats.isDirectory() ? 'folder' : 'file'
        };
      }));

      res.json(fileList);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Failed to list files' });
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
