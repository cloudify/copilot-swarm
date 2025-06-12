import http from "http";
import { URL } from "url";
import axios from "axios";
import crypto from "crypto";
import open from "open";

// Add debug logging helper
const DEBUG =
  process.env.DEBUG === "true" || process.env.NODE_ENV === "development";
const debugLog = (message: string, data?: any) => {
  if (DEBUG) {
    console.log(
      `[OAuth Debug] ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  }
};

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthResult {
  accessToken: string;
  tokenType: string;
  scope: string;
}

export class GitHubOAuth {
  private config: OAuthConfig;
  private server?: http.Server;
  private state: string;

  constructor(config: OAuthConfig) {
    this.config = config;
    this.state = crypto.randomBytes(20).toString("hex");
  }

  /**
   * Start the OAuth flow by opening the browser and starting a local server
   */
  async authorize(): Promise<OAuthResult> {
    return new Promise((resolve, reject) => {
      const port = 3000; // Default callback port
      let isResolved = false;

      // Create HTTP server to handle the callback
      this.server = http.createServer(async (req, res) => {
        if (isResolved) {return;}

        try {
          const url = new URL(req.url!, `http://localhost:${port}`);

          if (url.pathname === "/callback") {
            const code = url.searchParams.get("code");
            const state = url.searchParams.get("state");
            const error = url.searchParams.get("error");

            if (error) {
              isResolved = true;
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body>
                    <h1>Authorization Failed</h1>
                    <p>Error: ${error}</p>
                    <p>You can close this window and try again.</p>
                  </body>
                </html>
              `);
              this.cleanup();
              reject(new Error(`OAuth error: ${error}`));
              return;
            }

            if (state !== this.state) {
              isResolved = true;
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body>
                    <h1>Authorization Failed</h1>
                    <p>Invalid state parameter. This could be a security issue.</p>
                    <p>You can close this window and try again.</p>
                  </body>
                </html>
              `);
              this.cleanup();
              reject(new Error("Invalid state parameter"));
              return;
            }

            if (!code) {
              isResolved = true;
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body>
                    <h1>Authorization Failed</h1>
                    <p>No authorization code received.</p>
                    <p>You can close this window and try again.</p>
                  </body>
                </html>
              `);
              this.cleanup();
              reject(new Error("No authorization code received"));
              return;
            }

            try {
              // Exchange authorization code for access token
              const tokenResult = await this.exchangeCodeForToken(code);

              isResolved = true;
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body>
                    <h1>Authorization Successful!</h1>
                    <p>You have successfully authorized the application.</p>
                    <p>You can close this window and return to the terminal.</p>
                    <script>setTimeout(() => window.close(), 3000);</script>
                  </body>
                </html>
              `);

              this.cleanup();
              resolve(tokenResult);
            } catch (tokenError) {
              isResolved = true;
              res.writeHead(500, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body>
                    <h1>Token Exchange Failed</h1>
                    <p>Failed to exchange authorization code for access token.</p>
                    <p>You can close this window and try again.</p>
                  </body>
                </html>
              `);
              this.cleanup();
              reject(tokenError);
            }
          } else {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
          }
        } catch (err) {
          if (!isResolved) {
            isResolved = true;
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Internal Server Error");
            this.cleanup();
            reject(err);
          }
        }
      });

      // Start server
      this.server.listen(port, () => {
        // Build authorization URL
        const authUrl = this.buildAuthorizationUrl();

        // Open browser
        open(authUrl).catch((err) => {
          if (!isResolved) {
            isResolved = true;
            this.cleanup();
            reject(new Error(`Failed to open browser: ${err.message}`));
          }
        });
      });

      // Handle server errors
      this.server.on("error", (err) => {
        if (!isResolved) {
          isResolved = true;
          this.cleanup();
          reject(new Error(`Server error: ${err.message}`));
        }
      });

      // Set a timeout (5 minutes)
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.cleanup();
          reject(
            new Error(
              "Authorization timeout - no response received within 5 minutes"
            )
          );
        }
      }, 5 * 60 * 1000);
    });
  }

  private buildAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(" "),
      state: this.state,
      allow_signup: "true",
    });

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    debugLog("Building authorization URL", {
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      scopes: this.config.scopes,
      state: this.state,
      authUrl,
    });

    return authUrl;
  }

  private async exchangeCodeForToken(code: string): Promise<OAuthResult> {
    try {
      debugLog("Exchanging authorization code for token", {
        clientId: this.config.clientId,
        redirectUri: this.config.redirectUri,
        codeLength: code.length,
      });

      const response = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      debugLog("Token exchange response", {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        dataKeys: Object.keys(response.data),
      });

      const data = response.data;

      if (data.error) {
        debugLog("Token exchange error", {
          error: data.error,
          errorDescription: data.error_description,
        });
        throw new Error(
          `Token exchange error: ${data.error_description || data.error}`
        );
      }

      if (!data.access_token) {
        debugLog("No access token in response", { data });
        throw new Error("No access token received from GitHub");
      }

      const result = {
        accessToken: data.access_token,
        tokenType: data.token_type || "bearer",
        scope: data.scope || "",
      };

      debugLog("Token exchange successful", {
        tokenType: result.tokenType,
        scope: result.scope,
        tokenLength: result.accessToken.length,
      });

      return result;
    } catch (error) {
      debugLog("Token exchange error", {
        error: error instanceof Error ? error.message : error,
        isAxiosError: axios.isAxiosError(error),
        responseStatus: axios.isAxiosError(error)
          ? error.response?.status
          : undefined,
        responseData: axios.isAxiosError(error)
          ? error.response?.data
          : undefined,
      });

      if (axios.isAxiosError(error)) {
        throw new Error(`HTTP error during token exchange: ${error.message}`);
      }
      throw error;
    }
  }

  private cleanup(): void {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
  }

  /**
   * Stop the OAuth flow and cleanup resources
   */
  cancel(): void {
    this.cleanup();
  }
}

/**
 * Default GitHub OAuth configuration for the copilot monitor app
 *
 * Scopes explanation (matching GitHub CLI requirements):
 * - repo: Full access to repositories (needed for searching PRs, workflow reruns)
 * - read:org: Read organization membership (needed for org search)
 * - read:user: Read user profile information
 * - user:email: Read user email addresses
 * - gist: Access to gists (used by GitHub CLI)
 * - workflow: Access to GitHub Actions workflows (needed for rerunning workflows)
 */
export function createDefaultOAuthConfig(
  clientId: string,
  clientSecret: string
): OAuthConfig {
  const config = {
    clientId,
    clientSecret,
    redirectUri: "http://localhost:3000/callback",
    scopes: ["repo", "read:org", "read:user", "user:email", "gist", "workflow"], // Match GitHub CLI scopes exactly
  };

  debugLog("Created OAuth config", {
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scopes: config.scopes,
  });

  return config;
}

export interface DeviceAuthResult {
  accessToken: string;
  tokenType: string;
  scope: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

/**
 * GitHub Device Flow OAuth implementation
 * Better suited for CLI applications as it doesn't require a callback server
 */
export class GitHubDeviceAuth {
  private clientId: string;
  private scopes: string[];

  constructor(clientId: string, scopes: string[]) {
    this.clientId = clientId;
    this.scopes = scopes;
  }

  /**
   * Start the device authorization flow
   */
  async authorize(): Promise<DeviceAuthResult> {
    // Step 1: Request device and user codes
    const deviceCodeData = await this.requestDeviceCode();

    debugLog("Device code requested", {
      userCode: deviceCodeData.user_code,
      verificationUri: deviceCodeData.verification_uri,
      expiresIn: deviceCodeData.expires_in,
    });

    // Step 2: Display instructions to user
    console.log("\n🔐 GitHub Authentication Required");
    console.log("To authorize this application, please follow these steps:");
    console.log(`\n1. Visit: ${deviceCodeData.verification_uri}`);
    console.log(`2. Enter code: ${deviceCodeData.user_code}`);
    console.log("\nWaiting for authentication...");

    // Try to open the verification URL automatically
    try {
      await open(deviceCodeData.verification_uri_complete);
      console.log("✅ Browser opened automatically");
    } catch (openError) {
      console.log("⚠️  Could not open browser automatically");
      debugLog("Failed to open browser", openError);
    }

    // Step 3: Poll for access token
    return this.pollForAccessToken(deviceCodeData);
  }

  private async requestDeviceCode(): Promise<DeviceCodeResponse> {
    try {
      const response = await axios.post(
        "https://github.com/login/device/code",
        {
          client_id: this.clientId,
          scope: this.scopes.join(" "),
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.device_code) {
        throw new Error("No device code received from GitHub");
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        throw new Error(
          `Failed to request device code: ${
            errorData?.error_description || error.message
          }`
        );
      }
      throw error;
    }
  }

  private async pollForAccessToken(
    deviceCodeData: DeviceCodeResponse
  ): Promise<DeviceAuthResult> {
    const startTime = Date.now();
    const expiresAt = startTime + deviceCodeData.expires_in * 1000;
    const pollInterval = deviceCodeData.interval * 1000;

    while (Date.now() < expiresAt) {
      try {
        const response = await axios.post(
          "https://github.com/login/oauth/access_token",
          {
            client_id: this.clientId,
            device_code: deviceCodeData.device_code,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          },
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          }
        );

        const data = response.data;

        if (data.access_token) {
          console.log("✅ Authentication successful!");

          debugLog("Device auth successful", {
            tokenType: data.token_type,
            scope: data.scope,
            tokenLength: data.access_token.length,
          });

          return {
            accessToken: data.access_token,
            tokenType: data.token_type || "bearer",
            scope: data.scope || "",
          };
        }

        if (data.error) {
          if (data.error === "authorization_pending") {
            // Continue polling
            await this.sleep(pollInterval);
            continue;
          } else if (data.error === "slow_down") {
            // Increase polling interval
            await this.sleep(pollInterval + 5000);
            continue;
          } else if (data.error === "expired_token") {
            throw new Error("Device code expired. Please try again.");
          } else if (data.error === "access_denied") {
            throw new Error("Access denied by user.");
          } else {
            throw new Error(
              `Authentication error: ${data.error_description || data.error}`
            );
          }
        }
      } catch (pollError) {
        if (axios.isAxiosError(pollError) && pollError.response?.data?.error) {
          const errorData = pollError.response.data;
          if (errorData.error === "authorization_pending") {
            await this.sleep(pollInterval);
            continue;
          }
        }
        throw pollError;
      }
    }

    throw new Error("Authentication timed out. Please try again.");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a device auth instance with default GitHub CLI client ID and required scopes
 */
export function createDeviceAuth(): GitHubDeviceAuth {
  // Using GitHub CLI's public client ID (this is public and safe to use)
  const clientId = "178c6fc778ccc68e1d6a";
  const scopes = [
    "repo",
    "read:org",
    "read:user",
    "user:email",
    "gist",
    "workflow",
  ];

  debugLog("Created device auth", { clientId, scopes });

  return new GitHubDeviceAuth(clientId, scopes);
}
