export interface GitHubTokenVerification {
  valid: boolean;
  scopes: string[];
  user?: {
    login: string;
    id: number;
    name?: string;
  };
  rateLimitRemaining?: number;
  rateLimitReset?: number;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed" | "draft";
  user: {
    login: string;
  };
  assignees?: Array<{
    login: string;
    id: number;
  }>;
  created_at: string;
  updated_at: string;
  head?: {
    ref: string;
    sha: string;
  };
  base?: {
    ref: string;
    repo: {
      name: string;
      full_name: string;
      owner: {
        login: string;
        id: number;
      };
    };
  };
  repository?: {
    name: string;
    full_name: string;
  };
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description?: string;
  updated_at: string;
  owner: {
    login: string;
    id: number;
  };
}

export interface Organization {
  id: number;
  login: string;
  description?: string;
  avatar_url: string;
}

export interface CopilotEventData {
  action: string;
  copilot_state?: string;
  pull_request?: PullRequest;
}

export type CopilotStatus =
  | "Copilot Working"
  | "Waiting for Feedback"
  | "Error"
  | "No Copilot Activity"
  | "Max Copilot sessions reached";

export interface PullRequestWithCopilotStatus extends PullRequest {
  copilotStatus: CopilotStatus;
}

export interface AppConfig {
  token?: string;
  clientId?: string;
  clientSecret?: string;
  organizations?: string[];
  repositories?: string[];
  refreshInterval?: number;
}

export interface AuthFlowProps {
  onAuthComplete: (token: string) => void;
}

export interface ConfigFlowProps {
  token: string;
  onConfigComplete: (organizations: string[], repositories: string[]) => void;
}

export interface MonitorViewProps {
  token: string;
  organizations: string[];
  repositories: string[];
  refreshInterval: number;
  days: number;
  resumeOnFailure: boolean;
  autoFix: boolean;
  autoApprove: boolean;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

export interface CopilotEvent {
  id: number;
  event: string;
  created_at: string;
  actor?: {
    login: string;
  };
  raw_payload?: {
    message?: string;
  };
  message?: string;
}

export interface CheckRun {
  id: number;
  name: string;
  status: string;
  conclusion?: string;
  started_at?: string;
  completed_at?: string;
}

export interface CommitStatus {
  id: number;
  state: string;
  context: string;
  description?: string;
  updated_at?: string;
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion?: string;
  head_sha: string;
  head_branch: string;
  created_at: string;
  updated_at: string;
}

export interface PullRequestEvent {
  timestamp?: Date;
  status: CopilotStatus;
  color: string;
  emoji: string;
  time: string;
  state: "working" | "waiting" | "failed" | "idle" | "max_sessions_reached";
  event_word: string;
  status_msg: string;
  wait_minutes?: number;
}

export interface IssueComment {
  id: number;
  body: string;
  created_at: string;
  user: {
    login: string;
  };
}

// UI Enhancement Types
export type ThemeType = "green" | "amber" | "blue" | "red" | "cyan" | "magenta";

export interface FontConfig {
  primary: string;
  display: string;
  size: "small" | "medium" | "large";
}

export interface EffectConfig {
  scanlines: boolean;
  glow: boolean;
  flicker: boolean;
  chromaticAberration: boolean;
  rasterBars: boolean;
  glitchTransitions: boolean;
}

export interface TerminalSize {
  width: number;
  height: number;
  columns: number;
  rows: number;
}

export interface BootMessage {
  text: string;
  delay: number;
  type?: "normal" | "error" | "success" | "warning";
}

export interface Command {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<string> | string;
  animation?: string;
}

export interface ConsoleState {
  history: string[];
  currentInput: string;
  isProcessing: boolean;
  cursor: boolean;
}
