import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add logging middleware
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

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Initialize server asynchronously
async function startServer() {
  try {
    const server = registerRoutes(app);
    await setupVite(app, server);

    // Try ports from 5000 to 5010
    for (let port = 5000; port <= 5010; port++) {
      try {
        await new Promise<void>((resolve, reject) => {
          server.listen(port, '0.0.0.0')
            .once('listening', () => {
              log(`Server started successfully on port ${port}`);
              resolve();
            })
            .once('error', (err: any) => {
              if (err.code === 'EADDRINUSE') {
                log(`Port ${port} in use, trying next port...`);
                server.close();
              } else {
                reject(err);
              }
            });
        });
        // If we get here, the server started successfully
        break;
      } catch (err) {
        if (port === 5010) {
          throw new Error('No available ports found between 5000 and 5010');
        }
        continue;
      }
    }
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();