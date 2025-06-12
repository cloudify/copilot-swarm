# OAuth Migration Guide

This document explains the migration from Personal Access Tokens (PAT) to OAuth authentication in the Copilot PR Monitor.

## What Changed

### Before (Personal Access Token)

- Users had to manually create a GitHub Personal Access Token
- Required manual scope configuration
- Token management was entirely manual
- Less secure as tokens were created with potentially broad permissions

### After (OAuth Flow)

- Automated OAuth flow with browser-based authorization
- Scopes are automatically requested (`repo` and `workflow`)
- Better user experience with guided setup
- More secure as permissions are explicitly granted
- Follows GitHub's recommended authentication patterns

## New Authentication Flow

1. **OAuth App Setup**: User creates a GitHub OAuth App (guided process)
2. **Credential Entry**: User enters Client ID and Client Secret in the terminal
3. **Browser Authorization**: Application opens browser to GitHub's authorization page
4. **User Authorization**: User reviews and approves the requested permissions
5. **Token Exchange**: Application automatically exchanges authorization code for access token
6. **Verification**: Token is verified and stored securely

## Benefits

### Security

- **Explicit Permission Granting**: Users see exactly what permissions are being requested
- **Limited Scope**: Only requests necessary permissions (`repo` and `workflow`)
- **Revocable**: Users can revoke access from GitHub settings at any time
- **No Broad Tokens**: Eliminates risk of overly-permissive PATs

### User Experience

- **Guided Setup**: Step-by-step instructions for OAuth App creation
- **Browser Integration**: Familiar GitHub authorization interface
- **Automated Process**: No manual token creation or scope configuration
- **Clear Error Messages**: Helpful feedback during setup process

### Developer Experience

- **Standard OAuth Flow**: Uses GitHub's recommended authentication method
- **Proper Error Handling**: Comprehensive error handling and user feedback
- **Cancellable Flow**: Users can cancel OAuth flow with Ctrl+C or Esc
- **Local Server**: Secure local callback server for token exchange

## Technical Implementation

### New Components

- **`GitHubOAuth` class**: Handles the OAuth flow with local HTTP server
- **Enhanced `AuthFlow` component**: Guides users through OAuth setup
- **Updated config management**: Stores Client ID, Client Secret, and access tokens

### OAuth Configuration

- **Redirect URI**: `http://localhost:3000/callback`
- **Required Scopes**: `repo`, `workflow`
- **Authorization URL**: GitHub's OAuth authorization endpoint
- **Token Exchange**: Secure server-to-server token exchange

### Security Measures

- **State Parameter**: Prevents CSRF attacks with random state verification
- **Local Server**: Temporary HTTP server for secure callback handling
- **Timeout Protection**: 5-minute timeout for authorization flow
- **Secure Storage**: Tokens stored in user's config directory

## Migration Notes

### Existing Users

- Users with existing PAT configuration are not affected
- Next authentication will use the new OAuth flow
- Old PATs can be revoked from GitHub settings after migration

### OAuth App Requirements

- Must be created in the same GitHub account/organization where repositories are located
- Callback URL must be exactly: `http://localhost:3000/callback`
- No specific homepage URL required (can use `https://github.com`)

## Troubleshooting

### Common Issues

1. **Browser doesn't open**: Check terminal for error messages, ensure `open` package is installed
2. **OAuth App access**: Ensure OAuth App is created in the correct GitHub account/org
3. **Callback URL mismatch**: Verify callback URL is exactly `http://localhost:3000/callback`
4. **Port conflicts**: Ensure port 3000 is available during authorization

### Fallback Options

- Users can still manually configure OAuth Apps if guided setup fails
- Clear error messages guide users to GitHub's OAuth App settings
- Documentation provides step-by-step OAuth App creation instructions

## Dependencies

### New Dependencies

- **`open`**: Opens the browser for OAuth authorization
- Uses Node.js built-in `http` and `crypto` modules for OAuth server and security

### Updated Types

- Enhanced `AppConfig` interface with `clientSecret` field
- OAuth-specific types for token exchange and verification
- Updated authentication flow types

This migration significantly improves the security posture and user experience of the Copilot PR Monitor while following GitHub's recommended authentication patterns.
