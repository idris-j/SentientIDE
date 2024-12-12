import express, { type Request, Response, NextFunction } from "express";
import { WebSocketServer } from 'ws';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { handleTerminal } from "./terminal";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Create WebSocket server for terminal
const terminalWss = new WebSocketServer({ 
  noServer: true,
  handleProtocols: (protocols: Set<string>, request: any) => {
    if (protocols.has('vite-hmr')) {
      return false;
    }
    return Array.from(protocols)[0] || false;
  }
});

terminalWss.on('connection', handleTerminal);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = registerRoutes(app);

  // Handle WebSocket upgrade requests
  server.on('upgrade', (request, socket, head) => {
    try {
      const protocol = request.headers['x-forwarded-proto'] || 'http';
      const pathname = new URL(request.url!, `${protocol}://${request.headers.host}`).pathname;

      if (pathname === '/terminal') {
        log('Terminal WebSocket upgrade request received', 'terminal');
        terminalWss.handleUpgrade(request, socket, head, (ws) => {
          log('Terminal WebSocket connection established', 'terminal');
          terminalWss.emit('connection', ws, request);
        });
      } else {
        log(`Rejecting WebSocket upgrade for unknown path: ${pathname}`, 'terminal');
        socket.destroy();
      }
    } catch (error) {
      log(`WebSocket upgrade error: ${error}`, 'terminal');
      socket.destroy();
    }
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client
  const PORT = 5000;
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();
