import { useState, useEffect } from "react";

interface TerminalSize {
  width: number;
  height: number;
  columns: number;
  rows: number;
}

export function useTerminalSize(): TerminalSize {
  const [size, setSize] = useState<TerminalSize>({
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
    columns: 80,
    rows: 24,
  });

  useEffect(() => {
    if (typeof window === "undefined") {return;}

    const updateSize = () => {
      const charWidth = 8; // Approximate character width in pixels
      const charHeight = 16; // Approximate character height in pixels
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      setSize({
        width: newWidth,
        height: newHeight,
        columns: Math.floor(newWidth / charWidth),
        rows: Math.floor(newHeight / charHeight),
      });
    };

    // Listen for window resize events
    window.addEventListener("resize", updateSize);

    // Initial size update
    updateSize();

    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  return size;
}
