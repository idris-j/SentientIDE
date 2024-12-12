# AI-Powered IDE - Debugging Guide

## Minimal Setup for WebSocket Debugging

### Required Files for Local Testing

Create a new directory and copy these files maintaining the same structure:

1. **Backend Files** (`/server`):
```
server/
├── services/
│   └── claude.ts     # Claude AI integration
└── routes.ts         # WebSocket server setup
```

2. **Frontend Files** (`/client`):
```
client/
└── src/
3. **Minimal package.json**:
```json
{
  "name": "ide-websocket-debug",
  "version": "1.0.0",
  "scripts": {
    "dev": "node server/index.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.14.1",
    "express": "^4.18.2",
    "ws": "^8.16.0"
  }
}
```

4. **Minimal server/index.js**:
```javascript
const express = require('express');
const { registerRoutes } = require('./routes');

const app = express();
const server = registerRoutes(app);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Quick Start

1. Create the project structure as shown above
2. Copy the files from this repository
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm run dev
   ```
5. Open browser console and check for WebSocket connection logs
6. Monitor server terminal for connection attempts

### Debugging Steps

1. **Server-side**: Add these console logs to `routes.ts`:
   ```typescript
   // In the upgrade handler
   console.log('Headers:', request.headers);
   console.log('URL:', request.url);
   
   // In the connection handler
   console.log('Client connected');
   console.log('Message received:', message.toString());
   ```

2. **Client-side**: Add these console logs to `websocket.ts`:
   ```typescript
   // In connect function
   console.log('Attempting connection...');
   console.log('WebSocket URL:', wsUrl);
   
   // In socket.onopen
   console.log('Connection established');
   
   // In socket.onerror
   console.log('Connection error:', error);

### Test Files

1. **test-server.js** - Minimal WebSocket server:
```javascript
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws/ide') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      console.log('Client connected');
      
      ws.on('message', (message) => {
        console.log('Received:', message.toString());
        ws.send(JSON.stringify({ id: Date.now(), type: 'text', content: 'Test response' }));
      });
    });
  } else {
    socket.destroy();
  }
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Test server running on port 3000');
});
```

2. **test-client.html** - Minimal WebSocket client:
```html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Test</title>
</head>
<body>
  <div id="status">Disconnected</div>
  <button onclick="sendMessage()">Send Test Message</button>
  <div id="messages"></div>

  <script>
    let ws;
    
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/ide`);
      
      ws.onopen = () => {
        document.getElementById('status').textContent = 'Connected';
        console.log('Connected to WebSocket');
      };
      
      ws.onmessage = (event) => {
        const messages = document.getElementById('messages');
        messages.innerHTML += `<div>Received: ${event.data}</div>`;
        console.log('Received:', event.data);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        document.getElementById('status').textContent = 'Error';
      };
      
      ws.onclose = () => {
        document.getElementById('status').textContent = 'Disconnected';
        setTimeout(connect, 2000);
      };
    }
    
    function sendMessage() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'query',
          content: 'Test message',
          currentFile: null
        }));
      }
    }
    
    connect();
  </script>
</body>
</html>
```

To use these test files:
1. Save them in a new directory
2. Run `node test-server.js`
3. Open `test-client.html` in a browser
4. Check console logs and messages on the page

This minimal setup helps isolate WebSocket issues from the rest of the application.
   ```

3. **Common Issues to Check**:
   - Ensure server is running and accessible
   - Check WebSocket URL matches server URL
### Essential File Contents for Testing

1. **`server/routes.ts`** - Main WebSocket server setup:
```typescript
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from 'ws';
import { analyzeCode, handleQuery } from './services/claude';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Create WebSocket server
  const wss = new WebSocketServer({ 
    noServer: true,
    clientTracking: true
  });

  // Handle upgrade requests
  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
      
      if (pathname !== '/ws/ide') {
        console.log('Rejecting WebSocket connection for path:', pathname);
        socket.destroy();
        return;
      }

      // Skip vite-hmr connections
      if (request.headers['sec-websocket-protocol'] === 'vite-hmr') {
        console.log('Skipping vite-hmr connection');
        socket.destroy();
        return;
      }

      console.log('Handling WebSocket upgrade for path:', pathname);
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch (error) {
      console.error('Error in WebSocket upgrade:', error);
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    console.log('WebSocket client connected');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received message:', data);
        const response = await handleQuery(data.content, data.currentFile);
        ws.send(JSON.stringify(response));
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({
          id: Date.now().toString(),
          type: 'error',
          content: 'Failed to process message'
        }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  return httpServer;
}
```

2. **`client/src/lib/websocket.ts`** - WebSocket client implementation:
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

