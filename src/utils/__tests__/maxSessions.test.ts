import { CopilotStateMachine, StateContext } from "../stateMachine";

describe("Max Sessions Functionality", () => {
  let stateMachine: CopilotStateMachine;
  let mockLog: jest.Mock;

  beforeEach(() => {
    mockLog = jest.fn();

    const context: StateContext = {
      hasFailedChecks: false,
      autoFixEnabled: true,
      autoApproveEnabled: true,
      username: "testuser",
      pendingWorkflowRuns: [],
      runningWorkflowRuns: [],
      sessionCount: 0,
      maxSessions: 3, // Use a small number for testing
    };

    stateMachine = new CopilotStateMachine(context, {
      onLog: mockLog,
    });
  });

  describe("Session Counting", () => {
    it("should increment session count when copilot work finishes successfully", async () => {
      // Start and finish first session
      await stateMachine.transition("COPILOT_WORK_STARTED");
      expect(stateMachine.getCurrentState()).toBe("COPILOT_WORKING");
      
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      expect(stateMachine.getCurrentState()).toBe("WAITING_FOR_FEEDBACK");
      expect(stateMachine.getContext().sessionCount).toBe(1);
    });

    it("should increment session count when copilot work fails", async () => {
      // Start and fail first session
      await stateMachine.transition("COPILOT_WORK_STARTED");
      expect(stateMachine.getCurrentState()).toBe("COPILOT_WORKING");
      
      await stateMachine.transition("COPILOT_WORK_FAILED");
      expect(stateMachine.getCurrentState()).toBe("ERROR");
      expect(stateMachine.getContext().sessionCount).toBe(1);
    });

    it("should transition to MAX_SESSIONS_REACHED when reaching session limit", async () => {
      const context = stateMachine.getContext();
      
      // Complete sessions up to the limit - 1
      for (let i = 0; i < context.maxSessions - 1; i++) {
        stateMachine.updateContext({ sessionCount: i });
        await stateMachine.transition("COPILOT_WORK_STARTED");
        await stateMachine.transition("COPILOT_WORK_FINISHED");
      }

      // Start the final session that will reach the limit
      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      
      expect(stateMachine.getCurrentState()).toBe("MAX_SESSIONS_REACHED");
      expect(stateMachine.getContext().sessionCount).toBe(context.maxSessions);
    });

    it("should prevent further copilot work when max sessions reached", async () => {
      // Set session count to maximum
      stateMachine.updateContext({ sessionCount: 3 });
      
      // Try to start new copilot work from IDLE state - should not transition
      const result = await stateMachine.transition("COPILOT_WORK_STARTED");
      expect(result).toBe(false); // No valid transition
      expect(stateMachine.getCurrentState()).toBe("IDLE");
    });
  });

  describe("Auto-fix Sessions", () => {
    it("should count auto-fix sessions towards the limit", async () => {
      // Start regular session
      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      expect(stateMachine.getContext().sessionCount).toBe(1);

      // Simulate auto-fix flow
      await stateMachine.transition("FAILED_CHECKS_DETECTED");
      expect(stateMachine.getCurrentState()).toBe("AUTO_FIX_REQUESTED");
      
      await stateMachine.transition("COPILOT_WORK_STARTED");
      expect(stateMachine.getCurrentState()).toBe("AUTO_FIX_IN_PROGRESS");
      
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      expect(stateMachine.getContext().sessionCount).toBe(2);
    });

    it("should transition to MAX_SESSIONS_REACHED during auto-fix when limit reached", async () => {
      // Set session count close to limit
      stateMachine.updateContext({ sessionCount: 2 });
      
      // Start auto-fix session that will reach the limit
      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      await stateMachine.transition("FAILED_CHECKS_DETECTED");
      await stateMachine.transition("COPILOT_WORK_STARTED");
      
      expect(stateMachine.getCurrentState()).toBe("AUTO_FIX_IN_PROGRESS");
      
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      expect(stateMachine.getCurrentState()).toBe("MAX_SESSIONS_REACHED");
      expect(stateMachine.getContext().sessionCount).toBe(3);
    });
  });

  describe("State Info", () => {
    it("should return appropriate status for MAX_SESSIONS_REACHED state", async () => {
      // Force transition to MAX_SESSIONS_REACHED state
      stateMachine.updateContext({ sessionCount: 2 });
      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      
      const stateInfo = stateMachine.getStateInfo();
      expect(stateInfo.status).toBe("Max Copilot sessions reached");
      expect(stateInfo.message).toBe("Maximum number of Copilot sessions reached");
      expect(stateInfo.emoji).toBe("🚫");
      expect(stateInfo.color).toBe("orange");
    });
  });

  describe("Reset Functionality", () => {
    it("should reset from MAX_SESSIONS_REACHED state", async () => {
      // Get to MAX_SESSIONS_REACHED state
      stateMachine.updateContext({ sessionCount: 2 });
      await stateMachine.transition("COPILOT_WORK_STARTED");
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      expect(stateMachine.getCurrentState()).toBe("MAX_SESSIONS_REACHED");
      
      // Reset should work
      await stateMachine.reset();
      expect(stateMachine.getCurrentState()).toBe("IDLE");
    });
  });
});