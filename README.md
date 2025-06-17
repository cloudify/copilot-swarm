# Copilot Neural Swarm

A real-time terminal dashboard for monitoring GitHub Copilot activity across pull requests in your organization's repositories. Command your AI clone army with this hacker-style neural interface.

**Built with TypeScript for enhanced reliability and type safety.**

## ⚠️ Security Disclaimer

**Important**: This tool requires access to your GitHub repositories and monitors Copilot activity. Please be aware:

- The tool accesses repository data and pull request information
- OAuth tokens are stored locally in your system configuration directory
- **Use responsibly**: Do not abuse monitoring capabilities or violate GitHub's terms of service
- **Enterprise users**: Ensure compliance with your organization's security policies
- **Data privacy**: Be mindful of what repositories you monitor, especially those containing sensitive information

## 🚨 Cost Warning - Automated Workflows

**CRITICAL**: This tool will automatically instruct the Copilot agent to fix issues and will automatically run workflows once the agent is done. **This process will be repeated indefinitely and may result in very high usage of GitHub Action runner minutes, incurring significant costs.**

- **Set billing limits**: Configure spending limits in your GitHub billing settings before using this tool
- **Monitor usage**: Regularly check your GitHub Actions usage and costs
- **Understand automation**: The tool runs continuously and triggers workflows automatically
- **Enterprise impact**: High runner minute usage can quickly exceed organizational budgets

**By using this tool, you acknowledge that you understand these cost implications and will monitor and limit your GitHub Actions usage appropriately.**

By using this tool, you acknowledge that you understand these implications and will use it responsibly and in accordance with GitHub's terms of service.

## Features

- 🖥️ **Terminal Dashboard** - Beautiful terminal interface with real-time updates
- 🔐 **Secure GitHub OAuth Authentication** - Full OAuth flow with browser-based authorization
- ⚙️ **Repository Configuration** - Select organizations and repositories to monitor
- ⚡ **Real-time Updates** - Live pull request status updates
- 🔁 **Auto-refresh** - Configurable refresh intervals (default: 30 seconds)
- 🤖 **AI Swarm Control** - Real-time monitoring of your Copilot clone army
- 🔥 **Neural Interface** - Enhanced hacker-style terminal with CRT effects
- 📜 **Activity Logs** - Debug panel showing API calls and system activity
- 📊 **Status Metrics** - Live statistics on PRs and active Copilot jobs
- 🛡️ **Type Safety** - TypeScript implementation prevents runtime errors
- 📱 **Responsive Design** - Adapts to terminal size changes

## Quick Start

```bash
# Install dependencies
npm install

# Start the application
npm start
```

On first launch, you'll be guided through:

1. **OAuth App Setup** - Create a GitHub OAuth App (guided setup)
2. **Browser Authorization** - Authorize the application via your browser
3. **Repository Selection** - Choose organizations and repositories to monitor

## Documentation

📚 **Complete documentation is available in the [`docs/`](./docs/) directory:**

- **[Getting Started](./docs/getting-started.md)** - Installation, setup, and first-time configuration
- **[User Guide](./docs/user-guide.md)** - Complete user manual and feature documentation
- **[Configuration Guide](./docs/guides/configuration.md)** - Advanced configuration options
- **[Troubleshooting Guide](./docs/guides/troubleshooting.md)** - Common issues and solutions
- **[Architecture Documentation](./docs/architecture.md)** - Technical architecture and design
- **[Development Guide](./docs/development/README.md)** - Developer setup and contribution guidelines

## Basic Usage

```bash
# Start monitoring
npm start

# Reconfigure repositories
npm start -- --config

# Clean local status (clear all paused PRs)
npm start -- --clean-status

# Custom refresh interval (60 seconds)
npm start -- --interval 60

# Look back 7 days for PRs (default: 3)
npm start -- --days 7

# Show help
npm start -- --help
```

````

## Understanding the Interface

The terminal interface shows:

- **Pull Request Table**: PRs assigned to both you and GitHub Copilot
- **Activity Log**: Real-time API calls and system events
- **Status Bar**: Live metrics and refresh countdown
- **Copilot Status**: Current Copilot activity state

### Status Indicators

- **🔄 AI Clone Working**: Active neural swarm detected
- **⏳ Waiting for Feedback**: Minion completed task, awaiting orders
- **❌ Error**: Neural network malfunction detected
- **ℹ️ No Activity**: Swarm idle, no recent neural events

## Requirements

- **Node.js**: Version 16 or higher
- **GitHub Account**: With access to repositories you want to monitor
- **GitHub OAuth App**: Required for authentication (setup is guided)

## Development

```bash
# Development mode with auto-compilation
npm run dev

# Build TypeScript
npm run build

# Run linting
npm run lint:check

# Debug mode
DEBUG=true npm start
````

## License

MIT License - See package.json for details.
