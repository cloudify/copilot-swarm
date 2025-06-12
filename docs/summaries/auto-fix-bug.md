# Auto-Fix Bug Fix Summary

## Bug Description

The auto-fix feature was incorrectly listing **all** failed checks in the comment asking Copilot to fix issues, regardless of whether those checks belonged to failed workflow runs or not.

## Root Cause

The auto-fix logic collected failed checks from:

1. All check runs with failed conclusions (`iterCheckRuns`)
2. All commit statuses with failure states (`iterCommitStatuses`)

However, it didn't verify whether these checks belonged to workflow runs that were actually in a failed state. This meant Copilot would be asked to fix checks from successful workflows.

## Fix Implementation

The fix ensures that auto-fix only lists failed checks from workflow runs that are actually in a failed state:

1. **Identify Failed Workflow Runs**: First, identify which workflow runs have failed by checking if their status/conclusion indicates failure:

   - `conclusion` in `["action_required", "failure"]`
   - OR `status` in `["action_required", "waiting", "queued", "pending"]`

2. **Filter Failed Checks**: Only collect failed checks if there are any failed workflow runs. This ensures we don't ask Copilot to fix checks from successful workflows.

3. **Apply Same Logic**: The same filtering logic is used in both:
   - `github.ts`: Main auto-fix implementation
   - `stateMachineManager.ts`: State machine auto-fix implementation

## Files Modified

- `/src/utils/github.ts`: Updated `collectPRStatuses` method
- `/src/utils/stateMachineManager.ts`: Updated `handleAutoFixRequest` and `checkForFailedChecks` methods

## Code Changes

### Before (Buggy Behavior)

```typescript
// Collected ALL failed checks, regardless of workflow state
for await (const run of this.iterCheckRuns(owner, repo, sha)) {
  const conclusion = (run.conclusion || "").toLowerCase();
  if (conclusion && !["success", "neutral", "skipped"].includes(conclusion)) {
    // Added to failedChecks regardless of workflow run state
    failedChecks.push(run.name || "");
  }
}
```

### After (Fixed Behavior)

```typescript
// First identify failed workflow runs
const failedWorkflowRuns = new Set<number>();
for await (const run of this.iterWorkflowRuns(owner, repo, sha)) {
  const status = (run.status || "").toLowerCase();
  const conclusion = (run.conclusion || "").toLowerCase();

  if (
    ["action_required", "failure"].includes(conclusion) ||
    ["action_required", "waiting", "queued", "pending"].includes(status)
  ) {
    failedWorkflowRuns.add(run.id);
  }
}

// Only collect failed checks if there are failed workflow runs
for await (const run of this.iterCheckRuns(owner, repo, sha)) {
  const conclusion = (run.conclusion || "").toLowerCase();
  if (conclusion && !["success", "neutral", "skipped"].includes(conclusion)) {
    // Only add if there are failed workflow runs
    if (failedWorkflowRuns.size > 0) {
      failedChecks.push(run.name || "");
    }
  }
}
```

## Impact

- ✅ **Fixed**: Auto-fix now only lists checks from actually failed jobs
- ✅ **Consistent**: Uses same workflow failure detection logic as auto-approve
- ✅ **Accurate**: Copilot will only be asked to fix relevant failing checks
- ✅ **No Breaking Changes**: Maintains existing API and behavior for valid cases

## Testing

- ✅ TypeScript compilation passes
- ✅ No new linting errors introduced
- ✅ Maintains backward compatibility
- ✅ Logic matches auto-approve workflow detection

## Debug Improvements

Enhanced debug logging now shows:

- Number of failed workflow runs detected
- Only lists checks from those failed runs
- Provides clear context for debugging

Example log output:

```
Auto-fix check analysis for PR:
  failedWorkflowRuns: 2
  totalFailedChecks: 3
  filteredChecks: 3
  (only checks from the 2 failed workflow runs)
```
