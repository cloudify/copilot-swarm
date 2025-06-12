# Configuration Guide

Complete guide to configuring the Copilot Neural Swarm application.

## Configuration Overview

The Copilot Neural Swarm stores configuration in your system's standard config directory with secure encryption for sensitive data.

### Storage Locations

- **Linux/macOS**: `~/.config/copilot-pr-monitor/`
- **Windows**: `%APPDATA%/copilot-pr-monitor/`

### Configuration Files

- **config.json**: Repository and organization selections, application settings
- **auth.json**: OAuth tokens and credentials (encrypted)

## Initial Configuration

### Interactive Setup

Run the configuration wizard:

```bash
npm start -- --config
```

This will guide you through:

1. **OAuth App Setup**: GitHub OAuth application configuration
2. **Authentication**: Browser-based GitHub authorization
3. **Organization Selection**: Choose organizations to monitor
4. **Repository Selection**: Select specific repositories

### Command Line Configuration

```bash
# Force reconfiguration (skip existing settings)
npm start -- --config

# Set refresh interval during startup
npm start -- --interval 60

# Set PR lookback period
npm start -- --days 7

# Custom port for OAuth callback
npm start -- --port 8080

# Disable automatic features
npm start -- --no-auto-fix --no-auto-approve --no-resume-on-failure
```

## OAuth Configuration

### Creating GitHub OAuth App

