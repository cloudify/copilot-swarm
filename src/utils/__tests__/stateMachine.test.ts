import type { StateContext } from "./stateMachine";
import { CopilotStateMachine } from "./stateMachine";

describe("CopilotStateMachine", () => {
  let stateMachine: CopilotStateMachine;
  let mockLog: jest.Mock;
  let mockAutoFixRequested: jest.Mock;
  let mockWorkflowRerun: jest.Mock;

  beforeEach(() => {
    mockLog = jest.fn();
    mockAutoFixRequested = jest.fn();
    mockWorkflowRerun = jest.fn();

    const context: StateContext = {
      hasFailedChecks: false,
      autoFixEnabled: true,
      autoApproveEnabled: true,
      username: "testuser",
      pendingWorkflowRuns: [],
    };

    stateMachine = new CopilotStateMachine(context, {
      onLog: mockLog,
      onAutoFixRequested: mockAutoFixRequested,
      onWorkflowRerun: mockWorkflowRerun,
    });
  });

  describe("Basic State Transitions", () => {
    it("should start in IDLE state", () => {
      expect(stateMachine.getCurrentState()).toBe("IDLE");
    });

    it("should transition from IDLE to COPILOT_WORKING on COPILOT_WORK_STARTED", async () => {
      await stateMachine.transition("COPILOT_WORK_STARTED");
      expect(stateMachine.getCurrentState()).toBe("COPILOT_WORKING");
    });

    it("should transition from COPILOT_WORKING to WAITING_FOR_FEEDBACK on COPILOT_WORK_FINISHED", async () => {
      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      expect(stateMachine.getCurrentState()).toBe("WAITING_FOR_FEEDBACK");
    });

    it("should transition from COPILOT_WORKING to ERROR on COPILOT_WORK_FAILED", async () => {
      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FAILED");
      expect(stateMachine.getCurrentState()).toBe("ERROR");
    });
  });

  describe("Auto-Fix Flow", () => {
    it("should request auto-fix when failed checks are detected and auto-fix is enabled", async () => {
      // Start working then finish
      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");

      // Detect failed checks - should trigger auto-fix
      await stateMachine.transition("FAILED_CHECKS_DETECTED");

      expect(stateMachine.getCurrentState()).toBe("AUTO_FIX_REQUESTED");
      expect(mockAutoFixRequested).toHaveBeenCalled();
    });

    it("should not request auto-fix when username is missing", async () => {
      // Remove username
      stateMachine.updateContext({ username: undefined });

      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      await stateMachine.transition("FAILED_CHECKS_DETECTED");

      // Should go to READY_FOR_RERUN instead (assuming auto-approve is enabled)
      expect(stateMachine.getCurrentState()).toBe("READY_FOR_RERUN");
      expect(mockAutoFixRequested).not.toHaveBeenCalled();
    });

    it("should progress through auto-fix workflow correctly", async () => {
      // Initial work
      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");

      // Auto-fix requested
      await stateMachine.transition("FAILED_CHECKS_DETECTED");
      expect(stateMachine.getCurrentState()).toBe("AUTO_FIX_REQUESTED");

      // Copilot starts working on fixes
      await stateMachine.transition("COPILOT_WORK_STARTED");
      expect(stateMachine.getCurrentState()).toBe("AUTO_FIX_IN_PROGRESS");

      // Copilot finishes fixes
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      expect(stateMachine.getCurrentState()).toBe("READY_FOR_RERUN");
    });
  });

  describe("Auto-Approve Flow", () => {
    it("should skip directly to READY_FOR_RERUN when no failed checks and auto-approve enabled", async () => {
      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      await stateMachine.transition("NO_FAILED_CHECKS");

      expect(stateMachine.getCurrentState()).toBe("READY_FOR_RERUN");
    });

    it("should trigger workflow rerun from READY_FOR_RERUN state", async () => {
      // Get to READY_FOR_RERUN state
      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      await stateMachine.transition("NO_FAILED_CHECKS");

      // Trigger rerun
      await stateMachine.transition("WORKFLOW_RERUN_TRIGGERED");

      expect(stateMachine.getCurrentState()).toBe("IDLE");
      expect(mockWorkflowRerun).toHaveBeenCalled();
    });

    it("should not auto-approve when disabled", async () => {
      // Disable auto-approve
      stateMachine.updateContext({ autoApproveEnabled: false });

      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      await stateMachine.transition("NO_FAILED_CHECKS");

      // Should go back to IDLE instead of READY_FOR_RERUN
      expect(stateMachine.getCurrentState()).toBe("IDLE");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid transitions gracefully", async () => {
      const result = await stateMachine.transition("COPILOT_WORK_FINISHED"); // Invalid from IDLE
      expect(result).toBe(false);
      expect(stateMachine.getCurrentState()).toBe("IDLE");
    });

    it("should allow reset from any state", async () => {
      // Get to some other state
      await stateMachine.transition("COPILOT_WORK_STARTED");
      expect(stateMachine.getCurrentState()).toBe("COPILOT_WORKING");

      // Reset should work
      await stateMachine.reset();
      expect(stateMachine.getCurrentState()).toBe("IDLE");
    });
  });

  describe("Helper Methods", () => {
    it("should correctly identify when auto-fix should run", async () => {
      // Setup conditions for auto-fix
      stateMachine.updateContext({
        hasFailedChecks: true,
        autoFixEnabled: true,
        username: "testuser",
      });

      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");

      expect(stateMachine.shouldRequestAutoFix()).toBe(true);
    });

    it("should correctly identify when auto-approve should run", async () => {
      // Get to READY_FOR_RERUN state
      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      await stateMachine.transition("NO_FAILED_CHECKS");

      expect(stateMachine.shouldTriggerAutoApprove()).toBe(true);
    });
  });

  describe("State Info", () => {
    it("should provide correct state info for each state", () => {
      const states = [
        "IDLE",
        "COPILOT_WORKING",
        "WAITING_FOR_FEEDBACK",
        "AUTO_FIX_REQUESTED",
        "AUTO_FIX_IN_PROGRESS",
        "READY_FOR_RERUN",
        "ERROR",
      ];

      states.forEach((state) => {
        // Mock the current state
        (stateMachine as any).currentState = state;
        const info = stateMachine.getStateInfo();

        expect(info).toHaveProperty("status");
        expect(info).toHaveProperty("message");
        expect(info).toHaveProperty("emoji");
        expect(info).toHaveProperty("color");
        expect(typeof info.status).toBe("string");
        expect(typeof info.message).toBe("string");
        expect(typeof info.emoji).toBe("string");
        expect(typeof info.color).toBe("string");
      });
    });
  });
});
