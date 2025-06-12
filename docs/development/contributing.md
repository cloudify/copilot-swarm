# Contributing Guide

Guide for contributing to the Copilot Neural Swarm project.

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **TypeScript**: Version 5 or higher
- **Git**: Version 2.30 or higher
- **GitHub Account**: For testing and contributions

### Development Setup

1. **Fork the Repository**

   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR-USERNAME/copilot-swarm.git
   cd copilot-swarm
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Verify Setup**
   ```bash
   npm run build    # Should compile successfully
   npm run lint:check  # Should pass without errors
   npm start        # Should start the application
   ```

## Development Workflow

### Creating Features

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Development with Live Reload**

   ```bash
   npm run dev      # Start development mode
   ```

3. **Make Changes Following Standards**

   - Use TypeScript for all new code
   - Follow safe rendering patterns for UI components
   - Implement comprehensive error handling
   - Add appropriate type definitions

4. **Test Your Changes**

   ```bash
   npm run build        # Verify TypeScript compilation
   npm run lint:check   # Check code quality
   npm start            # Test functionality
   DEBUG=true npm start # Test with debug logging
   ```

5. **Commit and Push**

   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**
   - Create PR against the main branch
   - Fill out the PR template
   - Link any related issues

## Code Standards

### TypeScript Requirements

**Strict Typing**: All code must use explicit TypeScript types

```typescript
// ✅ Good: Explicit interface definitions
interface PullRequestData {
  id: number;
  title: string;
  state: "open" | "closed" | "draft";
  assignees: GitHubUser[];
}

// ❌ Bad: Any types or implicit any
function processData(data: any): any {
  return data.something;
}

// ✅ Good: Generic types with constraints
function processResponse<T extends PullRequestData>(data: T): T {
  return { ...data, processed: true };
}
```

**Error Handling**: Comprehensive error handling with types

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

### React/Ink Component Standards

**Safe Rendering**: Always use safe rendering patterns

```typescript
// ✅ Good: Safe text rendering with fallbacks
const PullRequestTitle: React.FC<{ title: string }> = ({ title }) => {
  return <SafeText>{title || "Untitled Pull Request"}</SafeText>;
};

// ❌ Bad: Direct rendering without safety checks
const BadComponent: React.FC<{ title: string }> = ({ title }) => {
  return <Text>{title}</Text>; // Can crash if title is empty
};

// ✅ Good: Conditional rendering with safe defaults
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

### Code Organization

**File Structure**: Follow established patterns

```
src/
├── components/           # React/Ink components
│   ├── ui/              # Reusable UI components
│   ├── AuthFlow.tsx     # Feature-specific components
│   └── MainDisplay.tsx
├── hooks/               # Custom React hooks
├── utils/               # Business logic utilities
├── types/               # TypeScript type definitions
└── App.tsx             # Main application
```

**Import Organization**: Consistent import patterns

```typescript
// External libraries first
import React from "react";
import { Box, Text } from "ink";
import axios from "axios";

// Internal utilities
import { SafeText } from "./ui/SafeText";
import { debugLog } from "../utils/debug";
import type { PullRequest } from "../types";
```

## Documentation Standards

### Update Documentation

**Always update documentation** when making changes:

- **New Features**: Add to [User Guide](../user-guide.md)
- **API Changes**: Update [Architecture](../architecture.md)
- **Bug Fixes**: Update [Troubleshooting Guide](../guides/troubleshooting.md)
- **Development Changes**: Update [Development Guide](./README.md)

### Documentation Style

- **Clear headings** with proper hierarchy
- **Code examples** for complex concepts
- **Cross-references** to related documentation
- **Step-by-step instructions** for procedures

## Testing Guidelines

### Manual Testing

**Required testing for all changes**:

1. **Basic Functionality**

   ```bash
   npm start               # Test normal operation
   npm start -- --config  # Test configuration flow
   DEBUG=true npm start    # Test debug mode
   ```

2. **Error Scenarios**

   ```bash
   # Test with invalid token
   # Test with no network connection
   # Test with rate limiting
   ```

3. **Edge Cases**
   ```bash
   # Test with empty repositories
   # Test with long PR titles
   # Test with special characters
   ```

### Automated Testing

While comprehensive automated tests are not yet implemented, follow these patterns:

```typescript
// Component testing pattern
describe("SafeText Component", () => {
  it("should render text content safely", () => {
    const { getByText } = render(<SafeText>Valid content</SafeText>);
    expect(getByText("Valid content")).toBeInTheDocument();
  });

  it("should handle empty strings gracefully", () => {
    const { container } = render(<SafeText>{""}</SafeText>);
    expect(container.textContent).toBe(" ");
  });
});

