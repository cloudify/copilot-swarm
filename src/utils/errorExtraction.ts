/**
 * Advanced Error Extraction from GitHub Actions Job Logs
 *
 * This module implements sophisticated error parsing similar to VS Code's problem matchers.
 * It can extract structured error information from various tools like TypeScript, Jest, ESLint, etc.
 */

export interface ParsedError {
  tool: string;
  file?: string;
  line?: number;
  column?: number;
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
  rule?: string;
  context?: string[];
  rawLine: string;
}

export interface ErrorExtraction {
  errors: ParsedError[];
  errorsByTool: Record<string, ParsedError[]>;
  summary: string;
  getPrioritizedErrors(): ParsedError[];
  getGroupedErrors(): Record<string, ParsedError[]>;
  generateSummary(): string;
}

// TypeScript compiler error patterns
const TSC_PATTERNS = [
  // Standard tsc output: file(line,column): error TS1234: message
  /^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+TS(\d+):\s*(.+)$/,
  // Alternative format: file(line): error TS1234: message
  /^(.+?)\((\d+)\):\s+(error|warning|info)\s+TS(\d+):\s*(.+)$/,
  // Webpack ts-loader format
  /^Error in (.+?)\((\d+),(\d+)\):\s*TS(\d+):\s*(.+)$/,
];

// ESLint error patterns
const ESLINT_PATTERNS = [
  // ESLint format: line:col level message rule
  /^\s*(\d+):(\d+)\s+(error|warning|warn|info)\s+(.+?)\s+([\w\-/@]+)$/,
  // ESLint format without rule
  /^\s*(\d+):(\d+)\s+(error|warning|warn|info)\s+(.+)$/,
  // ESLint file path line
  /^([/\w\-.]+\.(js|jsx|ts|tsx))$/,
];

// Jest test error patterns
const JEST_PATTERNS = [
  // Jest error with file and location
  /at Object\.<anonymous> \((.+?):(\d+):(\d+)\)$/,
  // Jest error with stack trace
  /at (.+?) \((.+?):(\d+):(\d+)\)$/,
  // Jest test file path
  /^\s*FAIL\s+(.+)$/,
  // Jest assertion error - expect pattern
  /^\s*expect\(received\)\.(.+?)$/,
  // Jest Expected/Received pattern
  /^\s*(Expected|Received):\s*(.+)$/,
  // Jest test summary
  /Test Suites:\s*(\d+)\s*failed.*?(\d+)\s*total/,
  /Tests:\s*(\d+)\s*failed.*?(\d+)\s*total/,
];

// NPM/Package manager error patterns
const NPM_PATTERNS = [
  /npm ERR!\s+(code\s+)?(.+)/,
  /yarn error\s+(.+)/,
  /Error:\s+(.+)/,
  // NPM dependency resolution errors
  /npm ERR! peer dep missing:\s*(.+)/,
  /npm ERR! ERESOLVE could not resolve/,
  // Installation failures
  /npm ERR! Failed at the (.+?) script/,
];

// Webpack/Build error patterns
const WEBPACK_PATTERNS = [
  /ERROR in (.+?)$/,
  /Module build failed.*?Error in (.+?):/,
  /webpack \d+\.\d+\.\d+ compiled with (\d+) errors?/,
  // Module not found errors
  /Module not found: Error: Can't resolve '(.+?)'/,
  // Build configuration errors
  /Invalid configuration object\. (.+)/,
];

// GitHub Actions specific patterns (for future use)
const _GITHUB_ACTIONS_PATTERNS = [
  /##\[error\](.+)/,
  /Process completed with exit code (\d+)/,
];

interface ToolParser {
  name: string;
  patterns: RegExp[];
  parse: (
    line: string,
    match: RegExpMatchArray,
    allLines: string[],
    lineIndex: number
  ) => ParsedError | null;
}

