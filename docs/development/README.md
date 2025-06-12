# Development Guide

Comprehensive guide for developers working on the Copilot Neural Swarm.

## Quick Start for Developers

### Prerequisites

```bash
# Required software
Node.js >= 18.0.0
npm >= 8.0.0
TypeScript >= 5.0.0
Git >= 2.30.0

# Recommended tools
Visual Studio Code with TypeScript extension
GitHub CLI (gh) for testing authentication
```

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/cloudify/copilot-swarm.git
cd copilot-swarm

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run linting
npm run lint:check
```

### Development Scripts

```bash
# Development with auto-compilation and restart
npm run dev

# Build TypeScript to JavaScript
npm run build

# Type checking without compilation
npm run type-check

# Linting
npm run lint:check    # Check for issues
npm run lint          # Fix issues automatically

# Debug mode
npm run debug         # Run with debug logging
DEBUG=true npm start  # Environment variable approach
```

## Project Structure

```
src/
├── components/           # React/Ink UI components
│   ├── ui/              # Reusable UI components
│   ├── AuthFlow.tsx     # OAuth authentication flow
│   ├── ConfigFlow.tsx   # Repository configuration
│   ├── MainDisplay.tsx  # Main monitoring interface
│   └── Console.tsx      # Activity logging
├── hooks/               # Custom React hooks
│   ├── useSafeState.ts  # Safe state management
│   ├── useAnimation.ts  # Terminal animations
│   └── index.ts         # Hook exports
├── utils/               # Business logic utilities
│   ├── github.ts        # GitHub API client
│   ├── oauth.ts         # OAuth flow implementation
│   ├── config.ts        # Configuration management
│   ├── searchQueries.ts # GitHub search optimization
│   └── textUtils.ts     # Safe text utilities
├── types/               # TypeScript type definitions
│   ├── index.ts         # Core types
│   └── safeTypes.ts     # Safe rendering types
├── styles/              # CSS styles
│   └── crt.css         # Terminal styling
└── App.tsx             # Main application entry
```

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes with live reload
npm run dev

# Test your changes
npm start

# Build and verify
npm run build
npm run lint:check

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

### 2. Code Standards

#### TypeScript Guidelines

**Strict Typing**: Always use explicit types

```typescript
// ✅ Good: Explicit interface definitions
interface PullRequestData {
  id: number;
  title: string;
  state: "open" | "closed" | "draft";
}

// ❌ Bad: Any types
function processData(data: any): any {
  return data.something;
}

// ✅ Good: Generic types with constraints
function processResponse<T extends PullRequestData>(data: T): T {
  return { ...data, processed: true };
}
```

**Error Handling**: Comprehensive error handling

```typescript
// ✅ Good: Type-safe error handling
async function fetchData(): Promise<PullRequest[]> {
  try {
    const response = await githubAPI.get<PullRequest[]>("/pulls");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      debugLog("API Error", {
        status: error.response?.status,
        message: error.message,
      });
      throw new Error(
        `GitHub API Error: ${error.response?.status || "Unknown"}`
      );
    }
    throw error;
  }
}
```

#### React/Ink Component Guidelines

**Safe Rendering**: Always use safe rendering patterns

```typescript
// ✅ Good: Safe text rendering
const PullRequestTitle: React.FC<{ title: string }> = ({ title }) => {
  return <SafeText>{title || "Untitled Pull Request"}</SafeText>;
};

// ❌ Bad: Direct rendering without safety
const BadComponent: React.FC<{ title: string }> = ({ title }) => {
  return <Text>{title}</Text>; // Can crash if title is empty
};

