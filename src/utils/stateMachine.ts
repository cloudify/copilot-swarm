// State Machine for Copilot PR Monitoring
export type CopilotState =
  | "IDLE" // No Copilot activity detected
  | "COPILOT_WORKING" // Copilot is actively working
  | "WAITING_FOR_FEEDBACK" // Copilot finished, waiting for user feedback
  | "AUTO_FIX_REQUESTED" // Auto-fix posted comment, waiting for Copilot to start
  | "AUTO_FIX_IN_PROGRESS" // Copilot is working on auto-fix issues
  | "READY_FOR_RERUN" // Ready to rerun workflows (no pending fixes)
  | "CI_RUNNING" // CI workflows are running after GitHub work finished
  | "ERROR" // Copilot encountered an error
  | "MAX_SESSIONS_REACHED"; // Maximum number of copilot sessions reached

export type CopilotEvent =
  | "COPILOT_WORK_STARTED"
  | "COPILOT_WORK_FINISHED"
  | "COPILOT_WORK_FAILED"
  | "AUTO_FIX_COMMENT_POSTED"
  | "WORKFLOW_RERUN_TRIGGERED"
  | "FAILED_CHECKS_DETECTED"
  | "NO_FAILED_CHECKS"
  | "CI_STARTED" // CI workflows started running
  | "CI_COMPLETED" // CI workflows completed (success or failure)
  | "RESET";

export interface StateContext {
  hasFailedChecks: boolean;
  autoFixEnabled: boolean;
  autoApproveEnabled: boolean;
  username?: string;
  lastEventTimestamp?: Date;
  pendingWorkflowRuns: number[];
  runningWorkflowRuns: number[]; // Track currently running CI workflows
  sessionCount: number; // Track number of completed copilot sessions
  maxSessions: number; // Maximum allowed sessions
}

export interface StateTransition {
  fromState: CopilotState;
  event: CopilotEvent;
  toState: CopilotState;
  condition?: (context: StateContext) => boolean;
  action?: (context: StateContext) => Promise<void> | void;
}

export interface StateMachineConfig {
  onLog?: (
    message: string,
    type: "info" | "success" | "error" | "warning"
  ) => void;
  onStatusChange?: (
    status: CopilotState,
    message: string,
    emoji: string
  ) => void;
  onAutoFixRequested?: (context: StateContext) => Promise<void>;
  onWorkflowRerun?: (context: StateContext) => Promise<void>;
}

export class CopilotStateMachine {
  private currentState: CopilotState = "IDLE";
  private context: StateContext;
  private config: StateMachineConfig;

