# Copilot Neural Swarm - AI Agent Instructions

## Project Overview

The **Copilot Neural Swarm** is a real-time terminal user interface (TUI) tool for monitoring GitHub Copilot activity across pull requests in organizational repositories. Built with TypeScript for enhanced reliability and type safety, this tool provides a sophisticated monitoring solution with OAuth authentication, repository configuration, and live status tracking.

### Core Purpose

- Monitor GitHub Copilot activity across multiple repositories and organizations
- Provide real-time status updates through a terminal-based interface
- Track pull request states and associated Copilot jobs
- Offer debugging capabilities through activity logs and status metrics

### Key Features

- 🔐 Secure GitHub OAuth authentication with scope verification
- ⚙️ Interactive repository and organization configuration
- 🧱 Full-screen terminal UI with multi-column display
- 🔁 Configurable auto-refresh intervals (default: 30 seconds)
- 🤖 Real-time Copilot status detection and tracking
- 📜 Activity logging with timestamped debug information
- 📊 Live statistics on PRs, active Copilot jobs, and monitored repositories
- 🛡️ Type-safe implementation preventing runtime errors

## Technology Stack

### Core Framework

- **TypeScript 5.0+**: Primary language for type safety and compile-time error checking
- **Node.js**: Runtime environment with CommonJS module system
- **React 17**: Component framework for UI structure
- **Ink 3.2**: React-based terminal UI framework for cross-platform TUI

### API & Networking

- **Axios**: HTTP client for GitHub API interactions with interceptors and error handling
- **GitHub REST API v3**: Primary data source for repository and pull request information

### CLI & Configuration

- **Commander.js**: Command-line argument parsing and CLI interface
- **Conf**: Cross-platform configuration storage and management
- **dotenv**: Environment variable management for development

### Development Tools

- **ESLint 9**: Code linting with TypeScript and React rules
- **@typescript-eslint**: TypeScript-specific ESLint plugins and parser
- **ts-node**: Development-time TypeScript execution
- **Babel**: JSX transformation and React preset handling

## Architecture Overview

### Application Flow

```
index.ts (CLI Entry) → App.tsx (Main Coordinator) → [AuthFlow | ConfigFlow | MainDisplay]
```

### Core Components

1. **AuthFlow**: Handles GitHub token authentication and validation
2. **ConfigFlow**: Manages organization and repository selection
3. **MainDisplay**: Primary monitoring interface with real-time updates
4. **GitHubAPI**: Centralized API client with rate limiting and error handling
5. **Config Utils**: Secure configuration storage and retrieval

### Type System Architecture

All data structures are strongly typed through `src/types/index.ts`:

- `PullRequest`, `GitHubRepository`, `Organization`: GitHub API response types
- `CopilotStatus`: Enumerated status states for Copilot activity
- `AuthFlowProps`, `ConfigFlowProps`, `MonitorViewProps`: Component interfaces
- `LogEntry`: Structured logging with timestamps and severity levels

## Development Standards

### TypeScript Requirements

- **Strict Mode**: All strict TypeScript compiler options enabled
- **No Any Types**: Explicit typing required for all variables and function parameters
- **Null Safety**: Strict null checks to prevent runtime errors
- **Return Types**: Explicit return types for all functions and methods
- **Interface Definitions**: All component props and data structures must be typed

### Code Style & Formatting

- **String Literals**: Use double quotes consistently (`"string"`)
- **Function Style**: Prefer arrow functions for callbacks and inline functions
- **Async Patterns**: Use async/await over Promise chains for better readability
- **React Patterns**: Functional components with hooks only (no class components)
- **Import Style**: Named imports preferred, default exports for components
- **Naming Conventions**: PascalCase for components, camelCase for functions/variables

### Error Handling Patterns

```typescript
// Preferred error handling pattern
try {
  const result = await apiCall();
  return result;
} catch (error) {
  if (error instanceof Error) {
    console.error(`Operation failed: ${error.message}`);
  }
  throw error; // Re-throw for upstream handling
}
```

### React/Ink Best Practices

- **Empty Text Prevention**: Never render empty strings directly in JSX
- **Conditional Rendering**: Always check for truthy values before rendering text
- **Text Wrapping**: All text content must be wrapped in `<Text>` components
- **Component Structure**: Use `<Box>` for layout, `<Text>` for content display
- **State Management**: Use React hooks (useState, useEffect) for state management

### Common Anti-Patterns to Avoid

