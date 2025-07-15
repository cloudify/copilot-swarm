# Copilot Neural Swarm - AI Agent Instructions

## Project Overview

The **Copilot Neural Swarm** is a sophisticated terminal-based UI tool for monitoring GitHub Copilot activity across pull requests. This is **NOT** a traditional CLI monitoring tool - it's a **hybrid web/terminal application** with dual interfaces: a React-based web UI served via Express and an enhanced terminal UI built with modern web technologies.

### Core Architecture Pattern

**Dual UI System**: The application runs as a hybrid:
- **Web Interface** (`src/server.ts`): Express server with React UI at http://localhost:3000  
- **Terminal Interface** (`src/App.tsx`): Enhanced terminal UI using Framer Motion, Tailwind, and CRT effects
- **Monitor Engine** (`src/MonitorEngine.ts`): Core business logic shared between both interfaces

Both interfaces communicate with the same underlying `MonitorEngine` which handles GitHub API integration, state management, and real-time updates.

### Current Implementation Status

**🚨 CRITICAL**: The app is in transition. The terminal UI components have been extensively modernized with:
- Framer Motion animations and GSAP effects
- Tailwind CSS styling system
- Advanced CRT terminal effects (scanlines, glow, flicker)
- "Hacker-style" neural interface with command routing

The web UI exists but may be out of sync with terminal UI features.

## Technology Stack

### Core Framework
- **TypeScript 5.0+**: Type safety with strict mode enabled
- **React 19**: Functional components with hooks only
- **Express**: Web server for dual-interface architecture  
- **Framer Motion**: Advanced animations and transitions
- **Tailwind CSS**: Utility-first styling system

### Terminal Enhancement
- **CRT Effects**: `src/styles/crt.css` provides retro terminal aesthetics
- **GSAP**: Animation library for complex effects
- **Command Router**: `src/components/CommandRouter.tsx` handles terminal commands

## Development Patterns

### Safe Rendering Architecture

**CRITICAL PATTERN**: This codebase has strict anti-empty-string rendering due to past crashes:

```typescript
// ❌ NEVER: Direct empty string rendering
{error && <Text>{error}</Text>}

// ✅ ALWAYS: Validate before rendering
{error && error.trim() && <Text color="red">{error}</Text>}
```

All text must be wrapped in proper components and validated for empty/undefined values.

### Component Structure Standards

```typescript
// Standard component pattern
interface ComponentProps {
  // Always type props explicitly
  data: SomeType;
  onAction: (value: string) => void;
}

const Component: React.FC<ComponentProps> = ({ data, onAction }) => {
  // Use functional components with hooks only
  const [state, setState] = useState<StateType>(initialValue);
  
  return (
    <motion.div>  {/* Framer Motion for animations */}
      <Text>{data.title || "Default text"}</Text>
    </motion.div>
  );
};
```

### GitHub API Integration Pattern

The GitHub API client (`src/utils/github.ts`) follows a specific pattern:

```typescript
// Always check authentication first
if (!this.api) {
  throw new Error("API not initialized");
}

// Use streaming for performance  
for await (const item of this.api.iterResults(query)) {
  // Process items individually
  await this.processItem(item);
}

// Handle rate limiting automatically
const response = await this.client.get(url);
// Rate limiting is handled by interceptors
```

## Key Development Commands

```bash
# Terminal interface development
npm run dev                    # Development with tsx
npm run dev:enhanced          # Development with Tailwind watch

# Building and testing
npm run build                 # TypeScript compilation
npm start                     # Production build + run
npm run lint                  # ESLint with TypeScript rules

# Debugging
npm run debug                 # Debug mode with environment vars
DEBUG=true npm run dev        # Verbose logging
```

## Critical File Patterns

### State Machine Architecture

The application uses a sophisticated state machine pattern (`src/utils/stateMachine.ts`) for PR status management:

```typescript
// State transitions for PR monitoring
type PRState = "idle" | "working" | "waiting" | "failed" | "max_sessions";

// Each state has specific transition rules and side effects
const transitions = {
  idle: ["working"],
  working: ["waiting", "failed"],
  // ... etc
};
```

### Configuration Management

**Location**: `src/utils/config.ts`
- Cross-platform config storage using `conf` package
- Encrypted OAuth token storage
- Organization/repository selection persistence

```typescript
// Configuration is environment-aware
const config = new Conf<AppConfig>({
  projectName: "copilot-pr-monitor",
  encryptionKey: process.env.ENCRYPTION_KEY || "default-key"
});
```

### Dual Refresh System

The `MonitorEngine` implements dual refresh intervals:
- **Fast refresh** (15s): Active PRs with ongoing Copilot activity
- **Slow refresh** (60s): Stable PRs without recent changes

This optimizes API usage while maintaining real-time updates for active work.

## Common Pitfalls & Solutions

### 1. Component Rendering Issues
- **Problem**: Empty strings crash the terminal UI
- **Solution**: Always validate text content before rendering
- **Pattern**: Use safe rendering utilities from `src/utils/textUtils.ts`

### 2. GitHub API Rate Limits  
- **Problem**: 5000 requests/hour limit can be hit quickly
- **Solution**: Use the streaming APIs and batch operations
- **Monitor**: Check `X-RateLimit-Remaining` headers

### 3. State Synchronization
- **Problem**: Web and terminal UIs can get out of sync
- **Solution**: All state changes go through `MonitorEngine`
- **Pattern**: Use event-driven updates via the server layer

### 4. Animation Performance
- **Problem**: Complex CRT effects can slow down terminal
- **Solution**: Effects are configurable in `FIXED_EFFECT_CONFIG`
- **Debug**: Disable effects when debugging core functionality

## Architecture Decision Records

### Why Dual Interface?
The application started as a terminal-only tool but evolved to include a web interface for better accessibility and sharing. Both interfaces share the same core engine for consistency.

### Why Framer Motion in Terminal?
Modern terminal emulators support complex CSS and animations. The enhanced UI provides better UX while maintaining the "hacker terminal" aesthetic.

### Why TypeScript Migration?
The project was migrated from JavaScript to TypeScript specifically to prevent runtime crashes from empty string rendering and improve developer experience.

## Testing Strategy

```bash
# Run linting (required before commits)
npm run lint:check

# Test individual components
npm run build && node dist/index.js --config

# Debug specific features
DEBUG=true tsx src/debug-specific-feature.ts
```

The codebase emphasizes compile-time safety over extensive unit testing, relying on TypeScript's type system and ESLint rules to catch issues early.
