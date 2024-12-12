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

// Utility function to find an available port
async function findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number> {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    try {
      await new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(port, '0.0.0.0')
          .once('error', reject)
          .once('listening', () => {
            server.close(() => resolve(port));
          });
      });
      return port;
    } catch (err) {
      if (port === startPort + maxAttempts - 1) {
        throw new Error('No available ports found');
      }
      continue;
    }
  }
  throw new Error('No available ports found');
}

export async function registerRoutes(app: Express): Promise<Server> {
  let port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  const httpServer = createServer(app);

  // Try to start the server on the specified port or find an available one
  while (true) {
    try {
      await new Promise((resolve, reject) => {
        httpServer.listen(port, '0.0.0.0')
          .once('listening', () => {
            console.log(`Server started successfully on port ${port}`);
            resolve(true);
          })
          .once('error', (error) => {
            if (error.code === 'EADDRINUSE') {
              console.log(`Port ${port} is in use, trying next port...`);
              port++;
              httpServer.close();
              resolve(false);
            } else {
              reject(error);
            }
          });
      });
      break;
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  }

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Graceful shutdown handler
  const shutdownGracefully = (signal: string) => {
    console.log(`\n${signal} signal received. Closing HTTP server...`);
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
  process.on('SIGINT', () => shutdownGracefully('SIGINT'));

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
    try {
      const clientId = Date.now().toString();
      console.log(`New SSE connection attempt (${clientId})`);

      // Set SSE headers with appropriate CORS and caching directives
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      });

      // Cleanup any existing zombied connection for this client
      Array.from(clients).forEach(client => {
        if (!client.writableEnded && client.finished) {
          console.log('Cleaning up stale SSE connection');
          clients.delete(client);
        }
      });

      // Send initial connection message
      const initialMessage = JSON.stringify({ 
        type: 'connection', 
        status: 'connected', 
        clientId,
        timestamp: Date.now() 
      });
      res.write(`data: ${initialMessage}\n\n`);

      // Setup heartbeat interval with error handling
      const heartbeatInterval = setInterval(() => {
        try {
          if (!res.writableEnded) {
            const heartbeat = JSON.stringify({ 
              type: 'heartbeat',
              clientId, 
              timestamp: Date.now() 
            });
            res.write(`data: ${heartbeat}\n\n`);
          } else {
            throw new Error('Connection ended');
          }
        } catch (error) {
          console.error(`Error sending SSE heartbeat to client ${clientId}:`, error);
          clearInterval(heartbeatInterval);
          clients.delete(res);
        }
      }, 30000); // Send heartbeat every 30 seconds

      // Add client to the set
      clients.add(res);
      console.log(`Client ${clientId} connected to SSE`);

      // Handle client disconnection
      req.on('close', () => {
        clearInterval(heartbeatInterval);
        clients.delete(res);
        console.log(`Client ${clientId} disconnected from SSE`);
      });

      // Handle errors
      res.on('error', (error) => {
        console.error(`SSE Response error for client ${clientId}:`, error);
        clearInterval(heartbeatInterval);
        clients.delete(res);
      });
    } catch (error) {
      console.error('Error setting up SSE connection:', error);
      res.status(500).end();
    }
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

  // WebSocket connection tracking
  const wsClients = new Map();

  // Terminal WebSocket server error handling
  terminalWss.on('error', (error) => {
    console.error('Terminal WebSocket server error:', error);
    // Notify all connected clients about the error
    Array.from(wsClients.entries()).forEach(([id, client]) => {
      try {
        client.ws.send(JSON.stringify({ type: 'error', message: 'Server error occurred' }));
      } catch (e) {
        console.error(`Error notifying client ${id}:`, e);
      }
    });
  });

  terminalWss.on('close', () => {
    console.log('Terminal WebSocket server closed');
    // Clean up all client connections
    Array.from(wsClients.entries()).forEach(([id, client]) => {
      try {
        client.ws.close(1012, 'Server is shutting down');
        wsClients.delete(id);
      } catch (e) {
        console.error(`Error closing client ${id}:`, e);
      }
    });
  });

  // Enhanced WebSocket connection handler
  terminalWss.on('connection', (ws, request) => {
    const clientId = Date.now().toString();
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.ping();
        } catch (error) {
          console.error(`Error sending ping to client ${clientId}:`, error);
          clearInterval(heartbeatInterval);
          wsClients.delete(clientId);
          try {
            ws.close(1011, 'Server internal error');
          } catch (e) {
            console.error('Error closing WebSocket:', e);
          }
        }
      }
    }, 30000);

    wsClients.set(clientId, { 
      ws,
      connectedAt: Date.now(),
      heartbeatInterval
    });

    ws.on('pong', () => {
      // Update last pong time
      const client = wsClients.get(clientId);
      if (client) {
        client.lastPong = Date.now();
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      clearInterval(heartbeatInterval);
      wsClients.delete(clientId);
      try {
        ws.close(1011, 'Server internal error');
      } catch (e) {
        console.error('Error closing WebSocket:', e);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`Client ${clientId} disconnected:`, code, reason);
      clearInterval(heartbeatInterval);
      wsClients.delete(clientId);
    });
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

  // Handle port conflicts by finding an available port
  httpServer.on('error', async (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error('Port is already in use, attempting to find another port...');
      try {
        const newPort = await findAvailablePort(5000);
        console.log(`Found available port: ${newPort}`);
        httpServer.listen(newPort, '0.0.0.0');
      } catch (err) {
        console.error('Failed to find available port:', err);
      }
    } else {
      console.error('Server error:', error);
    }
  });

  return httpServer;
}