```typescript
// ❌ DON'T: Render empty strings
{
  error && <Text>{error}</Text>;
} // If error is "", this crashes

// ✅ DO: Validate before rendering
{
  error && error.trim() && <Text color="red">{error}</Text>;
}

// ❌ DON'T: Use any types
function processData(data: any): any {}

// ✅ DO: Define proper interfaces
interface ProcessedData {
  id: string;
  value: number;
}
function processData(data: RawData): ProcessedData {}
```

## Testing & Quality Assurance

### Linting Requirements

- Run `npm run lint:check` before committing code
- All ESLint errors must be resolved (warnings acceptable with justification)
- Custom rules specifically target Ink rendering issues and empty string problems
- TypeScript compilation must succeed without errors

### Manual Testing Checklist

1. **Authentication Flow**: Test with valid/invalid tokens
2. **Repository Selection**: Verify organization and repository listing
3. **Real-time Updates**: Confirm refresh intervals and data accuracy
4. **Error Scenarios**: Test network failures, API rate limits, invalid repositories
5. **UI Responsiveness**: Verify layout at different terminal sizes

### Performance Considerations

- **API Rate Limiting**: Respect GitHub API limits (5000 requests/hour for authenticated users)
- **Refresh Intervals**: Default 30 seconds, configurable via CLI
- **Memory Management**: Clean up intervals and event listeners in useEffect cleanup
- **Batch Operations**: Group API calls where possible to minimize requests

## GitHub Integration

### Required Token Scopes

- `repo`: Access to repository data and pull requests
- `workflow`: Access to GitHub Actions for Copilot event detection

### API Endpoints Used

- `/user`: Token validation and user information
- `/user/orgs`: Organization listing for authenticated user
- `/orgs/{org}/repos`: Repository listing for organizations
- `/repos/{owner}/{repo}/pulls`: Pull request retrieval
- `/repos/{owner}/{repo}/events`: Event tracking for Copilot activity

### Rate Limit Handling

- Monitor `X-RateLimit-Remaining` headers
- Implement exponential backoff for rate limit exceeded scenarios
- Display rate limit information in debug logs

## Configuration Management

### Storage Locations

- **macOS/Linux**: `~/.config/copilot-pr-monitor/`
- **Windows**: `%APPDATA%/copilot-pr-monitor/`

### Configuration Structure

```typescript
interface AppConfig {
  token?: string; // GitHub personal access token
  organizations?: string[]; // Selected organizations to monitor
  repositories?: string[]; // Selected repositories to monitor
  refreshInterval?: number; // Auto-refresh interval in seconds
}
```

### Security Considerations

- Tokens stored in system-secure configuration directories
- No token logging or console output
- Validate token scopes before accepting configuration

## Troubleshooting & Debugging

### Common Issues

1. **Empty String Rendering**: Check all conditional text rendering
2. **API Authentication**: Verify token scopes and expiration
3. **Repository Access**: Confirm user permissions for selected repositories
4. **Rate Limiting**: Monitor API usage and adjust refresh intervals

### Debug Information

- Enable verbose logging in development mode
- Activity log panel shows real-time API calls and responses
- Status metrics provide quick health checks
- Error boundaries prevent complete application crashes

### Migration Notes

This project was migrated from JavaScript to TypeScript to address persistent empty string rendering errors. The migration provides:

- Compile-time error detection
- Improved IDE support and autocomplete
- Better maintainability and debugging capabilities
- Elimination of runtime crashes from type-related issues

## Contributing Guidelines

### Code Review Checklist

- [ ] All new code written in TypeScript with proper type annotations
- [ ] ESLint passes without errors
- [ ] TypeScript compilation succeeds
- [ ] No empty string rendering in React components
- [ ] Proper error handling with typed catch blocks
- [ ] Configuration changes tested across platforms
- [ ] API interactions respect rate limits
- [ ] Component props properly typed and documented

### Development Workflow

1. **Setup**: `npm install` to install dependencies
2. **Development**: `npm run dev` for auto-compilation and testing
3. **Building**: `npm run build` to compile TypeScript
4. **Linting**: `npm run lint` to fix auto-fixable issues
5. **Testing**: `npm start` to test production build

### Future Enhancements

- WebSocket integration for real-time GitHub events
- Enhanced filtering and search capabilities
- Export functionality for monitoring data
- Multi-tenant support for different GitHub instances
- Plugin architecture for custom Copilot status detection