1. **Navigate to GitHub Developer Settings**:

   - Go to [https://github.com/settings/developers](https://github.com/settings/developers)
   - Click "New OAuth App"

2. **Fill Application Details**:

   ```
   Application name: Copilot PR Monitor
   Homepage URL: http://localhost:3000
   Application description: Real-time GitHub Copilot PR monitoring tool
   Authorization callback URL: http://localhost:3000/callback
   ```

3. **Save Credentials**:
   - Copy the **Client ID**
   - Generate and copy the **Client Secret**
   - Keep these secure - they're needed for authentication

### Required OAuth Scopes

The application automatically requests these scopes:

- **`repo`**: Full access to repositories (required for PR data and workflow access)
- **`read:org`**: Read organization membership and team data
- **`read:user`**: Read user profile information
- **`user:email`**: Read user email addresses
- **`workflow`**: Access to GitHub Actions workflows (for rerun functionality)

### OAuth Security

- **State Parameter**: CSRF protection with cryptographically secure random state
- **Local Server**: Temporary HTTP server for callback handling
- **Token Encryption**: OAuth tokens encrypted at rest
- **Timeout Protection**: 5-minute timeout for OAuth flow completion

## Repository Configuration

### Organization Selection

**Automatic Discovery**: The application automatically discovers:

- Organizations you're a member of
- Organizations your OAuth token has access to
- Public organizations you can access

**Selection Options**:

- Select all organizations
- Choose specific organizations
- Include/exclude personal repositories

### Repository Selection

**Discovery Methods**:

- **Organization Repositories**: All repos in selected organizations
- **Personal Repositories**: Your personal public and private repos
- **Collaborative Repositories**: Repos you contribute to

**Filtering Options**:

- Repository name patterns
- Activity-based filtering (recently updated)
- Access level filtering (admin, write, read)

### Repository Configuration Examples

```bash
# Monitor all repositories in an organization
Organizations: ["my-org", "another-org"]
Repositories: ["*"]  # All repos in selected orgs

# Monitor specific repositories only
Organizations: []
Repositories: [
  "my-org/important-repo",
  "my-org/critical-project",
  "personal-user/my-project"
]

# Mixed configuration
Organizations: ["my-org"]  # All repos in my-org
Repositories: [
  "other-org/specific-repo",  # Plus specific repos from other orgs
  "personal-user/side-project"
]
```

## Application Settings

### Refresh Configuration

**Refresh Interval**: How often to check for PR updates

```bash
# Set refresh interval (in seconds)
npm start -- --interval 30   # 30 seconds (default)
npm start -- --interval 60   # 1 minute
npm start -- --interval 300  # 5 minutes
```

**PR Lookback Period**: How far back to search for PRs

```bash
# Set lookback period (in days)
npm start -- --days 3    # 3 days (default)
npm start -- --days 7    # 1 week
npm start -- --days 14   # 2 weeks
```

### Network Configuration

**Port Configuration**: Custom port for OAuth callback

```bash
# Default port (3000)
npm start

# Custom port
npm start -- --port 8080

# Update OAuth app callback URL accordingly:
# http://localhost:8080/callback
```

**Timeout Settings**: API request timeout configuration

```bash
# Default timeout is 30 seconds
# Modify in source if needed for slow networks
```

## Advanced Configuration

### Manual Configuration Editing

**⚠️ Warning**: Direct file editing can break the application. Use the interactive configuration when possible.

#### Configuration File Structure

```json
{
  "organizations": ["org1", "org2"],
  "repositories": ["org1/repo1", "org2/repo2"],
  "refreshInterval": 30,
  "lookbackDays": 3,
  "autoFeatures": {
    "autoFix": true,
    "autoApprove": true,
    "resumeOnFailure": true
  },
  "ui": {
    "theme": "dark",
    "showDebug": false
  }
}
```

#### Authentication File Structure

```json
{
  "clientId": "encrypted_client_id",
  "clientSecret": "encrypted_client_secret",
  "accessToken": "encrypted_access_token",
  "tokenType": "Bearer",
  "scope": "repo read:org read:user workflow",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

### Environment Variables

Override configuration with environment variables:

```bash
# GitHub OAuth settings
export GITHUB_CLIENT_ID="your_client_id"
export GITHUB_CLIENT_SECRET="your_client_secret"

# Application settings
export COPILOT_MONITOR_PORT=8080
export COPILOT_MONITOR_INTERVAL=60
export COPILOT_MONITOR_DEBUG=true

# Start with environment overrides
npm start
```

### Configuration Validation

**Automatic Validation**: The application validates configuration on startup:

- OAuth credentials validity
- Repository access permissions
- Network connectivity to GitHub
- Configuration file integrity

**Manual Validation**:

```bash
# Test configuration
DEBUG=true npm start --config

# Validate OAuth token
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.github.com/user

# Test repository access
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.github.com/repos/owner/repo
```

## Configuration Backup and Migration

### Backup Configuration

```bash
# Backup entire configuration directory
tar -czf copilot-monitor-backup-$(date +%Y%m%d).tar.gz \
  ~/.config/copilot-pr-monitor/

# Backup specific files
cp ~/.config/copilot-pr-monitor/config.json ~/config-backup.json
```

### Restore Configuration

```bash
# Restore from backup
tar -xzf copilot-monitor-backup-*.tar.gz -C ~/

# Restore specific file
cp ~/config-backup.json ~/.config/copilot-pr-monitor/config.json
```

### Migration Between Systems

1. **Export Configuration** (source system):

   ```bash
   # Note: Don't copy auth.json as tokens are machine-specific
   cp ~/.config/copilot-pr-monitor/config.json ~/transfer-config.json
   ```

2. **Import Configuration** (target system):

   ```bash
   # Copy repository/org selections only
   mkdir -p ~/.config/copilot-pr-monitor/
   cp ~/transfer-config.json ~/.config/copilot-pr-monitor/config.json

   # Re-authenticate on new system
   npm start -- --config
   ```

## Organization-Wide Configuration

### Shared OAuth App

For organization-wide deployment:

1. **Create Organization OAuth App**:

   - Use organization GitHub account
   - Set appropriate callback URLs for all instances
   - Share Client ID (Client Secret should be secure)

2. **Centralized Configuration**:

   ```bash
   # Set shared OAuth app details
   export GITHUB_CLIENT_ID="org_oauth_client_id"

   # Users still need individual authentication
   npm start -- --config
   ```

### Team Configuration Templates

**Create Configuration Templates**:

```json
{
  "organizations": ["my-company"],
  "repositories": ["my-company/*"],
  "refreshInterval": 60,
  "lookbackDays": 7,
  "autoFeatures": {
    "autoFix": false,
    "autoApprove": false,
    "resumeOnFailure": true
  }
}
```

**Deploy Templates**:

```bash
# Copy template to user config
cp org-template-config.json ~/.config/copilot-pr-monitor/config.json

# User completes authentication
npm start -- --config
```

## Security Configuration

### Token Security

**Encryption**: All sensitive data is encrypted at rest using:

- AES-256 encryption
- Secure key derivation
- Machine-specific encryption keys

**Permissions**: Configuration files have restricted permissions:

```bash
# Secure configuration directory
chmod 700 ~/.config/copilot-pr-monitor/
chmod 600 ~/.config/copilot-pr-monitor/*
```

### Network Security

**HTTPS Only**: All GitHub API communications use HTTPS
**No Sensitive Data**: Logs don't contain tokens or secrets
**Local Only**: OAuth callback server only accepts localhost connections

### Access Control

**Minimal Scopes**: Request only necessary OAuth permissions
**Token Validation**: Regular token health checks
**Automatic Cleanup**: Expired tokens are automatically removed

## Troubleshooting Configuration

### Common Configuration Issues

#### Invalid OAuth Configuration

```bash
# Symptoms: Authentication fails repeatedly
# Solution: Verify OAuth app settings and re-authenticate
npm start -- --config
```

#### Repository Access Denied

```bash
# Symptoms: "No repositories found" or access errors
# Solution: Check organization membership and permissions
DEBUG=true npm start -- --config
```

#### Configuration File Corruption

```bash
# Symptoms: Application fails to start
# Solution: Reset configuration
rm -rf ~/.config/copilot-pr-monitor/
npm start -- --config
```

### Configuration Validation Commands

```bash
# Test OAuth token validity
curl -H "Authorization: Bearer $(cat ~/.config/copilot-pr-monitor/auth.json | jq -r .accessToken)" \
     https://api.github.com/user

# Validate repository access
DEBUG=true npm start | grep "Found repositories"

# Check configuration syntax
node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.HOME + '/.config/copilot-pr-monitor/config.json')))"
```

## Next Steps

- **[User Guide](../user-guide.md)**: Learn how to use the configured application
- **[Troubleshooting Guide](./troubleshooting.md)**: Solve configuration issues
- **[OAuth Setup Guide](./oauth-setup.md)**: Detailed OAuth configuration
- **[Development Guide](../development/README.md)**: Development and customization