// API integration testing pattern
describe("GitHub API Client", () => {
  it("should handle rate limiting gracefully", async () => {
    mockGitHubAPI.onGet("/user").reply(
      403,
      {},
      {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": Date.now() / 1000 + 60,
      }
    );

    await expect(fetchUser()).rejects.toThrow("Rate limit exceeded");
  });
});
```

## Pull Request Process

### PR Requirements

Before submitting a pull request, ensure:

- [ ] **Code compiles**: `npm run build` passes
- [ ] **Linting passes**: `npm run lint:check` passes
- [ ] **Manual testing**: Core functionality works
- [ ] **Documentation updated**: Relevant docs are updated
- [ ] **TypeScript types**: All new code is properly typed
- [ ] **Safe rendering**: UI components use safe patterns

### PR Template

Use this template for pull requests:

```markdown
## Description

Brief description of the changes made.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

- [ ] Manual testing completed
- [ ] Edge cases tested
- [ ] Error scenarios tested

## Documentation

- [ ] Documentation updated
- [ ] Code comments added where needed

## Checklist

- [ ] Code follows TypeScript standards
- [ ] Safe rendering patterns used
- [ ] Error handling implemented
- [ ] Linting passes
- [ ] Build succeeds
```

### Code Review Process

1. **Automated Checks**: Ensure all CI checks pass
2. **Code Review**: Address reviewer feedback promptly
3. **Documentation Review**: Verify documentation is accurate
4. **Final Testing**: Test the final version before merge

## Common Contribution Areas

### UI/UX Improvements

- **Enhanced Terminal Layout**: Improve information density and readability
- **Better Error Messages**: More user-friendly error reporting
- **Keyboard Shortcuts**: Add navigation and control shortcuts
- **Color Themes**: Support for different terminal color schemes

### Feature Enhancements

- **GitHub Enterprise Support**: Extend to GitHub Enterprise Server
- **Historical Tracking**: Store and display historical Copilot activity
- **Export Functionality**: CSV/JSON export of monitoring data
- **Notification System**: Configurable alerts for specific events

### Performance Optimizations

- **API Request Batching**: Optimize GitHub API usage
- **Intelligent Caching**: Reduce redundant API calls
- **Memory Management**: Optimize for long-running sessions
- **Response Time Improvements**: Faster data processing

### Developer Experience

- **Testing Framework**: Implement comprehensive test suite
- **Development Tools**: Enhanced debugging and profiling tools
- **Documentation**: Improve and expand documentation
- **Build Process**: Optimize build and deployment pipeline

## Getting Help

### Resources

- **[Development Guide](./README.md)**: Complete development documentation
- **[Architecture Documentation](../architecture.md)**: Technical architecture details
- **[User Guide](../user-guide.md)**: Understanding application functionality
- **[Troubleshooting Guide](../guides/troubleshooting.md)**: Common issues and solutions

### Community

- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and share ideas
- **Code Reviews**: Learn from reviewer feedback
- **Documentation**: Contribute to documentation improvements

### Support Channels

1. **Check existing documentation** for similar issues
2. **Search GitHub issues** for related problems
3. **Create new issue** with detailed description
4. **Join discussions** for community support

## Commit Message Guidelines

### Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```
feat(oauth): add automatic token refresh
fix(ui): prevent crash on empty PR titles
docs(readme): update installation instructions
refactor(api): improve error handling
```

### Best Practices

- **Keep it concise**: Under 50 characters for the subject line
- **Use imperative mood**: "Add feature" not "Added feature"
- **Reference issues**: Include issue numbers when applicable
- **Explain why**: Use body to explain reasoning for complex changes

## Release Process

### Version Management

The project follows semantic versioning:

- **Major**: Breaking changes
- **Minor**: New features, backwards compatible
- **Patch**: Bug fixes, backwards compatible

### Release Checklist

1. **Update documentation**: Ensure all docs are current
2. **Test thoroughly**: Complete manual testing
3. **Update version**: Follow semantic versioning
4. **Create release notes**: Document changes and improvements
5. **Tag release**: Create git tag for the release

Thank you for contributing to the Copilot Neural Swarm! Your contributions help make this tool better for everyone.
