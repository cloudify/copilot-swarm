# CLI Argument Changes Summary

## Changes Made

The following CLI arguments have been converted from opt-in flags to opt-out flags, making the features enabled by default:

### Before (opt-in):

- `--resume-on-failure` - Enable automatic resume when Copilot was rate limited
- `--fix` - Enable automatic Copilot fix requests for failing checks
- `--approve` - Enable automatic rerun of pending workflow runs

### After (opt-out):

- `--no-resume-on-failure` - **Disable** automatic resume when Copilot was rate limited
- `--no-auto-fix` - **Disable** automatic Copilot fix requests for failing checks
- `--no-auto-approve` - **Disable** automatic rerun of pending workflow runs

## Behavior Changes

### Default Behavior (no flags):

- ✅ Resume on failure: **ENABLED**
- ✅ Auto-fix: **ENABLED**
- ✅ Auto-approve: **ENABLED**

### With disable flags:

```bash
# Disable specific features
copilot-monitor --no-auto-fix              # Only disable auto-fix
copilot-monitor --no-auto-approve          # Only disable auto-approve
copilot-monitor --no-resume-on-failure     # Only disable resume on failure

# Disable all features
copilot-monitor --no-resume-on-failure --no-auto-fix --no-auto-approve
```

## Files Modified

1. **`src/index.ts`**:

   - Updated CLI option definitions from `--flag` to `--no-flag` format
   - Updated option descriptions to reflect "disable" behavior
   - Modified boolean logic to default to `true` and set to `false` only when disable flags are present

2. **`SCOPE_VALIDATION_SUMMARY.md`**:
   - Updated documentation to reflect that features are now enabled by default
   - Changed example from requiring `--approve` or `--fix` to mentioning the new disable flags

## Technical Implementation

The implementation uses Commander.js's built-in support for `--no-` prefixed flags:

- When `--no-feature-name` is defined, Commander.js automatically creates a `featureName` property
- The property defaults to `true` when the flag is not present
- The property is set to `false` when the `--no-feature-name` flag is used

This approach ensures:

- Features are enabled by default
- Users can selectively disable specific features
- The internal application logic remains unchanged (still expects boolean values)
- Backward compatibility is maintained at the code level

## Additional CLI Features

### Clean Status Command

A new `--clean-status` flag has been added to clean the local status (clear all paused PRs):

```bash
# Clean all paused PR states
copilot-monitor --clean-status
```

This command:

- Displays current pause status (globally paused state and paused PRs)
- Clears all pause states and timestamps
- Shows confirmation of the cleanup operation
- Exits after completion (does not start monitoring)

**Use cases:**

- Reset pause states after testing
- Clear paused PRs when resuming normal operations
- Debug pause state issues
- Bulk resume of all paused pull requests
