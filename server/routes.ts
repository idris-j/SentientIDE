import type { Express } from "express";
import { createServer, type Server } from "http";
import { IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import fileUpload from 'express-fileupload';
import AdmZip from 'adm-zip';
import path from 'path';
import { analyzeCode, handleQuery } from './services/claude';
import { handleTerminal } from './terminal';
import fs from 'fs/promises';

// For SSE clients
const clients = new Set<ServerResponse>();

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Configure file upload middleware
  app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    useTempFiles: true,
    tempFileDir: '/tmp/',
    debug: false,
    safeFileNames: true,
    preserveExtension: true,
    abortOnLimit: true,
    responseOnLimit: 'File size limit has been reached',
    uploadTimeout: 30000,
    createParentPath: true,
    parseNested: true
  }));

  // Add error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File is too large' });
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  // SSE endpoint for IDE communication
  app.get('/api/sse', (req, res) => {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connection', status: 'connected' })}\n\n`);

    // Add client to the set
    clients.add(res);
    console.log('Client connected to SSE');

    // Handle client disconnection
    req.on('close', () => {
      clients.delete(res);
      console.log('Client disconnected from SSE');
    });
  });

  // Endpoint to send messages to the AI
  app.post('/api/query', async (req, res) => {
    try {
      const { content, currentFile } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      console.log('Processing query:', { content, currentFile });
      const response = await handleQuery(content, currentFile);
      
      // Broadcast response to all connected clients
      clients.forEach(client => {
        try {
          client.write(`data: ${JSON.stringify(response)}\n\n`);
        } catch (error) {
          console.error('Error sending SSE message:', error);
          clients.delete(client);
        }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error processing query:', error);
      res.status(500).json({ error: 'Failed to process query' });
    }
  });

  // Create WebSocket server for terminal connections only
  const terminalWss = new WebSocketServer({ 
    noServer: true,
    clientTracking: true,
    maxPayload: 50 * 1024 * 1024 // 50MB max payload
  });

  // Handle WebSocket upgrade requests for terminal only
  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    try {
      const protocol = request.headers['x-forwarded-proto'] || 'http';
      const pathname = new URL(request.url!, `${protocol}://${request.headers.host}`).pathname;

      // Skip vite-hmr connections
      if (request.headers['sec-websocket-protocol'] === 'vite-hmr') {
        console.log('Skipping vite-hmr connection');
        socket.destroy();
        return;
      }

      if (pathname === '/terminal') {
        console.log('Handling terminal WebSocket upgrade');
        terminalWss.handleUpgrade(request, socket, head, handleTerminal);
      } else {
        console.log(`Invalid WebSocket path: ${pathname}`);
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
      }
    } catch (error) {
      console.error('Error in WebSocket upgrade:', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  // Terminal WebSocket server error handling
  terminalWss.on('error', (error) => {
    console.error('Terminal WebSocket server error:', error);
  });

  terminalWss.on('close', () => {
    console.log('Terminal WebSocket server closed');
  });

  // File upload endpoint
  app.post('/api/upload', async (req, res) => {
    try {
      console.log('Upload request received:', req.files);
      
      if (!req.files || !req.files.project) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const projectFile = req.files.project;
      const uploadPath = path.join(process.cwd(), 'uploads');
      
      console.log('Creating upload directory:', uploadPath);
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

  // File management endpoints
  app.get('/api/files', async (_req, res) => {
    try {
      const rootPath = process.cwd();
      
      const listFilesRecursive = async (dir: string, baseDir: string = ''): Promise<any[]> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(
          entries.map(async (entry) => {
            const relativePath = path.join(baseDir, entry.name);
            const fullPath = path.join(dir, entry.name);
            
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
      };
      
      const fileList = await listFilesRecursive(rootPath);
      res.json(fileList);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Failed to list files' });
    }
  });

  return httpServer;
}