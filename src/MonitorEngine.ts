import { loadConfig, loadOrganizations } from "./utils/config.js";
import { GitHubAPI } from "./utils/github.js";
import type MonitorWebServer from "./server.js";
import pauseManager from "./utils/pauseManager.js";
import { humanizeTime, getCIStatus } from "./utils/textUtils.js";

interface MonitorEngineOptions {
  config: boolean;
  interval: number;
  fastInterval: number;
  days: number;
  resumeOnFailure: boolean;
  autoFix: boolean;
  autoApprove: boolean;
  maxSessions: number;
  ignoreJobs: string[];
  server: MonitorWebServer;
}

export class MonitorEngine {
  private options: MonitorEngineOptions;
  private server: MonitorWebServer;
  private authToken: string | null = null;
  private repositories: string[] = [];
  private organizations: string[] = [];
  private api: GitHubAPI | null = null;
  private isRunning: boolean = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private fastIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastPullRequestData: any[] = [];
  private lastStatusData: any = null;
  private cachedUsername: string | null = null;
  private activePRs: Set<string> = new Set(); // URLs of PRs with ongoing activity
  private stablePRs: Set<string> = new Set(); // URLs of PRs without recent activity
  private fastRefreshInterval: number = 15; // seconds for active PRs (increased from 5)
  private slowRefreshInterval: number = 60; // seconds for stable PRs (increased from 30)
  
