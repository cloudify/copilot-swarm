import React from "react";
import SafeText from "./SafeText.js";
import type { TextProps } from "ink";

interface ConditionalTextProps extends Omit<TextProps, "children"> {
  condition: boolean;
  children: string;
  fallback?: string | null;
}

/**
 * ConditionalText component for safely rendering text based on a condition.
 * Prevents empty string rendering by only rendering when condition is true and text is valid.
 */
function ConditionalText({
  condition,
  children,
  fallback,
  ...props
}: ConditionalTextProps): React.ReactElement | null {
  if (!condition) {
    if (fallback && fallback.trim() !== "") {
      return <SafeText {...props}>{fallback}</SafeText>;
    }
    return null;
  }

  return <SafeText {...props}>{children}</SafeText>;
}

export default ConditionalText;