// ✅ Good: Conditional rendering with fallbacks
const StatusDisplay: React.FC<{ status?: CopilotStatus }> = ({ status }) => {
  return (
    <Box>
      {status ? (
        <SafeText>{status}</SafeText>
      ) : (
        <SafeText>No Status Available</SafeText>
      )}
    </Box>
  );
};
```

### 3. Testing Guidelines

#### Unit Tests

```typescript
// Component testing example
describe("SafeText Component", () => {
  it("should render text content safely", () => {
    const { getByText } = render(<SafeText>Valid content</SafeText>);
    expect(getByText("Valid content")).toBeInTheDocument();
  });

  it("should handle empty strings gracefully", () => {
    const { container } = render(<SafeText>{""}</SafeText>);
    expect(container.textContent).toBe(" ");
  });

  it("should handle null/undefined values", () => {
    const { container } = render(<SafeText>{null as any}</SafeText>);
    expect(container.textContent).toBe(" ");
  });
});
```

#### Integration Tests

```typescript
// API integration testing
describe("GitHub API Integration", () => {
  beforeEach(() => {
    mockGitHubAPI.reset();
  });

  it("should fetch pull requests with proper error handling", async () => {
    const mockPRs = [
      /* mock data */
    ];
    mockGitHubAPI.onGet("/search/issues").reply(200, { items: mockPRs });

    const result = await fetchUserPullRequests("testuser");
    expect(result).toHaveLength(mockPRs.length);
    expect(result[0]).toMatchObject({
      id: expect.any(Number),
      title: expect.any(String),
      state: expect.stringMatching(/open|closed|draft/),
    });
  });
});
```

## Common Development Tasks

### Adding New Features

#### 1. New UI Component

```typescript
// Create component file: src/components/NewComponent.tsx
import React from "react";
import { Box } from "ink";
import { SafeText } from "./ui/SafeText";

interface NewComponentProps {
  data: string;
  isLoading?: boolean;
}

export const NewComponent: React.FC<NewComponentProps> = ({
  data,
  isLoading = false,
}) => {
  if (isLoading) {
    return <SafeText>Loading...</SafeText>;
  }

  return (
    <Box>
      <SafeText>{data || "No data available"}</SafeText>
    </Box>
  );
};
```

#### 2. New API Integration

```typescript
// Add to src/utils/github.ts
export async function fetchNewData(token: string): Promise<NewDataType[]> {
  const client = createGitHubClient(token);

  try {
    const response = await resilientAPICall(
      () => client.get<NewDataType[]>("/new-endpoint"),
      3, // maxRetries
      1000 // baseDelay
    );

    return response.data.map(normalizeNewData);
  } catch (error) {
    debugLog("Failed to fetch new data", error);
    throw new Error("Unable to fetch new data from GitHub");
  }
}

function normalizeNewData(raw: any): NewDataType {
  return {
    id: raw.id,
    name: raw.name || "Unknown",
    // ... other normalized fields
  };
}
```

#### 3. New Configuration Option

```typescript
// Add to src/types/index.ts
interface AppConfig {
  // ... existing fields
  newOption?: boolean;
}

// Add to src/utils/config.ts
export async function saveNewOption(value: boolean): Promise<void> {
  const config = await loadConfig();
  config.newOption = value;
  await saveConfig(config);
}

// Add command line option in src/App.tsx
program.option("--new-option", "Enable new feature").parse();

const options = program.opts();
```

### Debugging Common Issues

#### 1. Ink Rendering Errors

**Problem**: Application crashes with "Cannot read property 'type' of undefined"

**Solution**: Use SafeText components and check for empty values

```typescript
// ❌ Problematic code
<Text>{someValue}</Text>

// ✅ Fixed code
<SafeText>{someValue || 'Default value'}</SafeText>
```

#### 2. GitHub API Rate Limiting

**Problem**: API calls fail with 403 rate limit errors

**Solution**: Implement proper rate limiting and caching

```typescript
// Check rate limit headers
const remaining = response.headers["x-ratelimit-remaining"];
const reset = response.headers["x-ratelimit-reset"];

if (remaining === "0") {
  const resetTime = new Date(parseInt(reset) * 1000);
  const waitTime = resetTime.getTime() - Date.now();
  await new Promise((resolve) => setTimeout(resolve, waitTime));
}
```

#### 3. OAuth Flow Issues

**Problem**: OAuth callback fails or hangs

**Solution**: Check OAuth app configuration and port availability

```bash
# Verify OAuth app settings
# - Callback URL: http://localhost:3000/callback
# - Ensure port 3000 is available

