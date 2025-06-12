import type { AxiosInstance } from "axios";
import axios from "axios";

const GITHUB_API_BASE = "https://api.github.com";

// Add debug logging helper
const DEBUG =
  process.env.DEBUG === "true" || process.env.NODE_ENV === "development";

export const debugLog = (message: string, data?: any) => {
  if (DEBUG) {
    console.log(
      `[GitHub API Debug] ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  }
};

export interface SearchOptions {
  owners: string[];
  days: number;
  token: string;
}

export interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: any[];
}

export class GitHubSearchAPI {
  private client: AxiosInstance;

  constructor(token: string) {
    this.client = axios.create({
      baseURL: GITHUB_API_BASE,
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    debugLog("Initialized GitHub Search API client", {
      baseURL: GITHUB_API_BASE,
      tokenLength: token.length,
      headers: this.client.defaults.headers,
    });
  }

  /**
   * Build the search query for finding open PRs in organizations
   * If username is provided, search for PRs assigned to that user
   */
  buildSearchQuery(
    owner: string,
    dateFilter: string,
    username?: string
  ): string {
    let query = `is:pr is:open org:${owner} updated:>=${dateFilter}`;
    if (username) {
      query += ` assignee:${username}`;
    }
    return query;
  }

  /**
   * Get the current authenticated user's username
   */
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

  /**
   * Search for all open PRs in given organizations updated since a date
   * If searchForCurrentUser is true, search only for PRs assigned to the current user
   */
  async searchOpenPRs(
    owners: string[],
    days: number = 2,
    searchForCurrentUser: boolean = false
  ): Promise<any[]> {
    try {
      debugLog("Starting searchOpenPRs", {
        owners,
        days,
        searchForCurrentUser,
      });

      const since = new Date();
      since.setDate(since.getDate() - days);
      const dateFilter = since.toISOString().split("T")[0]; // Format: YYYY-MM-DD

      debugLog("Date filter calculated", { dateFilter });

      // Get current username if needed
      let username: string | undefined;
      if (searchForCurrentUser) {
        username = await this.getUsername();
        debugLog("Retrieved username", { username });
        if (!username) {
          debugLog(
            "Could not get username, falling back to organization search"
          );
        }
      }

      const allItems: any[] = [];

      for (const owner of owners) {
        try {
          debugLog(`Processing owner: ${owner}`);

          // Search for open PRs updated since dateFilter, optionally filtered by user
          const query = this.buildSearchQuery(owner, dateFilter, username);
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
        } catch (error: any) {
          debugLog(`Error searching for ${owner}`, {
            error: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
          });
          // Continue with other owners even if one fails
        }
      }

      debugLog(`Total items found before filtering: ${allItems.length}`);
      return allItems;
    } catch (error: any) {
      debugLog("searchOpenPRs error", {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      throw error;
    }
  }

  /**
   * Filter PRs to only those assigned to Copilot
   */
  filterCopilotPRs(items: any[]): any[] {
    const copilotPRs: any[] = [];

    for (const item of items) {
      const assignees = item.assignees?.map((a: any) => a.login) || [];
      debugLog(
        `${item.repository?.full_name || "unknown"}#${
          item.number
        } assignees=${assignees.join(", ")}`
      );

      if (
        assignees.some(
          (assignee: string) => (assignee || "").toLowerCase() === "copilot"
        )
      ) {
        copilotPRs.push(item);
      }
    }

    debugLog(
      `Found ${copilotPRs.length} Copilot-assigned PRs out of ${items.length} total`
    );
    return copilotPRs;
  }

  /**
   * Main function to search for Copilot PRs
   */
  async searchCopilotPRs(owners: string[], days: number = 2): Promise<any[]> {
    try {
      const allItems = await this.searchOpenPRs(owners, days);
      const copilotPRs = this.filterCopilotPRs(allItems);

      debugLog(`Collected ${copilotPRs.length} PR statuses`);
      return copilotPRs;
    } catch (error: any) {
      debugLog("searchCopilotPRs error", {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      throw error;
    }
  }
}
