/**
 * Common DOM manipulation utilities for SSR server to avoid code duplication
 */

// Type definitions for browser APIs
interface Element {
  textContent: string | null;
  classList: {
    add(className: string): void;
    remove(className: string): void;
  };
}

interface RequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

declare const fetch: (url: string, init?: RequestInit) => Promise<Response>;

interface Response {
  ok: boolean;
  status: number;
  json(): Promise<any>;
}

/**
 * Common CSS class management for pause/resume buttons
 */
export function updateButtonState(button: Element, isPaused: boolean): void {
  if (isPaused) {
    button.textContent = '▶️ Resume';
    button.classList.add('paused-state');
  } else {
    button.textContent = '⏸️ Pause';
    button.classList.remove('paused-state');
  }
}

/**
 * Common pattern for updating global pause button and status
 */
export function updateGlobalPauseControls(
  toggleBtn: Element,
  pauseStatus: Element,
  isPaused: boolean
): void {
  if (isPaused) {
    toggleBtn.textContent = '▶️ Resume All';
    toggleBtn.classList.add('paused-state');
    pauseStatus.textContent = '⏸️ Automation: Paused';
  } else {
    toggleBtn.textContent = '⏸️ Pause All';
    toggleBtn.classList.remove('paused-state');
    pauseStatus.textContent = '🔄 Automation: Active';
  }
}

/**
 * Common pattern for CI status rendering
 */
export function renderCIStatus(ciStatus: any): string {
  if (ciStatus) {
    return `<span class="ci-status ci-${ciStatus.status}" title="${ciStatus.tooltip}">
      ${ciStatus.status === 'running' ? '<div class="ci-spinner"></div>' : ciStatus.emoji}
      ${ciStatus.count ? `(${ciStatus.count})` : ""}
    </span>`;
  } else {
    return '<span class="ci-status ci-unknown" title="CI status unknown">⚫</span>';
  }
}

/**
 * Common pattern for API call with error handling
 */
export async function makeAPICall(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API call to ${url} failed:`, error);
    throw error;
  }
}

/**
 * Common status class determination logic
 */
export function getStatusClass(status: string): string {
  if (
    status.includes("working") ||
    status.includes("Working") ||
    status.includes("Copilot is working") ||
    status.includes("AI Clone Working") ||
    status.includes("AI NEURAL SWARM ACTIVE") ||
    status.includes("NEURAL SWARM")
  ) {
    return "status-working";
  } else if (
    status.includes("✅") ||
    status.includes("success") ||
    status.includes("Complete")
  ) {
    return "status-success";
  } else if (
    status.includes("❌") ||
    status.includes("error") ||
    status.includes("failed") ||
    status.includes("Error") ||
    status.includes("Malfunction") ||
    status.includes("💥")
  ) {
    return "status-error";
  } else {
    return "status-pending";
  }
}

/**
 * Common text truncation utility
 */
export function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

/**
 * Common date formatting utility
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

/**
 * Common time formatting utility
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}