  private transitions: StateTransition[] = [
    // From IDLE
    {
      fromState: "IDLE",
      event: "COPILOT_WORK_STARTED",
      toState: "COPILOT_WORKING",
    },

    // From COPILOT_WORKING
    {
      fromState: "COPILOT_WORKING",
      event: "COPILOT_WORK_FINISHED",
      toState: "MAX_SESSIONS_REACHED",
      condition: (ctx) => ctx.sessionCount + 1 >= ctx.maxSessions,
      action: (ctx) => {
        ctx.sessionCount++;
        this.config.onLog?.(
          `🚫 Max sessions reached (${ctx.sessionCount}/${ctx.maxSessions}) - no further copilot work allowed`,
          "warning"
        );
      },
    },
    {
      fromState: "COPILOT_WORKING",
      event: "COPILOT_WORK_FINISHED",
      toState: "WAITING_FOR_FEEDBACK",
      condition: (ctx) => ctx.sessionCount + 1 < ctx.maxSessions,
      action: (ctx) => {
        ctx.sessionCount++;
        this.config.onLog?.(
          `✅ Copilot session completed (${ctx.sessionCount}/${ctx.maxSessions})`,
          "info"
        );
      },
    },
    {
      fromState: "COPILOT_WORKING",
      event: "COPILOT_WORK_FAILED",
      toState: "MAX_SESSIONS_REACHED",
      condition: (ctx) => ctx.sessionCount + 1 >= ctx.maxSessions,
      action: (ctx) => {
        ctx.sessionCount++;
        this.config.onLog?.(
          `🚫 Max sessions reached (${ctx.sessionCount}/${ctx.maxSessions}) - no further copilot work allowed`,
          "warning"
        );
      },
    },
    {
      fromState: "COPILOT_WORKING",
      event: "COPILOT_WORK_FAILED",
      toState: "ERROR",
      condition: (ctx) => ctx.sessionCount + 1 < ctx.maxSessions,
      action: (ctx) => {
        ctx.sessionCount++;
        this.config.onLog?.(
          `❌ Copilot session failed (${ctx.sessionCount}/${ctx.maxSessions})`,
          "error"
        );
      },
    },

    // From WAITING_FOR_FEEDBACK - analyze what to do next
    {
      fromState: "WAITING_FOR_FEEDBACK",
      event: "FAILED_CHECKS_DETECTED",
      toState: "AUTO_FIX_REQUESTED",
      condition: (ctx) => ctx.autoFixEnabled && !!ctx.username,
      action: async (ctx) => {
        this.config.onLog?.(
          "🔧 Auto-fix: Requesting fixes for failed checks",
          "info"
        );
        await this.config.onAutoFixRequested?.(ctx);
      },
    },
    {
      fromState: "WAITING_FOR_FEEDBACK",
      event: "FAILED_CHECKS_DETECTED",
      toState: "READY_FOR_RERUN",
      condition: (ctx) => !ctx.autoFixEnabled && ctx.autoApproveEnabled,
      action: (_ctx) => {
        this.config.onLog?.(
          "🔄 Auto-approve: Failed checks detected, but auto-fix disabled - proceeding with rerun",
          "info"
        );
      },
    },
    {
      fromState: "WAITING_FOR_FEEDBACK",
      event: "NO_FAILED_CHECKS",
      toState: "READY_FOR_RERUN",
      condition: (ctx) => ctx.autoApproveEnabled,
      action: (_ctx) => {
        this.config.onLog?.(
          "✅ No failed checks detected - ready to rerun workflows",
          "success"
        );
      },
    },
    {
      fromState: "WAITING_FOR_FEEDBACK",
      event: "NO_FAILED_CHECKS",
      toState: "IDLE",
      condition: (ctx) => !ctx.autoApproveEnabled,
      action: (_ctx) => {
        this.config.onLog?.(
          "✅ No failed checks detected - monitoring complete",
          "success"
        );
      },
    },

    // From AUTO_FIX_REQUESTED
    {
      fromState: "AUTO_FIX_REQUESTED",
      event: "COPILOT_WORK_STARTED",
      toState: "AUTO_FIX_IN_PROGRESS",
    },

    // From AUTO_FIX_IN_PROGRESS
    {
      fromState: "AUTO_FIX_IN_PROGRESS",
      event: "COPILOT_WORK_FINISHED",
      toState: "MAX_SESSIONS_REACHED",
      condition: (ctx) => ctx.sessionCount + 1 >= ctx.maxSessions,
      action: (ctx) => {
        ctx.sessionCount++;
        this.config.onLog?.(
          `🚫 Max sessions reached (${ctx.sessionCount}/${ctx.maxSessions}) - no further copilot work allowed`,
          "warning"
        );
      },
    },
    {
      fromState: "AUTO_FIX_IN_PROGRESS",
      event: "COPILOT_WORK_FINISHED",
      toState: "READY_FOR_RERUN",
      condition: (ctx) => ctx.autoApproveEnabled && ctx.sessionCount + 1 < ctx.maxSessions,
      action: (ctx) => {
        ctx.sessionCount++;
        this.config.onLog?.(
          `🔧 Auto-fix completed (${ctx.sessionCount}/${ctx.maxSessions}) - ready to rerun workflows`,
          "success"
        );
      },
    },
    {
      fromState: "AUTO_FIX_IN_PROGRESS",
      event: "COPILOT_WORK_FINISHED",
      toState: "WAITING_FOR_FEEDBACK",
      condition: (ctx) => !ctx.autoApproveEnabled && ctx.sessionCount + 1 < ctx.maxSessions,
      action: (ctx) => {
        ctx.sessionCount++;
        this.config.onLog?.(
          `🔧 Auto-fix completed (${ctx.sessionCount}/${ctx.maxSessions}) - waiting for manual workflow rerun`,
          "info"
        );
      },
    },
    {
      fromState: "AUTO_FIX_IN_PROGRESS",
      event: "COPILOT_WORK_FAILED",
      toState: "MAX_SESSIONS_REACHED",
      condition: (ctx) => ctx.sessionCount + 1 >= ctx.maxSessions,
      action: (ctx) => {
        ctx.sessionCount++;
        this.config.onLog?.(
          `🚫 Max sessions reached (${ctx.sessionCount}/${ctx.maxSessions}) - no further copilot work allowed`,
          "warning"
        );
      },
    },
    {
      fromState: "AUTO_FIX_IN_PROGRESS",
      event: "COPILOT_WORK_FAILED",
      toState: "ERROR",
      condition: (ctx) => ctx.sessionCount + 1 < ctx.maxSessions,
      action: (ctx) => {
        ctx.sessionCount++;
        this.config.onLog?.(
          `❌ Auto-fix failed (${ctx.sessionCount}/${ctx.maxSessions})`,
          "error"
        );
      },
    },

    // From READY_FOR_RERUN
    {
      fromState: "READY_FOR_RERUN",
      event: "WORKFLOW_RERUN_TRIGGERED",
      toState: "CI_RUNNING",
      action: async (ctx) => {
        this.config.onLog?.("🔄 Triggering workflow reruns", "info");
        await this.config.onWorkflowRerun?.(ctx);
      },
    },
    {
      fromState: "READY_FOR_RERUN",
      event: "CI_STARTED",
      toState: "CI_RUNNING",
      action: (_ctx) => {
        this.config.onLog?.("🔄 CI workflows started running", "info");
      },
    },

    // From CI_RUNNING
    {
      fromState: "CI_RUNNING",
      event: "CI_COMPLETED",
      toState: "IDLE",
      action: (_ctx) => {
        this.config.onLog?.("✅ CI workflows completed", "success");
      },
    },

    // From ERROR
    {
      fromState: "ERROR",
      event: "RESET",
      toState: "IDLE",
    },

    // Global transitions
    {
      fromState: "COPILOT_WORKING",
      event: "RESET",
      toState: "IDLE",
    },
    {
      fromState: "WAITING_FOR_FEEDBACK",
      event: "RESET",
      toState: "IDLE",
    },
    {
      fromState: "AUTO_FIX_REQUESTED",
      event: "RESET",
      toState: "IDLE",
    },
    {
      fromState: "AUTO_FIX_IN_PROGRESS",
      event: "RESET",
      toState: "IDLE",
    },
    {
      fromState: "READY_FOR_RERUN",
      event: "RESET",
      toState: "IDLE",
    },
    {
      fromState: "CI_RUNNING",
      event: "RESET",
      toState: "IDLE",
    },
    {
      fromState: "MAX_SESSIONS_REACHED",
      event: "RESET",
      toState: "IDLE",
    },
  ];

