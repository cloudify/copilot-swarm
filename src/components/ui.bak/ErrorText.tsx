import React from "react";
import SafeText from "./SafeText.js";

interface ErrorTextProps {
  error: string | null | undefined;
}

/**
 * ErrorText component for safely displaying error messages.
 * Only renders when there's a valid error message.
 */
function ErrorText({ error }: ErrorTextProps): React.ReactElement | null {
  if (!error || typeof error !== "string" || error.trim() === "") {
    return null;
  }

  return <SafeText color="red">{error.trim()}</SafeText>;
}

export default ErrorText;
