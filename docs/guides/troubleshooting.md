# Troubleshooting Guide

Common issues and solutions for the Copilot Neural Swarm.

## Quick Troubleshooting

### Enable Debug Mode

First step for any issue - enable debug logging:

```bash
DEBUG=true npm start
```

This shows detailed information about:

- GitHub API requests and responses
- Authentication flow details
- Search queries and results
- Repository parsing logic

## Common Issues

### 1. No Pull Requests Found

**Symptom**: Application shows "No Copilot PRs found"

**Causes and Solutions**:

#### Check PR Assignment

**Problem**: PRs aren't assigned to both you and Copilot
**Solution**:

1. Ensure PRs are assigned to your GitHub username
2. Also assign "Copilot" as an additional assignee
3. Verify assignments in GitHub's PR interface

#### Verify Repository Access

**Problem**: You don't have access to configured repositories
**Solution**:

```bash
# Reconfigure repositories
npm start -- --config

# Check your organization memberships in GitHub
# Verify repository permissions
```

#### Check Time Range

**Problem**: No recent PR activity
**Solution**:

```bash
# Look back more days (default: 3 days)
npm start -- --days 7

# Or extend search timeframe
npm start -- --days 14
```

#### OAuth Permission Issues

**Problem**: Insufficient OAuth scopes
**Solution**:

```bash
# Re-authenticate with proper scopes
npm start -- --config

# Required scopes: repo, read:org, read:user, workflow
```

### 2. Repository Shows as "unknown/unknown"

**Symptom**: PRs display with repository info as "unknown/unknown"

**Status**: ✅ **This is automatically handled**

The application now:

- Extracts repository info from PR URLs when GitHub API data is incomplete
- Falls back gracefully to URL parsing
- Successfully fetches events even with parsed repository info

If you still see "unknown/unknown":

1. Check that PR URLs are valid GitHub URLs
2. Verify network connectivity
3. Enable debug mode to see parsing details

### 3. Authentication Issues

#### OAuth Flow Fails

**Symptoms**:

- Browser doesn't open
- Redirect fails after authorization
- "Invalid state parameter" error

**Solutions**:

**Check OAuth App Configuration**:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Verify your OAuth App settings:
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/callback`
3. Ensure Client ID and Secret are correct

**Port Conflicts**:

```bash
# Check if port 3000 is in use
lsof -i :3000

# Use different port if needed
npm start -- --port 8080
```

**Browser Issues**:

```bash
# Try different browser
# Clear browser cache and cookies
# Disable browser extensions temporarily
```

#### Token Validation Fails

**Symptoms**:

- "Invalid token" errors
- Authentication required repeatedly

**Solutions**:

```bash
# Clear stored credentials and re-authenticate
rm -rf ~/.config/copilot-pr-monitor/
npm start -- --config

# Or delete specific auth file
rm ~/.config/copilot-pr-monitor/auth.json
npm start
```

### 4. API Rate Limiting

**Symptoms**:

- "Rate limit exceeded" errors
- Slow or failed API responses
- 403 HTTP status codes

**Solutions**:

**Increase Refresh Interval**:

```bash
# Use longer polling intervals
npm start -- --interval 60    # 60 seconds
npm start -- --interval 120   # 2 minutes
```

**Reduce Repository Count**:

```bash
# Monitor fewer repositories
npm start -- --config
# Select only essential repositories
```

**Check Rate Limit Status**:

```bash
# Check current rate limit (requires token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.github.com/rate_limit
```

**GitHub API Limits**:

- **Authenticated requests**: 5,000 per hour
- **Search API**: 30 requests per minute
- **Reset time**: Shown in debug output

### 5. Network and Connectivity Issues

#### GitHub API Unreachable

**Symptoms**:

- Connection timeout errors
- DNS resolution failures
- Network connectivity issues

**Solutions**:

```bash
# Test GitHub API connectivity
curl -I https://api.github.com

# Check DNS resolution
nslookup api.github.com

# Test with different network
# Check firewall/proxy settings
```

#### Corporate Proxy Issues

**Symptoms**:

- API calls fail in corporate networks
- SSL certificate errors

**Solutions**:

```bash
# Configure npm proxy settings
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Set environment variables
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
```

### 6. Application Crashes

#### Ink Rendering Errors

**Symptoms**:

- Application crashes with React/Ink errors
- "Cannot read property 'type' of undefined"
- Empty string rendering errors

**Status**: ✅ **This should be resolved**

The application uses safe rendering components. If crashes still occur:

1. **Update to Latest Version**:

   ```bash
   git pull origin main
   npm install
   npm run build
   ```

2. **Check for Empty Data**:

   ```bash
   # Enable debug mode to see data flow
   DEBUG=true npm start
   ```

3. **Report the Issue**:
   - Note the exact error message
   - Include debug output
   - Provide steps to reproduce

#### Memory Issues

**Symptoms**:

- Application becomes slow over time
- High memory usage
- Out of memory errors

**Solutions**:

```bash
# Restart the application periodically
# Monitor memory usage with system tools