const TOOL_PARSERS: ToolParser[] = [
  {
    name: "tsc",
    patterns: TSC_PATTERNS,
    parse: (line, match) => {
      // Check which pattern matched based on the match groups
      if (match.length >= 7) {
        // Standard format with column: file(line,col): severity TSerror: message
        return {
          tool: "tsc",
          file: cleanGitHubActionsOutput(match[1]?.trim() || ""),
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          severity: (match[4] as "error" | "warning" | "info") || "error",
          code: `TS${match[5]}`,
          message: cleanGitHubActionsOutput(match[6]?.trim() || ""),
          rawLine: line,
        };
      } else if (match.length >= 6) {
        // Format without column: file(line): severity TSerror: message
        return {
          tool: "tsc",
          file: cleanGitHubActionsOutput(match[1]?.trim() || ""),
          line: parseInt(match[2], 10),
          severity: (match[3] as "error" | "warning" | "info") || "error",
          code: `TS${match[4]}`,
          message: cleanGitHubActionsOutput(match[5]?.trim() || ""),
          rawLine: line,
        };
      } else if (match.length >= 5 && line.includes("Error in")) {
        // Webpack ts-loader format: Error in file(line,col): TSerror: message
        return {
          tool: "webpack",
          file: cleanGitHubActionsOutput(match[1]?.trim() || ""),
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          severity: "error",
          code: `TS${match[4]}`,
          message: match[5]?.trim() || "",
          rawLine: line,
        };
      }
      return null;
    },
  },
  {
    name: "eslint",
    patterns: ESLINT_PATTERNS,
    parse: (line, match, allLines, lineIndex) => {
      // Check if this is a file path line
      if (match.length === 3 && line.match(/^[/\w\-.]+\.(js|jsx|ts|tsx)$/)) {
        // This is just a file path, we'll use it for context
        return null;
      }

      // This is an error line, find the current file context
      let currentFile = "";
      for (let i = lineIndex - 1; i >= 0; i--) {
        const contextLine = allLines[i]?.trim();
        if (contextLine && contextLine.match(/^[/\w\-.]+\.(js|jsx|ts|tsx)$/)) {
          currentFile = contextLine;
          break;
        }
      }

      // Parse error line
      if (match.length >= 4) {
        const hasRule = match.length >= 5;
        return {
          tool: "eslint",
          file: currentFile || "",
          line: parseInt(match[1], 10),
          column: parseInt(match[2], 10),
          severity:
            (match[3] === "warn"
              ? "warning"
              : (match[3] as "error" | "warning" | "info")) || "error",
          message: match[4]?.trim() || "",
          rule: hasRule ? match[5]?.trim() : undefined,
          rawLine: line,
        };
      }

      return null;
    },
  },
  {
    name: "jest",
    patterns: JEST_PATTERNS,
    parse: (line, match, allLines, lineIndex) => {
      if (line.includes("FAIL")) {
        return {
          tool: "jest",
          file: cleanGitHubActionsOutput(match[1]?.trim() || ""),
          severity: "error",
          message: `Test suite failed: ${match[1]}`,
          rawLine: line,
        };
      }

      if (
        line.includes("expect(received)") ||
        line.includes("Expected:") ||
        line.includes("Received:")
      ) {
        // This is an assertion error line - combine with stack trace context
        const context = extractJestErrorContext(allLines, lineIndex);
        return {
          tool: "jest",
          severity: "error",
          message: line.trim(),
          context: context.lines,
          rawLine: line,
        };
      }

      if (line.includes("at Object.<anonymous>") || line.includes("at ")) {
        // Extract context from surrounding lines for better error messages
        const context = extractJestErrorContext(allLines, lineIndex);
        const file = match[2]?.trim() || match[1]?.trim() || "";
        const line_num = parseInt(match[3] || match[2], 10);
        const col_num = parseInt(match[4] || match[3], 10);

        return {
          tool: "jest",
          file,
          line: line_num || undefined,
          column: col_num || undefined,
          severity: "error",
          message: context.message || "Test assertion failed",
          context: context.lines,
          rawLine: line,
        };
      }

      return null;
    },
  },
  {
    name: "npm",
    patterns: NPM_PATTERNS,
    parse: (line, match) => {
      // Handle different NPM error types
      if (line.includes("peer dep missing")) {
        return {
          tool: "npm",
          severity: "error",
          message: `Missing peer dependency: ${match[1]?.trim()}`,
          rawLine: line,
        };
      }

      if (line.includes("ERESOLVE")) {
        return {
          tool: "npm",
          severity: "error",
          message: "Dependency resolution conflict",
          rawLine: line,
        };
      }

      if (line.includes("Failed at the") && line.includes("script")) {
        return {
          tool: "npm",
          severity: "error",
          message: `Build script failed: ${match[1]?.trim()}`,
          rawLine: line,
        };
      }

      return {
        tool: "npm",
        severity: "error",
        message: match[2]?.trim() || match[1]?.trim() || line.trim(),
        rawLine: line,
      };
    },
  },
  {
    name: "webpack",
    patterns: WEBPACK_PATTERNS,
    parse: (line, match) => {
      if (line.includes("ERROR in")) {
        return {
          tool: "webpack",
          file: cleanGitHubActionsOutput(match[1]?.trim() || ""),
          severity: "error",
          message: "Module build failed",
          rawLine: line,
        };
      }

      if (line.includes("Module not found")) {
        return {
          tool: "webpack",
          severity: "error",
          message: `Module not found: ${match[1]?.trim()}`,
          rawLine: line,
        };
      }

      if (line.includes("Invalid configuration")) {
        return {
          tool: "webpack",
          severity: "error",
          message: `Configuration error: ${match[1]?.trim()}`,
          rawLine: line,
        };
      }

      return {
        tool: "webpack",
        severity: "error",
        message: match[1]?.trim() || line.trim(),
        rawLine: line,
      };
    },
  },
];

