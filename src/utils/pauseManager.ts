import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

interface PauseState {
  globallyPaused: boolean;
  pausedPullRequests: Set<string>; // PR URLs or IDs
  pausedAt?: string;
  resumedAt?: string;
}

interface SerializedPauseState {
  globallyPaused: boolean;
  pausedPullRequests: string[]; // Array for JSON serialization
  pausedAt?: string;
  resumedAt?: string;
}

class PauseManager {
  private state: PauseState;
  private configPath: string;

  constructor() {
    this.configPath = join(
      homedir(),
      ".config",
      "copilot-pr-monitor",
      "pause-state.json"
    );
    this.state = this.loadState();
  }

  private loadState(): PauseState {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, "utf8");
        const serialized: SerializedPauseState = JSON.parse(data);
        return {
          globallyPaused: serialized.globallyPaused,
          pausedPullRequests: new Set(serialized.pausedPullRequests),
          pausedAt: serialized.pausedAt,
          resumedAt: serialized.resumedAt,
        };
      }
    } catch (error) {
      console.warn("Failed to load pause state, using defaults:", error);
    }

    return {
      globallyPaused: false,
      pausedPullRequests: new Set(),
    };
  }

  private saveState(): void {
    try {
      const serialized: SerializedPauseState = {
        globallyPaused: this.state.globallyPaused,
        pausedPullRequests: Array.from(this.state.pausedPullRequests),
        pausedAt: this.state.pausedAt,
        resumedAt: this.state.resumedAt,
      };

      // Ensure directory exists
      mkdirSync(dirname(this.configPath), { recursive: true });

      writeFileSync(this.configPath, JSON.stringify(serialized, null, 2));
    } catch (error) {
      console.error("Failed to save pause state:", error);
    }
  }

  /**
   * Check if automation features should be paused globally
   */
  isGloballyPaused(): boolean {
    return this.state.globallyPaused;
  }

  /**
   * Check if automation features should be paused for a specific PR
   */
  isPullRequestPaused(prIdentifier: string): boolean {
    return this.state.pausedPullRequests.has(prIdentifier);
  }

  /**
   * Check if automation should be paused for any reason
   */
  shouldPauseAutomation(prIdentifier?: string): boolean {
    if (this.state.globallyPaused) {
      return true;
    }
    if (prIdentifier && this.state.pausedPullRequests.has(prIdentifier)) {
      return true;
    }
    return false;
  }

  /**
   * Pause automation globally
   */
  pauseGlobally(): void {
    this.state.globallyPaused = true;
    this.state.pausedAt = new Date().toISOString();
    this.state.resumedAt = undefined;
    this.saveState();
  }

  /**
   * Resume automation globally
   */
  resumeGlobally(): void {
    this.state.globallyPaused = false;
    this.state.resumedAt = new Date().toISOString();
    this.saveState();
  }

  /**
   * Pause automation for a specific PR
   */
  pausePullRequest(prIdentifier: string): void {
    this.state.pausedPullRequests.add(prIdentifier);
    this.saveState();
  }

  /**
   * Resume automation for a specific PR
   */
  resumePullRequest(prIdentifier: string): void {
    this.state.pausedPullRequests.delete(prIdentifier);
    this.saveState();
  }

  /**
   * Get current pause status
   */
  getStatus(): {
    globallyPaused: boolean;
    pausedPullRequestCount: number;
    pausedPullRequests: string[];
    pausedAt?: string;
    resumedAt?: string;
  } {
    return {
      globallyPaused: this.state.globallyPaused,
      pausedPullRequestCount: this.state.pausedPullRequests.size,
      pausedPullRequests: Array.from(this.state.pausedPullRequests),
      pausedAt: this.state.pausedAt,
      resumedAt: this.state.resumedAt,
    };
  }

  /**
   * Clear all pause states
   */
  clearAll(): void {
    this.state.globallyPaused = false;
    this.state.pausedPullRequests.clear();
    this.state.resumedAt = new Date().toISOString();
    this.state.pausedAt = undefined;
    this.saveState();
  }
}

// Export a singleton instance
export const pauseManager = new PauseManager();
export default pauseManager;
