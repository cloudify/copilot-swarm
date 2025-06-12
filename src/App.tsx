import React, { useState } from "react";
import "./styles/crt.css";

// Import components
import BootSequence from "./components/BootSequence";
import Console from "./components/Console";
import EffectsLayer from "./components/EffectsLayer";

// Import hooks
import { useTerminalSize } from "./hooks/useTerminalSize";

// Import types
import type { FontConfig } from "./types";

// Fixed effect configuration - no longer configurable
const FIXED_EFFECT_CONFIG = {
  scanlines: true,
  glow: true,
  flicker: true,
  chromaticAberration: false,
  rasterBars: false,
  glitchTransitions: true,
};

interface AppState {
  isBooted: boolean;
  fontConfig: FontConfig;
  isLoading: boolean;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isBooted: false,
    fontConfig: {
      primary: "Roboto Mono",
      display: "Press Start 2P",
      size: "medium",
    },
    isLoading: true,
  });

  const terminalSize = useTerminalSize();

  // Boot sequence completion handler
  const handleBootComplete = () => {
    setState((prev) => ({ ...prev, isBooted: true, isLoading: false }));
  };

  return (
    <div
      className={`
        h-screen w-screen overflow-hidden bg-crt-dark text-terminal-green
        font-${state.fontConfig.primary.toLowerCase().replace(" ", "-")}
        relative
      `}
      style={{
        fontFamily: state.fontConfig.primary,
        fontSize:
          state.fontConfig.size === "small"
            ? "12px"
            : state.fontConfig.size === "large"
            ? "16px"
            : "14px",
      }}
    >
      {/* Google Fonts Preloader */}
      <link
        href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@300;400;500;700&family=Space+Mono:wght@400;700&family=Press+Start+2P&family=Major+Mono+Display&display=swap"
        rel="stylesheet"
      />

      {/* Effects Layer */}
      <EffectsLayer
        effectConfig={FIXED_EFFECT_CONFIG}
        _terminalSize={terminalSize}
      />

      {/* Main Content */}
      <div className="relative z-10">
        {!state.isBooted ? (
          <BootSequence
            key="boot"
            fontConfig={state.fontConfig}
            onBootComplete={handleBootComplete}
          />
        ) : (
          <Console
            key="console"
            fontConfig={state.fontConfig}
            effectConfig={FIXED_EFFECT_CONFIG}
            terminalSize={terminalSize}
          />
        )}
      </div>
    </div>
  );
};

export default App;
