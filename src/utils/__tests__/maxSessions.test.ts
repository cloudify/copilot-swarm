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
      totalSessionTimeMs: 0,
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

  describe("Session Timing", () => {
    it("should track session timing correctly", async () => {
      const context = stateMachine.getContext();
      
      // Initially no session time
      expect(context.totalSessionTimeMs).toBe(0);
      expect(stateMachine.getTotalSessionTime()).toBe("00:00:00");
      
      // Start a session
      await stateMachine.transition("COPILOT_WORK_STARTED");
      const contextAfterStart = stateMachine.getContext();
      expect(contextAfterStart.currentSessionStartTime).toBeDefined();
      
      // Simulate some time passing by manually setting the start time to earlier
      const fakeStartTime = new Date(Date.now() - 65000); // 1 minute 5 seconds ago
      stateMachine.updateContext({ currentSessionStartTime: fakeStartTime });
      
      // End the session
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      const contextAfterEnd = stateMachine.getContext();
      
      // Session should be complete
      expect(contextAfterEnd.currentSessionStartTime).toBeUndefined();
      expect(contextAfterEnd.totalSessionTimeMs).toBeGreaterThan(60000); // At least 1 minute
      expect(contextAfterEnd.sessionCount).toBe(1);
      
      // Should format time correctly
      const formattedTime = stateMachine.getTotalSessionTime();
      expect(formattedTime).toMatch(/00:01:\d{2}/); // Should be in format 00:01:XX
    });

    it("should accumulate multiple session times", async () => {
      // First session
      await stateMachine.transition("COPILOT_WORK_STARTED");
      const fakeStartTime1 = new Date(Date.now() - 30000); // 30 seconds ago
      stateMachine.updateContext({ currentSessionStartTime: fakeStartTime1 });
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      
      const contextAfterFirst = stateMachine.getContext();
      const firstSessionTime = contextAfterFirst.totalSessionTimeMs;
      expect(firstSessionTime).toBeGreaterThan(25000); // At least 25 seconds
      
      // Second session
      await stateMachine.transition("FAILED_CHECKS_DETECTED");
      await stateMachine.transition("COPILOT_WORK_STARTED");
      const fakeStartTime2 = new Date(Date.now() - 45000); // 45 seconds ago
      stateMachine.updateContext({ currentSessionStartTime: fakeStartTime2 });
      await stateMachine.transition("COPILOT_WORK_FINISHED");
      
      const contextAfterSecond = stateMachine.getContext();
      expect(contextAfterSecond.totalSessionTimeMs).toBeGreaterThan(firstSessionTime + 40000); // Should have added ~45 seconds
      expect(contextAfterSecond.sessionCount).toBe(2);
      
      // Total time should be formatted correctly
      const formattedTime = stateMachine.getTotalSessionTime();
      expect(formattedTime).toMatch(/00:01:\d{2}/); // Should be at least 1 minute total
    });
  });
});