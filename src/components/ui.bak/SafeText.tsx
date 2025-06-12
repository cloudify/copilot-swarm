import React from "react";
import type { TextProps } from "ink";
import { Text } from "ink";

interface SafeTextProps extends Omit<TextProps, "children"> {
  children?: string | (string | number)[] | number | null | undefined;
  fallback?: string;
}

/**
 * SafeText component that safely renders text content.
 * Prevents empty string rendering errors by handling null/undefined/empty values.
 */
function SafeText({
  children,
  fallback = "",
  ...props
}: SafeTextProps): React.ReactElement | null {
  // Handle arrays of children by joining them
  if (Array.isArray(children)) {
    const joined = children
      .filter((child) => child != null && child !== "")
      .join("");

    if (joined.trim() === "") {
      if (fallback.trim() === "") {
        return null;
      }
      return <Text {...props}>{fallback}</Text>;
    }

    return <Text {...props}>{joined}</Text>;
  }

  // Return null if no valid content to render
  if (
    children == null ||
    (typeof children === "string" && children.trim() === "")
  ) {
    if (fallback.trim() === "") {
      return null;
    }
    return <Text {...props}>{fallback}</Text>;
  }

  return <Text {...props}>{children}</Text>;
}

export default SafeText;
