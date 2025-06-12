/**
 * Enhanced TypeScript types for safer text handling in Ink applications.
 */

/**
 * A non-empty string type that prevents empty strings at compile time.
 * Use this for values that should never be empty.
 */
export type NonEmptyString = string & { readonly __brand: unique symbol };

/**
 * Type guard to check if a string is non-empty.
 */
export function isNonEmptyString(value: string): value is NonEmptyString {
  return value.trim().length > 0;
}

/**
 * Creates a NonEmptyString from a regular string.
 * Throws an error if the string is empty.
 */
export function createNonEmptyString(value: string): NonEmptyString {
  if (!isNonEmptyString(value)) {
    throw new Error("Cannot create NonEmptyString from empty string");
  }
  return value as NonEmptyString;
}

/**
 * Safely creates a NonEmptyString, returning null if the input is empty.
 */
export function safeNonEmptyString(
  value: string | null | undefined
): NonEmptyString | null {
  if (!value || typeof value !== "string" || !isNonEmptyString(value)) {
    return null;
  }
  return value as NonEmptyString;
}

/**
 * Safe text content type for Ink components.
 * Either a non-empty string or null (which renders nothing).
 */
export type SafeTextContent = NonEmptyString | null;

/**
 * Error state type that can only be null or a non-empty string.
 */
export type ErrorState = NonEmptyString | null;

/**
 * Props for components that display safe text content.
 */
export interface SafeTextProps {
  content: SafeTextContent;
  fallback?: SafeTextContent;
}

/**
 * Props for components that display error messages.
 */
export interface ErrorDisplayProps {
  error: ErrorState;
}
