import Conf from "conf";
import { homedir } from "os";
import { join } from "path";
import type { AppConfig } from "../types";
import { createDeviceAuth } from "./oauth.js";

// Add debug logging helper
const DEBUG =
  process.env.DEBUG === "true" || process.env.NODE_ENV === "development";
const debugLog = (message: string, data?: any) => {
  if (DEBUG) {
    console.error(
      `[Config Debug] ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  }
};

const config = new Conf({
  projectName: "copilot-pr-monitor",
  cwd: join(homedir(), ".config"),
});

// Log the configuration file path when debug mode is enabled
if (DEBUG) {
  debugLog("Configuration file path", { path: config.path });
}

export async function loadAuth(): Promise<{
  token: string;
  clientId: string;
  clientSecret?: string;
} | null> {
  debugLog("Loading authentication config from", { path: config.path });

  const token = config.get("github.token") as string | undefined;
  const clientId = config.get("github.clientId") as string | undefined;
  const clientSecret = config.get("github.clientSecret") as string | undefined;

  if (token && clientId) {
    debugLog("Authentication config loaded successfully", {
      hasToken: !!token,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
    });
    return { token, clientId, clientSecret };
  }

  debugLog("No valid authentication config found");
  return null;
}

export async function saveAuth(
  token: string,
  clientId: string,
  clientSecret?: string
): Promise<void> {
  debugLog("Saving authentication config to", {
    path: config.path,
    hasToken: !!token,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
  });

  config.set("github.token", token);
  config.set("github.clientId", clientId);
  if (clientSecret) {
    config.set("github.clientSecret", clientSecret);
  }

  debugLog("Authentication config saved successfully");
}

export async function loadConfig(): Promise<string[]> {
  debugLog("Loading repositories config from", { path: config.path });

  const repositories = config.get("repositories", []) as string[];

  debugLog("Repositories config loaded", {
    count: repositories.length,
    repositories: repositories.slice(0, 5), // Only show first 5 for brevity
  });

  return repositories;
}

export async function loadOrganizations(): Promise<string[]> {
  debugLog("Loading organizations config from", { path: config.path });

  const organizations = config.get("organizations", []) as string[];

  debugLog("Organizations config loaded", {
    count: organizations.length,
    organizations,
  });

  return organizations;
}

export async function saveConfig(repositories: string[]): Promise<void> {
  debugLog("Saving repositories config to", {
    path: config.path,
    count: repositories.length,
    repositories: repositories.slice(0, 5), // Only show first 5 for brevity
  });

  config.set("repositories", repositories);

  debugLog("Repositories config saved successfully");
}

export async function saveOrganizations(
  organizations: string[]
): Promise<void> {
  debugLog("Saving organizations config to", {
    path: config.path,
    count: organizations.length,
    organizations,
  });

  config.set("organizations", organizations);

  debugLog("Organizations config saved successfully");
}

export async function clearConfig(): Promise<void> {
  debugLog("Clearing all config from", { path: config.path });

  config.clear();

  debugLog("All config cleared successfully");
}

export async function loadFullConfig(): Promise<Partial<AppConfig>> {
  debugLog("Loading full config from", { path: config.path });

  const token = config.get("github.token") as string | undefined;
  const clientId = config.get("github.clientId") as string | undefined;
  const clientSecret = config.get("github.clientSecret") as string | undefined;
  const organizations = config.get("organizations", []) as string[];
  const repositories = config.get("repositories", []) as string[];
  const refreshInterval = config.get("refreshInterval", 30) as number;

  const configData = {
    token,
    clientId,
    clientSecret,
    organizations,
    repositories,
    refreshInterval,
  };

  debugLog("Full config loaded", {
    hasToken: !!token,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    organizationsCount: organizations.length,
    repositoriesCount: repositories.length,
    refreshInterval,
  });

  return configData;
}

export async function saveFullConfig(
  appConfig: Partial<AppConfig>
): Promise<void> {
  debugLog("Saving full config to", {
    path: config.path,
    hasToken: !!appConfig.token,
    hasClientId: !!appConfig.clientId,
    hasClientSecret: !!appConfig.clientSecret,
    organizationsCount: appConfig.organizations?.length ?? 0,
    repositoriesCount: appConfig.repositories?.length ?? 0,
    refreshInterval: appConfig.refreshInterval,
  });

  if (appConfig.token) {config.set("github.token", appConfig.token);}
  if (appConfig.clientId) {config.set("github.clientId", appConfig.clientId);}
  if (appConfig.clientSecret)
    {config.set("github.clientSecret", appConfig.clientSecret);}
  if (appConfig.organizations)
    {config.set("organizations", appConfig.organizations);}
  if (appConfig.repositories)
    {config.set("repositories", appConfig.repositories);}
  if (appConfig.refreshInterval)
    {config.set("refreshInterval", appConfig.refreshInterval);}

  debugLog("Full config saved successfully");
}

/**
 * Handle authentication flow with device-based OAuth when scopes are insufficient
 */
export async function handleScopeAuthentication(): Promise<{
  token: string;
  clientId: string;
}> {
  console.log("\n🔐 Authentication with required scopes needed");
  console.log("Starting device-based authentication flow...\n");

  try {
    const deviceAuth = createDeviceAuth();
    const result = await deviceAuth.authorize();

    // Use GitHub CLI's public client ID
    const clientId = "178c6fc778ccc68e1d6a";

    // Save the new token
    await saveAuth(result.accessToken, clientId);

    console.log("✅ Authentication successful and saved!");

    return {
      token: result.accessToken,
      clientId,
    };
  } catch (error) {
    console.error(
      "❌ Authentication failed:",
      error instanceof Error ? error.message : error
    );
    throw new Error("Failed to authenticate with required scopes");
  }
}

/**
 * Validate token scopes and re-authenticate if necessary
 */
export async function ensureValidTokenScopes(): Promise<{
  token: string;
  clientId: string;
}> {
  // Load existing auth
  const auth = await loadAuth();

  if (!auth) {
    // No existing auth, need to authenticate
    return handleScopeAuthentication();
  }

  // Check if current token has required scopes
  try {
    const { GitHubAPI } = await import("./github.js");
    const api = new GitHubAPI(auth.token);
    const verification = await api.verifyToken();

    if (!verification.valid) {
      console.log("❌ Current token is invalid, re-authenticating...");
      return handleScopeAuthentication();
    }

    const scopeValidation = api.validateTokenScopes(verification.scopes);

    if (!scopeValidation.valid) {
      console.log(
        `❌ Current token missing required scopes: ${scopeValidation.missingScopes.join(
          ", "
        )}`
      );
      console.log("Re-authenticating with required scopes...");
      return handleScopeAuthentication();
    }

    // Token is valid with all required scopes
    return {
      token: auth.token,
      clientId: auth.clientId,
    };
  } catch (error) {
    debugLog("Error validating token scopes", error);
    console.log("❌ Error validating current token, re-authenticating...");
    return handleScopeAuthentication();
  }
}