/**
 * Clean up file paths and error messages by removing GitHub Actions timestamps and tags
 */
function cleanGitHubActionsOutput(text: string): string {
  if (!text) {
    return text;
  }

  // Remove GitHub Actions timestamps: "2025-07-18T13:58:41.3846673Z "
  let cleaned = text.replace(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/g,
    ""
  );

  // Remove GitHub Actions tags: "##[error]", "##[warning]", "##[info]"
  cleaned = cleaned.replace(
    /##\[(error|warning|info|debug|group|endgroup)\]/g,
    ""
  );

  // Clean up any extra whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Check if a log line contains unhelpful GitHub Actions runner messages
 */
function isUnhelpfulRunnerMessage(line: string): boolean {
  const trimmedLine = line.trim().toLowerCase();

  // Skip empty lines
  if (!trimmedLine) {
    return true;
  }

  // Filter out generic GitHub Actions runner messages
  const unhelpfulPatterns = [
    /process completed with exit code \d+/i,
    /##\[error\]process completed with exit code \d+/i,
    /the process '.*?' failed with exit code \d+/i,
    /error: process completed with exit code \d+/i,
    /npm err! errno \d+/i,
    /npm err! code elifecycle/i,
    /npm err! failed at the .* script/i,
    /##\[group\]/i,
    /##\[endgroup\]/i,
    /##\[debug\]/i,
    /run .*/i, // Lines that just say "Run some-command"
    /> .* exited with code \d+/i,
    /command failed with exit code \d+/i,
  ];

  return unhelpfulPatterns.some((pattern) => pattern.test(trimmedLine));
}

function extractJestErrorContext(
  allLines: string[],
  lineIndex: number
): { message: string; lines: string[] } {
  const contextLines: string[] = [];
  let message = "Test assertion failed";

  // Look backwards for the actual assertion failure
  for (let i = Math.max(0, lineIndex - 15); i < lineIndex; i++) {
    const line = allLines[i];
    if (
      line &&
      line.includes("expect(") &&
      (line.includes(").toBe(") ||
        line.includes(").toContain(") ||
        line.includes(").toEqual("))
    ) {
      message = line.trim();
    }
    if (
      line &&
      (line.includes("Expected:") ||
        line.includes("Received:") ||
        line.includes("expect(received)"))
    ) {
      contextLines.push(line.trim());
      message = line.trim();
    }
  }

  return { message, lines: contextLines };
}

function extractErrorContext(
  allLines: string[],
  lineIndex: number,
  contextSize = 2
): string[] {
  const start = Math.max(0, lineIndex - contextSize);
  const end = Math.min(allLines.length, lineIndex + contextSize + 1);
  return allLines
    .slice(start, end)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseLogLine(
  line: string,
  allLines: string[],
  lineIndex: number
): ParsedError | null {
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return null;
  }

  // Skip unhelpful GitHub Actions runner messages
  if (isUnhelpfulRunnerMessage(line)) {
    return null;
  }

  for (const parser of TOOL_PARSERS) {
    for (const pattern of parser.patterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        const error = parser.parse(trimmedLine, match, allLines, lineIndex);
        if (error) {
          // Add context for certain types of errors
          if (error.tool === "jest" && !error.context) {
            error.context = extractErrorContext(allLines, lineIndex);
          }
          return error;
        }
      }
    }
  }

  // Fallback: Check for generic error patterns
  const lowerLine = trimmedLine.toLowerCase();
  if (
    lowerLine.includes("error") ||
    lowerLine.includes("failed") ||
    lowerLine.includes("failure") ||
    trimmedLine.includes("✗") ||
    trimmedLine.includes("❌")
  ) {
    // Extract tool name from context if possible
    let tool = "unknown";
    if (lowerLine.includes("npm") || lowerLine.includes("yarn")) {
      tool = "npm";
    } else if (lowerLine.includes("webpack")) {
      tool = "webpack";
    } else if (lowerLine.includes("jest")) {
      tool = "jest";
    } else if (lowerLine.includes("eslint")) {
      tool = "eslint";
    } else if (lowerLine.includes("tsc") || lowerLine.includes("typescript")) {
      tool = "tsc";
    }

    return {
      tool,
      severity: "error",
      message: trimmedLine,
      rawLine: line,
    };
  }

  return null;
}

