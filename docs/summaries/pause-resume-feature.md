# Pause/Resume Automation Feature

## Overview

This feature adds the ability to pause and resume automation features (auto-fix, auto-approve, and resume-on-failure) in the GitHub Copilot PR Monitor. You can pause automation globally or for individual pull requests, and the pause state persists across server restarts.

## Implementation

### Core Components

#### 1. PauseManager (`src/utils/pauseManager.ts`)

- **Purpose**: Manages pause state persistence and provides APIs for pause/resume operations
- **Storage**: Uses JSON file at `~/.config/copilot-pr-monitor/pause-state.json`
- **Key Methods**:
  - `shouldPauseAutomation(prIdentifier?)`: Check if automation should be paused
  - `pauseGlobally()` / `resumeGlobally()`: Global pause/resume
  - `pausePullRequest(id)` / `resumePullRequest(id)`: PR-specific pause/resume
  - `getStatus()`: Get current pause state
  - `clearAll()`: Clear all pause states

#### 2. Server API Endpoints (`src/server.ts`)

- **GET** `/api/pause/status` - Get current pause status
- **POST** `/api/pause/global` - Pause all automation globally
- **POST** `/api/resume/global` - Resume all automation globally
- **POST** `/api/pause/pr` - Pause automation for specific PR (body: `{prIdentifier}`)
- **POST** `/api/resume/pr` - Resume automation for specific PR (body: `{prIdentifier}`)
- **POST** `/api/pause/clear` - Clear all pause states

#### 3. GitHub API Integration (`src/utils/github.ts`)

- **Pause Checks**: Added pause checks before all automation actions:
  - Auto-fix posting comments to Copilot
  - Auto-approve rerunning workflows
  - Resume-on-failure posting nudge comments
- **PR Identification**: Uses PR URL as unique identifier for pause state

#### 4. Web Interface (`public/index.html`)

- **Global Toggle Control**: Single button that toggles between "Pause All" and "Resume All"
- **PR-specific Toggle Controls**: Individual toggle button for each PR in the table
- **Visual States**: Buttons change appearance (yellow background) when in paused state
- **Status Display**: Shows global pause status and count of paused PRs
- **Real-time Updates**: WebSocket integration for live pause status updates

### Features

#### Global Pause/Resume

- **Toggle Control**: Single button that switches between pause/resume actions
- **Visual Feedback**: Button appears yellow when automation is paused
- **Status Indicator**: Shows "Automation: Paused" when globally paused
- **Resume All**: Resumes all automation features globally
- **Status Indicator**: Shows "Automation: Paused" when globally paused

#### PR-specific Pause/Resume

- **Individual Toggle Control**: Single button per PR that toggles between pause/resume
- **Visual States**: Buttons turn yellow when PR automation is paused
- **Status Tracking**: Shows count of individually paused PRs

#### Persistence

- **File Storage**: Pause state saved to `~/.config/copilot-pr-monitor/pause-state.json`
- **Server Restart Safe**: State survives server restarts
- **Timestamps**: Records when pauses/resumes occurred

#### User Interface

- **Toggle Buttons**: Single buttons that change text and appearance based on state
- **Visual States**: Paused buttons have yellow background with dark text
- **Activity Log**: All pause/resume actions logged to activity feed
- **Real-time Updates**: Immediate UI updates via WebSocket

### Usage

#### Via Web Interface

1. **Global Control**: Click the toggle button in control bar (shows "Pause All" or "Resume All")
2. **PR Control**: Click toggle buttons in the Actions column for each PR
3. **Visual Feedback**: Buttons change appearance when automation is paused
4. **Clear All**: Use "Clear Pauses" to remove all pause states

#### Via API

```bash
# Pause globally
curl -X POST http://localhost:3000/api/pause/global

# Resume globally
curl -X POST http://localhost:3000/api/resume/global

# Pause specific PR
curl -X POST http://localhost:3000/api/pause/pr \
  -H "Content-Type: application/json" \
  -d '{"prIdentifier": "https://github.com/owner/repo/pull/123"}'

# Resume specific PR
curl -X POST http://localhost:3000/api/resume/pr \
  -H "Content-Type: application/json" \
  -d '{"prIdentifier": "https://github.com/owner/repo/pull/123"}'

# Get status
curl http://localhost:3000/api/pause/status
```

### Behavior When Paused

When automation is paused (globally or for a specific PR):

- **Auto-fix**: Skips posting fix comments to Copilot
- **Auto-approve**: Skips rerunning failed workflows
- **Resume-on-failure**: Skips posting nudge comments
- **Logging**: Warning messages logged explaining why actions were skipped

### Error Handling

- **File System Errors**: Graceful fallback to default state if pause file can't be read/written
- **API Errors**: User-friendly error messages in web interface
- **Missing Data**: Safe defaults when pause data is incomplete

### Testing

Run the test script to verify functionality:

```bash
node test-pause.js
```

This tests all core functionality including persistence, global/PR-specific controls, and state management.

## Files Modified

1. `src/utils/pauseManager.ts` - New pause state manager
2. `src/server.ts` - Added pause/resume API endpoints
3. `src/MonitorEngine.ts` - Added pause manager import and client sync
4. `src/utils/github.ts` - Added pause checks before automation actions
5. `public/index.html` - Added pause/resume UI controls and functionality
6. `test-pause.js` - Test script for pause manager functionality

## Configuration

No additional configuration required. Pause state is automatically persisted to:

```
~/.config/copilot-pr-monitor/pause-state.json
```

The feature is ready to use immediately after the server starts.
