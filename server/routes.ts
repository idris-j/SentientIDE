import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from 'ws';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Create WebSocket server with a specific path
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws/ide'
  });

  wss.on('connection', (ws) => {

    console.log('WebSocket client connected');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Mock AI response for now
        const response = {
          id: Date.now().toString(),
          type: 'suggestion',
          content: `Here's a suggestion for improving your code: Consider using const instead of let for values that won't be reassigned.`
        };

        ws.send(JSON.stringify(response));
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  // API routes
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
