import type {
  StateContext,
  StateMachineConfig,
  CopilotEvent} from "./stateMachine";
import {
  CopilotStateMachine
} from "./stateMachine";
import type { GitHubAPI } from "./github";
import { collectFailedWorkflowChecks, isWorkflowRunPending } from "./workflowHelpers.js";

export interface PrStateMachineManager {
  prKey: string;
  stateMachine: CopilotStateMachine;
  gitHubAPI: GitHubAPI;
  owner: string;
  repo: string;
  number: number;
}

export class PrStateMachineManagerFactory {
  private managers = new Map<string, PrStateMachineManager>();
  private gitHubAPI: GitHubAPI;

  constructor(gitHubAPI: GitHubAPI) {
    this.gitHubAPI = gitHubAPI;
  }

  getOrCreateManager(
    owner: string,
    repo: string,
    number: number,
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
  ): PrStateMachineManager {
    const prKey = `${owner}/${repo}#${number}`;

    if (!this.managers.has(prKey)) {
      const context: StateContext = {
        hasFailedChecks: false,
        autoFixEnabled: options.autoFix || false,
        autoApproveEnabled: options.autoApprove || false,
        username: options.username,
        pendingWorkflowRuns: [],
        runningWorkflowRuns: [],
        sessionCount: 0,
        maxSessions: options.maxSessions || 50,
        totalSessionTimeMs: 0,
      };

      const config: StateMachineConfig = {
        onLog: options.onLog,
        onStatusChange: (state, message, emoji) => {
          options.onLog?.(`[${prKey}] ${emoji} ${message}`, "info");
        },
        onAutoFixRequested: async (ctx) => {
          await this.handleAutoFixRequest(owner, repo, number, ctx, options);
        },
        onWorkflowRerun: async (ctx) => {
          await this.handleWorkflowRerun(owner, repo, number, ctx, options);
        },
      };

      const stateMachine = new CopilotStateMachine(context, config);

      this.managers.set(prKey, {
        prKey,
        stateMachine,
        gitHubAPI: this.gitHubAPI,
        owner,
        repo,
        number,
      });
    }

    return this.managers.get(prKey)!;
  }

  async handleCopilotEvent(
    owner: string,
    repo: string,
    number: number,
    eventType: string,
    timestamp: Date,
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
    const manager = this.getOrCreateManager(owner, repo, number, options);

    // Map GitHub events to state machine events
    let smEvent: CopilotEvent;
    switch (eventType) {
      case "copilot_work_started":
        smEvent = "COPILOT_WORK_STARTED";
        break;
      case "copilot_work_finished":
        smEvent = "COPILOT_WORK_FINISHED";
        break;
      case "copilot_work_finished_failure":
        smEvent = "COPILOT_WORK_FAILED";
        break;
      case "ci_started":
        smEvent = "CI_STARTED";
        break;
      case "ci_completed":
        smEvent = "CI_COMPLETED";
        break;
      default:
        throw new Error(`Unknown event type: ${eventType}`);
    }

    // Update context with latest timestamp
    manager.stateMachine.updateContext({
      lastEventTimestamp: timestamp,
      autoFixEnabled: options.autoFix || false,
      autoApproveEnabled: options.autoApprove || false,
      username: options.username,
      maxSessions: options.maxSessions || 50,
    });

    // Process the event
    await manager.stateMachine.transition(smEvent);

    // If we just finished Copilot work, analyze what to do next
    if (smEvent === "COPILOT_WORK_FINISHED") {
      await this.analyzePostWorkflowAction(manager, options);
    }

    // Return the current state info
    const stateInfo = manager.stateMachine.getStateInfo();
    return {
      ...stateInfo,
      state: this.mapStateToLegacyState(manager.stateMachine.getCurrentState()),
    };
  }

  private async analyzePostWorkflowAction(
    manager: PrStateMachineManager,
    options: any
  ): Promise<void> {
    const { owner, repo, number, stateMachine } = manager;
    const context = stateMachine.getContext();

    if (!context.lastEventTimestamp) {return;}

    // Check for failed checks
    const hasFailedChecks = await this.checkForFailedChecks(
      owner,
      repo,
      number,
      context.lastEventTimestamp,
      options
    );

    // Update context with failed checks info
    stateMachine.updateContext({ hasFailedChecks });

    // Trigger appropriate next event
    if (hasFailedChecks) {
      await stateMachine.transition("FAILED_CHECKS_DETECTED");
    } else {
      await stateMachine.transition("NO_FAILED_CHECKS");
    }

    // If we're ready for rerun, trigger it
    if (stateMachine.shouldTriggerAutoApprove()) {
      await stateMachine.transition("WORKFLOW_RERUN_TRIGGERED");
    }
  }

