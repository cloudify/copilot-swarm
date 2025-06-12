import React from "react";
import { motion } from "framer-motion";
import type { EffectConfig, TerminalSize } from "../types";

interface EffectsLayerProps {
  effectConfig: EffectConfig;
  _terminalSize: TerminalSize;
}

const EffectsLayer: React.FC<EffectsLayerProps> = ({
  effectConfig,
  _terminalSize,
}) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Scanlines Effect */}
      {effectConfig.scanlines && (
        <div
          className={`crt-scanlines theme-green ${
            effectConfig.flicker ? "crt-flicker" : ""
          }`}
        />
      )}

      {/* Raster Bars */}
      {effectConfig.rasterBars && <div className="crt-raster-bars" />}

      {/* CRT Curvature Overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `
            radial-gradient(
              ellipse at center,
              transparent 0%,
              transparent 70%,
              rgba(0,0,0,0.2) 85%,
              rgba(0,0,0,0.8) 100%
            )
          `,
        }}
      />

      {/* Glow Overlay */}
      {effectConfig.glow && (
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: `
              radial-gradient(
                circle at center,
                #00ff00 0%,
                transparent 50%
              )
            `,
            filter: "blur(20px)",
          }}
        />
      )}

      {/* Chromatic Aberration Overlay */}
      {effectConfig.chromaticAberration && (
        <div className="absolute inset-0 mix-blend-mode-screen opacity-30">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, #ff0000 0%, transparent 1%, transparent 99%, #0000ff 100%)",
              transform: "translateX(-1px)",
            }}
          />
        </div>
      )}

      {/* Noise Texture */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")
          `,
          backgroundSize: "200px 200px",
        }}
      />

      {/* Dynamic Light Streaks / Glitch Transitions */}
      {effectConfig.glitchTransitions &&
        Array.from({ length: 3 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 opacity-20"
            style={{
              background: `linear-gradient(90deg, transparent, #00ff00, transparent)`,
              top: `${20 + i * 30}%`,
              left: 0,
              right: 0,
            }}
            animate={{
              scaleX: [0, 1, 0],
              opacity: [0, 0.3, 0],
            }}
            transition={{
              duration: 2 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.7,
            }}
          />
        ))}
    </div>
  );
};

export default EffectsLayer;
