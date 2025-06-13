import type { AxiosInstance} from "axios";
import axios, { AxiosError } from "axios";
import type {
  GitHubTokenVerification,
  PullRequest,
  GitHubRepository,
  Organization,
  CopilotStatus,
  CopilotEvent,
  CheckRun,
  CommitStatus,
  WorkflowRun,
  PullRequestEvent,
  IssueComment,
} from "../types";
import pauseManager from "./pauseManager.js";
import { collectFailureLogsAdvanced } from "./errorExtraction.js";
import { humanizeTime, humanizeAge, humanizeRemaining } from "./textUtils.js";

const GITHUB_API_BASE = "https://api.github.com";

// Add debug logging helper
const DEBUG =
  process.env.DEBUG === "true" || process.env.NODE_ENV === "development";
const debugLog = (message: string, data?: any) => {
  if (DEBUG) {
    console.log(
      `[GitHub API Debug] ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  }
};

// Helper function to parse GitHub timestamps
const parseTimestamp = (ts: string): Date | null => {
  try {
    return new Date(ts);
  } catch {
    return null;
  }
};

// Fix message templates
const FIX_MESSAGES = {
  ts: "@copilot these checks are failing, please fix them",
  tests: "@copilot there are failing tests, please fix them",
  checks: "@copilot the checks are failing, please fix them",
};

// Nudge message
const NUDGE_TEXT = "@copilot please resume working on this task";

// Classify checks into categories
const classifyChecks = (names: string[]): keyof typeof FIX_MESSAGES => {
  const text = names.join(" ").toLowerCase();
  if (
    text.includes("typescript") ||
    text.includes("ts") ||
    text.includes("lint")
  ) {
    return "ts";
  }
  if (text.includes("test")) {
    return "tests";
  }
  return "checks";
};

// Legacy helper function to collect sample logs from failed jobs (kept for compatibility)
const _collectFailureLogs = async (
  client: AxiosInstance,
  owner: string,
  repo: string,
  failedRunIds: number[]
): Promise<string> => {
  const logSamples: string[] = [];

  debugLog(`Starting log collection for failed runs`, {
    owner,
    repo,
    failedRunIds,
    runCount: failedRunIds.length,
  });

  // Limit to most recent 2 failed runs to avoid overwhelming the comment
  const runIdsToCheck = failedRunIds.slice(0, 2);

  for (const runId of runIdsToCheck) {
    try {
      debugLog(`Processing workflow run ${runId}`);

      // Get jobs for this workflow run to identify failed jobs
      const jobsResponse = await client.get(
        `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`
      );
      const failedJobs = jobsResponse.data.jobs.filter(
        (job: any) => job.conclusion === "failure" || job.conclusion === "error"
      );

      debugLog(`Jobs analysis for run ${runId}`, {
        totalJobs: jobsResponse.data.jobs.length,
        failedJobs: failedJobs.length,
        failedJobNames: failedJobs.map((job: any) => job.name),
      });

      // Use individual job logs approach - this returns plain text, not compressed data
      for (const job of failedJobs.slice(0, 3)) {
        try {
          debugLog(`Fetching logs for job ${job.id} (${job.name}) in run ${runId}`);
          
          const jobLogResponse = await client.get(
            `/repos/${owner}/${repo}/actions/jobs/${job.id}/logs`,
            {
              headers: { 
                Accept: "text/plain",
                "X-GitHub-Api-Version": "2022-11-28"
              },
              maxRedirects: 5,
              // Ensure we handle response as text
              responseType: 'text',
            }
          );

          debugLog(`Job log response received for job ${job.id}`, {
            responseType: typeof jobLogResponse.data,
            dataLength: typeof jobLogResponse.data === "string" ? jobLogResponse.data.length : "not string",
            status: jobLogResponse.status,
            headers: {
              contentType: jobLogResponse.headers["content-type"],
              contentLength: jobLogResponse.headers["content-length"],
            },
          });

          const jobLogText = jobLogResponse.data;
          if (typeof jobLogText === "string" && jobLogText.length > 0) {
            const lines = jobLogText.split("\n");
            
            // Extract relevant error lines - look for common error patterns
            const errorLines = lines
              .filter(line => {
                const lowerLine = line.toLowerCase();
                return (
                  lowerLine.includes("error") ||
                  lowerLine.includes("failed") ||
                  lowerLine.includes("failure") ||
                  lowerLine.includes("exception") ||
                  lowerLine.includes("fatal") ||
                  line.includes("✗") ||
                  line.includes("❌") ||
                  line.includes("⚠") ||
                  // Common patterns from GitHub Actions
                  line.includes("##[error]") ||
                  line.includes("Process completed with exit code") ||
                  lowerLine.includes("npm err") ||
                  lowerLine.includes("yarn error") ||
                  lowerLine.includes("build failed") ||
                  lowerLine.includes("test failed") ||
                  lowerLine.includes("lint error") ||
                  lowerLine.includes("compile error") ||
                  // TypeScript specific errors
                  lowerLine.includes("ts(") ||
                  lowerLine.includes("typescript") && lowerLine.includes("error") ||
                  // TypeScript compiler errors (tsc --noemit output)
                  line.match(/^Error: .+\(\d+,\d+\): error TS\d+:/) ||
                  // ESLint specific errors
                  line.match(/^\s*\d+:\d+\s+error/) ||
                  // Jest/test specific errors
                  lowerLine.includes("test failed") ||
                  lowerLine.includes("expect") && lowerLine.includes("received")
                );
              })
              // Take the last 10 error lines to get the most recent errors
              .slice(-10);

            if (errorLines.length > 0) {
              // Clean up the error lines and remove excessive whitespace
              const cleanErrorLines = errorLines
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .slice(0, 8); // Limit to 8 lines per job to keep comment manageable

              if (cleanErrorLines.length > 0) {
                logSamples.push(
                  `### ${job.name}\n\`\`\`\n${cleanErrorLines.join("\n")}\n\`\`\``
                );
              }
            }

            debugLog(`Processed logs for job ${job.id}`, {
              totalLines: lines.length,
              errorLines: errorLines.length,
              includedInSample: errorLines.length > 0,
            });
          } else {
            debugLog(`Job logs were not string or empty for job ${job.id}`, {
              dataType: typeof jobLogText,
              dataLength: jobLogText ? jobLogText.length : 0,
            });
          }
        } catch (jobLogError) {
          debugLog(`Failed to fetch individual job logs for job ${job.id}`, {
            error: jobLogError instanceof Error ? jobLogError.message : jobLogError,
            status: (jobLogError as any)?.response?.status,
            data: (jobLogError as any)?.response?.data,
          });
        }
      }
    } catch (runError) {
      debugLog(`Failed to fetch run details for run ${runId}`, { 
        error: runError instanceof Error ? runError.message : runError 
      });
      // Continue with other runs
    }
  }

  debugLog(`Log collection completed`, {
    totalLogSamples: logSamples.length,
    logSamplesSummary: logSamples.map(sample => sample.split('\n')[0]), // Just the job names
    finalResultLength: logSamples.length > 0 ? 
      `\n\n**Sample error logs:**\n${logSamples.join("\n\n")}`.length : 0,
  });

  return logSamples.length > 0
    ? `\n\n**Sample error logs:**\n${logSamples.join("\n\n")}`
    : "";
};

