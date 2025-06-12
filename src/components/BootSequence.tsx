import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { FontConfig, BootMessage } from "../types";

interface BootSequenceProps {
  fontConfig: FontConfig;
  onBootComplete: () => void;
}

const createBootMessages = (fontConfig: FontConfig): BootMessage[] => [
  { text: "NEURAL SWARM INITIALIZATION...", delay: 0, type: "normal" },
  { text: "Loading Copilot Clone Army v3.0", delay: 500, type: "normal" },
  { text: "Establishing hive mind connection...", delay: 1000, type: "normal" },
  {
    text: "SWARM_TOKEN: ████████████████ [AUTHENTICATED]",
    delay: 1500,
    type: "success",
  },
  { text: "Calibrating neural pathways...", delay: 2000, type: "normal" },
  { text: "Loading holographic displays...", delay: 2200, type: "normal" },
  {
    text: `NEURAL_FONT: ${fontConfig.primary} [LOADED]`,
    delay: 2400,
    type: "success",
  },
  {
    text: `DISPLAY_MATRIX: ${fontConfig.display} [ACTIVE]`,
    delay: 2600,
    type: "success",
  },
  { text: "Encrypting quantum channels...", delay: 2800, type: "normal" },
  {
    text: "Minion network synchronized [ONLINE]",
    delay: 3200,
    type: "success",
  },
  {
    text: "GitHub mainframe access granted [BREACHED]",
    delay: 3600,
    type: "success",
  },
  { text: "CRT scanning array calibration...", delay: 4000, type: "normal" },
  {
    text: `NEURAL_THEME: GREEN [SYNCHRONIZED]`,
    delay: 4200,
    type: "success",
  },
  { text: "Deploying surveillance drones...", delay: 4600, type: "normal" },
  {
    text: "Repository infiltration complete [PWNED]",
    delay: 5000,
    type: "success",
  },
  { text: "Loading command protocols...", delay: 5200, type: "normal" },
  { text: "JOSHUA AI module activated [READY]", delay: 5400, type: "success" },
  {
    text: "FALKEN protocol synchronized [ARMED]",
    delay: 5600,
    type: "success",
  },
  { text: "WAR_GAMES simulation online [LIVE]", delay: 5800, type: "success" },
  { text: "", delay: 6200, type: "normal" },
  { text: "SWARM INTELLIGENCE ACTIVE", delay: 6500, type: "success" },
  { text: "Welcome to the Neural Hive...", delay: 7000, type: "normal" },
];

const BootSequence: React.FC<BootSequenceProps> = ({
  fontConfig,
  onBootComplete,
}) => {
  const [displayedMessages, setDisplayedMessages] = useState<BootMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const bootMessages = createBootMessages(fontConfig);

  useEffect(() => {
    if (currentIndex >= bootMessages.length) {
      setTimeout(onBootComplete, 1000);
      return;
    }

    const currentMessage = bootMessages[currentIndex];
    const timer = setTimeout(() => {
      setDisplayedMessages((prev) => [...prev, currentMessage]);
      setCurrentIndex((prev) => prev + 1);
      setProgress(((currentIndex + 1) / bootMessages.length) * 100);
    }, currentMessage.delay);

    return () => clearTimeout(timer);
  }, [currentIndex, onBootComplete, bootMessages]);

  const getMessageColor = (type?: string) => {
    switch (type) {
      case "success":
        return `text-terminal-green`;
      case "error":
        return "text-terminal-red";
      case "warning":
        return "text-terminal-yellow";
      default:
        return "text-gray-300";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-screen w-screen bg-crt-dark overflow-hidden relative flex flex-col"
      style={{ fontFamily: fontConfig.primary }}
    >
      {/* Header */}
      <div className="text-center pt-8 pb-4">
        <motion.h1
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className={`text-4xl font-bold text-terminal-green crt-glow`}
          style={{ fontFamily: fontConfig.display }}
        >
          COPILOT NEURAL SWARM
        </motion.h1>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ delay: 0.8, duration: 2 }}
          className={`h-1 bg-terminal-green mx-auto mt-4 max-w-md crt-glow`}
        />
      </div>

      {/* Boot Messages */}
      <div className="flex-1 px-8 py-4 overflow-hidden">
        <div className="space-y-1 font-mono text-sm">
          {displayedMessages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className={`${getMessageColor(message.type)} ${
                message.type === "success" ? "crt-glow" : ""
              }`}
            >
              {message.text && (
                <>
                  <span className="text-gray-500">
                    [{new Date().toLocaleTimeString()}]
                  </span>{" "}
                  {message.text}
                </>
              )}
            </motion.div>
          ))}
        </div>

        {/* Cursor */}
        {currentIndex < bootMessages.length && (
          <motion.div
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className={`inline-block w-2 h-4 bg-terminal-green ml-1 mt-1`}
          />
        )}
      </div>

      {/* Progress Bar */}
      <div className="px-8 pb-8">
        <div className="mb-2 text-sm text-gray-400">
          System Initialization: {Math.round(progress)}%
        </div>
        <div className="w-full bg-gray-800 h-2 rounded">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
            className={`h-2 bg-terminal-green rounded crt-glow`}
          />
        </div>
      </div>

      {/* ASCII Art Footer */}
      <div className="pb-4 text-center">
        <motion.pre
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className={`text-xs text-terminal-green opacity-30 ascii-art`}
        >
          {`
    ╔══════════════════════════════════════════╗
    ║  AUTHORIZED PERSONNEL ONLY - CLASS A5   ║
    ║  NEURAL INTERFACE ACTIVE                 ║
    ╚══════════════════════════════════════════╝
`}
        </motion.pre>
      </div>

      {/* Matrix rain effect */}
      <div className="matrix-rain">
        {Array.from({ length: 50 }).map((_, i) => (
          <motion.div
            key={i}
            className="matrix-char"
            style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${Math.random() * 3 + 2}s`,
              animationDelay: `${Math.random() * 5}s`,
            }}
            animate={{
              y: ["0vh", "100vh"],
              opacity: [1, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          >
            {String.fromCharCode(Math.random() * 26 + 65)}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default BootSequence;