  private async checkForFailedChecks(
    owner: string,
    repo: string,
    number: number,
    timestamp: Date,
    options: any
  ): Promise<boolean> {
    const prData = await this.gitHubAPI.fetchPullRequest(owner, repo, number);
    const sha = prData.head?.sha;
    if (!sha) {return false;}

    // Use common workflow checking logic
    const { failedChecks, failedWorkflowRuns } = await collectFailedWorkflowChecks({
      owner,
      repo,
      sha,
      timestampThreshold: timestamp,
      parseTimestamp: this.parseTimestamp.bind(this),
      gitHubAPI: this.gitHubAPI
    });

    // Check for failed commit statuses (only if there are failed workflow runs)
    if (failedWorkflowRuns.size > 0) {
      for await (const status of this.gitHubAPI.iterCommitStatuses(
        owner,
        repo,
        sha
      )) {
        const state = (status.state || "").toLowerCase();
        if (["failure", "error"].includes(state)) {
          const updated = this.parseTimestamp(status.updated_at || "");
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

    options.onLog?.(
      `Found ${filteredChecks.length} failed checks from ${
        failedWorkflowRuns.size
      } failed workflow runs after filtering: ${filteredChecks.join(", ")}`,
      filteredChecks.length > 0 ? "warning" : "success"
    );

    return filteredChecks.length > 0;
  }

  private async handleAutoFixRequest(
    owner: string,
    repo: string,
    number: number,
    context: StateContext,
    options: any
  ): Promise<void> {
    const prData = await this.gitHubAPI.fetchPullRequest(owner, repo, number);
    const sha = prData.head?.sha;
    if (!sha || !context.lastEventTimestamp) {return;}

    // Use common workflow checking logic
    const { failedChecks, failedWorkflowRuns } = await collectFailedWorkflowChecks({
      owner,
      repo,
      sha,
      timestampThreshold: context.lastEventTimestamp,
      parseTimestamp: this.parseTimestamp.bind(this),
      gitHubAPI: this.gitHubAPI
    });

    // Check for failed commit statuses (only if there are failed workflow runs)
    if (failedWorkflowRuns.size > 0) {
      for await (const status of this.gitHubAPI.iterCommitStatuses(
        owner,
        repo,
        sha
      )) {
        const state = (status.state || "").toLowerCase();
        if (["failure", "error"].includes(state)) {
          const updated = this.parseTimestamp(status.updated_at || "");
          if (updated && updated > context.lastEventTimestamp!) {
            failedChecks.push(status.context || "");
          }
        }
      }
    }

    const ignoreJobs = options.ignoreJobs || ["danger"];
    const filteredChecks = failedChecks.filter(
      (check) => !ignoreJobs.some((ignored: string) => 
        check.toLowerCase().includes(ignored.toLowerCase())
      )
    );

    if (filteredChecks.length > 0) {
      const category = this.classifyChecks(filteredChecks);
      const checksList = filteredChecks.sort().join(", ");
      const baseText = this.getFixMessage(category);
      const fixText = `${baseText}: ${checksList}`;

      await this.gitHubAPI.postIssueComment(owner, repo, number, fixText);
      options.onLog?.(
        `🔧 Auto-fix: Successfully requested fixes: ${checksList}`,
        "success"
      );
    }
  }

  private async handleWorkflowRerun(
    owner: string,
    repo: string,
    number: number,
    context: StateContext,
    options: any
  ): Promise<void> {
    const prData = await this.gitHubAPI.fetchPullRequest(owner, repo, number);
    const sha = prData.head?.sha;
    if (!sha) {return;}

    const pendingRuns: number[] = [];

    for await (const run of this.gitHubAPI.iterWorkflowRuns(owner, repo, sha)) {
      if (isWorkflowRunPending(run)) {
        pendingRuns.push(run.id);
      }
    }

    const rerunRuns: number[] = [];
    for (const runId of pendingRuns) {
      try {
        await this.gitHubAPI.rerunFailedJobs(owner, repo, runId);
        rerunRuns.push(runId);
        options.onLog?.(
          `🔄 Auto-approve: Rerunning workflow run ${runId}`,
          "success"
        );
      } catch (error) {
        options.onLog?.(
          `❌ Failed to rerun workflow ${runId}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          "error"
        );
      }
    }

    // Update context with running workflows
    const manager = this.getOrCreateManager(owner, repo, number, options);
    manager.stateMachine.updateContext({
      runningWorkflowRuns: rerunRuns,
    });
  }

  // Method to check for individual job failures during CI runs and trigger auto-fix
  async checkJobFailures(
    owner: string,
    repo: string,
    number: number,
    options: {
      autoFix?: boolean;
      username?: string;
      onLog?: (
        message: string,
        type: "info" | "success" | "error" | "warning"
      ) => void;
    }
  ): Promise<void> {
    if (!options.autoFix || !options.username) {
      return; // Auto-fix not enabled or no username
    }

    const manager = this.getOrCreateManager(owner, repo, number, options);
    const currentState = manager.stateMachine.getCurrentState();
    const context = manager.stateMachine.getContext();

    // Only check job failures during CI runs
    if (currentState !== "CI_RUNNING") {
      return;
    }

    const prData = await this.gitHubAPI.fetchPullRequest(owner, repo, number);
    const sha = prData.head?.sha;
    if (!sha) {return;}

    try {
      // Get all running workflow runs
      const runningWorkflowIds = context.runningWorkflowRuns || [];
      
      for (const runId of runningWorkflowIds) {
        // Get jobs for this workflow run
        try {
          const jobs = await this.gitHubAPI.getWorkflowJobs(owner, repo, runId);
          
          const failedJobs = jobs.filter(
            (job: any) => job.conclusion === "failure" || job.conclusion === "error"
          );

          if (failedJobs.length > 0) {
            options.onLog?.(
              `🚨 Detected ${failedJobs.length} failed job(s) in running CI workflow ${runId}`,
              "warning"
            );

            // Check if we haven't already posted a fix comment for this specific set of failures
            const failedJobNames = failedJobs.map((job: any) => job.name);
            const timestamp = context.lastEventTimestamp || new Date();

            // Create a fix comment for the failed jobs
            const baseText = "@copilot fix these CI failures";
            const checksList = failedJobNames.length > 0 
              ? `\n\nFailed jobs:\n${failedJobNames.map((name: string) => `- ${name}`).join('\n')}`
              : "";

            // Collect failure logs for context
            const sampleLogs = await this.gitHubAPI.collectFailureLogs(owner, repo, [runId]);
            const logsText = sampleLogs.length > 0 ? sampleLogs : "";

            const fixText = `${baseText}${checksList}${logsText}`;

            // Check if we already posted this exact fix comment recently
            const hasRecentComment = await this.gitHubAPI.hasFixComment(
              owner,
              repo,
              number,
              timestamp,
              options.username,
              fixText
            );

            if (!hasRecentComment) {
              options.onLog?.(
                `💬 Auto-fix: Posting immediate fix comment for failed jobs in ${owner}/${repo}#${number}`,
                "info"
              );

              await this.gitHubAPI.postIssueComment(
                owner,
                repo,
                number,
                fixText
              );

              options.onLog?.(
                `🔧 Auto-fix: Posted immediate fix request for ${failedJobs.length} failed job(s)`,
                "success"
              );
            } else {
              options.onLog?.(
                `⏭️ Auto-fix: Skipping duplicate fix comment for ${owner}/${repo}#${number}`,
                "info"
              );
            }
          }
        } catch (jobError) {
          options.onLog?.(
            `⚠️ Error checking jobs for workflow run ${runId}: ${
              jobError instanceof Error ? jobError.message : jobError
            }`,
            "warning"
          );
        }
      }
    } catch (error) {
      options.onLog?.(
        `❌ Error checking job failures for ${owner}/${repo}#${number}: ${
          error instanceof Error ? error.message : error
        }`,
        "error"
      );
    }
  }