  constructor(initialContext: StateContext, config: StateMachineConfig = {}) {
    this.context = { ...initialContext };
    this.config = config;
  }

  getCurrentState(): CopilotState {
    return this.currentState;
  }

  getContext(): StateContext {
    return { ...this.context };
  }

  updateContext(updates: Partial<StateContext>): void {
    this.context = { ...this.context, ...updates };
  }

  async transition(
    event: CopilotEvent,
    contextUpdates?: Partial<StateContext>
  ): Promise<boolean> {
    if (contextUpdates) {
      this.updateContext(contextUpdates);
    }

    const validTransitions = this.transitions.filter(
      (t) => t.fromState === this.currentState && t.event === event
    );

    for (const transition of validTransitions) {
      if (!transition.condition || transition.condition(this.context)) {
        const oldState = this.currentState;
        this.currentState = transition.toState;

        this.config.onLog?.(
          `State transition: ${oldState} → ${this.currentState} (event: ${event})`,
          "info"
        );

        if (transition.action) {
          try {
            await transition.action(this.context);
          } catch (error) {
            this.config.onLog?.(
              `Action failed during transition: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
              "error"
            );
          }
        }

        this.notifyStatusChange();
        return true;
      }
    }

    this.config.onLog?.(
      `No valid transition found from ${this.currentState} with event ${event}`,
      "warning"
    );
    return false;
  }

  private notifyStatusChange(): void {
    const { message, emoji } = this.getStateInfo();
    this.config.onStatusChange?.(this.currentState, message, emoji);
  }

  getStateInfo(): {
    status: string;
    message: string;
    emoji: string;
    color: string;
  } {
    switch (this.currentState) {
      case "IDLE":
        return {
          status: "No Copilot Activity",
          message: "No Copilot activity detected",
          emoji: "⚪",
          color: "gray",
        };
      case "COPILOT_WORKING":
        return {
          status: "Copilot Working",
          message: "Copilot is working",
          emoji: "🔄",
          color: "blue",
        };
      case "WAITING_FOR_FEEDBACK":
        return {
          status: "Waiting for Feedback",
          message: "Waiting for feedback",
          emoji: "⏳",
          color: "cyan",
        };
      case "AUTO_FIX_REQUESTED":
        return {
          status: "Waiting for Feedback",
          message: "Waiting for Copilot to fix issues",
          emoji: "🔧",
          color: "orange",
        };
      case "AUTO_FIX_IN_PROGRESS":
        return {
          status: "Copilot Working",
          message: "Copilot is fixing issues",
          emoji: "🔧",
          color: "blue",
        };
      case "READY_FOR_RERUN":
        return {
          status: "Ready for Rerun",
          message: "Ready to rerun workflows",
          emoji: "✅",
          color: "green",
        };
      case "CI_RUNNING":
        return {
          status: "CI is running",
          message: "CI workflows are running",
          emoji: "🔄",
          color: "blue",
        };
      case "ERROR":
        return {
          status: "Error",
          message: "Copilot encountered an error",
          emoji: "❌",
          color: "red",
        };
      case "MAX_SESSIONS_REACHED":
        return {
          status: "Max Copilot sessions reached",
          message: "Maximum number of Copilot sessions reached",
          emoji: "🚫",
          color: "orange",
        };
      default:
        return {
          status: "Unknown",
          message: "Unknown state",
          emoji: "❓",
          color: "gray",
        };
    }
  }

  // Helper method to check if auto-fix should run
  shouldRequestAutoFix(): boolean {
    return (
      this.currentState === "WAITING_FOR_FEEDBACK" &&
      this.context.hasFailedChecks &&
      this.context.autoFixEnabled &&
      !!this.context.username
    );
  }

  // Helper method to check if auto-approve should run
  shouldTriggerAutoApprove(): boolean {
    return (
      this.currentState === "READY_FOR_RERUN" && this.context.autoApproveEnabled
    );
  }

  // Helper method to check if we should monitor CI workflows
  shouldMonitorCI(): boolean {
    return (
      this.currentState === "CI_RUNNING" ||
      this.currentState === "READY_FOR_RERUN"
    );
  }

  // Reset the state machine
  async reset(): Promise<void> {
    await this.transition("RESET");
  }
}
