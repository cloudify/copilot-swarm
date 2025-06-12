import { useState, useEffect } from "react";

/**
 * Hook to provide animation frame updates
 * @param intervalMs - Update interval in milliseconds
 * @returns current frame number
 */
export function useAnimation(intervalMs: number = 150): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => prev + 1);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return frame;
}
