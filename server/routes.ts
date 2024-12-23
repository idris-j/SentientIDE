import type { Express } from "express";
import { createServer, type Server } from "http";
import { IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import fileUpload from 'express-fileupload';
import AdmZip from 'adm-zip';
import path from 'path';
import { db } from "../db";
import { files, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { setupAuth } from "./auth";
import { handleQuery, aiEventEmitter } from './services/nvidia';
import type { Message } from './types';
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

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  setupAuth(app);

  // Add authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  };

  // Initialize WebSocket server
  const wss = new WebSocketServer({ noServer: true });
  console.log('WebSocket server created');

  // WebSocket upgrade handler
  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    try {
      const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;

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
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
      }
    } catch (error) {
      console.error('Error in WebSocket upgrade:', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  // Simple server startup with port handling
  // Return the server instance for proper initialization in index.ts

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

  // Enable CORS for all routes
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // SSE endpoint for IDE communication
  app.get('/api/sse', (req, res) => {
    // Set appropriate headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    try {
      const clientId = Date.now().toString();
      console.log(`New SSE connection: ${clientId}`);

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      // Helper function to send SSE messages with error handling
      const sendEvent = (data: any) => {
        try {
          if (!res.writableEnded) {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            res.write(message);
            // Use proper type checking for flush method
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
          }
        } catch (error) {
          console.error('Error sending SSE event:', error);
          cleanup();
        }
      };

      // Send initial connection confirmation
      sendEvent({
        type: 'connection',
        status: 'connected',
        clientId,
        timestamp: Date.now()
      });

      // Setup message handlers
      const messageHandler = (message: Message) => {
        sendEvent(message);
      };

      const errorHandler = (error: Message) => {
        sendEvent(error);
      };

      // Subscribe to AI events
      aiEventEmitter.on('message', messageHandler);
      aiEventEmitter.on('error', errorHandler);

      // Setup heartbeat interval with shorter interval
      const heartbeatInterval = setInterval(() => {
        try {
          if (!res.writableEnded) {
            sendEvent({
              type: 'heartbeat',
              clientId,
              timestamp: Date.now()
            });
          } else {
            cleanup();
          }
        } catch (error) {
          console.error(`Heartbeat error for client ${clientId}:`, error);
          cleanup();
        }
      }, 15000); // Reduced to 15 seconds

      // Cleanup function
      const cleanup = () => {
        try {
          clearInterval(heartbeatInterval);
          aiEventEmitter.removeListener('message', messageHandler);
          aiEventEmitter.removeListener('error', errorHandler);
          clients.delete(res);
          if (!res.writableEnded) {
            res.end();
          }
          console.log(`Client ${clientId} disconnected from SSE`);
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      };

      // Add client to active connections
      clients.add(res);
      console.log(`Client ${clientId} connected to SSE`);

      // Handle client disconnect
      req.on('close', () => {
        console.log(`Client ${clientId} connection closed`);
        cleanup();
      });

      // Handle errors
      req.on('error', (error) => {
        console.error(`SSE error for client ${clientId}:`, error);
        cleanup();
      });

      // Ensure connection isn't dropped by proxy
      if (res.socket) {
        res.socket.setKeepAlive(true);
        res.socket.setTimeout(0);
      }

    } catch (error) {
      console.error('Error setting up SSE connection:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to establish SSE connection' });
      } else {
        try {
          res.end();
        } catch (e) {
          console.error('Error ending response:', e);
        }
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
  app.post('/api/upload', requireAuth, async (req, res) => {
    try {
      if (!req.files || !('project' in req.files)) {
        return res.status(400).json({
          error: 'No project file uploaded',
          details: 'Please ensure you are uploading a file with the field name "project"'
        });
      }

      const projectFile = req.files.project;
      if (Array.isArray(projectFile)) {
        return res.status(400).json({ error: 'Multiple file upload not supported' });
      }

      // Handle zip file upload
      if (projectFile.name.endsWith('.zip')) {
        const zip = new AdmZip(projectFile.tempFilePath);
        const entries = zip.getEntries();

        // Insert all files from zip into database
        for (const entry of entries) {
          if (!entry.isDirectory) {
            await db.insert(files).values({
              name: path.basename(entry.entryName),
              path: entry.entryName,
              content: entry.getData().toString('utf8'),
              userId: req.user.id,
              isDirectory: false
            });
          }
        }

        return res.json({
          success: true,
          message: 'Zip file contents imported successfully'
        });
      }

      // Handle single file upload
      const [uploadedFile] = await db.insert(files).values({
        name: projectFile.name,
        path: projectFile.name,
        content: projectFile.data.toString('utf8'),
        userId: req.user.id,
        isDirectory: false
      }).returning();

      res.json({
        success: true,
        file: uploadedFile
      });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        error: 'File upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // List user's files
  app.get('/api/files', requireAuth, async (req, res) => {
    try {
      const userFiles = await db.query.files.findMany({
        where: eq(files.userId, req.user.id),
        orderBy: (files, { asc }) => [asc(files.name)]
      });

      // Transform files into tree structure
      const fileTree = userFiles.reduce((acc: any[], file) => {
        const parts = file.path.split('/');
        let current = acc;

        parts.forEach((part, idx) => {
          if (!part) return;

          const existing = current.find(item => item.name === part);
          if (existing && idx < parts.length - 1) {
            current = existing.children;
          } else if (!existing) {
            const newItem = {
              name: part,
              type: idx === parts.length - 1 && !file.isDirectory ? 'file' : 'folder',
              children: []
            };
            current.push(newItem);
            current = newItem.children;
          }
        });

        return acc;
      }, []);

      res.json(fileTree);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Failed to list files' });
    }
  });

  // Create new file
  app.post('/api/files/create', requireAuth, async (req, res) => {
    try {
      const { path: filePath, content = '' } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
      }

      // Create file record in database
      const [newFile] = await db.insert(files)
        .values({
          name: path.basename(filePath),
          path: filePath,
          content,
          userId: req.user.id,
          isDirectory: false
        })
        .returning();

      res.json({
        success: true,
        file: newFile
      });
    } catch (error) {
      console.error('Error creating file:', error);
      res.status(500).json({
        error: 'Failed to create file',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Check if file exists
  app.get('/api/files/exists', requireAuth, async (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
      }

      const existingFile = await db.query.files.findFirst({
        where: eq(files.path, filePath) && eq(files.userId, req.user.id)
      });

      res.json(!!existingFile);
    } catch (error) {
      console.error('Error checking file existence:', error);
      res.status(500).json({ error: 'Failed to check file existence' });
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