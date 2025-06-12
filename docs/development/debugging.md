# Debug Logging Guide

This guide explains the comprehensive debug logging that has been added to help troubleshoot API issues with the Copilot Monitor application.

## Enabling Debug Mode

### Option 1: Using npm scripts

```bash
# Development mode with debug logging
npm run dev

# Verbose debug mode
npm run dev:verbose

# Build and run with debug
npm run debug
```

### Option 2: Environment variables

```bash
# Enable debug logging
DEBUG=true npm start

# Enable both debug and development mode
DEBUG=true NODE_ENV=development npm start
```

### Option 3: Direct execution

```bash
# Run the debug script directly
node debug.js
```

## What Gets Logged

### OAuth Flow (`oauth.ts`)

- **Configuration**: Client ID, redirect URI, and requested scopes
- **Authorization URL**: Complete OAuth URL with all parameters
- **Token Exchange**: Request details, response status, and token information
- **Errors**: Detailed error information including status codes and response data

### GitHub API (`github.ts`)

- **Client Initialization**: Base URL, token length, and default headers
- **Request Interceptor**: Every API request with method, URL, and parameters
- **Response Interceptor**: Status codes, rate limits, OAuth scopes, and response size
- **Token Verification**: User information, granted scopes, and rate limit status
- **Organization Fetching**: User details and organization list
- **Search Queries**: Query validation, sanitization, and execution details
- **Error Details**: Status codes, error messages, and response data

### Search API Specific Logging

- **Query Construction**: How search queries are built for different organization types
- **Query Validation**: Syntax checking and sanitization
- **Search Results**: Total count, returned items, and incomplete results flags
- **Fallback Logic**: Alternative search attempts when primary queries fail
- **Filter Results**: Client-side filtering for Copilot assignees

## Common Issues and Their Debug Signatures

### 422 Unprocessable Entity

This usually indicates a malformed search query. Look for:

```
[GitHub API Debug] Invalid search query for {org}: {
  "query": "...",
  "error": "..."
}
```

### Insufficient Scopes

Check the token verification output:

```
[GitHub API Debug] Token verification successful: {
  "scopes": ["repo", "workflow", ...],
  ...
}
```

### Rate Limiting

Monitor rate limit headers:

```
[GitHub API Debug] Response from /search/issues: {
  "headers": {
    "x-ratelimit-remaining": "10",
    "x-ratelimit-reset": "1234567890"
  }
}
```

### Organization Access Issues

Look for organization fetching errors:

```
[GitHub API Debug] Failed to fetch organizations: {
  "status": 403,
  "data": {"message": "..."}
}
```

## Troubleshooting Steps

1. **Enable Debug Mode**: Use one of the methods above
2. **Check Token Scopes**: Verify the token has the required permissions
3. **Validate Search Queries**: Look for query validation errors
4. **Monitor Rate Limits**: Check if you're hitting API limits
5. **Check Organization Access**: Ensure you have access to the specified organizations

## Enhanced OAuth Scopes

The application now requests these scopes by default:

- `repo`: Full access to repositories (required for searching PRs)
- `workflow`: Access to GitHub Actions workflows
- `read:org`: Read organization membership (required for org search)
- `read:user`: Read user profile information
- `user:email`: Read user email addresses

## Search Query Validation

The application now validates search queries for:

- Empty or malformed queries
- Maximum length limits (256 characters)
- Required GitHub search operators
- Invalid characters in organization names

## Sample Debug Output

When debug mode is enabled, you'll see output like:

```
🐛 Debug mode enabled
📊 OAuth and GitHub API requests will be logged
---

[OAuth Debug] Created OAuth config {
  "clientId": "your_client_id",
  "scopes": ["repo", "workflow", "read:org", "read:user", "user:email"]
}

[GitHub API Debug] Making request to GET /user
[GitHub API Debug] Response from /user {
  "status": 200,
  "headers": {
    "x-oauth-scopes": "repo, workflow, read:org, read:user, user:email"
  }
}
```

This comprehensive logging will help identify exactly where and why API requests are failing.