# Check Node.js memory usage
node --max-old-space-size=4096 dist/index.js
```

### 7. Configuration Issues

#### Configuration File Corruption

**Symptoms**:

- Application fails to start
- "Invalid configuration" errors
- Repeated authentication prompts

**Solutions**:

```bash
# Reset configuration
rm -rf ~/.config/copilot-pr-monitor/
npm start -- --config

# Or backup and restore
cp -r ~/.config/copilot-pr-monitor/ ~/backup-config/
rm -rf ~/.config/copilot-pr-monitor/
npm start -- --config
```

#### Missing Configuration Directory

**Symptoms**:

- Permission denied errors
- Cannot save configuration

**Solutions**:

```bash
# Create config directory manually
mkdir -p ~/.config/copilot-pr-monitor/
chmod 700 ~/.config/copilot-pr-monitor/

# Check disk space
df -h ~/.config/
```

## Platform-Specific Issues

### macOS

#### Keychain Access Issues

```bash
# Reset keychain permissions if needed
security delete-generic-password -s "copilot-pr-monitor"

# Check system permissions
# System Preferences > Security & Privacy > Privacy
```

#### Gatekeeper Issues

```bash
# If Node.js is blocked by Gatekeeper
sudo spctl --master-disable  # Temporary, re-enable after use
```

### Windows

#### PowerShell Execution Policy

```powershell
# Enable script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Path Issues

```cmd
# Ensure Node.js is in PATH
node --version
npm --version

# Reinstall Node.js if not found
```

### Linux

#### Permission Issues

```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) ~/.config

# Or use nvm for Node.js management
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

## Advanced Troubleshooting

### Detailed Logging

#### Enable Specific Debug Categories

```bash
# GitHub API only
DEBUG=github npm start

# OAuth flow only
DEBUG=oauth npm start

# All categories
DEBUG=* npm start

# Multiple categories
DEBUG=github,oauth npm start
```

#### Log File Output

```bash
# Redirect output to file
DEBUG=true npm start 2>&1 | tee debug.log

# Analyze logs
grep "ERROR" debug.log
grep "Rate limit" debug.log
```

### GitHub API Testing

#### Manual API Testing

```bash
# Test authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     https://api.github.com/user

# Test search functionality
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     "https://api.github.com/search/issues?q=is:pr+is:open+assignee:yourusername"

# Check rate limits
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.github.com/rate_limit
```

#### Validate OAuth Scopes

```bash
# Check token scopes
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -I https://api.github.com/user

# Look for X-OAuth-Scopes header
# Should include: repo, read:org, read:user, workflow
```

### Performance Analysis

#### Monitor Resource Usage

```bash
# Memory usage
ps aux | grep node

# CPU usage
top -p $(pgrep -f copilot-monitor)

# Network activity
netstat -an | grep 3000
```

#### Profile API Calls

```bash
# Time API responses
time curl -H "Authorization: Bearer YOUR_TOKEN" \
          https://api.github.com/user

# Monitor API call frequency in debug output
DEBUG=github npm start | grep -E "(GET|POST|PUT|DELETE)"
```

## Getting Help

### Information to Collect

When reporting issues, please include:

1. **System Information**:

   ```bash
   node --version
   npm --version
   uname -a  # Linux/macOS
   ```

2. **Error Messages**:

   ```bash
   # Full error output with debug enabled
   DEBUG=true npm start 2>&1 | tee error.log
   ```

3. **Configuration**:

   ```bash
   # Sanitized config (remove sensitive tokens)
   ls -la ~/.config/copilot-pr-monitor/
   ```

4. **GitHub API Access**:
   ```bash
   # Test basic API access (remove token from output)
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://api.github.com/user
   ```

### Support Channels

1. **Check Documentation**:

   - [User Guide](../user-guide.md)
   - [Development Guide](../development/README.md)
   - [Architecture Documentation](../architecture.md)

2. **Enable Debug Mode**: `DEBUG=true npm start`

3. **Check GitHub Repository**: Issues and discussions

4. **Community Support**: GitHub discussions and community forums

### Escalation Process

1. **Basic Troubleshooting**: Follow this guide
2. **Advanced Debugging**: Enable debug mode and analyze logs
3. **Issue Reporting**: Create GitHub issue with detailed information
4. **Community Help**: Ask in discussions or community forums

Remember: Most issues can be resolved by reconfiguring authentication or adjusting repository selections. When in doubt, try:

```bash
# Complete reset and reconfiguration
rm -rf ~/.config/copilot-pr-monitor/
npm start -- --config
```
