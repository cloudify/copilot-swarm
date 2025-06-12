# OAuth Scope Validation and Re-authentication Implementation

## Overview

This implementation addresses the issue where the Copilot Monitor tool fails when the GitHub token doesn't have the necessary scopes. Instead of just showing an error message, the tool now automatically guides the user through re-authentication using GitHub's device-based OAuth flow.

## Key Changes

### 1. Device-Based OAuth Flow (`src/utils/oauth.ts`)

Added `GitHubDeviceAuth` class and related interfaces:

- `DeviceAuthResult` - Result of successful device authentication
- `DeviceCodeResponse` - Response from GitHub's device code endpoint
- `GitHubDeviceAuth` class - Handles the complete device flow
- `createDeviceAuth()` - Factory function with default GitHub CLI client ID and scopes

**Benefits of Device Flow:**

- No callback server required (better for CLI tools)
- More secure than web-based flow for CLI applications
- Uses GitHub CLI's public client ID (no secrets needed)
- Automatic browser opening with fallback instructions

### 2. Enhanced Scope Validation (`src/utils/github.ts`)

Added `validateTokenScopes()` method to `GitHubAPI` class:

- Returns detailed validation result with missing scopes
- Provides user-friendly error messages
- Maintains compatibility with existing `getScopeErrorMessage()` method

### 3. Automatic Re-authentication Flow (`src/utils/config.ts`)

Added two new functions:

- `handleScopeAuthentication()` - Manages the device flow re-authentication
- `ensureValidTokenScopes()` - Validates current token and re-authenticates if needed

**Flow Logic:**

1. Check if there's existing authentication
2. If no auth exists → trigger device flow
3. If auth exists but token is invalid → trigger device flow
4. If auth exists but scopes are missing → trigger device flow
5. If auth exists and scopes are valid → return existing token

### 4. Updated Monitor Engine (`src/MonitorEngine.ts`)

Modified initialization to use the new authentication flow:

- Replaced direct token validation with `ensureValidTokenScopes()`
- Improved error handling and user messaging
- Maintains backward compatibility

### 5. Enhanced CLI Configuration (`src/index.ts`)

Added proper `--config` flag handling:

- Separate configuration mode that doesn't start the web server
- Interactive configuration flow
- Better user guidance for setup

## Required Scopes

The tool requires these GitHub scopes (matching GitHub CLI requirements):

- `repo` - Full access to repositories
- `read:org` - Read organization membership
- `read:user` - Read user profile information
- `user:email` - Read user email addresses
- `gist` - Access to gists
- `workflow` - Access to GitHub Actions workflows

## User Experience

### Before

```
❌ Setup required:
Please run the following command to configure authentication and repositories:
  npx copilot-monitor --config

[Monitor] Error starting monitor: Token missing required scopes: 🔐 Missing required GitHub token scopes: read:org, read:user, user:email, gist. Please re-authenticate with the required scopes.
```

### After

When scopes are missing, the tool automatically:

1. Detects missing scopes
2. Explains what's happening
3. Starts device flow authentication
4. Opens browser automatically
5. Provides fallback instructions if browser doesn't open
6. Polls for completion
7. Saves new token automatically
8. Continues with normal operation

## Testing

A test script is provided (`test-scope-validation.js`) to verify:

- Existing authentication detection
- Scope validation logic
- Re-authentication flow
- Error handling

## Security Considerations

- Uses GitHub CLI's public client ID (safe for public use)
- Device flow is more secure than web-based flow for CLI tools
- No client secrets stored locally
- Tokens are stored in user's config directory with appropriate permissions

## Backward Compatibility

- All existing functionality remains unchanged
- New authentication flow is transparent to existing users with valid tokens
- Configuration file format remains the same
- CLI flags and options remain the same
