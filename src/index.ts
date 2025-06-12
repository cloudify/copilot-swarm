#!/usr/bin/env node

import { program } from "commander";
import open from "open";
import MonitorWebServer from "./server.js";
import { MonitorEngine } from "./MonitorEngine.js";

// Configure CLI options
program
  .name("copilot-monitor")
  .description("GitHub Copilot PR monitor tool with web interface")
  .version("1.0.0")
  .option("-c, --config", "Reconfigure organizations and repositories")
  .option(
    "-i, --interval <seconds>",
    "Slow refresh interval in seconds (stable PRs)",
    "60"
  )
  .option(
    "--fast-interval <seconds>",
    "Fast refresh interval in seconds (active PRs)",
    "15"
  )
  .option(
    "--days <days>",
    "Look back this many days when searching for PRs",
    "2"
  )
  .option(
    "--no-resume-on-failure",
    "Disable automatic resume when Copilot was rate limited"
  )
  .option(
    "--no-auto-fix",
    "Disable automatic Copilot fix requests for failing checks"
  )
  .option(
    "--no-auto-approve",
    "Disable automatic rerun of pending workflow runs"
  )
  .option(
    "--max-sessions <number>",
    "Maximum number of copilot sessions per pull request",
    "50"
  )
  .option(
    "--ignore-jobs <jobs>",
    "Comma-separated list of job names to ignore in autofix mode",
    "danger"
  )
  .option("-p, --port <port>", "Web server port", "3010")
  .option("--no-open", "Don't automatically open browser")
  .parse();

const options = program.opts();

// Create monitor configuration
const monitorConfig = {
  config: Boolean(options.config),
  interval: parseInt(options.interval, 10),
  fastInterval: parseInt(options.fastInterval, 10),
  days: parseInt(options.days, 10),
  resumeOnFailure: options.resumeOnFailure !== false,
  autoFix: options.autoFix !== false,
  autoApprove: options.autoApprove !== false,
  maxSessions: parseInt(options.maxSessions, 10),
  ignoreJobs: options.ignoreJobs ? options.ignoreJobs.split(",").map((job: string) => job.trim()) : ["danger"],
  port: parseInt(options.port, 10),
  openBrowser: options.open !== false,
};

async function main() {
  try {
    // Handle configuration mode
    if (monitorConfig.config) {
      console.log("🚀 Starting GitHub Copilot PR Monitor Configuration...");
      await runConfigurationFlow();
      return;
    }

    console.log("🚀 Starting GitHub Copilot PR Monitor...");

    // Create web server
    const server = new MonitorWebServer({ port: monitorConfig.port });

    // Create monitor engine
    const monitor = new MonitorEngine({
      config: monitorConfig.config,
      interval: monitorConfig.interval,
      fastInterval: monitorConfig.fastInterval,
      days: monitorConfig.days,
      resumeOnFailure: monitorConfig.resumeOnFailure,
      autoFix: monitorConfig.autoFix,
      autoApprove: monitorConfig.autoApprove,
      maxSessions: monitorConfig.maxSessions,
      ignoreJobs: monitorConfig.ignoreJobs,
      server: server,
    });

    // Start the web server
    await server.start();

    // Open browser if requested
    if (monitorConfig.openBrowser) {
      try {
        await open(server.getUrl());
        console.log("🌐 Browser opened automatically");
      } catch {
        console.log(
          "⚠️  Could not open browser automatically. Please open manually:"
        );
        console.log(`   ${server.getUrl()}`);
      }
    } else {
      console.log("🌐 Access the dashboard at:");
      console.log(`   ${server.getUrl()}`);
    }

    // Start monitoring
    await monitor.start();

    // Handle graceful shutdown
    const cleanup = async () => {
      console.log("\n🔄 Shutting down...");
      await monitor.stop();
      await server.stop();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  } catch (error) {
    console.error("❌ Error starting monitor:", error);
    process.exit(1);
  }
}

/**
 * Interactive configuration flow
 */
async function runConfigurationFlow() {
  try {
    console.log("\n📋 Configuration Setup");
    console.log(
      "This will guide you through setting up authentication and repository monitoring.\n"
    );

    // Step 1: Handle authentication
    console.log("Step 1: Authentication Setup");
    const { ensureValidTokenScopes } = await import("./utils/config.js");
    await ensureValidTokenScopes();
    console.log("✅ Authentication configured successfully\n");

    // Step 2: Repository/Organization setup
    console.log("Step 2: Repository and Organization Setup");
    console.log(
      "You can monitor specific repositories or entire organizations.\n"
    );

    // For now, provide guidance for manual configuration
    // In a future version, this could be made interactive with prompts
    console.log("To configure repositories and organizations, you can:");
    console.log("1. Edit the configuration file directly");
    console.log("2. Use the web interface (coming soon)");
    console.log("3. Manually add them to your config\n");

    console.log("Example repositories format: ['owner/repo1', 'owner/repo2']");
    console.log("Example organizations format: ['org1', 'org2']\n");

    console.log("✅ Configuration setup complete!");
    console.log("You can now run 'npx copilot-monitor' to start monitoring.\n");
  } catch (error) {
    console.error("❌ Configuration failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
