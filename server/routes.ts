import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from 'ws';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Create WebSocket server with a specific path
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws/ide',
    handleProtocols: (protocols, request) => {
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

  // API routes
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