/**
 * GitHub API Client with enhanced workflow rerun capabilities
 *
 * Required GitHub OAuth Scopes (matching GitHub CLI):
 * - repo: Full repository access (required for workflow reruns)
 * - read:org: Read organization membership
 * - read:user: Read user profile information
 * - user:email: Read user email addresses
 * - gist: Access to gists (GitHub CLI requirement)
 * - workflow: Access to GitHub Actions workflows (required for reruns)
 */
export class GitHubAPI {
  private token: string;
  private client: AxiosInstance;

  constructor(token: string) {
    this.token = token;
    this.client = axios.create({
      baseURL: GITHUB_API_BASE,
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "copilot-monitor/1.0.0", // Add user agent for better API compatibility
      },
    });

    debugLog("Initialized GitHub API client", {
      baseURL: GITHUB_API_BASE,
      tokenLength: token.length,
      headers: this.client.defaults.headers,
    });

    // Add request interceptor for debugging
    this.client.interceptors.request.use(
      (config) => {
        debugLog(
          `Making request to ${config.method?.toUpperCase()} ${config.url}`,
          {
            params: config.params,
            data: config.data,
          }
        );
        return config;
      },
      (error) => {
        debugLog("Request interceptor error", error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for debugging
    this.client.interceptors.response.use(
      (response) => {
        debugLog(`Response from ${response.config.url}`, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            "x-ratelimit-remaining": response.headers["x-ratelimit-remaining"],
            "x-ratelimit-reset": response.headers["x-ratelimit-reset"],
            "x-oauth-scopes": response.headers["x-oauth-scopes"],
          },
          dataLength: JSON.stringify(response.data).length,
        });
        return response;
      },
      (error) => {
        debugLog(`Response error from ${error.config?.url}`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  async verifyToken(): Promise<GitHubTokenVerification> {
    try {
      debugLog("Verifying GitHub token");
      const response = await this.client.get("/user");
      const scopes = response.headers["x-oauth-scopes"]?.split(", ") || [];

      const result = {
        valid: true,
        user: response.data,
        scopes,
        rateLimitRemaining: response.headers["x-ratelimit-remaining"]
          ? parseInt(response.headers["x-ratelimit-remaining"], 10)
          : undefined,
        rateLimitReset: response.headers["x-ratelimit-reset"]
          ? parseInt(response.headers["x-ratelimit-reset"], 10)
          : undefined,
      };

      debugLog("Token verification successful", {
        user: response.data.login,
        scopes,
        rateLimitRemaining: result.rateLimitRemaining,
        rateLimitReset: result.rateLimitReset,
      });

      return result;
    } catch (error) {
      debugLog("Token verification failed", {
        error: error instanceof Error ? error.message : error,
        isAxiosError: axios.isAxiosError(error),
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
      });
      return { valid: false, scopes: [] };
    }
  }

  private getRequiredScopes(): string[] {
    // Match GitHub CLI scope requirements exactly
    return ["repo", "read:org", "read:user", "user:email", "gist", "workflow"];
  }

  private checkMissingScopes(currentScopes: string[]): string[] {
    const required = this.getRequiredScopes();
    return required.filter((scope) => !currentScopes.includes(scope));
  }

  // Helper method to generate user-friendly scope error messages
  getScopeErrorMessage(currentScopes: string[]): string | null {
    const missing = this.checkMissingScopes(currentScopes);
    if (missing.length === 0) {return null;}

    return `🔐 Missing required GitHub token scopes: ${missing.join(
      ", "
    )}. Please re-authenticate with the required scopes.`;
  }

  // Check if token has all required scopes and return validation result
  validateTokenScopes(currentScopes: string[]): {
    valid: boolean;
    missingScopes: string[];
    errorMessage: string | null;
  } {
    const missing = this.checkMissingScopes(currentScopes);

    return {
      valid: missing.length === 0,
      missingScopes: missing,
      errorMessage:
        missing.length > 0
          ? `Missing required GitHub token scopes: ${missing.join(
              ", "
            )}. Please re-authenticate with the required scopes.`
          : null,
    };
  }

  // Check if current token has all required scopes for workflow operations
  hasWorkflowScopes(currentScopes: string[]): boolean {
    const workflowRequiredScopes = ["repo", "workflow"];
    return workflowRequiredScopes.every((scope) =>
      currentScopes.includes(scope)
    );
  }

  async getOrganizations(): Promise<Organization[]> {
    try {
      debugLog("Fetching user organizations");

      // Get user's organizations
      const orgsResponse = await this.client.get<Organization[]>("/user/orgs");

      // Get user information to include as an option
      const userResponse = await this.client.get("/user");
      const user = userResponse.data;

      debugLog("Organizations fetched", {
        userLogin: user.login,
        orgCount: orgsResponse.data.length,
        organizations: orgsResponse.data.map((org) => ({
          login: org.login,
          id: org.id,
        })),
      });

      // Create a user organization entry
      const userOrg: Organization = {
        id: user.id,
        login: user.login,
        description: `Your personal repositories (${user.name || user.login})`,
        avatar_url: user.avatar_url,
      };

      // Return user first, then organizations
      return [userOrg, ...orgsResponse.data];
    } catch (error) {
      debugLog("Failed to fetch organizations", {
        error: error instanceof Error ? error.message : error,
        isAxiosError: axios.isAxiosError(error),
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
        data: axios.isAxiosError(error) ? error.response?.data : undefined,
      });

      const message =
        error instanceof AxiosError ? error.message : "Unknown error";
      throw new Error(`Failed to fetch organizations: ${message}`);
    }
  }

  async getRepositories(org: string): Promise<GitHubRepository[]> {
    try {
      // Check if this is the user's own repositories
      const userResponse = await this.client.get("/user");
      const currentUser = userResponse.data;

      let response;
      if (org === currentUser.login) {
        // Fetch user's own repositories (only owned, not collaborator repos)
        response = await this.client.get<GitHubRepository[]>("/user/repos", {
          params: {
            type: "owner", // Only repositories owned by the user
            sort: "updated",
            per_page: 100,
            affiliation: "owner", // Additional filter to ensure only owned repos
          },
        });
      } else {
        // Fetch organization repositories
        response = await this.client.get<GitHubRepository[]>(
          `/orgs/${org}/repos`,
          {
            params: {
              sort: "updated",
              per_page: 100,
            },
          }
        );
      }

      return response.data;
    } catch (error) {
      const message =
        error instanceof AxiosError ? error.message : "Unknown error";
      throw new Error(`Failed to fetch repositories for ${org}: ${message}`);
    }
  }

  async getPullRequests(owner: string, repo: string): Promise<PullRequest[]> {
    try {
      const response = await this.client.get<PullRequest[]>(
        `/repos/${owner}/${repo}/pulls`,
        {
          params: {
            state: "open",
            per_page: 100,
          },
        }
      );
      return response.data;
    } catch (error) {
      const message =
        error instanceof AxiosError ? error.message : "Unknown error";
      throw new Error(`Failed to fetch PRs for ${owner}/${repo}: ${message}`);
    }
  }

  async getPullRequestEvents(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<any[]> {
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/issues/${prNumber}/events`
      );
      return response.data;
    } catch (error) {
      const message =
        error instanceof AxiosError ? error.message : "Unknown error";
      throw new Error(`Failed to fetch events for PR ${prNumber}: ${message}`);
    }
  }

  async getCopilotStatus(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<CopilotStatus> {
    try {
      const events = await this.getPullRequestEvents(owner, repo, prNumber);

      // Look for copilot-related events (these would be custom events)
      // For now, we'll simulate the logic based on the requirements
      const copilotEvents = events.filter(
        (event) =>
          event.event === "labeled" &&
          event.label &&
          event.label.name.includes("copilot")
      );

      if (copilotEvents.length === 0) {
        return "No Copilot Activity";
      }

      const latestEvent = copilotEvents[copilotEvents.length - 1];

      // Simulate different states based on label names
      if (latestEvent.label.name.includes("copilot_started")) {
        return "Copilot Working";
      } else if (latestEvent.label.name.includes("copilot_finished_failed")) {
        return "Error";
      } else if (latestEvent.label.name.includes("copilot_finished")) {
        return "Waiting for Feedback";
      }

      return "No Copilot Activity";
    } catch {
      return "Error";
    }
  }

  async searchCopilotPRs(
    owners: string[],
    days: number = 2
  ): Promise<PullRequest[]> {
    try {
      debugLog("Starting searchCopilotPRs", { owners, days });

      // Get the current authenticated user's username
      const username = await this.getUsername();
      if (!username) {
        debugLog("Could not get username, falling back to organization search");
      } else {
        debugLog("Retrieved username for search", { username });
      }

      const since = new Date();
      since.setDate(since.getDate() - days);
      const dateFilter = since.toISOString().split("T")[0]; // Format: YYYY-MM-DD

      debugLog("Date filter calculated", { dateFilter });

      const allItems: any[] = [];

      for (const owner of owners) {
        try {
          debugLog(`Processing owner: ${owner}`);

          // Build search query - if we have a username, search for PRs assigned to that user
          // Otherwise, search for all PRs in the organization
          let query = `is:pr is:open org:${owner} updated:>=${dateFilter}`;
          if (username) {
            query += ` assignee:${username}`;
          }

          debugLog(`Making search request for ${owner}`, {
            searchQuery: query,
          });

          let page = 1;
          while (true) {
            debugLog(`Making request to GET /search/issues`, {
              params: {
                q: query,
                per_page: 100,
                page,
              },
            });

            const response = await this.client.get("/search/issues", {
              params: {
                q: query,
                per_page: 100,
                page,
              },
            });

            debugLog(`Response from /search/issues`, {
              status: response.status,
              statusText: response.statusText,
              headers: {
                "x-ratelimit-remaining":
                  response.headers["x-ratelimit-remaining"],
                "x-ratelimit-reset": response.headers["x-ratelimit-reset"],
                "x-oauth-scopes": response.headers["x-oauth-scopes"],
              },
              dataLength: JSON.stringify(response.data).length,
            });

            const data = response.data;
            debugLog(
              `${owner} page ${page} returned ${data.items?.length || 0} items`
            );

            if (!data.items || data.items.length === 0) {
              break;
            }

            allItems.push(...data.items);

            // Check if there are more pages
            if (
              !response.headers.link ||
              !response.headers.link.includes('rel="next"')
            ) {
              break;
            }
            page++;
          }

          // Add a small delay to avoid hitting rate limits
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (ownerError: any) {
          debugLog(`Error searching PRs for owner ${owner}`, {
            error: ownerError.message,
            status: ownerError.response?.status,
          });

          if (ownerError.response?.status === 422) {
            debugLog(`Search query validation failed for ${owner} (422 error)`);
            console.warn(`Invalid search query for ${owner} - skipping`);
          }
          continue;
        }
      }

      debugLog(`Total items found before filtering: ${allItems.length}`);

      // Filter PRs to find those assigned to Copilot
      const copilotPRs: PullRequest[] = [];
      for (const item of allItems) {
        const assignees = item.assignees?.map((a: any) => a.login) || [];
        debugLog(
          `${item.repository?.full_name || item.html_url || "unknown"}#${
            item.number
          } assignees=${assignees.join(", ")}`
        );

        // Debug: Log the item structure to understand what's available
        debugLog(`Item structure for PR #${item.number}:`, {
          repository: item.repository,
          html_url: item.html_url,
          url: item.url,
          repository_url: item.repository_url,
        });

        if (
          assignees.some(
            (assignee: string) => (assignee || "").toLowerCase() === "copilot"
          )
        ) {
          // Extract repository info from html_url if repository field is missing
          let repoName = "unknown";
          let repoFullName = "unknown";
          let repoOwner = "unknown";
          let repoOwnerId = 0;

          if (item.repository?.name) {
            repoName = item.repository.name;
            repoFullName = item.repository.full_name;
            repoOwner = item.repository.owner?.login || "unknown";
            repoOwnerId = item.repository.owner?.id || 0;
          } else if (item.html_url) {
            // Parse from html_url: https://github.com/owner/repo/pull/123
            const urlMatch = item.html_url.match(
              /github\.com\/([^/]+)\/([^/]+)/
            );
            if (urlMatch) {
              repoOwner = urlMatch[1];
              repoName = urlMatch[2];
              repoFullName = `${repoOwner}/${repoName}`;
            }
          }

          // Fetch complete PR data to get head SHA and branch information
          let headRef = "unknown";
          let headSha = "unknown";

          try {
            if (repoOwner !== "unknown" && repoName !== "unknown") {
              debugLog(
                `Fetching complete PR data for ${repoOwner}/${repoName}#${item.number}`
              );
              const fullPR = await this.fetchPullRequest(
                repoOwner,
                repoName,
                item.number
              );
              headRef = fullPR.head?.ref || "unknown";
              headSha = fullPR.head?.sha || "unknown";
              debugLog(`Got head info: ref=${headRef}, sha=${headSha}`);
            }
          } catch (error) {
            debugLog(
              `Failed to fetch complete PR data for ${repoOwner}/${repoName}#${
                item.number
              }: ${error instanceof Error ? error.message : error}`
            );
            // Use fallback values from search API if available
            headRef = item.head?.ref || "unknown";
            headSha = item.head?.sha || "unknown";
          }

          // Convert to PullRequest format
          const pr: PullRequest = {
            id: item.id,
            number: item.number,
            title: item.title,
            state: item.state,
            created_at: item.created_at,
            updated_at: item.updated_at,
            html_url: item.html_url,
            user: item.user,
            assignees: item.assignees,
            head: {
              ref: headRef,
              sha: headSha,
            },
            base: {
              ref: item.base?.ref || "main",
              repo: {
                name: repoName,
                full_name: repoFullName,
                owner: {
                  login: repoOwner,
                  id: repoOwnerId,
                },
              },
            },
            repository: {
              name: repoName,
              full_name: repoFullName,
            },
          };

          copilotPRs.push(pr);
        }
      }

      debugLog(
        `Found ${copilotPRs.length} Copilot-assigned PRs out of ${allItems.length} total`
      );

      return copilotPRs;
    } catch (error) {
      debugLog("searchCopilotPRs error", {
        error: error instanceof Error ? error.message : error,
      });
      throw new Error(
        `Failed to search Copilot Pull Requests: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async collectPRStatusesStreaming(
    owners: string[],
    days: number,
    options: {
      resumeOnFailure?: boolean;
      username?: string;
      autoFix?: boolean;
      autoApprove?: boolean;
      maxSessions?: number;
      ignoreJobs?: string[];
      onLog?: (
        message: string,
        type: "info" | "success" | "error" | "warning"
      ) => void;
      onPRProcessed?: (result: PullRequestEvent & { pr: PullRequest }) => void;
    } = {}
  ): Promise<Array<PullRequestEvent & { pr: PullRequest }>> {
    try {
      debugLog("Starting collectPRStatusesStreaming", { owners, days, options });

      const prs = await this.searchCopilotPRs(owners, days);
      if (prs.length === 0) {
        return [];
      }

      const copilotEvents = new Set([
        "copilot_work_started",
        "copilot_work_finished",
        "copilot_work_finished_failure",
      ]);

      const results: Array<PullRequestEvent & { pr: PullRequest }> = [];

      for (const pr of prs) {
        try {
          const result = await this.processSinglePR(pr, copilotEvents, options);
          if (result) {
            results.push(result);
            // Call the callback immediately after processing each PR
            if (options.onPRProcessed) {
              options.onPRProcessed(result);
            }
          }
        } catch (error) {
          debugLog(`Error processing PR ${pr.html_url}`, {
            error: error instanceof Error ? error.message : error,
          });
          // Continue with other PRs even if one fails
        }
      }

      // Sort by timestamp, most recent first
      results.sort((a, b) => {
        const aTime = a.timestamp?.getTime() || 0;
        const bTime = b.timestamp?.getTime() || 0;
        return bTime - aTime;
      });

      debugLog(`Collected ${results.length} PR statuses`);
      return results;
    } catch (error) {
      debugLog("collectPRStatusesStreaming error", {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  async collectPRStatuses(
    owners: string[],
    days: number,
    options: {
      resumeOnFailure?: boolean;
      username?: string;
      autoFix?: boolean;
      autoApprove?: boolean;
      maxSessions?: number;
      onLog?: (
        message: string,
        type: "info" | "success" | "error" | "warning"
      ) => void;
    } = {}
  ): Promise<Array<PullRequestEvent & { pr: PullRequest }>> {
    // Use the streaming version without the callback for backward compatibility
    return this.collectPRStatusesStreaming(owners, days, options);
  }

  private async processSinglePR(
    pr: PullRequest,
    copilotEvents: Set<string>,
    options: {
      resumeOnFailure?: boolean;
      username?: string;
      autoFix?: boolean;
      autoApprove?: boolean;
      maxSessions?: number;
      ignoreJobs?: string[];
      onLog?: (
        message: string,
        type: "info" | "success" | "error" | "warning"
      ) => void;
    }
  ): Promise<(PullRequestEvent & { pr: PullRequest }) | null> {
    debugLog(`Checking ${pr.html_url}`);

    const owner = pr.base!.repo.owner.login;
    const repo = pr.base!.repo.name;
    const number = pr.number;

    // Collect copilot events
    const events: CopilotEvent[] = [];
    try {
      for await (const event of this.iterIssueEvents(owner, repo, number)) {
        if (copilotEvents.has(event.event)) {
          events.push(event);
        }
      }
    } catch (error) {
      debugLog(`Failed to fetch events for ${pr.html_url}`, {
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }

    if (events.length === 0) {
      debugLog(`No Copilot events found in ${pr.html_url}`);
      return null;
    }

    const lastEvent = events[events.length - 1];
    const timestamp = parseTimestamp(lastEvent.created_at);
    const eventType = lastEvent.event;

    // Count completed copilot sessions
    let sessionCount = 0;
    let inSession = false;
    
    for (const event of events) {
      if (event.event === "copilot_work_started") {
        inSession = true;
      } else if (event.event === "copilot_work_finished" || event.event === "copilot_work_finished_failure") {
        if (inSession) {
          sessionCount++;
          inSession = false;
        }
      }
    }

    // Check if we've reached the maximum sessions
    const maxSessions = options.maxSessions || 50;
    if (sessionCount >= maxSessions) {
      return {
        timestamp: timestamp || undefined,
        status: "Max Copilot sessions reached",
        color: "orange",
        emoji: "🚫",
        time: humanizeTime(timestamp || new Date()),
        state: "max_sessions_reached",
        event_word: "Limit Reached",
        status_msg: `Maximum sessions reached (${sessionCount}/${maxSessions})`,
        pr,
      };
    }

    let status: CopilotStatus;
    let color: string;
    let emoji: string;
    let state: "working" | "waiting" | "failed" | "idle";
    let eventWord: string;
    let statusMsg: string;
    let waitMinutes: number | undefined;

    if (eventType === "copilot_work_started") {
      status = "Copilot Working";
      statusMsg = "Copilot is working";
      color = "blue";
      emoji = "🔄";
      state = "working";
      eventWord = "Started";
    } else if (eventType === "copilot_work_finished") {
      status = "Waiting for Feedback";
      statusMsg = "Waiting for feedback";
      color = "cyan";
      emoji = "⏳";
      state = "waiting";
      eventWord = "Finished";

      // Handle auto-fix and auto-approve features
      if ((options.autoFix || options.autoApprove) && timestamp) {
        // Check if automation is paused
        const prIdentifier = pr.html_url;
        if (pauseManager.shouldPauseAutomation(prIdentifier)) {
          if (pauseManager.isGloballyPaused()) {
            options.onLog?.(
              `⏸️ Automation globally paused - skipping auto actions for ${pr.title}`,
              "warning"
            );
          } else {
            options.onLog?.(
              `⏸️ Automation paused for this PR - skipping auto actions for ${pr.title}`,
              "warning"
            );
          }
        } else {
          try {
            const prData = await this.fetchPullRequest(owner, repo, number);
            const sha = prData.head?.sha;
            let autoFixPostedComment = false;

            if (options.autoFix && sha) {
              options.onLog?.(
                `🔍 Auto-fix: Analyzing failed checks for ${pr.title}`,
                "info"
              );
              const failedChecks: string[] = [];

              // First, identify workflow runs that are in a failed state
              const failedWorkflowRuns = new Set<number>();
              for await (const run of this.iterWorkflowRuns(
                owner,
                repo,
                sha
              )) {
                const status = (run.status || "").toLowerCase();
                const conclusion = (run.conclusion || "").toLowerCase();

                if (
                  ["action_required", "failure"].includes(conclusion) ||
                  [
                    "action_required",
                    "waiting",
                    "queued",
                    "pending",
                  ].includes(status)
                ) {
                  failedWorkflowRuns.add(run.id);
                }
              }

              // Only collect failed checks from workflow runs that are actually in a failed state
              // Note: Check runs and commit statuses don't directly map to workflow runs,
              // but we can filter by the same criteria: only include checks that failed after
              // the Copilot timestamp AND belong to workflows that are in a failed state
              for await (const run of this.iterCheckRuns(
                owner,
                repo,
                sha
              )) {
                const conclusion = (run.conclusion || "").toLowerCase();
                if (
                  conclusion &&
                  !["success", "neutral", "skipped"].includes(conclusion)
                ) {
                  const completed = parseTimestamp(
                    run.completed_at || run.started_at || ""
                  );
                  if (completed && completed > timestamp) {
                    // Only include failed checks if there are any failed workflow runs
                    // This ensures we don't ask Copilot to fix checks from successful workflows
                    if (failedWorkflowRuns.size > 0) {
                      failedChecks.push(run.name || "");
                    }
                  }
                }
              }

              // Check for failed commit statuses (only if there are failed workflow runs)
              if (failedWorkflowRuns.size > 0) {
                for await (const status of this.iterCommitStatuses(
                  owner,
                  repo,
                  sha
                )) {
                  const state = (status.state || "").toLowerCase();
                  if (["failure", "error"].includes(state)) {
                    const updated = parseTimestamp(status.updated_at || "");
                    if (updated && updated > timestamp) {
                      failedChecks.push(status.context || "");
                    }
                  }
                }
              }

              // Filter out ignored jobs (configurable via --ignore-jobs)
              const ignoreJobs = options.ignoreJobs || ["danger"];
              const filteredChecks = failedChecks.filter(
                (check) => !ignoreJobs.some((ignored: string) => 
                  check.toLowerCase().includes(ignored.toLowerCase())
                )
              );

              debugLog(`Auto-fix check analysis for ${pr.html_url}:`, {
                failedWorkflowRuns: failedWorkflowRuns.size,
                totalFailedChecks: failedChecks.length,
                filteredChecks: filteredChecks.length,
                allChecks: failedChecks,
                ignoredJobs: ignoreJobs,
                filteredOut: failedChecks.filter((check) =>
                  ignoreJobs.some((ignored: string) => 
                    check.toLowerCase().includes(ignored.toLowerCase())
                  )
                ),
                copilotTimestamp: timestamp?.toISOString(),
                username: options.username,
                hasUsername: !!options.username,
              });

              if (filteredChecks.length > 0) {
                const category = classifyChecks(filteredChecks);
                const checksList = filteredChecks.sort().join(", ");
                const baseText = FIX_MESSAGES[category];

                // Collect sample logs from failed workflow runs using advanced error extraction
                debugLog(`Collecting logs for failed workflow runs using advanced extraction`, {
                  failedWorkflowRunCount: failedWorkflowRuns.size,
                  failedWorkflowRuns: Array.from(failedWorkflowRuns),
                  owner,
                  repo,
                });
                
                const sampleLogs = await collectFailureLogsAdvanced(
                  this.client,
                  owner,
                  repo,
                  Array.from(failedWorkflowRuns)
                );

                debugLog(`Log collection completed`, {
                  sampleLogsLength: sampleLogs.length,
                  hasSampleLogs: sampleLogs.length > 0,
                  sampleLogsPreview: sampleLogs.substring(0, 200) + (sampleLogs.length > 200 ? "..." : ""),
                });

                const fixText = `${baseText}: ${checksList}${sampleLogs}`;

                if (options.username) {
                  debugLog(`Posting fix comment on ${pr.html_url}`, {
                    fixText,
                    username: options.username,
                    failedChecks: filteredChecks.length,
                  });
                  options.onLog?.(
                    `💬 Auto-fix: Posting fix comment for ${pr.title} (${filteredChecks.length} failed checks)`,
                    "info"
                  );
                  try {
                    await this.postIssueComment(
                      owner,
                      repo,
                      number,
                      fixText
                    );
                    autoFixPostedComment = true;
                    statusMsg = "Waiting for Copilot to fix issues";
                    status = "Waiting for Feedback";
                    emoji = "🔧";
                    state = "waiting";
                    options.onLog?.(
                      `🔧 Auto-fix: Successfully requested fixes for ${pr.title}: ${checksList}`,
                      "success"
                    );
                    options.onLog?.(
                      `⏳ Auto-fix: Waiting for Copilot to fix issues before rerunning workflows`,
                      "info"
                    );
                  } catch (fixError) {
                    debugLog(`Failed to post fix comment`, {
                      error:
                        fixError instanceof Error
                          ? fixError.message
                          : fixError,
                      status: axios.isAxiosError(fixError)
                        ? fixError.response?.status
                        : undefined,
                      response: axios.isAxiosError(fixError)
                        ? fixError.response?.data
                        : undefined,
                    });
                    options.onLog?.(
                      `❌ Auto-fix failed for ${pr.title}: ${
                        fixError instanceof Error
                          ? fixError.message
                          : "Unknown error"
                      }`,
                      "error"
                    );

                    // Check if it's a permissions issue
                    if (axios.isAxiosError(fixError)) {
                      const status = fixError.response?.status;
                      if (status === 403) {
                        options.onLog?.(
                          `🔐 Permission denied - check GitHub token scopes (need 'repo', 'workflow', and other required scopes)`,
                          "error"
                        );
                      } else if (status === 401) {
                        options.onLog?.(
                          `🔑 Authentication failed - check GitHub token validity`,
                          "error"
                        );
                      }
                    }
                  }
                } else {
                  options.onLog?.(
                    `⚠️ Auto-fix skipped for ${pr.title}: No username configured`,
                    "warning"
                  );
                }
              }
            }

            if (options.autoApprove && sha && !autoFixPostedComment) {
              options.onLog?.(
                `🔄 Auto-approve: No failed checks to fix, proceeding with workflow reruns for ${pr.title}`,
                "info"
              );
              const pendingRuns: number[] = [];

              for await (const run of this.iterWorkflowRuns(
                owner,
                repo,
                sha
              )) {
                const status = (run.status || "").toLowerCase();
                const conclusion = (run.conclusion || "").toLowerCase();

                if (
                  ["action_required", "failure"].includes(conclusion) ||
                  [
                    "action_required",
                    "waiting",
                    "queued",
                    "pending",
                  ].includes(status)
                ) {
                  pendingRuns.push(run.id);
                }
              }

              // Track rerun attempts to avoid duplicate status messages
              const statusModifiers: string[] = [];

              for (const runId of pendingRuns) {
                debugLog(
                  `Attempting to rerun failed jobs for run ${runId} on ${pr.html_url}`
                );

                let rerunSuccessful = false;
                let lastError: Error | null = null;

                // First try: rerun only failed jobs
                try {
                  await this.rerunFailedJobs(owner, repo, runId);
                  rerunSuccessful = true;
                  if (
                    !statusModifiers.includes("failed jobs rerun triggered")
                  ) {
                    statusModifiers.push("failed jobs rerun triggered");
                  }
                  options.onLog?.(
                    `🔄 Auto-approve triggered for ${pr.title}: Rerunning failed jobs in workflow run ${runId}`,
                    "info"
                  );
                } catch (rerunError) {
                  lastError =
                    rerunError instanceof Error
                      ? rerunError
                      : new Error(String(rerunError));
                  debugLog(
                    `Failed to rerun failed jobs for run ${runId}, trying full workflow rerun`,
                    {
                      error: lastError.message,
                    }
                  );

                  // Fallback: try rerunning the entire workflow
                  try {
                    await this.rerunWorkflowRun(owner, repo, runId);
                    rerunSuccessful = true;
                    if (
                      !statusModifiers.includes(
                        "full workflow rerun triggered"
                      )
                    ) {
                      statusModifiers.push("full workflow rerun triggered");
                    }
                    options.onLog?.(
                      `🔄 Auto-approve triggered for ${pr.title}: Rerunning entire workflow run ${runId} (fallback)`,
                      "info"
                    );
                  } catch (fullRerunError) {
                    lastError =
                      fullRerunError instanceof Error
                        ? fullRerunError
                        : new Error(String(fullRerunError));
                    debugLog(
                      `Failed to rerun entire workflow for run ${runId}`,
                      {
                        error: lastError.message,
                      }
                    );

                    // Handle specific "cannot be rerun" error (Issue #3)
                    if (
                      lastError.message.includes("cannot be rerun") ||
                      lastError.message.includes(
                        "workflow file may be broken"
                      ) ||
                      lastError.message.includes("lack the required") ||
                      lastError.message.includes("workflow scope")
                    ) {
                      options.onLog?.(
                        `⚠️ Auto-approve skipped for ${pr.title}: Workflow cannot be rerun - ${lastError.message}`,
                        "warning"
                      );
                    }
                  }
                }

                // If both approaches failed, log the error
                if (!rerunSuccessful && lastError) {
                  options.onLog?.(
                    `❌ Auto-approve rerun failed for ${pr.title}: ${lastError.message}`,
                    "error"
                  );
                }
              }

              // Apply status modifiers
              if (statusModifiers.length > 0) {
                statusMsg += ` (${statusModifiers.join(", ")})`;
              }
            } else if (options.autoApprove && autoFixPostedComment) {
              options.onLog?.(
                `⏳ Auto-approve: Skipping workflow rerun for ${pr.title} - waiting for Copilot to fix issues first`,
                "info"
              );
            }
          } catch (autoError) {
            debugLog(`Auto-fix/auto-approve error for ${pr.html_url}`, {
              error:
                autoError instanceof Error ? autoError.message : autoError,
            });
          }
        } // End of pause check else block
      }
    } else {
      // copilot_work_finished_failure
      const payload = lastEvent.raw_payload || {};
      const message = payload.message || lastEvent.message || "";
      statusMsg = message ? `Failed: ${message}` : "Failed";
      status = "Error";
      color = "red";
      emoji = "❌";
      state = "failed";
      eventWord = "Failed";

      // Extract wait time from failure message
      const waitMatch = message.match(/in (\d+) minute/);
      if (waitMatch) {
        waitMinutes = parseInt(waitMatch[1], 10);
      }

      if (
        options.resumeOnFailure &&
        timestamp &&
        waitMinutes !== undefined
      ) {
        // Check if automation is paused
        const prIdentifier = pr.html_url;
        if (pauseManager.shouldPauseAutomation(prIdentifier)) {
          if (pauseManager.isGloballyPaused()) {
            options.onLog?.(
              `⏸️ Resume on failure skipped for ${pr.title}: Automation globally paused`,
              "warning"
            );
          } else {
            options.onLog?.(
              `⏸️ Resume on failure skipped for ${pr.title}: Automation paused for this PR`,
              "warning"
            );
          }
        } else {
          const resumeTime = new Date(
            timestamp.getTime() + waitMinutes * 60 * 1000
          );
          const now = new Date();

          if (now < resumeTime) {
            const remaining = resumeTime.getTime() - now.getTime();
            statusMsg += ` (resume in ${humanizeRemaining(remaining)})`;
            options.onLog?.(
              `⏳ Resume on failure scheduled for ${
                pr.title
              }: Will retry in ${humanizeRemaining(remaining)}`,
              "info"
            );
          } else if (
            options.username &&
            !(await this.hasNudgeComment(
              owner,
              repo,
              number,
              timestamp,
              options.username
            ))
          ) {
            debugLog(`Posting resume comment on ${pr.html_url}`);
            try {
              await this.postIssueComment(owner, repo, number, NUDGE_TEXT);
              statusMsg += " (nudge sent)";
              options.onLog?.(
                `🔔 Resume on failure triggered for ${pr.title}: Sent nudge to resume work`,
                "success"
              );
            } catch (nudgeError) {
              debugLog(`Failed to post nudge comment`, {
                error:
                  nudgeError instanceof Error
                    ? nudgeError.message
                    : nudgeError,
              });
              options.onLog?.(
                `❌ Resume on failure failed for ${pr.title}: ${
                  nudgeError instanceof Error
                    ? nudgeError.message
                    : "Unknown error"
                }`,
                "error"
              );
            }
          } else if (!statusMsg.includes("(resume requested)")) {
            statusMsg += " (resume requested)";
            options.onLog?.(
              `ℹ️ Resume on failure skipped for ${pr.title}: Resume already requested`,
              "info"
            );
          }
        }
      }
    }

    const timeDesc = timestamp
      ? `${eventWord} ${humanizeAge(timestamp)}`
      : lastEvent.created_at;

    return {
      pr,
      timestamp: timestamp || undefined,
      status,
      color,
      emoji,
      time: timeDesc,
      state,
      event_word: eventWord,
      status_msg: statusMsg,
      wait_minutes: waitMinutes,
    };
  }
  async getUsername(): Promise<string> {
    try {
      const response = await this.client.get("/user");
      return response.data.login || "";
    } catch (error) {
      debugLog("Failed to get username", {
        error: error instanceof Error ? error.message : error,
      });
      return "";
    }
  }

  async *iterIssueEvents(
    owner: string,
    repo: string,
    number: number
  ): AsyncGenerator<CopilotEvent, void, unknown> {
    let page = 1;
    while (true) {
      try {
        const response = await this.client.get(
          `/repos/${owner}/${repo}/issues/${number}/events`,
          {
            params: {
              page,
              per_page: 100,
            },
          }
        );

        const events = response.data;
        if (!events || events.length === 0) {
          break;
        }

        debugLog(
          `Fetched ${events.length} events from ${owner}/${repo}#${number} page ${page}`
        );

        for (const event of events) {
          yield event;
        }

        // Add small delay to prevent tight loops and reduce CPU usage
        await new Promise((resolve) => setTimeout(resolve, 100));
        page++;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          debugLog("Issue events endpoint not found");
          return;
        }
        throw error;
      }
    }
  }

  async *iterIssueComments(
    owner: string,
    repo: string,
    number: number
  ): AsyncGenerator<IssueComment, void, unknown> {
    let page = 1;
    while (true) {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/issues/${number}/comments`,
        {
          params: {
            page,
            per_page: 100,
          },
        }
      );

      const comments = response.data;
      if (!comments || comments.length === 0) {
        break;
      }

      debugLog(
        `Fetched ${comments.length} comments from ${owner}/${repo}#${number} page ${page}`
      );

      for (const comment of comments) {
        yield comment;
      }

      // Add small delay to prevent tight loops and reduce CPU usage
      await new Promise((resolve) => setTimeout(resolve, 100));
      page++;
    }
  }

  async postIssueComment(
    owner: string,
    repo: string,
    number: number,
    body: string
  ): Promise<void> {
    try {
      debugLog(`Attempting to post comment on ${owner}/${repo}#${number}`, {
        bodyLength: body.length,
        bodyPreview: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
      });

      await this.client.post(
        `/repos/${owner}/${repo}/issues/${number}/comments`,
        { body }
      );
      debugLog(`Successfully posted comment on ${owner}/${repo}#${number}`);
    } catch (error) {
      debugLog(`Failed to post comment on ${owner}/${repo}#${number}`, {
        error: error instanceof Error ? error.message : error,
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
        statusText: axios.isAxiosError(error)
          ? error.response?.statusText
          : undefined,
        data: axios.isAxiosError(error) ? error.response?.data : undefined,
        headers: axios.isAxiosError(error)
          ? error.response?.headers
          : undefined,
      });
      throw error;
    }
  }

  async fetchPullRequest(
    owner: string,
    repo: string,
    number: number
  ): Promise<PullRequest> {
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/pulls/${number}`
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch PR ${owner}/${repo}#${number}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async *iterCheckRuns(
    owner: string,
    repo: string,
    sha: string
  ): AsyncGenerator<CheckRun, void, unknown> {
    let page = 1;
    while (true) {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/commits/${sha}/check-runs`,
        {
          params: {
            per_page: 100,
            page,
          },
        }
      );

      const runs = response.data.check_runs || [];
      if (runs.length === 0) {
        break;
      }

      for (const run of runs) {
        yield run;
      }

      // Check if there are more pages
      if (
        !response.headers.link ||
        !response.headers.link.includes('rel="next"')
      ) {
        break;
      }
      
      // Add small delay to prevent tight loops and reduce CPU usage
      await new Promise((resolve) => setTimeout(resolve, 100));
      page++;
    }
  }

  async *iterCommitStatuses(
    owner: string,
    repo: string,
    sha: string
  ): AsyncGenerator<CommitStatus, void, unknown> {
    let page = 1;
    while (true) {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/commits/${sha}/statuses`,
        {
          params: {
            per_page: 100,
            page,
          },
        }
      );

      const statuses = response.data;
      if (!statuses || statuses.length === 0) {
        break;
      }

      for (const status of statuses) {
        yield status;
      }

      // Check if there are more pages
      if (
        !response.headers.link ||
        !response.headers.link.includes('rel="next"')
      ) {
        break;
      }
      
      // Add small delay to prevent tight loops and reduce CPU usage
      await new Promise((resolve) => setTimeout(resolve, 100));
      page++;
    }
  }

  async *iterWorkflowRunsByBranch(
    owner: string,
    repo: string,
    branch: string
  ): AsyncGenerator<WorkflowRun, void, unknown> {
    let page = 1;
    while (true) {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/actions/runs`,
        {
          params: {
            per_page: 30, // Reduced to limit API calls
            page,
            branch: branch,
          },
        }
      );

      const runs = response.data.workflow_runs || [];
      if (runs.length === 0) {
        break;
      }

      debugLog(
        `Workflow runs page ${page} for ${owner}/${repo} branch ${branch} returned ${runs.length} runs`
      );

      for (const run of runs) {
        yield run;
      }

      // Check if there are more pages - but limit to first page for performance
      if (page >= 1) {
        break;
      }

      if (
        !response.headers.link ||
        !response.headers.link.includes('rel="next"')
      ) {
        break;
      }
      
      // Add small delay to prevent tight loops and reduce CPU usage
      await new Promise((resolve) => setTimeout(resolve, 100));
      page++;
    }
  }

  async *iterRecentWorkflowRuns(
    owner: string,
    repo: string
  ): AsyncGenerator<WorkflowRun, void, unknown> {
    let page = 1;
    while (true) {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/actions/runs`,
        {
          params: {
            per_page: 30, // Reduced to limit API calls
            page,
            // No head_sha filter - get all recent workflow runs
          },
        }
      );

      const runs = response.data.workflow_runs || [];
      if (runs.length === 0) {
        break;
      }

      debugLog(
        `Recent workflow runs page ${page} for ${owner}/${repo} returned ${runs.length} runs`
      );

      for (const run of runs) {
        yield run;
      }

      // Only fetch first page to avoid performance issues
      if (page >= 1) {
        break;
      }

      // Check if there are more pages
      if (
        !response.headers.link ||
        !response.headers.link.includes('rel="next"')
      ) {
        break;
      }
      
      // Add small delay to prevent tight loops and reduce CPU usage
      await new Promise((resolve) => setTimeout(resolve, 100));
      page++;
    }
  }

  async *iterWorkflowRuns(
    owner: string,
    repo: string,
    sha: string
  ): AsyncGenerator<WorkflowRun, void, unknown> {
    let page = 1;
    while (true) {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/actions/runs`,
        {
          params: {
            per_page: 100,
            page,
            head_sha: sha,
          },
        }
      );

      const runs = response.data.workflow_runs || [];
      if (runs.length === 0) {
        break;
      }

      debugLog(
        `Workflow runs page ${page} for ${owner}/${repo} returned ${runs.length} runs`
      );

      for (const run of runs) {
        yield run;
      }

      // Check if there are more pages
      if (
        !response.headers.link ||
        !response.headers.link.includes('rel="next"')
      ) {
        break;
      }
      
      // Add small delay to prevent tight loops and reduce CPU usage
      await new Promise((resolve) => setTimeout(resolve, 100));
      page++;
    }
  }

  async rerunFailedJobs(
    owner: string,
    repo: string,
    runId: number,
    debug = false
  ): Promise<void> {
    try {
      // First, get the workflow run details to check if it's eligible for rerun
      const workflowRun = await this.getWorkflowRun(owner, repo, runId);

      // Check if the run is too old (similar to Go implementation)
      const createdAt = new Date(workflowRun.created_at);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      if (createdAt < monthAgo) {
        throw new Error(
          `Run ${runId} cannot be rerun; it was created over a month ago`
        );
      }

      // Prepare request body similar to Go implementation
      const requestBody = debug ? { enable_debug_logging: debug } : {};

      debugLog(
        `Attempting to rerun failed jobs for run ${runId} in ${owner}/${repo}`,
        {
          debug,
          requestBody,
          workflowStatus: workflowRun.status,
          workflowConclusion: workflowRun.conclusion,
        }
      );

      await this.client.post(
        `/repos/${owner}/${repo}/actions/runs/${runId}/rerun-failed-jobs`,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      debugLog(
        `Successfully triggered rerun of failed jobs for run ${runId} in ${owner}/${repo}`
      );
    } catch (error) {
      const axiosError = error as AxiosError;

      debugLog(`Failed to rerun jobs for run ${runId}`, {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        error: error instanceof Error ? error.message : error,
      });

      // Handle specific error cases based on Go implementation
      if (axiosError.response?.status === 403) {
        const errorData = axiosError.response.data as any;
        const errorMessage = errorData?.message;

        if (
          errorMessage ===
          "Unable to retry this workflow run because it was created over a month ago"
        ) {
          throw new Error(`Run ${runId} cannot be rerun; ${errorMessage}`);
        }

        // Default 403 error handling
        throw new Error(
          `Run ${runId} cannot be rerun; its workflow file may be broken or you lack the required 'workflow' scope`
        );
      }

      // Re-throw with more context
      throw new Error(
        `Failed to rerun failed jobs for run ${runId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async rerunWorkflowRun(
    owner: string,
    repo: string,
    runId: number,
    debug = false
  ): Promise<void> {
    try {
      // First, get the workflow run details to check if it's eligible for rerun
      const workflowRun = await this.getWorkflowRun(owner, repo, runId);

      // Check if the run is too old (similar to Go implementation)
      const createdAt = new Date(workflowRun.created_at);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      if (createdAt < monthAgo) {
        throw new Error(
          `Run ${runId} cannot be rerun; it was created over a month ago`
        );
      }

      // Prepare request body similar to Go implementation
      const requestBody = debug ? { enable_debug_logging: debug } : {};

      debugLog(
        `Attempting to rerun entire workflow run ${runId} in ${owner}/${repo}`,
        {
          debug,
          requestBody,
          workflowStatus: workflowRun.status,
          workflowConclusion: workflowRun.conclusion,
        }
      );

      await this.client.post(
        `/repos/${owner}/${repo}/actions/runs/${runId}/rerun`,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      debugLog(
        `Successfully triggered rerun of workflow run ${runId} in ${owner}/${repo}`
      );
    } catch (error) {
      const axiosError = error as AxiosError;

      debugLog(`Failed to rerun workflow run ${runId}`, {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        error: error instanceof Error ? error.message : error,
      });

      // Handle specific error cases based on Go implementation
      if (axiosError.response?.status === 403) {
        const errorData = axiosError.response.data as any;
        const errorMessage = errorData?.message;

        if (
          errorMessage ===
          "Unable to retry this workflow run because it was created over a month ago"
        ) {
          throw new Error(`Run ${runId} cannot be rerun; ${errorMessage}`);
        }

        // Default 403 error handling
        throw new Error(
          `Run ${runId} cannot be rerun; its workflow file may be broken or you lack the required 'workflow' scope`
        );
      }

      // Re-throw with more context
      throw new Error(
        `Failed to rerun workflow run ${runId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getWorkflowRun(
    owner: string,
    repo: string,
    runId: number
  ): Promise<WorkflowRun> {
    try {
      debugLog(`Getting workflow run details for ${runId} in ${owner}/${repo}`);

      const response = await this.client.get<WorkflowRun>(
        `/repos/${owner}/${repo}/actions/runs/${runId}`
      );

      debugLog(`Retrieved workflow run ${runId}`, {
        status: response.data.status,
        conclusion: response.data.conclusion,
        created_at: response.data.created_at,
        updated_at: response.data.updated_at,
      });

      return response.data;
    } catch (error) {
      debugLog(`Failed to get workflow run ${runId}`, {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  async hasFixComment(
    owner: string,
    repo: string,
    number: number,
    since: Date,
    username: string,
    body: string
  ): Promise<boolean> {
    try {
      for await (const comment of this.iterIssueComments(owner, repo, number)) {
        const commentBody = (comment.body || "").trim();
        if (commentBody !== body) {
          continue;
        }
        if (comment.user?.login !== username) {
          continue;
        }
        const timestamp = parseTimestamp(comment.created_at);
        if (timestamp && timestamp >= since) {
          return true;
        }
      }
      return false;
    } catch (error) {
      debugLog(
        `Failed to check for fix comment in ${owner}/${repo}#${number}`,
        {
          error: error instanceof Error ? error.message : error,
        }
      );
      return false;
    }
  }

  private async hasNudgeComment(
    owner: string,
    repo: string,
    number: number,
    since: Date,
    username: string
  ): Promise<boolean> {
    try {
      for await (const comment of this.iterIssueComments(owner, repo, number)) {
        const commentBody = (comment.body || "").trim();
        if (commentBody !== NUDGE_TEXT) {
          continue;
        }
        if (comment.user?.login !== username) {
          continue;
        }
        const timestamp = parseTimestamp(comment.created_at);
        if (timestamp && timestamp >= since) {
          return true;
        }
      }
      return false;
    } catch (error) {
      debugLog(
        `Failed to check for nudge comment in ${owner}/${repo}#${number}`,
        {
          error: error instanceof Error ? error.message : error,
        }
      );
      return false;
    }
  }

  // Validate that the current token has sufficient scopes for workflow operations
  async validateWorkflowPermissions(): Promise<{
    valid: boolean;
    message?: string;
  }> {
    try {
      const tokenInfo = await this.verifyToken();
      if (!tokenInfo.valid) {
        return { valid: false, message: "Invalid GitHub token" };
      }

      const missingScopes = this.checkMissingScopes(tokenInfo.scopes);
      if (missingScopes.length > 0) {
        return {
          valid: false,
          message: `Missing required scopes: ${missingScopes.join(
            ", "
          )}. Please re-authenticate.`,
        };
      }

      const hasWorkflowScope = this.hasWorkflowScopes(tokenInfo.scopes);
      if (!hasWorkflowScope) {
        return {
          valid: false,
          message:
            "Missing 'workflow' scope required for rerunning workflows. Please re-authenticate.",
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        message: `Failed to validate token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // Get workflow run jobs
  async getWorkflowJobs(owner: string, repo: string, runId: number): Promise<any[]> {
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`
      );
      return response.data.jobs || [];
    } catch (error) {
      debugLog(`Error fetching jobs for workflow run ${runId}`, {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }

  // Collect failure logs for specific workflow runs using advanced error extraction
  async collectFailureLogs(owner: string, repo: string, failedRunIds: number[]): Promise<string> {
    return await collectFailureLogsAdvanced(this.client, owner, repo, failedRunIds);
  }

  // Expose the client for advanced use cases
  getClient() {
    return this.client;
  }
}
