// Legacy WebSocket server - now deprecated in favor of SSR server
// This file is kept for backward compatibility but will be removed
import SSRMonitorWebServer from "./ssr-server.js";

interface ServerOptions {
  port?: number;
  host?: string;
}

// Wrapper class to maintain compatibility while using SSR server
class MonitorWebServer {
  private ssrServer: SSRMonitorWebServer;
  public onClientConnect?: () => void;

  constructor(options: ServerOptions = {}) {
    this.ssrServer = new SSRMonitorWebServer(options);
    
    // Forward the onClientConnect callback
    this.ssrServer.onClientConnect = () => {
      if (this.onClientConnect) {
        this.onClientConnect();
      }
    };
  }

  // Delegate all methods to the SSR server
  public updatePullRequests(pullRequests: any[]): void {
    this.ssrServer.updatePullRequests(pullRequests);
  }

  public updateStatus(status: any): void {
    this.ssrServer.updateStatus(status);
  }

  public log(message: string): void {
    this.ssrServer.log(message);
  }

  public send(type: string, data: any): void {
    this.ssrServer.send(type, data);
  }

  // Legacy broadcast method - now uses SSE
  public broadcast(data: any): void {
    this.ssrServer.send(data.type, data.data);
  }

  public async start(): Promise<void> {
    return this.ssrServer.start();
  }

  public async stop(): Promise<void> {
    return this.ssrServer.stop();
  }

  public getUrl(): string {
    return this.ssrServer.getUrl();
  }
}

export default MonitorWebServer;