  // Method to check CI workflow status and trigger appropriate events
  async checkCIStatus(
    owner: string,
    repo: string,
    number: number,
    options: {
      autoFix?: boolean;
      autoApprove?: boolean;
      username?: string;
      ignoreJobs?: string[];
      onLog?: (
        message: string,
        type: "info" | "success" | "error" | "warning"
      ) => void;
    }
  ): Promise<void> {
    const manager = this.getOrCreateManager(owner, repo, number, options);
    const currentState = manager.stateMachine.getCurrentState();
    const context = manager.stateMachine.getContext();

    // Only check CI status if we're in CI_RUNNING state or if we just triggered reruns
    if (currentState !== "CI_RUNNING" && currentState !== "READY_FOR_RERUN") {
      return;
    }

    const prData = await this.gitHubAPI.fetchPullRequest(owner, repo, number);
    const sha = prData.head?.sha;
    if (!sha) {return;}

    const runningRuns: number[] = [];
    const completedRuns: number[] = [];

    // Check status of all workflow runs
    for await (const run of this.gitHubAPI.iterWorkflowRuns(owner, repo, sha)) {
      const status = (run.status || "").toLowerCase();
      const conclusion = (run.conclusion || "").toLowerCase();

      // If this run was in our tracking list
      if (context.runningWorkflowRuns.includes(run.id)) {
        if (
          status === "in_progress" ||
          status === "queued" ||
          status === "waiting"
        ) {
          runningRuns.push(run.id);
        } else if (conclusion && conclusion !== "none") {
          completedRuns.push(run.id);
        }
      }
      // Also check for any new runs that started after we triggered reruns
      else if (
        (status === "in_progress" ||
          status === "queued" ||
          status === "waiting") &&
        context.lastEventTimestamp
      ) {
        const runStarted = this.parseTimestamp(run.created_at || "");
        if (runStarted && runStarted > context.lastEventTimestamp) {
          runningRuns.push(run.id);
        }
      }
    }

    // Update context with current running workflows
    manager.stateMachine.updateContext({
      runningWorkflowRuns: runningRuns,
    });

    // Check for individual job failures during CI runs and trigger immediate auto-fix
    if (currentState === "CI_RUNNING" && runningRuns.length > 0) {
      await this.checkJobFailures(owner, repo, number, options);
    }

    // Determine if we should transition states
    if (currentState === "READY_FOR_RERUN" && runningRuns.length > 0) {
      // CI has started running
      await manager.stateMachine.transition("CI_STARTED");
      options.onLog?.(
        `🔄 CI workflows started running (${runningRuns.length} workflows)`,
        "info"
      );
    } else if (currentState === "CI_RUNNING" && runningRuns.length === 0) {
      // All CI workflows have completed
      await manager.stateMachine.transition("CI_COMPLETED");
      options.onLog?.(
        `✅ All CI workflows completed (${completedRuns.length} completed)`,
        "success"
      );
    }
  }