# Test OAuth flow in debug mode
DEBUG=true npm start -- --config
```

### Performance Optimization

#### 1. Efficient State Updates

```typescript
// ✅ Good: Batch state updates
const [state, setState] = useState({
  prs: [],
  loading: false,
  error: null,
});

// Update multiple fields together
setState((prev) => ({
  ...prev,
  prs: newPRs,
  loading: false,
  error: null,
}));
```

#### 2. Memory Management

```typescript
// ✅ Good: Cleanup in useEffect
useEffect(() => {
  const timer = setInterval(fetchData, refreshInterval);

  return () => {
    clearInterval(timer);
  };
}, [refreshInterval]);

// ✅ Good: Limit log entries
const MAX_LOGS = 1000;
const addLog = useCallback((newLog: LogEntry) => {
  setLogs((prev) => [newLog, ...prev].slice(0, MAX_LOGS));
}, []);
```

#### 3. API Request Optimization

```typescript
// ✅ Good: Batch API requests
const fetchMultipleRepos = async (repos: string[]): Promise<PullRequest[]> => {
  const batchSize = 5;
  const batches = chunk(repos, batchSize);

  const results = await Promise.all(
    batches.map((batch) =>
      Promise.all(batch.map((repo) => fetchRepoPulls(repo)))
    )
  );

  return results.flat(2);
};
```

## Development Tools

### VS Code Configuration

Recommended `.vscode/settings.json`:

```json
{
  "typescript.preferences.noSemicolons": "off",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.includePackageJsonAutoImports": "on"
}
```

### ESLint Configuration

The project includes comprehensive ESLint rules:

```bash
# Check for linting issues
npm run lint:check

# Auto-fix issues
npm run lint

# Manually run ESLint
npx eslint src/ --ext .ts,.tsx
```

### Debugging Tools

#### 1. Debug Mode

```bash
# Enable debug logging
DEBUG=true npm start

# Enable specific debug categories
DEBUG=github npm start
DEBUG=oauth npm start
DEBUG=* npm start  # All debug output
```

#### 2. Node.js Debugging

```bash
# Run with Node.js debugger
node --inspect-brk dist/index.js

# Connect with VS Code debugger
# Add launch configuration in .vscode/launch.json
```

#### 3. GitHub API Testing

```bash
# Test GitHub API with curl
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     https://api.github.com/user

# Test search queries
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     "https://api.github.com/search/issues?q=is:pr+is:open+assignee:username"
```

## Contribution Guidelines

### Pull Request Process

1. **Fork and Branch**: Create feature branch from main
2. **Development**: Make changes following code standards
3. **Testing**: Add tests for new functionality
4. **Documentation**: Update relevant documentation
5. **PR Submission**: Submit PR with clear description
6. **Code Review**: Address review feedback
7. **Merge**: Squash and merge when approved

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

**Types**: feat, fix, docs, style, refactor, test, chore

**Examples**:

```
feat(oauth): add automatic token refresh
fix(ui): prevent crash on empty PR titles
docs(readme): update installation instructions
```

### Code Review Checklist

- [ ] TypeScript types are properly defined
- [ ] Components use safe rendering patterns
- [ ] Error handling is comprehensive
- [ ] Performance considerations addressed
- [ ] Documentation is updated
- [ ] Tests are included (when applicable)
- [ ] No sensitive data in code or logs

## Resources

- **[Architecture Documentation](../architecture.md)**: Technical architecture details
- **[User Guide](../user-guide.md)**: End-user documentation
- **[Troubleshooting Guide](../guides/troubleshooting.md)**: Common issues and solutions
- **[GitHub API Documentation](https://docs.github.com/en/rest)**: GitHub REST API reference
- **[Ink Documentation](https://github.com/vadimdemedes/ink)**: Terminal UI framework docs
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)**: TypeScript language reference
