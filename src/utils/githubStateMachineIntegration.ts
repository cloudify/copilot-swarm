// Example of how to refactor the current GitHub API to use the state machine

import { PrStateMachineManagerFactory } from "./stateMachineManager";

export class GitHubAPIWithStateMachine {
  private stateMachineFactory: PrStateMachineManagerFactory;

  constructor(private originalGitHubAPI: any) {
    this.stateMachineFactory = new PrStateMachineManagerFactory(
      originalGitHubAPI
    );
  }

  // This would replace the complex getCopilotStatus logic
  async getCopilotStatusWithStateMachine(
    pr: any,
    timestamp: Date | null,
    options: {
      autoFix?: boolean;
      autoApprove?: boolean;
      username?: string;
      maxSessions?: number;
      onLog?: (
        message: string,
        type: "info" | "success" | "error" | "warning"
      ) => void;
    }
  ): Promise<{
    status: string;
    message: string;
    emoji: string;
    color: string;
    state: string;
  }> {
    const { owner, repo, number } = this.extractPrInfo(pr);

    if (!timestamp) {
      return {
        status: "No Copilot Activity",
        message: "No Copilot activity detected",
        emoji: "⚪",
        color: "gray",
        state: "idle",
      };
    }

    // Get the last Copilot event
    const lastEvent = await this.originalGitHubAPI.getLastCopilotEvent(
      owner,
      repo,
      number
    );
    if (!lastEvent) {
      return {
        status: "No Copilot Activity",
        message: "No Copilot activity detected",
        emoji: "⚪",
        color: "gray",
        state: "idle",
      };
    }

    // Handle the event through the state machine
    const result = await this.stateMachineFactory.handleCopilotEvent(
      owner,
      repo,
      number,
      lastEvent.event,
      new Date(lastEvent.created_at),
      options
    );

    return result;
  }

  private extractPrInfo(pr: any): {
    owner: string;
    repo: string;
    number: number;
  } {
    return {
      owner: pr.base?.repo?.owner?.login || pr.repository?.owner?.login || "",
      repo: pr.base?.repo?.name || pr.repository?.name || "",
      number: pr.number,
    };
  }

  // Cleanup when PR is closed/merged
  async cleanupPrStateMachine(pr: any): Promise<void> {
    const { owner, repo, number } = this.extractPrInfo(pr);
    this.stateMachineFactory.cleanup(owner, repo, number);
  }

  // Get debug info about active state machines
  getActiveStateMachines(): string[] {
    return this.stateMachineFactory.getActiveManagers();
  }

  // Method to check CI status for all active state machines
  async checkAllCIStatus(options: {
    autoFix?: boolean;
    autoApprove?: boolean;
    username?: string;
    maxSessions?: number;
    onLog?: (
      message: string,
      type: "info" | "success" | "error" | "warning"
    ) => void;
  }): Promise<void> {
    const activeManagers = this.stateMachineFactory.getActiveManagers();

    for (const prKey of activeManagers) {
      // Parse prKey format: "owner/repo#number"
      const match = prKey.match(/^(.+)\/(.+)#(\d+)$/);
      if (!match) {continue;}

      const [, owner, repo, numberStr] = match;
      const number = parseInt(numberStr, 10);

      try {
        await this.stateMachineFactory.checkCIStatus(
          owner,
          repo,
          number,
          options
        );
      } catch (error) {
        options.onLog?.(
          `Error checking CI status for ${prKey}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          "error"
        );
      }
    }
  }
}

/*
// Example usage in the main collection logic:
export async function collectPRStatusesWithStateMachine(
  organizations: string[],
  days: number,
  options: {
    autoFix?: boolean;
    autoApprove?: boolean;
    username?: string;
    onLog?: (
      message: string,
      type: "info" | "success" | "error" | "warning"
    ) => void;
  }
): Promise<any[]> {
  const gitHubAPI = new GitHubAPIWithStateMachine(originalAPI);

  // ... existing PR collection logic ...

  const results = [];

  for (const pr of pullRequests) {
    const copilotTimestamp =
      await gitHubAPI.originalGitHubAPI.getFirstCopilotEvent(
        pr.base?.repo?.owner?.login,
        pr.base?.repo?.name,
        pr.number
      );

    // Use the state machine to get status
    const copilotStatus = await gitHubAPI.getCopilotStatusWithStateMachine(
      pr,
      copilotTimestamp,
      options
    );

    results.push({
      ...pr,
      copilotStatus: copilotStatus.status,
      statusMessage: copilotStatus.message,
      statusEmoji: copilotStatus.emoji,
      statusColor: copilotStatus.color,
      state: copilotStatus.state,
    });
  }

  return results;
}
*/
