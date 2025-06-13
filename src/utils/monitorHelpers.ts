/**
 * Common utilities for MonitorEngine to avoid code duplication
 */

export interface UsernameCache {
  cachedUsername: string | null;
}

export interface GitHubAPIClient {
  getUsername(): Promise<string>;
}

export interface LogFunction {
  (message: string): void;
}

/**
 * Common username caching logic to avoid duplication in MonitorEngine
 */
export async function getCachedUsername(
  cache: UsernameCache,
  api: GitHubAPIClient,
  log: LogFunction
): Promise<string> {
  if (cache.cachedUsername === null) {
    try {
      const username = await api.getUsername();
      cache.cachedUsername = username;
      if (username) {
        log(`👤 Using username: ${username}`);
      }
      return username;
    } catch {
      log(
        `⚠️ Warning: Could not fetch GitHub username - auto-features requiring comments may not work`
      );
      cache.cachedUsername = "";
      return "";
    }
  } else {
    return cache.cachedUsername;
  }
}

/**
 * Common options creation pattern
 */
export interface MonitorOptions {
  resumeOnFailure: boolean;
  autoFix: boolean;
  autoApprove: boolean;
  maxSessions: number;
  ignoreJobs?: string[];
  onLog?: LogFunction;
}

export function createMonitoringOptions(
  baseOptions: Partial<MonitorOptions>,
  username: string,
  onLog?: LogFunction
): MonitorOptions {
  return {
    resumeOnFailure: baseOptions.resumeOnFailure || false,
    autoFix: baseOptions.autoFix || false,
    autoApprove: baseOptions.autoApprove || false,
    maxSessions: baseOptions.maxSessions || 1,
    ignoreJobs: baseOptions.ignoreJobs || [],
    onLog,
    ...baseOptions,
    // Explicitly include username in returned object for type safety
  } as MonitorOptions & { username: string };
}