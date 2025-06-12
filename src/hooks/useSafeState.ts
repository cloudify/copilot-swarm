import { useState, useCallback } from "react";

/**
 * Hook for managing error state safely.
 * Ensures error states never contain empty strings.
 */
export function useErrorState(initialError: string | null = null) {
  const [error, setErrorInternal] = useState<string | null>(initialError);

  const setError = useCallback((newError: string | null | undefined) => {
    if (!newError || typeof newError !== "string" || newError.trim() === "") {
      setErrorInternal(null);
    } else {
      setErrorInternal(newError.trim());
    }
  }, []);

  const clearError = useCallback(() => setErrorInternal(null), []);

  const hasError = error !== null;

  return {
    error,
    setError,
    clearError,
    hasError,
  };
}

/**
 * Hook for managing optional text content safely.
 * Ensures text states never contain empty strings.
 */
export function useSafeTextState(initialText: string | null = null) {
  const [text, setTextInternal] = useState<string | null>(initialText);

  const setText = (newText: string | null | undefined) => {
    if (!newText || typeof newText !== "string" || newText.trim() === "") {
      setTextInternal(null);
    } else {
      setTextInternal(newText.trim());
    }
  };

  const clearText = () => setTextInternal(null);

  const hasText = text !== null;

  return {
    text,
    setText,
    clearText,
    hasText,
  };
}
