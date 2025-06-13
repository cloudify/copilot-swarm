import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import pauseManager from "./utils/pauseManager.js";

interface ServerOptions {
  port?: number;
  host?: string;
}

interface PRData {
  url: string;
  title: string;
  repository: {
    name: string;
    url: string;
  };
  updatedAt: string;
  updatedAtHuman?: string;
  copilotStatus: string;
  ciStatus?: {
    status: string;
    emoji: string;
    count?: number;
    tooltip: string;
  };
}

interface StatusData {
  totalPrs: number;
  activeCopilot: number;
  totalSessionTime: string;
  totalSessionTimeLoading?: boolean;
  refreshInterval: number;
}

class SSRMonitorWebServer {
  private app: express.Application;
  private server: any;
  private port: number;
  private host: string;
  private sseClients: Set<express.Response>;
  private pullRequests: PRData[] = [];
  private status: StatusData = {
    totalPrs: 0,
    activeCopilot: 0,
    totalSessionTime: "0s",
    refreshInterval: 30,
  };
  private logEntries: Array<{ message: string; timestamp: string }> = [];
  public onClientConnect?: () => void;

  constructor(options: ServerOptions = {}) {
    this.port = options.port || 3000;
    this.host = options.host || "0.0.0.0";
    this.sseClients = new Set();

    this.app = express();
    this.server = createServer(this.app);

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Get the directory path in ES modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Parse JSON bodies
    this.app.use(express.json());

    // Health check endpoint
    this.app.get("/health", (_req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Server-Sent Events endpoint for real-time updates
    this.app.get("/events", (req, res) => {
      // Set SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      });

      // Add client to set
      this.sseClients.add(res);

      // Send initial data
      this.sendSSE(res, "connected", { message: "Connected to Copilot Monitor" });
      this.sendSSE(res, "pauseStatus", { ...pauseManager.getStatus(), fullUpdate: true });
      this.sendSSE(res, "status", this.status);
      this.sendSSE(res, "pullRequests", this.pullRequests);

      // Notify about new client connection
      if (this.onClientConnect) {
        this.onClientConnect();
      }

      // Handle client disconnect
      req.on("close", () => {
        this.sseClients.delete(res);
      });
    });

    // Main page with server-side rendered HTML
    this.app.get("/", (req, res) => {
      const html = this.renderMainPage();
      res.send(html);
    });

    // Pause/Resume API endpoints (same as before)
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
        this.broadcastSSE("pauseStatus", { ...status, fullUpdate: true });
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
        this.broadcastSSE("pauseStatus", { ...status, fullUpdate: true });
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
        
        this.log(`🔄 Automation paused for PR: ${prIdentifier}`);
        
        // Return updated button state for immediate UI update
        res.json({ 
          success: true, 
          status,
          prIdentifier,
          isPaused: true
        });
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
        
        this.log(`▶️ Automation resumed for PR: ${prIdentifier}`);
        
        // Return updated button state for immediate UI update
        res.json({ 
          success: true, 
          status,
          prIdentifier,
          isPaused: false
        });
      } catch {
        res.status(500).json({ error: "Failed to resume PR" });
      }
    });

