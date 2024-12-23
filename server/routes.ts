import type { Express } from "express";
import { createServer, type Server } from "http";
import { IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import fileUpload from 'express-fileupload';
import AdmZip from 'adm-zip';
import path from 'path';
import { handleQuery, aiEventEmitter } from './services/nvidia';
import type { Message } from './types';
import { handleTerminal } from './terminal';
import fs from 'fs/promises';
import { getGitStatus, stageFile, commitChanges, pushChanges } from './services/git';

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
  const startPort = process.env.PORT ? parseInt(process.env.PORT) : 5000;

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
    try {
      const clientId = Date.now().toString();
      console.log(`New SSE connection: ${clientId}`);

      // Set SSE headers only once
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
      }
      try {
        if (!res.writableEnded) {
          res.end();
        }
      } catch (e) {
        console.error('Error ending response:', e);
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
    console.log('Received upload request');

    try {
      // Set CORS headers specifically for file upload
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
      res.header('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      // Validate request
      if (!req.files || !('project' in req.files)) {
        console.error('No valid files in request:', {
          hasFiles: !!req.files,
          fileKeys: req.files ? Object.keys(req.files) : []
        });
        return res.status(400).json({
          error: 'No project file uploaded',
          details: 'Please ensure you are uploading a file with the field name "project"'
        });
      }

      const projectFile = req.files.project;
      console.log('Received file:', {
        name: projectFile.name,
        size: projectFile.size,
        mimetype: projectFile.mimetype
      });

      // Validate file type and structure
      if (Array.isArray(projectFile)) {
        console.error('Multiple files received instead of single file');
        return res.status(400).json({
          error: 'Multiple file upload not supported',
          details: 'Please upload a single ZIP file'
        });
      }

      console.log('Received file:', {
        name: projectFile.name,
        size: projectFile.size,
        mimetype: projectFile.mimetype
      });

      if (Array.isArray(projectFile)) {
        console.error('Multiple files detected');
        return res.status(400).json({ error: 'Multiple file upload not supported' });
      }

      // Validate file type
      if (!projectFile.name.endsWith('.zip')) {
        console.error('Invalid file type:', projectFile.name);
        return res.status(400).json({ error: 'Only ZIP files are allowed' });
      }

      const uploadPath = path.join(process.cwd(), 'uploads');
      console.log('Creating upload directory:', uploadPath);

      try {
        await fs.mkdir(uploadPath, { recursive: true });

        // Verify directory exists and is writable
        await fs.access(uploadPath, fs.constants.W_OK);
        console.log('Upload directory is ready and writable');
      } catch (mkdirError) {
        console.error('Error with upload directory:', mkdirError);
        if ((mkdirError as NodeJS.ErrnoException).code === 'EACCES') {
          return res.status(500).json({ error: 'Permission denied: Cannot create upload directory' });
        }
        return res.status(500).json({ error: 'Failed to setup upload directory' });
      }

      // Create a .gitkeep file to ensure the uploads directory is tracked
      try {
        const gitkeepPath = path.join(uploadPath, '.gitkeep');
        await fs.writeFile(gitkeepPath, '');
      } catch (error) {
        console.error('Error creating .gitkeep file:', error);
        // Non-critical error, continue with upload
      }

      const safeName = path.basename(projectFile.name).replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = path.join(uploadPath, safeName);
      console.log('Moving file to:', filePath);

      try {
        await projectFile.mv(filePath);
        console.log('File uploaded successfully:', safeName);
        res.status(200).json({
          success: true,
          filename: safeName,
          path: filePath
        });
      } catch (moveError) {
        console.error('Error moving uploaded file:', moveError);
        return res.status(500).json({ error: 'Failed to save uploaded file' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        error: 'File upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
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

  app.post('/api/files/new', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'File name is required' });
      }

      // Sanitize and validate file path
      const safeName = path.normalize(name).replace(/^(\.\.[\/\\])+/, '');
      if (!safeName || safeName.includes('..')) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      const filePath = path.join(process.cwd(), safeName);
      const dirPath = path.dirname(filePath);

      // Prevent writing outside of project directory
      if (!filePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: 'Invalid file location' });
      }

      // Create directory if it doesn't exist
      await fs.mkdir(dirPath, { recursive: true });

      // Check if file exists
      try {
        await fs.access(filePath);
        return res.status(409).json({ error: 'File already exists' });
      } catch {
        // File doesn't exist, proceed with creation
      }

      try {
        // First, ensure the directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });

        // Create a new file handler with exclusive write flag
        const fileHandle = await fs.open(filePath, 'wx');

        try {
          // Close the file immediately after creation to ensure it's empty
          await fileHandle.close();

          // Verify the file exists and is empty
          const stats = await fs.stat(filePath);
          if (stats.size !== 0) {
            // If somehow not empty, truncate it
            await fs.truncate(filePath, 0);
          }

          console.log(`Created new empty file: ${safeName}`);
          res.json({
            success: true,
            path: safeName,
            content: ''
          });
        } catch (closeError) {
          // If we fail during verification/closing, try to remove the file
          await fs.unlink(filePath).catch(console.error);
          throw closeError;
        }
      } catch (writeError) {
        if ((writeError as NodeJS.ErrnoException).code === 'EEXIST') {
          return res.status(409).json({ error: 'File already exists' });
        }
        throw writeError;
      }
    } catch (error) {
      console.error('Error creating file:', error);
      res.status(500).json({
        error: 'Failed to create file',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get('/api/git/status', async (_req, res) => {
    try {
      const status = await getGitStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting git status:', error);
      res.status(500).json({ error: 'Failed to get git status' });
    }
  });

  app.post('/api/git/stage', async (req, res) => {
    try {
      const { path } = req.body;
      if (!path) {
        return res.status(400).json({ error: 'File path is required' });
      }
      await stageFile(path);
      res.json({ success: true });
    } catch (error) {
      console.error('Error staging file:', error);
      res.status(500).json({ error: 'Failed to stage file' });
    }
  });

  app.post('/api/git/commit', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Commit message is required' });
      }
      await commitChanges(message);
      res.json({ success: true });
    } catch (error) {
      console.error('Error committing changes:', error);
      res.status(500).json({ error: 'Failed to commit changes' });
    }
  });

  app.post('/api/git/push', async (_req, res) => {
    try {
      await pushChanges();
      res.json({ success: true });
    } catch (error) {
      console.error('Error pushing changes:', error);
      res.status(500).json({ error: 'Failed to push changes' });
    }
  });


  return httpServer;
}