export function extractErrorsFromJobLogs(
  logText: string,
  _jobName?: string
): ErrorExtraction {
  const lines = logText.split("\n");
  const errors: ParsedError[] = [];
  const errorsByTool: Record<string, ParsedError[]> = {};

  // Parse each line for errors
  for (let i = 0; i < lines.length; i++) {
    const error = parseLogLine(lines[i], lines, i);
    if (error) {
      errors.push(error);

      if (!errorsByTool[error.tool]) {
        errorsByTool[error.tool] = [];
      }
      errorsByTool[error.tool].push(error);
    }
  }

  // Extract summary information
  const summary = extractSummaryInfo(logText, errors);

  return {
    errors,
    errorsByTool,
    summary,

    getPrioritizedErrors(): ParsedError[] {
      // Filter out unhelpful runner messages first
      const filteredErrors = errors.filter(
        (error) => !isUnhelpfulRunnerMessage(error.rawLine || error.message)
      );

      return [...filteredErrors].sort((a, b) => {
        // Prioritize by severity
        const severityOrder = { error: 0, warning: 1, info: 2 };
        const severityDiff =
          severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) {
          return severityDiff;
        }

        // Prioritize by tool importance (compilation errors first)
        const toolOrder = {
          tsc: 0,
          webpack: 1,
          jest: 2,
          eslint: 3,
          npm: 4,
          unknown: 5,
        };
        const toolDiff =
          (toolOrder[a.tool as keyof typeof toolOrder] || 5) -
          (toolOrder[b.tool as keyof typeof toolOrder] || 5);
        if (toolDiff !== 0) {
          return toolDiff;
        }

        // Prioritize errors with file/line information
        const hasLocationA = !!(a.file && a.line);
        const hasLocationB = !!(b.file && b.line);
        if (hasLocationA !== hasLocationB) {
          return hasLocationA ? -1 : 1;
        }

        return 0;
      });
    },

    getGroupedErrors(): Record<string, ParsedError[]> {
      const grouped: Record<string, ParsedError[]> = {};

      // Filter out unhelpful runner messages
      const filteredErrors = errors.filter(
        (error) => !isUnhelpfulRunnerMessage(error.rawLine || error.message)
      );

      for (const error of filteredErrors) {
        const rawKey = error.file || error.tool;
        const key = cleanGitHubActionsOutput(rawKey);
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(error);
      }

      return grouped;
    },

    generateSummary(): string {
      const toolCounts: Record<string, { errors: number; warnings: number }> =
        {};

      // Filter out unhelpful runner messages
      const filteredErrors = errors.filter(
        (error) => !isUnhelpfulRunnerMessage(error.rawLine || error.message)
      );

      for (const error of filteredErrors) {
        if (!toolCounts[error.tool]) {
          toolCounts[error.tool] = { errors: 0, warnings: 0 };
        }

        if (error.severity === "error") {
          toolCounts[error.tool].errors++;
        } else if (error.severity === "warning") {
          toolCounts[error.tool].warnings++;
        }
      }

      const summaryLines: string[] = [];

      for (const [tool, counts] of Object.entries(toolCounts)) {
        if (counts.errors > 0 || counts.warnings > 0) {
          const parts: string[] = [];
          if (counts.errors > 0) {
            parts.push(
              `${counts.errors} error${counts.errors !== 1 ? "s" : ""}`
            );
          }
          if (counts.warnings > 0) {
            parts.push(
              `${counts.warnings} warning${counts.warnings !== 1 ? "s" : ""}`
            );
          }
          summaryLines.push(`**${tool.toUpperCase()}**: ${parts.join(", ")}`);
        }
      }

      // Add specific file information for the most critical errors
      const prioritized = this.getPrioritizedErrors().slice(0, 5);
      if (prioritized.length > 0) {
        summaryLines.push("");
        summaryLines.push("**Most Critical Issues:**");
        for (const error of prioritized) {
          const location =
            error.file && error.line
              ? ` (${cleanGitHubActionsOutput(error.file)}:${error.line})`
              : "";
          summaryLines.push(
            `- ${cleanGitHubActionsOutput(error.message)}${location}`
          );
        }
      }

      return summaryLines.join("\n");
    },
  };
}