  private mapStateToLegacyState(state: string): string {
    switch (state) {
      case "COPILOT_WORKING":
      case "AUTO_FIX_IN_PROGRESS":
        return "working";
      case "WAITING_FOR_FEEDBACK":
      case "AUTO_FIX_REQUESTED":
        return "waiting";
      case "READY_FOR_RERUN":
        return "ready";
      case "CI_RUNNING":
        return "ci_running";
      case "ERROR":
        return "failed";
      case "MAX_SESSIONS_REACHED":
        return "max_sessions_reached";
      default:
        return "idle";
    }
  }

  private parseTimestamp(timestampStr: string): Date | null {
    if (!timestampStr) {return null;}
    const parsed = new Date(timestampStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private classifyChecks(
    checks: string[]
  ): "tests" | "build" | "lint" | "general" {
    const checkNames = checks.map((c) => c.toLowerCase()).join(" ");

    if (checkNames.includes("test") || checkNames.includes("spec")) {
      return "tests";
    } else if (checkNames.includes("build") || checkNames.includes("compile")) {
      return "build";
    } else if (checkNames.includes("lint") || checkNames.includes("format")) {
      return "lint";
    }
    return "general";
  }

  private getFixMessage(category: string): string {
    const messages = {
      tests: "Please fix the failing tests",
      build: "Please fix the build errors",
      lint: "Please fix the linting/formatting issues",
      general: "Please fix the failing checks",
    };
    return messages[category as keyof typeof messages] || messages.general;
  }

  // Cleanup method for completed PRs
  cleanup(owner: string, repo: string, number: number): void {
    const prKey = `${owner}/${repo}#${number}`;
    this.managers.delete(prKey);
  }

  // Get all active managers (for debugging)
  getActiveManagers(): string[] {
    return Array.from(this.managers.keys());
  }
}
