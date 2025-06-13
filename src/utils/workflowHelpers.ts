/**
 * Common workflow checking utilities to avoid code duplication
 */

export interface WorkflowCheckResult {
  failedChecks: string[];
  failedWorkflowRuns: Set<number>;
}

export interface WorkflowCheckOptions {
  owner: string;
  repo: string;
  sha: string;
  timestampThreshold?: Date;
  parseTimestamp: (timestamp: string) => Date | null;
  gitHubAPI: {
    iterWorkflowRuns: (owner: string, repo: string, sha: string) => AsyncIterable<any>;
    iterCheckRuns: (owner: string, repo: string, sha: string) => AsyncIterable<any>;
  };
}

/**
 * Common logic for collecting failed workflow checks
 * This eliminates the duplication found in stateMachineManager.ts
 */
export async function collectFailedWorkflowChecks(
  options: WorkflowCheckOptions
): Promise<WorkflowCheckResult> {
  const { owner, repo, sha, timestampThreshold, parseTimestamp, gitHubAPI } = options;
  
  const failedChecks: string[] = [];
  const failedWorkflowRuns = new Set<number>();

  // First, identify workflow runs that are in a failed state
  for await (const run of gitHubAPI.iterWorkflowRuns(owner, repo, sha)) {
    const status = (run.status || "").toLowerCase();
    const conclusion = (run.conclusion || "").toLowerCase();

    if (
      WORKFLOW_STATUS_PATTERNS.FAILED_CONCLUSIONS.includes(conclusion as any) ||
      WORKFLOW_STATUS_PATTERNS.PENDING_STATUSES.includes(status as any)
    ) {
      failedWorkflowRuns.add(run.id);
    }
  }

  // Only collect failed checks from workflow runs that are actually in a failed state
  for await (const run of gitHubAPI.iterCheckRuns(owner, repo, sha)) {
    const conclusion = (run.conclusion || "").toLowerCase();
    if (
      conclusion &&
      !WORKFLOW_STATUS_PATTERNS.SUCCESS_CONCLUSIONS.includes(conclusion as any)
    ) {
      const completed = parseTimestamp(
        run.completed_at || run.started_at || ""
      );
      
      if (timestampThreshold && completed && completed > timestampThreshold) {
        // Only include failed checks if there are any failed workflow runs
        if (failedWorkflowRuns.size > 0) {
          failedChecks.push(run.name || "Unknown check");
        }
      } else if (!timestampThreshold) {
        // If no timestamp threshold, include all failed checks when workflow runs are failed
        if (failedWorkflowRuns.size > 0) {
          failedChecks.push(run.name || "Unknown check");
        }
      }
    }
  }

  return { failedChecks, failedWorkflowRuns };
}

/**
 * Determines if workflow status indicates a need for fixes
 */
export function shouldTriggerFix(
  failedChecks: string[],
  failedWorkflowRuns: Set<number>
): boolean {
  return failedChecks.length > 0 || failedWorkflowRuns.size > 0;
}

/**
 * Common workflow status checking patterns
 */
export const WORKFLOW_STATUS_PATTERNS = {
  FAILED_CONCLUSIONS: ["action_required", "failure"],
  PENDING_STATUSES: ["action_required", "waiting", "queued", "pending"],
  SUCCESS_CONCLUSIONS: ["success", "neutral", "skipped"],
  RUNNING_STATUSES: ["in_progress", "queued", "waiting", "pending"]
} as const;

/**
 * Check if a workflow run is in a pending/failed state
 */
export function isWorkflowRunPending(run: any): boolean {
  const status = (run.status || "").toLowerCase();
  const conclusion = (run.conclusion || "").toLowerCase();

  return (
    WORKFLOW_STATUS_PATTERNS.FAILED_CONCLUSIONS.includes(conclusion as any) ||
    WORKFLOW_STATUS_PATTERNS.PENDING_STATUSES.includes(status as any)
  );
}