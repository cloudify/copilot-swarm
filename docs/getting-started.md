# Getting Started

Welcome to the Copilot Neural Swarm! This guide will help you get up and running quickly.

## Prerequisites

- **Node.js**: Version 16 or higher
- **npm**: Version 8 or higher
- **GitHub Account**: With access to repositories you want to monitor
- **GitHub OAuth App**: Required for authentication (we'll help you create this)

## Quick Installation

```bash
# Clone the repository
git clone https://github.com/cloudify/copilot-swarm.git
cd copilot-swarm

# Install dependencies
npm install

# Start the application
npm start
```

## First-Time Setup

When you run the application for the first time, you'll be guided through:

### 1. GitHub OAuth App Creation

The application will guide you to create a GitHub OAuth App:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the form:
   - **Application name**: `Copilot Neural Swarm`
   - **Homepage URL**: `http://localhost:3010`
   - **Authorization callback URL**: `http://localhost:3010/callback`
4. Save the **Client ID** and **Client Secret**

### 2. Authentication

After setting up your OAuth App:

1. Enter your Client ID and Client Secret when prompted
2. The application will open your browser for GitHub authorization
3. Sign in to GitHub and authorize the application
4. You'll be redirected back automatically

### 3. Configuration

Choose which repositories to monitor:

1. Select organizations (if you have access to any)
2. Choose specific repositories from your selections
3. Save your configuration

## Basic Usage

Once configured, the application will:

- **Monitor Pull Requests**: Shows PRs assigned to both you and GitHub Copilot
- **Real-time Updates**: Automatically refreshes every 30 seconds
- **Status Tracking**: Displays current Copilot activity status
- **Activity Logging**: Shows API calls and system events

## Command Line Options

```bash
# Basic usage
npm start

# Reconfigure repositories
npm start -- --config

# Custom refresh interval (60 seconds)
npm start -- --interval 60

# Look back 7 days for PRs (default: 3 days)
npm start -- --days 7

# Use different port
npm start -- --port 8080

# Don't open browser automatically
npm start -- --no-open

# Show help
npm start -- --help
```

## Understanding the Interface

```
┌─ 🤖 Copilot Neural Swarm ──────────────────────────────────┐
├─ PR Title ─┬─ Repository ─┬─ PR # ─┬─ Copilot Status ────┤
│ Fix bug... │ org/repo     │ #123  │ 🔄 Copilot Working   │
│ Add feat...│ org/other    │ #124  │ ⏳ Waiting for...    │
└────────────┴──────────────┴───────┴─────────────────────┘
┌─ 📜 Activity Logs ───────────────────────────────────────┐
│ [14:30:15] 🔄 Refreshing pull requests...                │
│ [14:30:16] ✅ Loaded 5 PRs from org/repo                 │
└──────────────────────────────────────────────────────────┘
┌─ 📊 Stats ─────────────────────── ⏱️ Next refresh: 25s ─┘
```

### Status Indicators

- **🔄 Copilot Working**: Active Copilot session detected
- **⏳ Waiting for Feedback**: Copilot completed, awaiting review
- **❌ Error**: Copilot encountered an error
- **ℹ️ No Activity**: No recent Copilot events found

## Next Steps

- **[User Guide](./user-guide.md)**: Complete feature documentation
- **[OAuth Setup Guide](./guides/oauth-setup.md)**: Detailed OAuth configuration
- **[Troubleshooting](./guides/troubleshooting.md)**: Common issues and solutions
- **[Configuration Guide](./guides/configuration.md)**: Advanced configuration options

## Need Help?

If you encounter issues:

1. Try running with debug mode: `DEBUG=true npm start`
2. Check the [Troubleshooting Guide](./guides/troubleshooting.md)
3. Review the [User Guide](./user-guide.md) for detailed information
