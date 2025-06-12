# User Guide

Complete guide to using the Copilot Neural Swarm application.

## Overview

The Copilot Neural Swarm is a real-time dashboard for monitoring GitHub Copilot activity across pull requests in your organization's repositories. It provides a terminal-based interface that shows active Copilot sessions, completed work awaiting review, and comprehensive activity logging.

## Features

### 🔐 Secure Authentication

- **GitHub OAuth Integration**: Secure browser-based authentication
- **No Manual Tokens**: Eliminates need for personal access tokens
- **Automatic Scope Management**: Requests only necessary permissions

### ⚙️ Repository Configuration

- **Organization Support**: Monitor multiple GitHub organizations
- **Selective Monitoring**: Choose specific repositories to watch
- **Auto-discovery**: Intelligent repository detection and configuration

### ⚡ Real-time Monitoring

- **Live Updates**: Configurable refresh intervals (default: 30 seconds)
- **Copilot Status Detection**: Real-time monitoring of Copilot activity
- **Event Tracking**: Comprehensive GitHub event analysis

### 📊 Comprehensive Dashboard

- **Pull Request Table**: Multi-column view of PRs with status indicators
- **Activity Logs**: Real-time logging of API calls and system events
- **Status Metrics**: Live statistics on PRs and active Copilot sessions
- **Responsive Design**: Adapts to terminal size changes

## How It Works

### PR Discovery Model

The application uses a **dual-assignment filtering model**:

1. **Primary Search**: Finds all open PRs assigned to the authenticated user
2. **Copilot Filter**: Shows only PRs that are also assigned to "Copilot"
3. **Status Analysis**: Examines GitHub events to determine Copilot activity

This approach provides:

- ✅ **Reliable Results**: Overcomes GitHub API limitations with bot searches
- ✅ **Personalized View**: Shows only PRs relevant to you
- ✅ **Collaborative Focus**: Highlights AI-human workflows

### Status Detection

The application monitors GitHub events to detect:

- **🔄 Copilot Working**: Active Copilot session detected
- **⏳ Waiting for Feedback**: Copilot completed, awaiting review
- **❌ Error**: Copilot encountered an error
- **ℹ️ No Activity**: No recent Copilot events found

## Getting Started

### Initial Setup

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **First Run**:

   ```bash
   npm start
   ```

3. **Follow Setup Wizard**:
   - Create GitHub OAuth App
   - Authenticate with GitHub
   - Select repositories to monitor

### OAuth App Configuration

When prompted, create a GitHub OAuth App with:

- **Application name**: `Copilot PR Monitor` (or your preference)
- **Homepage URL**: `http://localhost:3000`
- **Authorization callback URL**: `http://localhost:3000/callback`

**Required Scopes**:

- `repo` - Access to repository data and workflow reruns
- `read:org` - Read organization membership
- `read:user` - Read user profile information
- `workflow` - Access to GitHub Actions workflows

## Using the Application

### Basic Commands

```bash
# Start monitoring
npm start

# Reconfigure repositories
npm start -- --config

# Change refresh interval to 60 seconds
npm start -- --interval 60

# Look back 7 days for PRs (default: 3)
npm start -- --days 7

# Use custom port
npm start -- --port 8080

# Don't open browser automatically
npm start -- --no-open

# Disable automatic features
npm start -- --no-auto-fix --no-auto-approve
```

### Interface Overview

The terminal interface consists of four main sections:

#### 1. Header Bar

Shows application title and current status.

#### 2. Pull Request Table

Displays active PRs with columns:

- **Title**: PR title (truncated to fit)
- **Repository**: Owner/repo format
- **PR Number**: GitHub PR number with link
- **Copilot Status**: Current activity status

#### 3. Activity Log

Real-time logging showing:

- API requests and responses
- Authentication events
- Configuration changes
- Error messages and warnings

#### 4. Status Bar

Live metrics including:

- Total PR count
- Active Copilot sessions
- Repository count
- Next refresh countdown

### Navigation and Controls

- **Ctrl+C**: Exit the application
- **Automatic Refresh**: Updates every 30 seconds (configurable)
- **Real-time Logging**: Activity log updates continuously

## Advanced Features

### Automatic Actions

The application can automatically:

- **Auto-fix**: Request Copilot to fix failing checks (includes sample error logs from failed jobs)
- **Auto-approve**: Rerun pending workflow runs
- **Resume on Failure**: Restart monitoring after rate limits

Disable with command line flags:

```bash
npm start -- --no-auto-fix --no-auto-approve --no-resume-on-failure
```

### Debug Mode

Enable detailed logging:

```bash
DEBUG=true npm start
```

Debug mode shows:

- GitHub API requests and responses
- Search queries and filters
- Authentication flow details
- Repository parsing logic

### Development Mode

For development with auto-compilation:

```bash
npm run dev
```

## Configuration

### Storage Locations

Configuration is stored in your system's config directory:

- **Linux/macOS**: `~/.config/copilot-pr-monitor/`
- **Windows**: `%APPDATA%/copilot-pr-monitor/`

### Configuration Files

- **config.json**: Repository and organization selections
- **auth.json**: OAuth tokens and credentials (encrypted)

### Manual Configuration

You can manually edit configuration files, but it's recommended to use:

```bash
npm start -- --config
```

## Monitoring Workflow

### Typical Development Workflow

1. **Developer creates PR**: Standard GitHub PR creation
2. **Assign to yourself**: Add yourself as assignee
3. **Assign to Copilot**: Add "Copilot" as additional assignee
4. **Monitor shows PR**: Application detects the dual assignment
5. **Copilot works**: Status shows "🔄 Copilot Working"
6. **Copilot completes**: Status changes to "⏳ Waiting for Feedback"
7. **Developer reviews**: Provide feedback or approve changes
8. **Cycle continues**: Process repeats for iterations

### Best Practices

- **Consistent Assignment**: Always assign both yourself and Copilot
- **Regular Monitoring**: Check the dashboard regularly for status updates
- **Prompt Feedback**: Respond quickly when Copilot is waiting for feedback
- **Error Handling**: Address errors promptly when they occur

## Integration with Development Tools

### GitHub CLI Integration

The application works alongside GitHub CLI:

```bash
# View PR in browser
gh pr view 123 --web

# Check PR status
gh pr status

# Review PR changes
gh pr review 123
```

### IDE Integration

While the monitor runs in terminal, you can:

- Keep it running in a dedicated terminal tab
- Use split terminal views in VS Code
- Run alongside other development tools

## Performance and Limits

### API Rate Limits

- **GitHub API Limit**: 5,000 requests/hour for authenticated users
- **Automatic Handling**: Application respects rate limits
- **Optimization**: Efficient queries reduce API usage

### System Requirements

- **Memory**: ~50MB RAM usage
- **CPU**: Minimal CPU usage during monitoring
- **Network**: Regular API calls (configurable frequency)

### Scaling Considerations

For large organizations:

- **Increase Refresh Interval**: Use `--interval 60` or higher
- **Selective Monitoring**: Monitor only essential repositories
- **Multiple Instances**: Run separate instances for different teams

## Next Steps

- **[Configuration Guide](./guides/configuration.md)**: Advanced configuration options
- **[Troubleshooting Guide](./guides/troubleshooting.md)**: Common issues and solutions
- **[Development Guide](./development/README.md)**: Contributing and development setup
- **[Architecture Documentation](./architecture.md)**: Technical architecture details
