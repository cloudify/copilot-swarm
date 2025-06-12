import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import pauseManager from "./utils/pauseManager.js";

interface WebSocketData {
  type: "pullRequests" | "status" | "log" | "pauseStatus" | "prUpdate";
  data: any;
}

interface ServerOptions {
  port?: number;
  host?: string;
}

class MonitorWebServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private port: number;
  private host: string;
  private clients: Set<any>;
  public onClientConnect?: () => void;

  constructor(options: ServerOptions = {}) {
    this.port = options.port || 3000;
    this.host = options.host || "0.0.0.0"; // Bind to all interfaces
    this.clients = new Set();

    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupRoutes(): void {
    // Get the directory path in ES modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // Go up one level from src/ to reach the project root, then into public/
    const publicPath = path.join(__dirname, "..", "public");

    // Log the public path for debugging
    console.log(`[Server] Serving static files from: ${publicPath}`);

    // Parse JSON bodies
    this.app.use(express.json());

    // Serve static files
    this.app.use(express.static(publicPath));

    // Health check endpoint
    this.app.get("/health", (_req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // API endpoint for pull requests data
    this.app.get("/api/pullrequests", (_req, res) => {
      // This will be populated by the monitoring logic
      res.json({ pullRequests: [], status: "loading" });
    });

    // Pause/Resume API endpoints
    this.app.get("/api/pause/status", (_req, res) => {
      try {
        const status = pauseManager.getStatus();
        res.json(status);
      } catch {
        res.status(500).json({ error: "Failed to get pause status" });
      }
    });

    this.app.post("/api/pause/global", (_req, res) => {
      try {
        pauseManager.pauseGlobally();
        const status = pauseManager.getStatus();
        this.send("pauseStatus", status);
        this.log("🔄 Automation globally paused");
        res.json({ success: true, status });
      } catch {
        res.status(500).json({ error: "Failed to pause globally" });
      }
    });

    this.app.post("/api/resume/global", (_req, res) => {
      try {
        pauseManager.resumeGlobally();
        const status = pauseManager.getStatus();
        this.send("pauseStatus", status);
        this.log("▶️ Automation globally resumed");
        res.json({ success: true, status });
      } catch {
        res.status(500).json({ error: "Failed to resume globally" });
      }
    });

    this.app.post("/api/pause/pr", (req, res) => {
      try {
        const { prIdentifier } = req.body;
        if (!prIdentifier) {
          res.status(400).json({ error: "prIdentifier is required" });
          return;
        }
        pauseManager.pausePullRequest(prIdentifier);
        const status = pauseManager.getStatus();
        this.send("pauseStatus", status);
        this.log(`🔄 Automation paused for PR: ${prIdentifier}`);
        res.json({ success: true, status });
      } catch {
        res.status(500).json({ error: "Failed to pause PR" });
      }
    });

    this.app.post("/api/resume/pr", (req, res) => {
      try {
        const { prIdentifier } = req.body;
        if (!prIdentifier) {
          res.status(400).json({ error: "prIdentifier is required" });
          return;
        }
        pauseManager.resumePullRequest(prIdentifier);
        const status = pauseManager.getStatus();
        this.send("pauseStatus", status);
        this.log(`▶️ Automation resumed for PR: ${prIdentifier}`);
        res.json({ success: true, status });
      } catch {
        res.status(500).json({ error: "Failed to resume PR" });
      }
    });

    this.app.post("/api/pause/clear", (_req, res) => {
      try {
        pauseManager.clearAll();
        const status = pauseManager.getStatus();
        this.send("pauseStatus", status);
        this.log("🔄 All pause states cleared");
        res.json({ success: true, status });
      } catch {
        res.status(500).json({ error: "Failed to clear pause states" });
      }
    });

    // Fallback to index.html for SPA routing
    this.app.get("*", (_req, res) => {
      res.sendFile(path.join(publicPath, "index.html"));
    });
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws) => {
      console.log("WebSocket client connected");
      this.clients.add(ws);

      // Send initial connection message
      this.send("log", { message: "Connected to Copilot Monitor" });

      // Notify about new client connection
      if (this.onClientConnect) {
        this.onClientConnect();
      }

      ws.on("close", () => {
        console.log("WebSocket client disconnected");
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.clients.delete(ws);
      });
    });
  }

  public broadcast(data: WebSocketData): void {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        try {
          client.send(message);
        } catch (error) {
          console.error("Error sending WebSocket message:", error);
          this.clients.delete(client);
        }
      }
    });
  }

  public send(type: WebSocketData["type"], data: any): void {
    this.broadcast({ type, data });
  }

  public updatePullRequests(pullRequests: any[]): void {
    this.send("pullRequests", pullRequests);
  }

  public updateStatus(status: any): void {
    this.send("status", status);
  }

  public log(message: string): void {
    // Also log to console
    console.log(`[Monitor] ${message}`);
    this.send("log", { message, timestamp: new Date().toISOString() });
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, () => {
        console.log(
          `🌐 Copilot Monitor Web Server running at http://${this.host}:${this.port}`
        );
        console.log(`📊 Open your browser to view the dashboard`);
        resolve();
      });

      this.server.on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          console.error(
            `❌ Port ${this.port} is already in use. Please choose a different port.`
          );
        } else {
          console.error("❌ Server error:", error);
        }
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all WebSocket connections
      this.clients.forEach((client) => {
        try {
          client.close();
        } catch (error) {
          console.error("Error closing WebSocket client:", error);
        }
      });
      this.clients.clear();

      // Close WebSocket server
      this.wss.close(() => {
        // Close HTTP server
        this.server.close(() => {
          console.log("🔄 Monitor Web Server stopped");
          resolve();
        });
      });
    });
  }

  public getUrl(): string {
    return `http://localhost:${this.port}`;
  }
}

export default MonitorWebServer;
