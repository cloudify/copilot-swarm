/**
 * Utility functions for safe text rendering in Ink applications.
 * These functions help prevent empty string rendering errors.
 */

/**
 * Safely concatenates text with optional prefix/suffix.
 * Returns null if the result would be empty.
 */
export function safeConcat(
  text: string | null | undefined,
  prefix: string = "",
  suffix: string = ""
): string | null {
  if (!text || typeof text !== "string" || text.trim() === "") {
    return null;
  }

  const result = `${prefix}${text.trim()}${suffix}`;
  return result.trim() === "" ? null : result;
}

/**
 * Safely truncates text to a maximum length.
 * Returns null if the input is empty.
 */
export function safeTruncate(
  text: string | null | undefined,
  maxLength: number,
  ellipsis: string = "..."
): string | null {
  if (!text || typeof text !== "string" || text.trim() === "") {
    return null;
  }

  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const truncated = trimmed.slice(0, maxLength - ellipsis.length) + ellipsis;
  return truncated.length === ellipsis.length ? null : truncated;
}

/**
 * Safely formats a template string.
 * Returns null if the result would be empty.
 */
export function safeTemplate(
  template: string,
  values: Record<string, string | null | undefined>
): string | null {
  let result = template;

  for (const [key, value] of Object.entries(values)) {
    const safeValue = value && typeof value === "string" ? value.trim() : "";
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), safeValue);
  }

  return result.trim() === "" ? null : result.trim();
}

/**
 * Safely joins an array of strings.
 * Returns null if the result would be empty.
 */
export function safeJoin(
  items: (string | null | undefined)[],
  separator: string = ", "
): string | null {
  const validItems = items
    .filter(
      (item): item is string =>
        item !== null &&
        item !== undefined &&
        typeof item === "string" &&
        item.trim() !== ""
    )
    .map((item) => item.trim());

  if (validItems.length === 0) {
    return null;
  }

  return validItems.join(separator);
}

/**
 * Type guard to check if a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

// Text formatting utilities

/**
 * Convert a timestamp to human-readable relative time
 */
/**
 * Common time unit calculations to avoid duplication
 */
export interface TimeUnits {
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  weeks: number;
  months: number;
}

export function calculateTimeUnits(deltaMs: number): TimeUnits {
  const seconds = Math.floor(deltaMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  
  return { seconds, minutes, hours, days, weeks, months };
}

/**
 * Humanizes time duration from past timestamp
 */
export const humanizeTime = (timestamp: string | Date): string => {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const delta = now.getTime() - date.getTime();

  const { seconds, minutes, hours, days, weeks, months } = calculateTimeUnits(delta);

  if (seconds < 60) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  if (weeks < 4) {
    return `${weeks}w ago`;
  }

  return `${months}mo ago`;
};

/**
 * Humanizes time age (similar to humanizeTime but with different format)
 */
export function humanizeAge(ts: Date): string {
  const delta = Date.now() - ts.getTime();
  const { seconds, minutes, hours, days } = calculateTimeUnits(delta);

  if (seconds < 60) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

/**
 * Humanizes remaining time (for countdown timers)
 */
export function humanizeRemaining(delta: number): string {
  const { seconds, minutes, hours, days } = calculateTimeUnits(delta);

  if (seconds <= 0) {
    return "0m";
  }
  if (minutes < 60) {
    return `${Math.ceil(seconds / 60)}m`;
  }
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  const remainingHours = hours % 24;
  if (remainingHours) {
    return `${days}d ${remainingHours}h`;
  }
  return `${days}d`;
}

/**
 * Get CI status based on workflow runs
 */
export interface CIStatus {
  status: "success" | "failure" | "running" | "pending" | "unknown";
  color: "green" | "red" | "yellow" | "blue" | "gray";
  emoji: string;
  tooltip: string;
  count?: number; // Number of workflows
}

export const getCIStatus = (
  workflowRuns?: any[],
  stateMachineState?: string
): CIStatus => {
  // If we have state machine info, prioritize that
  if (stateMachineState === "ci_running") {
    return {
      status: "running",
      color: "yellow",
      emoji: "⭕", // This won't be used, CSS spinner will be used instead
      tooltip: "CI workflows are running",
      count: workflowRuns?.length || 0,
    };
  }

  if (!workflowRuns || workflowRuns.length === 0) {
    return {
      status: "unknown",
      color: "gray",
      emoji: "⚫",
      tooltip: "No CI workflows found",
      count: 0,
    };
  }

  // Check for any running workflows
  const runningWorkflows = workflowRuns.filter((run) => {
    const status = (run.status || "").toLowerCase();
    return ["in_progress", "queued", "waiting", "pending"].includes(status);
  });

  if (runningWorkflows.length > 0) {
    return {
      status: "running",
      color: "yellow",
      emoji: "⭕", // This won't be used, CSS spinner will be used instead
      tooltip: `${runningWorkflows.length} CI workflow(s) running`,
      count: runningWorkflows.length,
    };
  }

  // Check for any failed workflows
  const failedWorkflows = workflowRuns.filter((run) => {
    const conclusion = (run.conclusion || "").toLowerCase();
    const status = (run.status || "").toLowerCase();
    return (
      ["failure", "action_required"].includes(conclusion) ||
      ["action_required"].includes(status)
    );
  });

  if (failedWorkflows.length > 0) {
    return {
      status: "failure",
      color: "red",
      emoji: "🔴",
      tooltip: `${failedWorkflows.length} CI workflow(s) failed`,
      count: failedWorkflows.length,
    };
  }

  // Check if all completed successfully
  const successfulWorkflows = workflowRuns.filter((run) => {
    const conclusion = (run.conclusion || "").toLowerCase();
    return ["success", "neutral", "skipped"].includes(conclusion);
  });

  if (
    successfulWorkflows.length === workflowRuns.length &&
    workflowRuns.length > 0
  ) {
    return {
      status: "success",
      color: "green",
      emoji: "🟢",
      tooltip: `${successfulWorkflows.length} CI workflow(s) passed`,
      count: successfulWorkflows.length,
    };
  }

  return {
    status: "pending",
    color: "blue",
    emoji: "🔵",
    tooltip: "CI status pending",
    count: workflowRuns.length,
  };
};