    this.app.post("/api/pause/clear", (_req, res) => {
      try {
        pauseManager.clearAll();
        const status = pauseManager.getStatus();
        this.broadcastSSE("pauseStatus", { ...status, fullUpdate: true });
        this.log("🔄 All pause states cleared");
        res.json({ success: true, status });
      } catch {
        res.status(500).json({ error: "Failed to clear pause states" });
      }
    });
  }

  private sendSSE(res: express.Response, event: string, data: any): void {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error("Error sending SSE:", error);
      this.sseClients.delete(res);
    }
  }

  private broadcastSSE(event: string, data: any): void {
    this.sseClients.forEach((client) => {
      if (!client.destroyed) {
        this.sendSSE(client, event, data);
      } else {
        this.sseClients.delete(client);
      }
    });
  }

  private broadcastPageUpdate(): void {
    // Trigger a page refresh for all connected clients
    // This is the key difference from WebSocket - we re-render server-side
    this.broadcastSSE("pageUpdate", { 
      timestamp: new Date().toISOString(),
      pullRequests: this.pullRequests,
      status: this.status 
    });
  }

  public updatePullRequests(pullRequests: PRData[]): void {
    this.pullRequests = pullRequests;
    this.broadcastSSE("pullRequests", pullRequests);
    // Also trigger a page update for full SSR experience
    this.broadcastPageUpdate();
  }

  public updateStatus(status: StatusData): void {
    this.status = status;
    this.broadcastSSE("status", status);
  }

  public log(message: string): void {
    console.log(`[Monitor] ${message}`);
    const logEntry = { message, timestamp: new Date().toISOString() };
    this.logEntries.unshift(logEntry);
    // Keep only last 100 entries
    if (this.logEntries.length > 100) {
      this.logEntries = this.logEntries.slice(0, 100);
    }
    this.broadcastSSE("log", logEntry);
  }

  private renderMainPage(): string {
    const pauseStatus = pauseManager.getStatus();
    const pausedPRs = new Set(pauseStatus.pausedPullRequests || []);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>COPILOT NEURAL SWARM - Command Interface</title>
    ${this.renderStyles()}
</head>
<body class="theme-green">
    <div class="crt-screen">
        <div class="matrix-rain" id="matrixRain"></div>
        <div class="crt-scanlines"></div>
        
        <div class="container">
            <div class="header">
                <div class="title crt-glow">🤖 COPILOT NEURAL SWARM</div>
                <div style="font-size: 12px; opacity: 0.8">
                    AI Clone Command Interface - Neural Network Active
                </div>
                <div id="connection-status">✅ Connected (SSR)</div>
            </div>

            <div class="status-bar">
                <div class="status-item">
                    <span>📊 Total PRs:</span>
                    <span id="total-prs">${this.status.totalPrs}</span>
                </div>
                <div class="status-item">
                    <span>⚡ Active Copilot:</span>
                    <span id="active-copilot">${this.status.activeCopilot}</span>
                </div>
                <div class="status-item">
                    <span>⏱️ Total Session Time:</span>
                    <span id="total-session-time">${this.status.totalSessionTime}</span>
                </div>
                <div class="status-item">
                    <span>🔄 Next Refresh:</span>
                    <span id="next-refresh">-</span>
                </div>
                <div class="status-item">
                    <span id="pause-status">${pauseStatus.globallyPaused ? "⏸️ Automation: Paused" : "🔄 Automation: Active"}</span>
                </div>
            </div>

            <div class="control-bar">
                <button id="toggle-global-btn" class="control-btn ${pauseStatus.globallyPaused ? "paused-state" : ""}">
                    ${pauseStatus.globallyPaused ? "▶️ Resume All" : "⏸️ Pause All"}
                </button>
                <button id="clear-pauses-btn" class="control-btn">
                    🧹 Clear Pauses
                </button>
            </div>

            <div id="main-content">
                ${this.renderPRTable(pausedPRs)}
            </div>

            <div class="activity-log">
                <h3>📋 Activity Log</h3>
                <div id="log-entries">
                    ${this.logEntries.map(entry => 
                        `<div class="log-entry">
                            <span class="timestamp">${this.formatTime(new Date(entry.timestamp))}</span> 
                            ${entry.message}
                        </div>`
                    ).join("")}
                </div>
            </div>
        </div>
    </div>
    ${this.renderJavaScript()}
</body>
</html>`;
  }

  private renderPRTable(pausedPRs: Set<string>): string {
    if (this.pullRequests.length === 0) {
      return '<div class="loading">No pull requests found</div>';
    }

    const rows = this.pullRequests.map(pr => {
      const isPaused = pausedPRs.has(pr.url);
      const statusClass = this.getStatusClass(pr.copilotStatus);
      
      return `
        <tr data-pr-url="${pr.url}">
          <td>
            <span class="${statusClass}${statusClass === 'status-working' ? ' ai-clone-working' : ''}">${pr.copilotStatus}</span>
          </td>
          <td>
            <a href="${pr.repository.url}" target="_blank" class="repo-link">${pr.repository.name}</a>
          </td>
          <td>
            <a href="${pr.url}" target="_blank" class="repo-link">${this.truncateText(pr.title, 50)}</a>
          </td>
          <td>${pr.updatedAtHuman || this.formatDate(pr.updatedAt)}</td>
          <td>
            ${pr.ciStatus ? 
              `<span class="ci-status ci-${pr.ciStatus.status}" title="${pr.ciStatus.tooltip}">
                ${pr.ciStatus.status === 'running' ? '<div class="ci-spinner"></div>' : pr.ciStatus.emoji}
                ${pr.ciStatus.count ? `(${pr.ciStatus.count})` : ""}
              </span>` :
              '<span class="ci-status ci-unknown" title="CI status unknown">⚫</span>'
            }
          </td>
          <td>
            <button class="control-btn toggle-pr-btn ${isPaused ? "paused-state" : ""}" 
                    data-pr-url="${pr.url}" style="font-size: 12px; padding: 4px 8px;">
              ${isPaused ? "▶️ Resume" : "⏸️ Pause"}
            </button>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <table class="pr-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Repository</th>
            <th>Title</th>
            <th>Updated</th>
            <th>CI</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  private getStatusClass(status: string): string {
    if (
      status.includes("working") ||
      status.includes("Working") ||
      status.includes("Copilot is working") ||
      status.includes("AI Clone Working") ||
      status.includes("AI NEURAL SWARM ACTIVE") ||
      status.includes("NEURAL SWARM")
    ) {
      return "status-working";
    } else if (
      status.includes("✅") ||
      status.includes("success") ||
      status.includes("Complete")
    ) {
      return "status-success";
    } else if (
      status.includes("❌") ||
      status.includes("error") ||
      status.includes("failed") ||
      status.includes("Error") ||
      status.includes("Malfunction") ||
      status.includes("💥")
    ) {
      return "status-error";
    } else {
      return "status-pending";
    }
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString();
  }

  private renderStyles(): string {
    // Include the same styles as the original but inline them for self-contained SSR
    return `<style>
      /* Same styles as public/index.html but inlined for SSR */
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: "Courier New", monospace;
        background-color: #0d1117;
        color: #f0f6fc;
        line-height: 1.4;
        overflow-x: auto;
      }

      .container {
        max-width: 100%;
        padding: 20px;
        position: relative;
        z-index: 10;
      }

      .header {
        text-align: center;
        margin-bottom: 20px;
        padding: 10px;
        border: 1px solid #30363d;
        border-radius: 6px;
        background-color: rgba(22, 27, 34, 0.8);
        backdrop-filter: blur(2px);
      }

      .title {
        font-size: 24px;
        font-weight: bold;
        color: #58a6ff;
        margin-bottom: 10px;
        text-shadow: 0 0 10px currentColor, 0 0 20px currentColor;
      }

      .crt-glow {
        text-shadow: 0 0 10px currentColor, 0 0 20px currentColor;
      }

      .status-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding: 10px;
        border: 1px solid #30363d;
        border-radius: 6px;
        background-color: rgba(22, 27, 34, 0.8);
        backdrop-filter: blur(2px);
        flex-wrap: wrap;
        gap: 10px;
      }

      .status-item {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .control-bar {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        padding: 10px;
        border: 1px solid #30363d;
        border-radius: 6px;
        background-color: rgba(22, 27, 34, 0.8);
        backdrop-filter: blur(2px);
        flex-wrap: wrap;
      }

      .control-btn {
        background-color: #21262d;
        color: #f0f6fc;
        border: 1px solid #30363d;
        border-radius: 6px;
        padding: 8px 16px;
        cursor: pointer;
        font-family: inherit;
        font-size: 14px;
        transition: background-color 0.2s;
      }

      .control-btn:hover {
        background-color: #30363d;
      }

      .control-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .control-btn.paused-state {
        background-color: #f2cc60;
        color: #0d1117;
        border-color: #f2cc60;
      }

      .control-btn.paused-state:hover {
        background-color: #ffdf5d;
      }

      .pr-table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid #30363d;
        border-radius: 6px;
        background-color: rgba(22, 27, 34, 0.8);
        backdrop-filter: blur(2px);
        margin-bottom: 20px;
      }

      .pr-table th {
        background-color: #21262d;
        color: #f0f6fc;
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #30363d;
      }

      .pr-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #30363d;
      }

      .pr-table tr:hover {
        background-color: #21262d;
      }

      .status-working {
        color: #58a6ff;
        text-shadow: 0 0 10px currentColor, 0 0 20px currentColor;
      }

      .ai-clone-working {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .ai-clone-working::before {
        content: "";
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid transparent;
        border-left: 2px solid currentColor;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: copilot-spin 1s linear infinite;
      }

      @keyframes copilot-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .status-success {
        color: #3fb950;
        text-shadow: 0 0 8px currentColor;
      }

      .status-error {
        color: #f85149;
      }

      .status-pending {
        color: #8b949e;
      }

      .repo-link {
        color: #58a6ff;
        text-decoration: none;
      }

      .repo-link:hover {
        text-decoration: underline;
      }

      .loading {
        text-align: center;
        padding: 40px;
        color: #8b949e;
      }

      .crt-screen {
        height: 100vh;
        width: 100vw;
        position: relative;
        background: #000;
        overflow-x: auto;
        overflow-y: auto;
      }

      .crt-scanlines {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        background: repeating-linear-gradient(
          90deg,
          transparent,
          transparent 2px,
          rgba(0, 255, 0, 0.03) 2px,
          rgba(0, 255, 0, 0.03) 4px
        );
        animation: scanlines 0.4s linear infinite;
        z-index: 1000;
        transform: translateZ(0);
        will-change: transform;
      }

      @keyframes scanlines {
        0% { transform: translateX(0); }
        100% { transform: translateX(4px); }
      }

      .matrix-rain {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
        opacity: 0.1;
        z-index: 1;
        transform: translateZ(0);
        will-change: transform;
      }

      .matrix-char {
        position: absolute;
        font-family: "Courier New", monospace;
        font-size: 12px;
        color: #00ff00;
        animation: matrix-fall linear infinite;
        animation-duration: 10s;
        transform: translateZ(0);
        will-change: transform, opacity;
      }

      @keyframes matrix-fall {
        0% {
          transform: translateY(-100vh);
          opacity: 1;
        }
        100% {
          transform: translateY(100vh);
          opacity: 0;
        }
      }

      .theme-green {
        color: #00ff00;
        border-color: #00ff00;
      }

      .ci-status {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
        font-weight: 500;
        padding: 2px 6px;
        border-radius: 3px;
        white-space: nowrap;
      }

      .ci-success {
        color: #3fb950;
        background-color: rgba(63, 185, 80, 0.1);
        border: 1px solid rgba(63, 185, 80, 0.3);
      }

      .ci-failure {
        color: #f85149;
        background-color: rgba(248, 81, 73, 0.1);
        border: 1px solid rgba(248, 81, 73, 0.3);
      }

      .ci-running {
        color: #d29922;
        background-color: rgba(210, 153, 34, 0.1);
        border: 1px solid rgba(210, 153, 34, 0.3);
      }

      .ci-spinner {
        display: inline-block;
        width: 12px;
        height: 12px;
        border: 2px solid rgba(210, 153, 34, 0.3);
        border-left: 2px solid #d29922;
        border-radius: 50%;
        animation: ci-rotate 1s linear infinite;
        vertical-align: middle;
      }

      .ci-pending {
        color: #58a6ff;
        background-color: rgba(88, 166, 255, 0.1);
        border: 1px solid rgba(88, 166, 255, 0.3);
      }

      .ci-unknown {
        color: #8b949e;
        background-color: rgba(139, 148, 158, 0.1);
        border: 1px solid rgba(139, 148, 158, 0.3);
      }

      @keyframes ci-rotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .activity-log {
        border: 1px solid #30363d;
        border-radius: 6px;
        background-color: rgba(22, 27, 34, 0.8);
        backdrop-filter: blur(2px);
        padding: 15px;
      }

      .activity-log h3 {
        margin-bottom: 10px;
        color: #f0f6fc;
      }

      .log-entry {
        margin-bottom: 5px;
        font-size: 14px;
        color: #8b949e;
      }

      .timestamp {
        color: #58a6ff;
      }

      @media (max-width: 768px) {
        .container {
          padding: 10px;
        }

        .pr-table {
          font-size: 12px;
        }

        .pr-table th,
        .pr-table td {
          padding: 8px;
        }

        .status-bar {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    </style>`;
  }

  private renderJavaScript(): string {
    return `<script>
      // Matrix Rain Effect for SSR
      function createMatrixRain() {
        const container = document.getElementById("matrixRain");
        const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";

        for (let i = 0; i < 20; i++) {
          const char = document.createElement("div");
          char.className = "matrix-char";
          char.textContent = chars[Math.floor(Math.random() * chars.length)];
          char.style.left = Math.random() * 100 + "vw";
          char.style.animationDuration = Math.random() * 4 + 4 + "s";
          char.style.animationDelay = Math.random() * 3 + "s";
          container.appendChild(char);
        }
      }

      // Server-Sent Events connection
      let eventSource = null;
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;
      const reconnectDelay = 5000;
      
      // Countdown timer for next refresh
      let refreshCountdownInterval = null;
      let nextRefreshTime = null;

      function connectSSE() {
        try {
          eventSource = new EventSource('/events');
          
          eventSource.onopen = function() {
            console.log('SSE connected');
            reconnectAttempts = 0;
            document.getElementById('connection-status').textContent = '✅ Connected (SSR)';
          };

          eventSource.addEventListener('status', function(e) {
            const data = JSON.parse(e.data);
            updateStatus(data);
            // Start countdown timer when status is updated
            startRefreshCountdown(data.refreshInterval || 30);
          });

          eventSource.addEventListener('pullRequests', function(e) {
            const data = JSON.parse(e.data);
            // No need to update DOM - server already rendered the table
            console.log('Pull requests updated via SSR');
            // Restart countdown when PR data is refreshed
            startRefreshCountdown(30); // Default refresh interval
          });

          eventSource.addEventListener('prUpdate', function(e) {
            const data = JSON.parse(e.data);
            updateSinglePR(data.pr);
            console.log('Single PR updated:', data.pr.title);
          });

          // Removed prPauseUpdate SSE handling - now using direct API responses

          eventSource.addEventListener('pauseStatus', function(e) {
            const data = JSON.parse(e.data);
            updatePauseStatus(data);
          });

          eventSource.addEventListener('log', function(e) {
            const data = JSON.parse(e.data);
            addLogEntry(data);
          });

          eventSource.addEventListener('pageUpdate', function(e) {
            const data = JSON.parse(e.data);
            updatePageContent(data);
          });

          eventSource.onerror = function() {
            console.log('SSE disconnected');
            document.getElementById('connection-status').textContent = '❌ Disconnected';
            eventSource.close();
            
            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++;
              document.getElementById('connection-status').textContent = 
                \`🔄 Reconnecting... (\${reconnectAttempts}/\${maxReconnectAttempts})\`;
              setTimeout(connectSSE, reconnectDelay);
            } else {
              document.getElementById('connection-status').textContent = '❌ Connection failed';
            }
          };
        } catch (error) {
          console.error('Error creating SSE connection:', error);
          document.getElementById('connection-status').textContent = '❌ Connection error';
        }
      }

      function startRefreshCountdown(intervalSeconds) {
        // Clear existing countdown
        if (refreshCountdownInterval) {
          clearInterval(refreshCountdownInterval);
        }
        
        // Set the next refresh time
        nextRefreshTime = Date.now() + (intervalSeconds * 1000);
        
        // Update countdown immediately
        updateRefreshCountdown();
        
        // Start countdown interval
        refreshCountdownInterval = setInterval(updateRefreshCountdown, 1000);
      }

      function updateRefreshCountdown() {
        if (!nextRefreshTime) {
          document.getElementById('next-refresh').textContent = '-';
          return;
        }
        
        const now = Date.now();
        const timeLeft = Math.max(0, Math.ceil((nextRefreshTime - now) / 1000));
        
        if (timeLeft === 0) {
          document.getElementById('next-refresh').textContent = 'Refreshing...';
          // Reset countdown after a brief moment
          setTimeout(() => {
            if (refreshCountdownInterval) {
              clearInterval(refreshCountdownInterval);
            }
            document.getElementById('next-refresh').textContent = '-';
          }, 2000);
        } else {
          document.getElementById('next-refresh').textContent = \`\${timeLeft}s\`;
        }
      }

      function updateSinglePR(prData) {
        // Find existing row or create new one
        let existingRow = document.querySelector(\`tr[data-pr-url="\${prData.url}"]\`);
        
        if (existingRow) {
          // Update existing row
          updatePRRow(existingRow, prData);
        } else {
          // Add new row to table
          addNewPRRow(prData);
        }
      }

      function updatePRRow(row, prData) {
        const statusClass = getStatusClass(prData.copilotStatus);
        
        // Update status cell
        const statusCell = row.children[0];
        statusCell.innerHTML = \`<span class="\${statusClass}\${statusClass === 'status-working' ? ' ai-clone-working' : ''}">\${prData.copilotStatus}</span>\`;
        
        // Update repository cell
        const repoCell = row.children[1];
        repoCell.innerHTML = \`<a href="\${prData.repository.url}" target="_blank" class="repo-link">\${prData.repository.name}</a>\`;
        
        // Update title cell
        const titleCell = row.children[2];
        titleCell.innerHTML = \`<a href="\${prData.url}" target="_blank" class="repo-link">\${truncateText(prData.title, 50)}</a>\`;
        
        // Update updated time cell
        const timeCell = row.children[3];
        timeCell.textContent = prData.updatedAtHuman || formatDate(prData.updatedAt);
        
        // Update CI status cell
        const ciCell = row.children[4];
        if (prData.ciStatus) {
          ciCell.innerHTML = \`<span class="ci-status ci-\${prData.ciStatus.status}" title="\${prData.ciStatus.tooltip}">
            \${prData.ciStatus.status === 'running' ? '<div class="ci-spinner"></div>' : prData.ciStatus.emoji}
            \${prData.ciStatus.count ? \`(\${prData.ciStatus.count})\` : ""}
          </span>\`;
        } else {
          ciCell.innerHTML = '<span class="ci-status ci-unknown" title="CI status unknown">⚫</span>';
        }
        
        // Preserve the existing pause button in actions cell (index 5)
        // This ensures the button state isn't lost when updating PR data
        const actionsCell = row.children[5];
        if (!actionsCell || !actionsCell.querySelector('.toggle-pr-btn')) {
          // If button doesn't exist, create it with default state
          actionsCell.innerHTML = \`
            <button class="control-btn toggle-pr-btn" 
                    data-pr-url="\${prData.url}" style="font-size: 12px; padding: 4px 8px;">
              ⏸️ Pause
            </button>
          \`;
        }
        // Button state will be updated separately via direct API responses or pauseStatus events
      }

      function addNewPRRow(prData) {
        const table = document.querySelector('.pr-table tbody');
        if (!table) {
          // If no table exists, create the full table structure
          updatePRTable([prData]);
          return;
        }
        
        const statusClass = getStatusClass(prData.copilotStatus);
        const newRow = document.createElement('tr');
        newRow.setAttribute('data-pr-url', prData.url);
        
        // Check if PR is currently paused by looking at existing state or fetching from server
        // Default to non-paused state, button state will be corrected by pauseStatus events
        const isPaused = false; // Will be updated by subsequent pauseStatus SSE events
        
        newRow.innerHTML = \`
          <td>
            <span class="\${statusClass}\${statusClass === 'status-working' ? ' ai-clone-working' : ''}">\${prData.copilotStatus}</span>
          </td>
          <td>
            <a href="\${prData.repository.url}" target="_blank" class="repo-link">\${prData.repository.name}</a>
          </td>
          <td>
            <a href="\${prData.url}" target="_blank" class="repo-link">\${truncateText(prData.title, 50)}</a>
          </td>
          <td>\${prData.updatedAtHuman || formatDate(prData.updatedAt)}</td>
          <td>
            \${prData.ciStatus ? 
              \`<span class="ci-status ci-\${prData.ciStatus.status}" title="\${prData.ciStatus.tooltip}">
                \${prData.ciStatus.status === 'running' ? '<div class="ci-spinner"></div>' : prData.ciStatus.emoji}
                \${prData.ciStatus.count ? \`(\${prData.ciStatus.count})\` : ""}
              </span>\` :
              '<span class="ci-status ci-unknown" title="CI status unknown">⚫</span>'
            }
          </td>
          <td>
            <button class="control-btn toggle-pr-btn \${isPaused ? "paused-state" : ""}" 
                    data-pr-url="\${prData.url}" style="font-size: 12px; padding: 4px 8px;">
              \${isPaused ? "▶️ Resume" : "⏸️ Pause"}
            </button>
          </td>
        \`;
        
        table.appendChild(newRow);
      }

      function updateStatus(status) {
        document.getElementById('total-prs').textContent = status.totalPrs || '-';
        document.getElementById('active-copilot').textContent = status.activeCopilot || '-';
        
        const sessionTimeElement = document.getElementById('total-session-time');
        if (status.totalSessionTimeLoading) {
          sessionTimeElement.innerHTML = '<div class="ci-spinner"></div> Loading...';
        } else {
          sessionTimeElement.textContent = status.totalSessionTime || '0s';
        }
      }

      function updateIndividualPRButton(prIdentifier, isPaused) {
        // Removed - now handled by direct API responses
      }

      function updatePauseStatus(pauseData) {
        const toggleBtn = document.getElementById('toggle-global-btn');
        const pauseStatus = document.getElementById('pause-status');

        if (pauseData.globallyPaused) {
          toggleBtn.textContent = '▶️ Resume All';
          toggleBtn.classList.add('paused-state');
          pauseStatus.textContent = '⏸️ Automation: Paused';
        } else {
          toggleBtn.textContent = '⏸️ Pause All';
          toggleBtn.classList.remove('paused-state');
          pauseStatus.textContent = '🔄 Automation: Active';
        }

        // Only update PR buttons during full reconciliation (startup/periodic sync)
        // Individual PR button states are managed via direct API responses
        if (pauseData.fullUpdate) {
          const pausedPRs = new Set(pauseData.pausedPullRequests || []);
          document.querySelectorAll('.toggle-pr-btn').forEach(button => {
            const prUrl = button.getAttribute('data-pr-url');
            if (prUrl) {
              const isPaused = pausedPRs.has(prUrl);
              updatePRButton(button, isPaused);
            }
          });
        }
      }

      function updatePRButton(button, isPaused) {
        if (isPaused) {
          button.textContent = '▶️ Resume';
          button.classList.add('paused-state');
        } else {
          button.textContent = '⏸️ Pause';
          button.classList.remove('paused-state');
        }
      }

      function addLogEntry(logData) {
        const logEntries = document.getElementById('log-entries');
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = \`<span class="timestamp">\${formatTime(new Date())}</span> \${logData.message}\`;

        logEntries.insertBefore(entry, logEntries.firstChild);

        // Keep only last 100 entries
        while (logEntries.children.length > 100) {
          logEntries.removeChild(logEntries.lastChild);
        }
      }

      function updatePageContent(data) {
        // Update main table content with server-side rendered data
        if (data.pullRequests) {
          updatePRTable(data.pullRequests);
        }
        
        // Update status if provided
        if (data.status) {
          updateStatus(data.status);
        }
      }

      function updatePRTable(pullRequests) {
        const mainContent = document.getElementById('main-content');
        if (pullRequests.length === 0) {
          mainContent.innerHTML = '<div class="loading">No pull requests found</div>';
          return;
        }

        // Get current pause status from existing buttons to preserve state
        const pausedPRs = new Set();
        document.querySelectorAll('.toggle-pr-btn.paused-state').forEach(button => {
          const prUrl = button.getAttribute('data-pr-url');
          if (prUrl) {
            pausedPRs.add(prUrl);
          }
        });
        
        const rows = pullRequests.map(pr => {
          const isPaused = pausedPRs.has(pr.url);
          const statusClass = getStatusClass(pr.copilotStatus);
          
          return \`
            <tr data-pr-url="\${pr.url}">
              <td>
                <span class="\${statusClass}\${statusClass === 'status-working' ? ' ai-clone-working' : ''}">\${pr.copilotStatus}</span>
              </td>
              <td>
                <a href="\${pr.repository.url}" target="_blank" class="repo-link">\${pr.repository.name}</a>
              </td>
              <td>
                <a href="\${pr.url}" target="_blank" class="repo-link">\${truncateText(pr.title, 50)}</a>
              </td>
              <td>\${pr.updatedAtHuman || formatDate(pr.updatedAt)}</td>
              <td>
                \${pr.ciStatus ? 
                  \`<span class="ci-status ci-\${pr.ciStatus.status}" title="\${pr.ciStatus.tooltip}">
                    \${pr.ciStatus.status === 'running' ? '<div class="ci-spinner"></div>' : pr.ciStatus.emoji}
                    \${pr.ciStatus.count ? \`(\${pr.ciStatus.count})\` : ""}
                  </span>\` :
                  '<span class="ci-status ci-unknown" title="CI status unknown">⚫</span>'
                }
              </td>
              <td>
                <button class="control-btn toggle-pr-btn \${isPaused ? "paused-state" : ""}" 
                        data-pr-url="\${pr.url}" style="font-size: 12px; padding: 4px 8px;">
                  \${isPaused ? "▶️ Resume" : "⏸️ Pause"}
                </button>
              </td>
            </tr>
          \`;
        }).join('');

        mainContent.innerHTML = \`
          <table class="pr-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Repository</th>
                <th>Title</th>
                <th>Updated</th>
                <th>CI</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              \${rows}
            </tbody>
          </table>
        \`;
      }

      function getStatusClass(status) {
        if (
          status.includes("working") ||
          status.includes("Working") ||
          status.includes("Copilot is working") ||
          status.includes("AI Clone Working") ||
          status.includes("AI NEURAL SWARM ACTIVE") ||
          status.includes("NEURAL SWARM")
        ) {
          return "status-working";
        } else if (
          status.includes("✅") ||
          status.includes("success") ||
          status.includes("Complete")
        ) {
          return "status-success";
        } else if (
          status.includes("❌") ||
          status.includes("error") ||
          status.includes("failed") ||
          status.includes("Error") ||
          status.includes("Malfunction") ||
          status.includes("💥")
        ) {
          return "status-error";
        } else {
          return "status-pending";
        }
      }

      function truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
      }

      function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
      }

      function formatTime(date) {
        return date.toLocaleTimeString();
      }

      // API calls for pause/resume functionality
      async function toggleGlobalPause() {
        const toggleBtn = document.getElementById('toggle-global-btn');
        const isPaused = toggleBtn.classList.contains('paused-state');

        toggleBtn.disabled = true;

        try {
          if (isPaused) {
            await resumeGlobally();
          } else {
            await pauseGlobally();
          }
        } finally {
          toggleBtn.disabled = false;
        }
      }

      async function pauseGlobally() {
        try {
          const response = await fetch('/api/pause/global', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!response.ok) {
            throw new Error('Failed to pause globally');
          }
        } catch (error) {
          console.error('Error pausing globally:', error);
          alert('Failed to pause automation');
        }
      }

      async function resumeGlobally() {
        try {
          const response = await fetch('/api/resume/global', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!response.ok) {
            throw new Error('Failed to resume globally');
          }
        } catch (error) {
          console.error('Error resuming globally:', error);
          alert('Failed to resume automation');
        }
      }

      async function clearAllPauses() {
        try {
          const response = await fetch('/api/pause/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!response.ok) {
            throw new Error('Failed to clear pauses');
          }
        } catch (error) {
          console.error('Error clearing pauses:', error);
          alert('Failed to clear pauses');
        }
      }

      async function togglePR(prIdentifier) {
        const button = document.querySelector(\`[data-pr-url="\${prIdentifier}"]\`);
        if (!button) return;

        const isPaused = button.classList.contains('paused-state');
        button.disabled = true;

        try {
          let response;
          if (isPaused) {
            response = await resumePR(prIdentifier);
          } else {
            response = await pausePR(prIdentifier);
          }
          
          // Update button based on server response
          if (response && response.success) {
            updatePRButton(button, response.isPaused);
          }
        } catch (error) {
          console.error('Toggle PR failed:', error);
          alert(\`Failed to \${isPaused ? 'resume' : 'pause'} PR: \${error.message}\`);
        } finally {
          button.disabled = false;
        }
      }

      async function pausePR(prIdentifier) {
        try {
          const response = await fetch('/api/pause/pr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prIdentifier }),
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || \`HTTP \${response.status}\`);
          }
          return await response.json();
        } catch (error) {
          console.error('Error pausing PR:', error);
          throw error;
        }
      }

      async function resumePR(prIdentifier) {
        try {
          const response = await fetch('/api/resume/pr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prIdentifier }),
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || \`HTTP \${response.status}\`);
          }
          return await response.json();
        } catch (error) {
          console.error('Error resuming PR:', error);
          throw error;
        }
      }

      // Initialize
      document.addEventListener('DOMContentLoaded', function() {
        // Initialize effects
        createMatrixRain();

        // Set up event listeners
        document.getElementById('toggle-global-btn').addEventListener('click', toggleGlobalPause);
        document.getElementById('clear-pauses-btn').addEventListener('click', clearAllPauses);

        // Event delegation for PR pause/resume buttons
        document.addEventListener('click', function(event) {
          if (event.target.classList.contains('toggle-pr-btn')) {
            const prUrl = event.target.getAttribute('data-pr-url');
            togglePR(prUrl);
          }
        });

        // Connect to SSE
        connectSSE();
        
        // Start initial countdown with default interval
        startRefreshCountdown(30);
        
        // Simplified periodic reconciliation - only sync global state
        setInterval(async () => {
          try {
            const response = await fetch('/api/pause/status');
            if (response.ok) {
              const pauseData = await response.json();
              // Only update global controls, not individual PR buttons
              const toggleBtn = document.getElementById('toggle-global-btn');
              const pauseStatus = document.getElementById('pause-status');
              
              if (pauseData.globallyPaused) {
                toggleBtn.textContent = '▶️ Resume All';
                toggleBtn.classList.add('paused-state');
                pauseStatus.textContent = '⏸️ Automation: Paused';
              } else {
                toggleBtn.textContent = '⏸️ Pause All';
                toggleBtn.classList.remove('paused-state');
                pauseStatus.textContent = '🔄 Automation: Active';
              }
            }
          } catch (error) {
            console.warn('Failed to sync global pause status:', error);
          }
        }, 60000);
      });
    </script>`;
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, () => {
        console.log(
          `🌐 Copilot Monitor SSR Server running at http://${this.host}:${this.port}`
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
      // Close all SSE connections
      this.sseClients.forEach((client) => {
        try {
          client.end();
        } catch (error) {
          console.error("Error closing SSE client:", error);
        }
      });
      this.sseClients.clear();

      // Close HTTP server
      this.server.close(() => {
        console.log("🔄 SSR Monitor Web Server stopped");
        resolve();
      });
    });
  }

  public getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  // Keep the same interface as the original server for compatibility
  public send(type: string, data: any): void {
    this.broadcastSSE(type, data);
  }
}

export default SSRMonitorWebServer;