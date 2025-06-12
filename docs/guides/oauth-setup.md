# OAuth Setup Guide

Complete guide for setting up GitHub OAuth authentication for the Copilot Neural Swarm.

## Overview

The Copilot Neural Swarm uses GitHub OAuth for secure authentication, eliminating the need for personal access tokens and providing a better user experience.

## Creating a GitHub OAuth App

### Step 1: Access GitHub Developer Settings

1. Sign in to GitHub
2. Go to [GitHub Developer Settings](https://github.com/settings/developers)
3. Click **"OAuth Apps"** in the left sidebar
4. Click **"New OAuth App"**

### Step 2: Configure OAuth App

Fill in the OAuth App form with these values:

```
Application name: Copilot Neural Swarm
Homepage URL: http://localhost:3010
Application description: Real-time GitHub Copilot monitoring tool
Authorization callback URL: http://localhost:3010/callback
```

**Important**: The callback URL must be exactly `http://localhost:3010/callback`

### Step 3: Save Credentials

After creating the OAuth App:

1. **Copy the Client ID** - You'll need this for the application
2. **Generate a Client Secret** - Click "Generate a new client secret"
3. **Copy the Client Secret** - You'll need this for the application
4. **Keep credentials secure** - Don't share or commit these to version control

## Required OAuth Scopes

The application automatically requests these scopes during authorization:

### Core Scopes

- **`repo`**: Full access to repositories

  - Read repository information
  - Access pull request data
  - Read GitHub Actions workflow data
  - Rerun failed workflows (when auto-approve is enabled)

- **`read:org`**: Read organization membership

  - List organizations you belong to
  - Access organization repositories
  - Read team memberships

- **`read:user`**: Read user profile information

  - Get authenticated user information
  - Read user profile data

- **`workflow`**: Access to GitHub Actions workflows
  - Read workflow run information
  - Rerun workflow runs (when auto-approve is enabled)
  - Access workflow logs and status

### Why These Scopes?

- **`repo`**: Required to read PR data and detect Copilot activity
- **`read:org`**: Needed to discover and monitor organization repositories
- **`read:user`**: Used for user-based PR filtering and authentication
- **`workflow`**: Enables automatic workflow rerun features

## OAuth Flow Process

### 1. Application Startup

When you first run the application:

```bash
npm start
```

If no valid authentication is found, the OAuth flow begins automatically.

### 2. Credential Input

The application prompts for:

- **GitHub OAuth Client ID**
- **GitHub OAuth Client Secret**

Enter the credentials from your OAuth App.

### 3. Browser Authorization

The application:

1. Starts a local HTTP server on port 3010
2. Opens your default browser to GitHub's OAuth authorization page
3. Shows the requested permissions
4. Waits for you to authorize the application

### 4. Authorization Completion

After clicking "Authorize" in GitHub:

1. GitHub redirects to `http://localhost:3010/callback`
2. The application receives the authorization code
3. Exchanges the code for an access token
4. Validates the token and stores it securely
5. Continues with repository configuration

## Security Features

### State Parameter Validation

The OAuth flow uses a cryptographically secure state parameter to prevent CSRF attacks:

```typescript
// Secure state generation
const state = crypto.randomBytes(20).toString("hex");
```

### Local Callback Server

The callback server:

- Only accepts connections from localhost
- Automatically shuts down after receiving the callback
- Has a 5-minute timeout for security
- Validates the state parameter before processing

### Token Storage

OAuth tokens are:

- **Encrypted at rest** using AES-256 encryption
- **Stored locally** in your system's config directory
- **Never transmitted** except to GitHub's API
- **Automatically cleaned up** when expired

### Secure Configuration

Configuration files have restricted permissions:

```bash
# Configuration directory permissions
chmod 700 ~/.config/copilot-pr-monitor/

# Configuration file permissions
chmod 600 ~/.config/copilot-pr-monitor/auth.json
```

## Troubleshooting OAuth Issues

### Common Problems and Solutions

#### 1. Browser Doesn't Open

**Problem**: OAuth flow starts but browser doesn't open automatically

**Solutions**:

```bash
# Check for browser issues
# Try manually opening: http://localhost:3010/auth

# Check port availability
lsof -i :3010

# Use different port if needed
npm start -- --port 8080
# Update OAuth app callback URL to: http://localhost:8080/callback
```

#### 2. Callback URL Mismatch

**Problem**: "The redirect_uri MUST match the registered callback URL"

**Solutions**:

1. Verify OAuth app callback URL is exactly: `http://localhost:3010/callback`
2. Check for typos (http vs https, trailing slashes, etc.)
3. Ensure port matches (default is 3010)

#### 3. Invalid Client Credentials

**Problem**: "Bad credentials" or "Client ID/Secret invalid"

**Solutions**:

1. Verify Client ID and Secret are correct
2. Check for extra spaces or characters
3. Regenerate Client Secret if needed
4. Ensure OAuth App is not suspended

#### 4. Authorization Denied

**Problem**: User denies authorization or scope access

**Solutions**:

```bash
# Restart OAuth flow
npm start -- --config

# Check organization OAuth app restrictions
# Contact organization admin if needed
```

#### 5. Insufficient Scopes

**Problem**: Application warns about missing scopes

**Solutions**:

```bash
# Re-run OAuth flow to get required scopes
npm start -- --config

# Check organization OAuth app restrictions
# Verify OAuth app has access to required organizations
```

### Advanced Troubleshooting

#### Debug OAuth Flow

Enable debug mode to see detailed OAuth flow information:

```bash
DEBUG=oauth npm start
```

This shows:

- OAuth URLs and parameters
- State parameter generation and validation
- Token exchange process
- Scope validation details

#### Manual Token Validation

Test OAuth token manually:

```bash
# Test basic authentication (replace YOUR_TOKEN)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.github.com/user

# Check token scopes
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -I https://api.github.com/user \
     | grep x-oauth-scopes
```

#### Reset Authentication

Clear stored credentials and restart OAuth flow:

```bash
# Remove stored authentication
rm ~/.config/copilot-pr-monitor/auth.json

# Restart OAuth flow
npm start
```

## Organization Considerations

### OAuth App Access

For organization repositories, the OAuth app may need approval:

1. **Organization OAuth App Restrictions**: Some organizations restrict OAuth app access
2. **Admin Approval**: Organization admins may need to approve your OAuth app
3. **Member Permissions**: Ensure you have access to the repositories you want to monitor

### Shared OAuth Apps

For team use, consider creating a shared OAuth app:

1. **Create under organization account**: Use the organization's GitHub account
2. **Share Client ID**: Client ID can be shared (not secret)
3. **Individual authentication**: Each user still needs to authenticate individually
4. **Centralized management**: Organization admins can manage the OAuth app

## Production Considerations

### Long-term Token Management

- **Token Refresh**: GitHub OAuth tokens don't expire, but can be revoked
- **Token Validation**: Application validates tokens on startup
- **Graceful Handling**: Automatic re-authentication when tokens become invalid

### Security Best Practices

- **Keep Client Secret secure**: Never commit or share Client Secret
- **Regular Review**: Periodically review OAuth app access and permissions
- **Monitor Usage**: Check OAuth app usage in GitHub settings
- **Revoke When Needed**: Revoke tokens when no longer needed

### Backup and Recovery

```bash
# Backup OAuth app credentials (keep secure)
echo "Client ID: YOUR_CLIENT_ID" > oauth-backup.txt
echo "Client Secret: YOUR_CLIENT_SECRET" >> oauth-backup.txt

# Store in secure location (not in version control)
```

## Next Steps

After successful OAuth setup:

1. **[Repository Configuration](./configuration.md)**: Configure repositories to monitor
2. **[User Guide](../user-guide.md)**: Learn how to use the application
3. **[Troubleshooting](./troubleshooting.md)**: Solve common issues

For ongoing use, the OAuth setup is a one-time process. The application will automatically use stored credentials for future sessions.
