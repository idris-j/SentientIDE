import type { Express } from "express";
import { createServer, type Server } from "http";
import { IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import fileUpload from 'express-fileupload';
import AdmZip from 'adm-zip';
import path from 'path';
import { handleQuery } from './services/claude';
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
  const httpServer = createServer(app);
  const startPort = process.env.PORT ? parseInt(process.env.PORT) : 5000;

  // Find an available port
  const port = await findAvailablePort(startPort);
  console.log(`Starting server on port ${port}`);

  // Create WebSocket server before starting HTTP server
  const wss = new WebSocketServer({ noServer: true });

  // Set up WebSocket handling
  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;

      // Handle Vite HMR separately
      if (request.headers['sec-websocket-protocol'] === 'vite-hmr') {
        console.log('Passing vite-hmr connection');
        socket.destroy();
        return;
      }

      if (pathname === '/terminal') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          console.log('Terminal WebSocket connection established');
          handleTerminal(ws);
        });
      } else if (pathname === '/ws/ide') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
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

  // Start the server with retries
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      await new Promise<void>((resolve, reject) => {
        const server = httpServer.listen(port, '0.0.0.0', () => {
          console.log(`Server started successfully on port ${port}`);
          resolve();
        });

        server.once('error', async (error: any) => {
          if (error.code === 'EADDRINUSE') {
            console.log(`Port ${port} is in use, trying next port...`);
            port++;
            retryCount++;
            server.close();
          } else {
            console.error('Server failed to start:', error);
            reject(error);
          }
        });
      });
      break; // Successfully started server
    } catch (error) {
      if (retryCount === maxRetries - 1) {
        throw error; // Reached max retries
      }
      retryCount++;
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
      const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      };

      // Add CORS headers if needed
      const origin = req.headers.origin;
      if (origin) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
      }

      res.writeHead(200, headers);

      // Helper function to send SSE messages
      const sendEvent = (data: any) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      };

      // Send initial connection confirmation
      sendEvent({
        type: 'connection',
        status: 'connected',
        clientId,
        timestamp: Date.now()
      });

      // Setup heartbeat interval
      const heartbeatInterval = setInterval(() => {
        try {
          sendEvent({
            type: 'heartbeat',
            clientId,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error(`Heartbeat error for client ${clientId}:`, error);
          cleanup();
        }
      }, 30000);

      // Cleanup function
      const cleanup = () => {
        clearInterval(heartbeatInterval);
        clients.delete(res);
        if (!res.writableEnded) {
          res.end();
        }
        console.log(`Client ${clientId} disconnected from SSE`);
      };

      // Add client to active connections
      clients.add(res);
      console.log(`Client ${clientId} connected to SSE`);

      // Handle client disconnect
      req.on('close', cleanup);
      res.on('error', (error) => {
        console.error(`SSE error for client ${clientId}:`, error);
        cleanup();
      });

      // Ensure connection isn't dropped by proxy
      res.socket?.setKeepAlive(true);

    } catch (error) {
      console.error('Error setting up SSE connection:', error);
      if (!res.headersSent) {
        res.status(500).end();
      }
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

      try {
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

        // Send success response for non-error messages
        if (response.type !== 'error') {
          return res.json({ success: true });
        }

        // Handle error responses with appropriate status codes
        const statusCode = response.content.includes('rate limit') ? 429 :
          response.content.includes('authentication') ? 401 :
            response.content.includes('invalid request') ? 400 : 500;

        return res.status(statusCode).json({ error: response.content });

      } catch (error) {
        if (error instanceof Error && error.message === 'NEED_NEW_API_KEY') {
          return res.status(401).json({
            error: 'API key invalid or expired',
            needNewKey: true
          });
        }
        throw error; // Re-throw other errors to be caught by outer catch
      }
    } catch (error) {
      console.error('Error processing query:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process query';
      res.status(500).json({ error: errorMessage });
    }
  });

  // WebSocket connection tracking
  const wsClients = new Map();

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

  // Add new file creation endpoint
  app.post('/api/files/new', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'File name is required' });
      }

      const filePath = path.join(process.cwd(), name);
      await fs.writeFile(filePath, '', 'utf-8');
      res.json({ path: name });
    } catch (error) {
      console.error('Error creating file:', error);
      res.status(500).json({ error: 'Failed to create file' });
    }
  });

  return httpServer;
}