  // Session time tracking
  private totalSessionTimeMs: number = 0;
  private historicalSessionTimeMs: number = 0; // Historical completed sessions
  private workingPRs: Map<string, Date> = new Map(); // Track when each PR started working
  private realTimeUpdateInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: MonitorEngineOptions) {
    this.options = options;
    this.server = options.server;
    
    // Set configurable refresh intervals
    this.fastRefreshInterval = options.fastInterval;
    this.slowRefreshInterval = options.interval;

    // Set up callback for when new clients connect
    this.server.onClientConnect = () => {
      this.sendCurrentDataToNewClient();
    };
  }

  private sendCurrentDataToNewClient(): void {
    // Send current pause status first so pausedPRs Set is populated before buttons are created
    const pauseStatus = pauseManager.getStatus();
    this.server.send("pauseStatus", pauseStatus);
    
    if (this.lastPullRequestData.length > 0) {
      this.server.updatePullRequests(this.lastPullRequestData);
    }
    if (this.lastStatusData) {
      this.server.updateStatus(this.lastStatusData);
    }
  }

  async start(): Promise<void> {
    try {
      this.server.log("Initializing Copilot Monitor...");

      // Initialize authentication and configuration
      await this.initialize();

      if (!this.authToken) {
        throw new Error(
          "Authentication required. Please run with --config to set up authentication."
        );
      }

      if (this.repositories.length === 0 && this.organizations.length === 0) {
        throw new Error(
          "No repositories or organizations configured. Please run with --config to set up monitoring targets."
        );
      }

      this.server.log(
        `Monitoring ${this.repositories.length} repositories and ${this.organizations.length} organizations`
      );
      this.server.log(`Slow refresh interval: ${this.slowRefreshInterval} seconds for stable PRs`);
      this.server.log(`Fast refresh interval: ${this.fastRefreshInterval} seconds for active PRs`);

      // Start monitoring loop
      this.isRunning = true;
      
      // Initialize historical session time
      await this.initializeHistoricalSessionTime();
      
      await this.refreshAllData();

      // Set up dual refresh intervals
      // Slow refresh for stable PRs
      this.intervalId = setInterval(async () => {
        if (this.isRunning) {
          try {
            await this.refreshStablePRs();
          } catch (error) {
            this.server.log(
              `Error during slow refresh: ${
                error instanceof Error ? error.message : error
              }`
            );
          }
        }
      }, this.slowRefreshInterval * 1000);

      // Fast refresh for active PRs
      this.fastIntervalId = setInterval(async () => {
        if (this.isRunning) {
          try {
            await this.refreshActivePRs();
          } catch (error) {
            this.server.log(
              `Error during fast refresh: ${
                error instanceof Error ? error.message : error
              }`
            );
          }
        }
      }, this.fastRefreshInterval * 1000);

      // Real-time session time updates every second when there are active sessions
      this.realTimeUpdateInterval = setInterval(() => {
        if (this.isRunning && this.workingPRs.size > 0) {
          this.updateRealTimeSessionDisplay();
        }
      }, 1000);

      this.server.log("Monitor started successfully");
    } catch (error) {
      this.server.log(
        `Error starting monitor: ${
          error instanceof Error ? error.message : error
        }`
      );
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.fastIntervalId) {
      clearInterval(this.fastIntervalId);
      this.fastIntervalId = null;
    }

    if (this.realTimeUpdateInterval) {
      clearInterval(this.realTimeUpdateInterval);
      this.realTimeUpdateInterval = null;
    }

    this.server.log("Monitor stopped");
  }

  private async initialize(): Promise<void> {
    try {
      // If config flag is set, skip normal initialization
      if (this.options.config) {
        throw new Error("Configuration setup required");
      }

      // Ensure we have valid authentication with required scopes
      const { ensureValidTokenScopes } = await import("./utils/config.js");
      const auth = await ensureValidTokenScopes();

      // Create API instance and verify it works
      this.api = new GitHubAPI(auth.token);
      const verification = await this.api.verifyToken();

      if (!verification.valid) {
        throw new Error("Token validation failed after authentication");
      }

      // Double-check scopes (should not fail after ensureValidTokenScopes)
      const scopeValidation = this.api.validateTokenScopes(verification.scopes);
      if (!scopeValidation.valid) {
        throw new Error(
          `Token still missing required scopes: ${scopeValidation.missingScopes.join(
            ", "
          )}`
        );
      }

      this.authToken = auth.token;
      this.server.log(
        `Authenticated as: ${verification.user?.login || "unknown"}`
      );

      // Load configuration
      const repos = await loadConfig();
      const orgs = await loadOrganizations();

      if ((!repos || repos.length === 0) && (!orgs || orgs.length === 0)) {
        throw new Error("Configuration setup required");
      }

      this.repositories = repos || [];
      this.organizations = orgs || [];
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Configuration setup required"
      ) {
        console.error("\n❌ Setup required:");
        console.error(
          "Please run the following command to configure authentication and repositories:"
        );
        console.error("  npx copilot-monitor --config\n");
      }
      throw error;
    }
  }

  private async refreshData(): Promise<void> {
    try {
      this.server.log("Refreshing pull request data...");

      if (!this.api) {
        throw new Error("API not initialized");
      }

      // Get username if needed for auto features (cache it to avoid logging every time)
      let username = "";
      if (this.options.resumeOnFailure || this.options.autoFix) {
        if (this.cachedUsername === null) {
          try {
            username = await this.api.getUsername();
            this.cachedUsername = username;
            if (username) {
              this.server.log(`👤 Using username: ${username}`);
            }
          } catch {
            this.server.log(
              `⚠️ Warning: Could not fetch GitHub username - auto-features requiring comments may not work`
            );
            this.cachedUsername = "";
          }
        } else {
          username = this.cachedUsername;
        }
      }

      // Create options for collectPRStatuses
      const options = {
        resumeOnFailure: this.options.resumeOnFailure,
        username,
        autoFix: this.options.autoFix,
        autoApprove: this.options.autoApprove,
        maxSessions: this.options.maxSessions,
        onLog: (
          message: string,
          type: "info" | "success" | "error" | "warning"
        ) => {
          this.server.log(`[${type.toUpperCase()}] ${message}`);
        },
      };

      // Get pull requests with Copilot status
      const results = await this.api.collectPRStatuses(
        this.organizations,
        this.options.days,
        options
      );

      // Transform data for web interface with CI status (process sequentially to reduce CPU load)
      const webData = [];
      for (const result of results) {
        const owner = result.pr.base?.repo.owner.login || "";
        const repo = result.pr.base?.repo.name || "";
        const sha = result.pr.head?.sha;
        const branch = result.pr.head?.ref;

        this.server.log(
          `Processing PR ${owner}/${repo}#${result.pr.number}: SHA=${sha}, branch=${branch}`
        );

        // Fetch workflow runs for CI status
        let workflowRuns: any[] = [];
        let ciStatus = getCIStatus();

        if (this.api && (sha || branch)) {
          try {
            workflowRuns = [];

            if (sha) {
              // First try to fetch workflows for the specific SHA
              for await (const run of this.api.iterWorkflowRuns(
                owner,
                repo,
                sha
              )) {
                workflowRuns.push(run);
              }
            }

            // If no workflows found for specific SHA, try fetching recent workflows without SHA filter
            if (workflowRuns.length === 0) {
              this.server.log(
                `No workflows found for SHA ${sha} on ${owner}/${repo}#${result.pr.number}, trying without SHA filter`
              );
              for await (const run of this.api.iterRecentWorkflowRuns(
                owner,
                repo
              )) {
                // Only include runs related to this PR's branch or recent commits
                if (branch && run.head_branch === branch) {
                  workflowRuns.push(run);
                } else if (sha && run.head_sha === sha) {
                  workflowRuns.push(run);
                } else if (!branch && !sha) {
                  // If we don't have branch or SHA info, include recent workflows from main branches
                  if (
                    run.head_branch === "main" ||
                    run.head_branch === "master"
                  ) {
                    workflowRuns.push(run);
                  }
                }
                // Limit to avoid performance issues
                if (workflowRuns.length >= 5) {break;}
              }
            }

            this.server.log(
              `Found ${workflowRuns.length} workflow runs for ${owner}/${repo}#${result.pr.number} (SHA: ${sha}, branch: ${branch})`
            );
            if (workflowRuns.length > 0) {
              this.server.log(
                `Workflow statuses: ${workflowRuns
                  .map((r) => `${r.name}:${r.status}:${r.conclusion}`)
                  .join(", ")}`
              );
            }
            ciStatus = getCIStatus(workflowRuns, result.state);
          } catch (error) {
            this.server.log(
              `Error fetching workflow data for ${owner}/${repo}#${
                result.pr.number
              }: ${error instanceof Error ? error.message : error}`
            );
            // Fallback to unknown status if we can't fetch workflow data
            ciStatus = getCIStatus();
          }
        }

        const prData = {
          id: result.pr.id,
          title: result.pr.title,
          url: result.pr.html_url,
          repository: {
            name:
              result.pr.repository?.full_name ||
              result.pr.base?.repo?.full_name ||
              "unknown",
            url: `https://github.com/${
              result.pr.repository?.full_name ||
              result.pr.base?.repo?.full_name ||
              "unknown"
            }`,
          },
          copilotStatus: this.formatCopilotStatus(result),
          updatedAt: result.pr.updated_at,
          updatedAtHuman: humanizeTime(result.pr.updated_at),
          state: result.pr.state,
          draft: result.pr.state === "draft",
          ciStatus: ciStatus,
          workflowRuns: workflowRuns,
        };
        
        webData.push(prData);
        
        // Add small delay between processing each PR to reduce CPU load
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Update web interface
      this.lastPullRequestData = webData;
      this.server.updatePullRequests(webData);

      // Update session time tracking
      this.updateSessionTime(results);

      // Update status bar
      const activeCopilot = results.filter(
        (result) => result.state === "working"
      ).length;
      const statusData = {
        totalPrs: webData.length,
        activeCopilot: activeCopilot,
        totalSessionTime: this.formatTotalSessionTime(),
        nextRefresh: this.getNextRefreshTime(),
        refreshInterval: this.options.interval,
      };
      this.lastStatusData = statusData;
      this.server.updateStatus(statusData);

      this.server.log(
        `Updated ${webData.length} pull requests (${activeCopilot} active Copilot sessions)`
      );
    } catch (error) {
      this.server.log(
        `Error refreshing data: ${
          error instanceof Error ? error.message : error
        }`
      );
      throw error;
    }
  }

  private async refreshAllData(): Promise<void> {
    try {
      this.server.log("Refreshing all pull request data...");

      if (!this.api) {
        throw new Error("API not initialized");
      }

      // Clear current categorization
      this.activePRs.clear();
      this.stablePRs.clear();

      // Get username if needed for auto features (cache it to avoid logging every time)
      let username = "";
      if (this.options.resumeOnFailure || this.options.autoFix) {
        if (this.cachedUsername === null) {
          try {
            username = await this.api.getUsername();
            this.cachedUsername = username;
            if (username) {
              this.server.log(`👤 Using username: ${username}`);
            }
          } catch {
            this.server.log(
              `⚠️ Warning: Could not fetch GitHub username - auto-features requiring comments may not work`
            );
            this.cachedUsername = "";
          }
        } else {
          username = this.cachedUsername;
        }
      }

      // Create options for collectPRStatuses
      const options = {
        resumeOnFailure: this.options.resumeOnFailure,
        username,
        autoFix: this.options.autoFix,
        autoApprove: this.options.autoApprove,
        maxSessions: this.options.maxSessions,
        ignoreJobs: this.options.ignoreJobs,
        onLog: (
          message: string,
          type: "info" | "success" | "error" | "warning"
        ) => {
          this.server.log(`[${type.toUpperCase()}] ${message}`);
        },
        onPRProcessed: (result: any) => {
          // Send incremental update as soon as each PR is processed
          this.sendPRUpdate(result);
        },
      };

      // Get pull requests with Copilot status using streaming API
      const results = await this.api.collectPRStatusesStreaming(
        this.organizations,
        this.options.days,
        options
      );

      // Transform all data for final status update (process sequentially to reduce CPU load)
      const webData = [];
      for (const result of results) {
        const transformedData = await this.transformPRData(result);
        webData.push(transformedData);
        
        // Add small delay between processing each PR to reduce CPU load
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Update web interface with complete data
      this.lastPullRequestData = webData;
      this.server.updatePullRequests(webData);

      // Update session time tracking
      this.updateSessionTime(results);

      // Update status bar
      const activeCopilot = results.filter(
        (result) => result.state === "working"
      ).length;
      const statusData = {
        totalPrs: webData.length,
        activeCopilot: activeCopilot,
        totalSessionTime: this.formatTotalSessionTime(),
        nextRefresh: this.getNextRefreshTime(),
        refreshInterval: this.slowRefreshInterval,
      };
      this.lastStatusData = statusData;
      this.server.updateStatus(statusData);

      this.server.log(
        `Updated ${webData.length} pull requests (${activeCopilot} active Copilot sessions)`
      );
    } catch (error) {
      this.server.log(
        `Error refreshing all data: ${
          error instanceof Error ? error.message : error
        }`
      );
      throw error;
    }
  }

  private async refreshActivePRs(): Promise<void> {
    if (this.activePRs.size === 0) {
      return; // No active PRs to refresh
    }

    try {
      this.server.log(`Fast refresh: Updating ${this.activePRs.size} active PRs`);
      // For now, refresh only a subset of active PRs
      // TODO: Implement targeted refresh for specific PRs
      await this.refreshTargetedPRs(Array.from(this.activePRs));
    } catch (error) {
      this.server.log(
        `Error during fast refresh: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  private async refreshStablePRs(): Promise<void> {
    try {
      this.server.log(`Slow refresh: Checking for new PRs and updating stable PRs`);
      // For initial implementation, do a full refresh periodically
      // This will pick up new PRs and re-categorize existing ones
      await this.refreshAllData();
    } catch (error) {
      this.server.log(
        `Error during slow refresh: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  private async refreshTargetedPRs(prUrls: string[]): Promise<void> {
    // TODO: Implement targeted refresh for specific PRs
    // For now, we'll do a simplified version that just refreshes a few active PRs
    this.server.log(`Targeted refresh for ${prUrls.length} PRs (simplified implementation)`);
  }

  private async sendPRUpdate(result: any): Promise<void> {
    try {
      // Transform the single PR result for web interface
      const webData = await this.transformPRData(result);
      
      // Categorize PR based on activity level
      this.categorizePR(result, webData);
      
      // Send incremental update to UI
      this.server.send("prUpdate", {
        pr: webData,
        timestamp: new Date().toISOString(),
      });
      
      this.server.log(`Streamed update for PR: ${result.pr.title}`);
    } catch (error) {
      this.server.log(
        `Error sending PR update: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  private categorizePR(result: any, webData: any): void {
    const prUrl = result.pr.html_url;
    
    // Remove from both sets first
    this.activePRs.delete(prUrl);
    this.stablePRs.delete(prUrl);
    
    // Categorize based on activity
    const isActive = 
      result.state === "working" || // Copilot is actively working
      (webData.ciStatus && webData.ciStatus.status === "in_progress") || // CI is running
      (webData.workflowRuns && webData.workflowRuns.some((run: any) => 
        run.status === "in_progress" || run.status === "queued")); // Workflows running
    
    if (isActive) {
      this.activePRs.add(prUrl);
      this.server.log(`Categorized as ACTIVE: ${result.pr.title}`);
    } else {
      this.stablePRs.add(prUrl);
      this.server.log(`Categorized as STABLE: ${result.pr.title}`);
    }
  }

  private async transformPRData(result: any): Promise<any> {
    const owner = result.pr.base?.repo.owner.login || "";
    const repo = result.pr.base?.repo.name || "";
    const sha = result.pr.head?.sha;
    const branch = result.pr.head?.ref;

    this.server.log(
      `Processing PR ${owner}/${repo}#${result.pr.number}: SHA=${sha}, branch=${branch}`
    );

    // Fetch workflow runs for CI status
    let workflowRuns: any[] = [];
    let ciStatus = getCIStatus();

    if (this.api && (sha || branch)) {
      try {
        workflowRuns = [];

        if (sha) {
          // First try to fetch workflows for the specific SHA
          for await (const run of this.api.iterWorkflowRuns(
            owner,
            repo,
            sha
          )) {
            workflowRuns.push(run);
          }
        }

        // If no workflows found for specific SHA, try fetching recent workflows without SHA filter
        if (workflowRuns.length === 0) {
          this.server.log(
            `No workflows found for SHA ${sha} on ${owner}/${repo}#${result.pr.number}, trying without SHA filter`
          );
          for await (const run of this.api.iterRecentWorkflowRuns(
            owner,
            repo
          )) {
            // Only include runs related to this PR's branch or recent commits
            if (branch && run.head_branch === branch) {
              workflowRuns.push(run);
            } else if (sha && run.head_sha === sha) {
              workflowRuns.push(run);
            } else if (!branch && !sha) {
              // If we don't have branch or SHA info, include recent workflows from main branches
              if (
                run.head_branch === "main" ||
                run.head_branch === "master"
              ) {
                workflowRuns.push(run);
              }
            }
            // Limit to avoid performance issues
            if (workflowRuns.length >= 5) {break;}
          }
        }

        this.server.log(
          `Found ${workflowRuns.length} workflow runs for ${owner}/${repo}#${result.pr.number} (SHA: ${sha}, branch: ${branch})`
        );
        if (workflowRuns.length > 0) {
          this.server.log(
            `Workflow statuses: ${workflowRuns
              .map((r) => `${r.name}:${r.status}:${r.conclusion}`)
              .join(", ")}`
          );
        }
        ciStatus = getCIStatus(workflowRuns, result.state);
      } catch (error) {
        this.server.log(
          `Error fetching workflow data for ${owner}/${repo}#${
            result.pr.number
          }: ${error instanceof Error ? error.message : error}`
        );
        // Fallback to unknown status if we can't fetch workflow data
        ciStatus = getCIStatus();
      }
    }

    return {
      id: result.pr.id,
      title: result.pr.title,
      url: result.pr.html_url,
      repository: {
        name:
          result.pr.repository?.full_name ||
          result.pr.base?.repo?.full_name ||
          "unknown",
        url: `https://github.com/${
          result.pr.repository?.full_name ||
          result.pr.base?.repo?.full_name ||
          "unknown"
        }`,
      },
      copilotStatus: this.formatCopilotStatus(result),
      updatedAt: result.pr.updated_at,
      updatedAtHuman: humanizeTime(result.pr.updated_at),
      state: result.pr.state,
      draft: result.pr.state === "draft",
      ciStatus: ciStatus,
      workflowRuns: workflowRuns,
    };
  }

  private formatCopilotStatus(result: any): string {
    // Format the copilot status based on the result data
    if (result.state === "working") {
      return result.status_msg || "Copilot is working";
    } else if (result.state === "waiting") {
      return result.status_msg || "Waiting for feedback";
    } else if (result.state === "failed") {
      return result.status_msg || "Error";
    } else {
      return result.status_msg || "No Copilot activity";
    }
  }

  private getNextRefreshTime(): string {
    // Return seconds until next refresh for better client-side countdown
    return `${this.options.interval}s`;
  }

  private formatTotalSessionTime(): string {
    // Calculate total time including historical + current ongoing sessions
    let currentActiveSessionTime = 0;
    const now = new Date();
    
    // Add time for currently active sessions
    for (const startTime of this.workingPRs.values()) {
      currentActiveSessionTime += now.getTime() - startTime.getTime();
    }
    
    const totalMs = this.historicalSessionTimeMs + this.totalSessionTimeMs + currentActiveSessionTime;
    
    if (totalMs === 0) {
      return "00:00:00";
    }
    
    const totalSeconds = Math.floor(totalMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private updateSessionTime(results: any[]): void {
    const now = new Date();
    
    // Process each PR to track session timing
    for (const result of results) {
      const prUrl = result.pr.html_url;
      
      if (result.state === "working") {
        // PR is currently working
        if (!this.workingPRs.has(prUrl)) {
          // PR just started working - record start time
          this.workingPRs.set(prUrl, now);
          this.server.log(`Session started for PR: ${result.pr.title}`);
        }
        // If already working, we don't need to do anything here
        // The real-time display will handle the ongoing time calculation
      } else if (this.workingPRs.has(prUrl)) {
        // PR is no longer working and was previously working
        // PR just finished working - add the final session time
        const startTime = this.workingPRs.get(prUrl);
        if (startTime) {
          const sessionDuration = now.getTime() - startTime.getTime();
          this.totalSessionTimeMs += sessionDuration;
          this.workingPRs.delete(prUrl);
          
          const sessionMinutes = Math.floor(sessionDuration / 60000);
          const sessionSeconds = Math.floor((sessionDuration % 60000) / 1000);
          this.server.log(`Session completed for PR: ${result.pr.title} (${sessionMinutes}m ${sessionSeconds}s, total: ${this.formatTotalSessionTime()})`);
        }
      }
    }
  }

  private async initializeHistoricalSessionTime(): Promise<void> {
    try {
      this.server.log("Calculating historical Copilot session time...");
      
      if (!this.api) {
        throw new Error("API not initialized");
      }

      let totalHistoricalTime = 0;
      
      // Get pull requests with Copilot activity
      const results = await this.api.collectPRStatuses(
        this.organizations,
        this.options.days,
        { onLog: (message, type) => this.server.log(`[${type.toUpperCase()}] ${message}`) }
      );

      // Calculate session durations from Copilot events
      for (const result of results) {
        try {
          const sessionTime = await this.calculatePRSessionTime(result.pr);
          totalHistoricalTime += sessionTime;
        } catch (error) {
          this.server.log(
            `Error calculating session time for PR ${result.pr.html_url}: ${
              error instanceof Error ? error.message : error
            }`
          );
        }
      }

      this.historicalSessionTimeMs = totalHistoricalTime;
      
      const totalMinutes = Math.floor(totalHistoricalTime / 60000);
      const totalSeconds = Math.floor((totalHistoricalTime % 60000) / 1000);
      this.server.log(`Historical session time calculated: ${totalMinutes}m ${totalSeconds}s`);
      
    } catch (error) {
      this.server.log(
        `Error initializing historical session time: ${
          error instanceof Error ? error.message : error
        }`
      );
      // Continue with zero historical time if calculation fails
      this.historicalSessionTimeMs = 0;
    }
  }

  private async calculatePRSessionTime(pr: any): Promise<number> {
    if (!this.api) {
      return 0;
    }

    const owner = pr.base?.repo.owner.login || "";
    const repo = pr.base?.repo.name || "";
    const number = pr.number;

    if (!owner || !repo) {
      return 0;
    }

    // Collect copilot events
    const copilotEvents = new Set([
      "copilot_work_started",
      "copilot_work_finished", 
      "copilot_work_finished_failure",
    ]);

    const events: any[] = [];
    try {
      for await (const event of this.api.iterIssueEvents(owner, repo, number)) {
        if (copilotEvents.has(event.event)) {
          events.push(event);
        }
      }
    } catch {
      // Skip PRs where we can't fetch events
      return 0;
    }

    if (events.length === 0) {
      return 0;
    }

    // Calculate session durations from start/end pairs
    let totalSessionTime = 0;
    let sessionStart: Date | null = null;

    for (const event of events) {
      const eventTime = new Date(event.created_at);
      
      if (event.event === "copilot_work_started") {
        sessionStart = eventTime;
      } else if (
        (event.event === "copilot_work_finished" || event.event === "copilot_work_finished_failure") &&
        sessionStart
      ) {
        // Calculate session duration
        const duration = eventTime.getTime() - sessionStart.getTime();
        totalSessionTime += duration;
        sessionStart = null;
      }
    }

    return totalSessionTime;
  }

  private updateRealTimeSessionDisplay(): void {
    // Update status bar with current session time including active sessions
    if (this.lastStatusData) {
      const statusData = {
        ...this.lastStatusData,
        totalSessionTime: this.formatTotalSessionTime(),
      };
      this.server.updateStatus(statusData);
    }
  }
}