function extractSummaryInfo(logText: string, _errors: ParsedError[]): string {
  const lines = logText.split("\n");
  const summaryLines: string[] = [];

  // Look for tool-specific summary lines
  for (const line of lines) {
    const trimmed = line.trim();

    // Jest summary
    if (
      trimmed.includes("Test Suites:") &&
      (trimmed.includes("failed") || trimmed.includes("passed"))
    ) {
      summaryLines.push(trimmed);
    }
    if (
      trimmed.includes("Tests:") &&
      (trimmed.includes("failed") || trimmed.includes("passed"))
    ) {
      summaryLines.push(trimmed);
    }

    // ESLint summary
    if (trimmed.match(/✖ \d+ problems? \(\d+ errors?, \d+ warnings?\)/)) {
      summaryLines.push(trimmed);
    }

    // Webpack summary
    if (
      trimmed.includes("webpack") &&
      trimmed.includes("compiled with") &&
      trimmed.includes("error")
    ) {
      summaryLines.push(trimmed);
    }

    // Exit code information
    if (trimmed.includes("Process completed with exit code")) {
      summaryLines.push(trimmed);
    }
  }

  return summaryLines.join("\n");
}

/**
 * Enhanced version of the original collectFailureLogs function that uses advanced error extraction
 */
export async function collectFailureLogsAdvanced(
  client: any,
  owner: string,
  repo: string,
  failedRunIds: number[]
): Promise<string> {
  const logSamples: string[] = [];

  // Use existing debug logging
  const debugLog = (message: string, data?: any) => {
    console.log(
      `[Error Extraction Debug] ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  };

  debugLog(`Starting advanced log collection for failed runs`, {
    owner,
    repo,
    failedRunIds,
    runCount: failedRunIds.length,
  });

  // Limit to most recent 2 failed runs to avoid overwhelming the comment
  const runIdsToCheck = failedRunIds.slice(0, 2);

  for (const runId of runIdsToCheck) {
    try {
      debugLog(`Processing workflow run ${runId}`);

      // Get jobs for this workflow run to identify failed jobs
      const jobsResponse = await client.get(
        `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`
      );
      const failedJobs = jobsResponse.data.jobs.filter(
        (job: any) => job.conclusion === "failure" || job.conclusion === "error"
      );

      debugLog(`Jobs analysis for run ${runId}`, {
        totalJobs: jobsResponse.data.jobs.length,
        failedJobs: failedJobs.length,
        failedJobNames: failedJobs.map((job: any) => job.name),
      });

      // Process each failed job
      for (const job of failedJobs.slice(0, 3)) {
        try {
          debugLog(
            `Fetching logs for job ${job.id} (${job.name}) in run ${runId}`
          );

          const jobLogResponse = await client.get(
            `/repos/${owner}/${repo}/actions/jobs/${job.id}/logs`,
            {
              headers: {
                Accept: "application/vnd.github.v3.raw",
                "X-GitHub-Api-Version": "2022-11-28",
              },
              maxRedirects: 5,
              responseType: "text",
            }
          );

          const jobLogText = jobLogResponse.data;
          if (typeof jobLogText === "string" && jobLogText.length > 0) {
            // Use advanced error extraction
            const extraction = extractErrorsFromJobLogs(jobLogText, job.name);

            debugLog(`Advanced error extraction for job ${job.id}`, {
              totalErrors: extraction.errors.length,
              errorsByTool: Object.keys(extraction.errorsByTool),
              toolCounts: Object.fromEntries(
                Object.entries(extraction.errorsByTool).map(
                  ([tool, errors]) => [tool, errors.length]
                )
              ),
            });

            if (extraction.errors.length > 0) {
              // Generate a comprehensive error report
              const prioritizedErrors = extraction
                .getPrioritizedErrors()
                .slice(0, 10);
              const summary = extraction.generateSummary();

              const errorLines: string[] = [];

              // Add summary first
              if (summary) {
                errorLines.push("**Error Summary:**");
                errorLines.push(summary);
                errorLines.push("");
              }

              // Add prioritized errors with better formatting
              if (prioritizedErrors.length > 0) {
                errorLines.push("**Detailed Errors:**");

                // Group by tool for better readability
                const grouped = extraction.getGroupedErrors();
                const processedFiles = new Set<string>();

                for (const [fileOrTool, errors] of Object.entries(grouped)) {
                  if (processedFiles.has(fileOrTool)) {
                    continue;
                  }
                  processedFiles.add(fileOrTool);

                  const relevantErrors = errors.slice(0, 3); // Limit per file/tool
                  if (relevantErrors.length > 0) {
                    errorLines.push(`\n*${fileOrTool}:*`);
                    for (const error of relevantErrors) {
                      const location =
                        error.line && error.column
                          ? `:${error.line}:${error.column}`
                          : error.line
                            ? `:${error.line}`
                            : "";
                      const code = error.code ? ` [${error.code}]` : "";
                      const rule = error.rule ? ` (${error.rule})` : "";

                      errorLines.push(
                        `- ${error.severity}: ${cleanGitHubActionsOutput(error.message)}${location}${code}${rule}`
                      );
                    }
                  }
                }
              }

              if (errorLines.length > 0) {
                logSamples.push(
                  `### ${job.name}\n\`\`\`\n${errorLines.join("\n")}\n\`\`\``
                );
              }
            }

            debugLog(`Processed logs for job ${job.id}`, {
              totalLines: jobLogText.split("\n").length,
              extractedErrors: extraction.errors.length,
              includedInSample: extraction.errors.length > 0,
            });
          } else {
            debugLog(`Job logs were not string or empty for job ${job.id}`, {
              dataType: typeof jobLogText,
              dataLength: jobLogText ? jobLogText.length : 0,
            });
          }
        } catch (jobLogError) {
          debugLog(`Failed to fetch individual job logs for job ${job.id}`, {
            error:
              jobLogError instanceof Error ? jobLogError.message : jobLogError,
          });
        }
      }
    } catch (runError) {
      debugLog(`Failed to fetch run details for run ${runId}`, {
        error: runError instanceof Error ? runError.message : runError,
      });
    }
  }

  debugLog(`Advanced log collection completed`, {
    totalLogSamples: logSamples.length,
    logSamplesSummary: logSamples.map((sample) => sample.split("\n")[0]), // Just the job names
  });

  return logSamples.length > 0
    ? `\n\n**Advanced Error Analysis:**\n${logSamples.join("\n\n")}`
    : "";
}
