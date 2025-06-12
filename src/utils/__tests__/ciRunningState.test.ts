import type { StateContext } from "../stateMachine";
import { CopilotStateMachine } from "../stateMachine";

describe("CI Running State", () => {
  let stateMachine: CopilotStateMachine;
  let context: StateContext;
  let logs: Array<{ message: string; type: string }>;

  beforeEach(() => {
    context = {
      hasFailedChecks: false,
      autoFixEnabled: false,
      autoApproveEnabled: true,
      username: "test-user",
      pendingWorkflowRuns: [],
      runningWorkflowRuns: [],
      sessionCount: 0,
      maxSessions: 50,
      totalSessionTimeMs: 0,
    };

    logs = [];

    stateMachine = new CopilotStateMachine(context, {
      onLog: (message, type) => {
        logs.push({ message, type });
      },
      onStatusChange: (status, message, emoji) => {
        logs.push({
          message: `Status: ${status} ${emoji} ${message}`,
          type: "info",
        });
      },
      onWorkflowRerun: async () => {
        // Mock workflow rerun
      },
    });
  });

  test("should transition from READY_FOR_RERUN to CI_RUNNING when workflows are triggered", async () => {
    // First get to READY_FOR_RERUN state
    await stateMachine.transition("COPILOT_WORK_STARTED");
    await stateMachine.transition("COPILOT_WORK_FINISHED");
    await stateMachine.transition("NO_FAILED_CHECKS");

    expect(stateMachine.getCurrentState()).toBe("READY_FOR_RERUN");

    // Now trigger workflow rerun
    await stateMachine.transition("WORKFLOW_RERUN_TRIGGERED");

    expect(stateMachine.getCurrentState()).toBe("CI_RUNNING");

    const stateInfo = stateMachine.getStateInfo();
    expect(stateInfo.status).toBe("CI is running");
    expect(stateInfo.message).toBe("CI workflows are running");
    expect(stateInfo.emoji).toBe("🔄");
    expect(stateInfo.color).toBe("blue");
  });

  test("should transition from READY_FOR_RERUN to CI_RUNNING when CI starts", async () => {
    // First get to READY_FOR_RERUN state
    await stateMachine.transition("COPILOT_WORK_STARTED");
    await stateMachine.transition("COPILOT_WORK_FINISHED");
    await stateMachine.transition("NO_FAILED_CHECKS");

    expect(stateMachine.getCurrentState()).toBe("READY_FOR_RERUN");

    // CI starts
    await stateMachine.transition("CI_STARTED");

    expect(stateMachine.getCurrentState()).toBe("CI_RUNNING");
  });

  test("should transition from CI_RUNNING to IDLE when CI completes", async () => {
    // Get to CI_RUNNING state
    await stateMachine.transition("COPILOT_WORK_STARTED");
    await stateMachine.transition("COPILOT_WORK_FINISHED");
    await stateMachine.transition("NO_FAILED_CHECKS");
    await stateMachine.transition("WORKFLOW_RERUN_TRIGGERED");

    expect(stateMachine.getCurrentState()).toBe("CI_RUNNING");

    // CI completes
    await stateMachine.transition("CI_COMPLETED");

    expect(stateMachine.getCurrentState()).toBe("IDLE");
  });

  test("shouldMonitorCI should return true for CI_RUNNING and READY_FOR_RERUN states", async () => {
    // IDLE state - should not monitor
    expect(stateMachine.shouldMonitorCI()).toBe(false);

    // Get to READY_FOR_RERUN
    await stateMachine.transition("COPILOT_WORK_STARTED");
    await stateMachine.transition("COPILOT_WORK_FINISHED");
    await stateMachine.transition("NO_FAILED_CHECKS");

    expect(stateMachine.shouldMonitorCI()).toBe(true);

    // Move to CI_RUNNING
    await stateMachine.transition("WORKFLOW_RERUN_TRIGGERED");

    expect(stateMachine.shouldMonitorCI()).toBe(true);

    // Complete CI
    await stateMachine.transition("CI_COMPLETED");

    expect(stateMachine.shouldMonitorCI()).toBe(false);
  });

  test("should handle reset from CI_RUNNING state", async () => {
    // Get to CI_RUNNING state
    await stateMachine.transition("COPILOT_WORK_STARTED");
    await stateMachine.transition("COPILOT_WORK_FINISHED");
    await stateMachine.transition("NO_FAILED_CHECKS");
    await stateMachine.transition("WORKFLOW_RERUN_TRIGGERED");

    expect(stateMachine.getCurrentState()).toBe("CI_RUNNING");

    // Reset
    await stateMachine.reset();

    expect(stateMachine.getCurrentState()).toBe("IDLE");
  });
});