export function useWebSocket() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const maxRetries = 3;
  const retryCount = useRef(0);

  const connect = useCallback(async () => {
    if (isConnecting) return;

    try {
      setIsConnecting(true);
      console.log('Attempting WebSocket connection...');

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setWs(null);
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/ide`;
      console.log('WebSocket URL:', wsUrl);
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      return new Promise<WebSocket>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('WebSocket connection timeout');
          reject(new Error('WebSocket connection timeout'));
          socket.close();
        }, 5000);

        socket.onopen = () => {
          clearTimeout(timeout);
          console.log('WebSocket connection established');
          setWs(socket);
          (window as any).aiWebSocket = socket;
          retryCount.current = 0;
          setIsConnecting(false);
          resolve(socket);
        };

        socket.onclose = (event) => {
          clearTimeout(timeout);
          console.log('WebSocket disconnected:', event.code, event.reason);
          setWs(null);
          (window as any).aiWebSocket = null;
          setIsConnecting(false);

          if (event.code !== 1000 && event.code !== 1001 && retryCount.current < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount.current), 5000);
            retryCount.current += 1;
            console.log(`Attempting reconnection in ${delay}ms (attempt ${retryCount.current})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          }
        };

        socket.onerror = (error) => {
          clearTimeout(timeout);
          console.error('WebSocket error:', error);
          setIsConnecting(false);
          reject(error);
          socket.close();
        };
      });
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      setIsConnecting(false);
      
      if (retryCount.current < maxRetries) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
        retryCount.current += 1;
      }
    }
  }, [isConnecting]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
        setWs(null);
      }
    };
  }, [connect]);

  return ws;
}
```

These files contain all the necessary debug logging to help track the WebSocket connection lifecycle. When testing:

1. Watch the browser console for client-side logs
2. Monitor the terminal for server-side logs
3. Use the Network tab in DevTools to inspect the WebSocket connection attempt

The most common issues are:
- Incorrect WebSocket URL construction
- Failed upgrade requests
- CORS issues
- Timing problems with the connection setup
   - Verify no CORS issues in browser console
   - Monitor network tab for failed upgrades
    ├── lib/
    │   └── websocket.ts   # WebSocket client
    └── components/
        └── AIPanel.tsx    # Chat interface
```

### Prerequisites

1. Node.js and npm:
   - Node.js v18 or later
   - npm v8 or later

2. Required Environment Variables:
   ```
   ANTHROPIC_API_KEY=your_claude_api_key
   ```

### Testing Without AI Integration

To test the WebSocket connection independently of the Claude AI integration:

1. Modify the `handleQuery` function in `server/routes.ts`:
```typescript
// Temporary test response
async function handleQuery(content: string, currentFile: string | null) {
  return {
    id: Date.now().toString(),
    type: 'text',
    content: `Received: ${content} (File: ${currentFile || 'none'})`
  };
}
```

2. Use the browser console to send a test message:
```javascript
const ws = window.aiWebSocket;
if (ws && ws.readyState === WebSocket.OPEN) {
  ws.send(JSON.stringify({
    type: 'query',
    content: 'Test message',
    currentFile: null
  }));
}
```

This will help verify if the WebSocket connection and message handling are working correctly before dealing with the AI integration.
## Project Structure

```
├── client/
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── ui/             # Shadcn UI components
│   │   │   ├── AIPanel.tsx     # AI Assistant panel
│   │   │   ├── Editor.tsx      # Monaco editor
│   │   │   └── ...
│   │   ├── lib/                # Utilities and contexts
│   │   │   ├── websocket.ts    # WebSocket connection
│   │   │   ├── theme-context.tsx
│   │   │   └── file-context.tsx
│   │   └── App.tsx
│   └── index.html
└── server/
    ├── services/
    │   └── claude.ts           # Claude AI integration
    └── routes.ts               # Express routes and WebSocket server

```

## Local Setup Instructions

1. **Environment Setup**:
   ```bash
   # Create .env file in project root
   echo "ANTHROPIC_API_KEY=your_key_here" > .env
   
   # Install dependencies
   npm install
   ```

2. **Required Dependencies**:
   - Core dependencies:
     ```bash
     npm install @anthropic-ai/sdk express ws @monaco-editor/react
     ```
   - UI dependencies:
     ```bash
     npm install @radix-ui/react-* lucide-react tailwindcss
     ```
   - Development dependencies:
     ```bash
     npm install -D typescript @types/express @types/ws
     ```

3. **Start Development Server**:
   ```bash
   # Start both frontend and backend
   npm run dev
   ```

## WebSocket Debugging Guide

1. **Server-side Debugging**:
   - Check WebSocket upgrade logs:
     ```typescript
     // Add to server/routes.ts
     httpServer.on('upgrade', (request, socket, head) => {
       console.log('Upgrade request:', {
         url: request.url,
         headers: request.headers
       });
     });
     ```

2. **Client-side Debugging**:
   - Monitor WebSocket connection:
     ```typescript
     // Add to client/src/lib/websocket.ts
     socket.onopen = () => {
       console.log('WebSocket connected:', socket.readyState);
     };
     
     socket.onerror = (error) => {
       console.error('WebSocket error:', error);
     };
     ```

3. **Common Issues & Solutions**:

   a. Connection Refused:
      - Verify server is running on correct port
      - Check WebSocket URL construction
      - Ensure no firewall blocking WebSocket traffic

   b. Upgrade Failed:
      - Verify proper headers in upgrade request
      - Check vite-hmr protocol handling
      - Ensure proper CORS configuration

   c. Message Handling:
      - Add logging for message events
      - Verify message format matches expected schema
      - Check Claude AI integration response format

4. **Browser DevTools Tips**:
   - Network tab: Filter by "WS" to see WebSocket connections
   - Console: Monitor WebSocket lifecycle events
   - Application tab: Check WebSocket frame data

## Development Workflow

1. Start the server in development mode
2. Monitor terminal for WebSocket connection logs
3. Use browser DevTools to debug client-side issues
4. Check server logs for API and WebSocket errors

## Troubleshooting Steps

1. **WebSocket Connection Issues**:
   ```bash
   # Check server logs
   npm run dev
   
   # In browser console
   console.log(window.aiWebSocket?.readyState)
   ```

2. **Claude AI Integration**:
   - Verify ANTHROPIC_API_KEY is set
   - Check Claude API response format
   - Monitor network requests to Claude API

3. **UI Issues**:
   - Check theme context updates
   - Verify component rendering
   - Monitor state changes

## Need Help?

1. Check the logs in both terminal and browser console
2. Verify all environment variables are set
3. Ensure all dependencies are installed
4. Monitor WebSocket connection status

## Known Limitations

1. WebSocket needs proper error handling
2. Theme changes require page refresh
3. File operations are synchronous
4. Claude AI has rate limits
