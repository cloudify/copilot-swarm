import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  FontConfig,
  EffectConfig,
  TerminalSize,
  ConsoleState,
} from "../types";
import CommandRouter from "./CommandRouter";

interface ConsoleProps {
  fontConfig: FontConfig;
  effectConfig: EffectConfig;
  terminalSize: TerminalSize;
}

const Console: React.FC<ConsoleProps> = ({
  fontConfig,
  effectConfig,
  terminalSize,
}) => {
  const [consoleState, setConsoleState] = useState<ConsoleState>({
    history: [
      "Neural Swarm Command Interface v3.0 - Hive Mind Active",
      'Type "help" to access clone protocols',
      "",
    ],
    currentInput: "",
    isProcessing: false,
    cursor: true,
  });

  const inputRef = useRef<React.ElementRef<"input">>(null);
  const consoleRef = useRef<React.ElementRef<"div">>(null);

  // Cursor blinking effect
  useEffect(() => {
    const interval = setInterval(() => {
      setConsoleState((prev) => ({ ...prev, cursor: !prev.cursor }));
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleState.history]);

  // Focus input on component mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const addToHistory = useCallback((text: string) => {
    setConsoleState((prev) => ({
      ...prev,
      history: [...prev.history, text],
    }));
  }, []);

  const executeCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) {return;}

      // Add command to history
      addToHistory(`> ${command}`);

      setConsoleState((prev) => ({
        ...prev,
        currentInput: "",
        isProcessing: true,
      }));

      try {
        // Simulate processing delay for dramatic effect
        await new Promise((resolve) => setTimeout(resolve, 200));

        const result = await CommandRouter.execute(command, "green");

        if (result) {
          // Handle multi-line results
          const lines = result.split("\n");
          lines.forEach((line) => addToHistory(line));
        }
      } catch (error) {
        addToHistory(
          `ERROR: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }

      setConsoleState((prev) => ({ ...prev, isProcessing: false }));
    },
    [addToHistory]
  );

  const handleKeyPress = (
    event: React.KeyboardEvent<React.ElementRef<"input">>
  ) => {
    if (event.key === "Enter" && !consoleState.isProcessing) {
      executeCommand(consoleState.currentInput);
    }
  };

  const handleInputChange = (
    event: React.ChangeEvent<React.ElementRef<"input">>
  ) => {
    setConsoleState((prev) => ({
      ...prev,
      currentInput: event.target.value,
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="h-screen w-screen bg-crt-dark text-terminal-green overflow-hidden relative"
      style={{ fontFamily: fontConfig.primary }}
    >
      {/* Header */}
      <div className="border-b border-current p-4">
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`text-2xl font-bold text-terminal-green crt-glow text-center`}
          style={{ fontFamily: fontConfig.display }}
        >
          COPILOT NEURAL SWARM - COMMAND INTERFACE
        </motion.h1>
        <div className="text-center text-sm opacity-70 mt-2">
          AI Swarm Nodes: 42 | Neural Network: OPERATIONAL | Theme:{" "}
          GREEN
        </div>
      </div>

      {/* Console Output */}
      <div
        ref={consoleRef}
        className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-track-crt-dark scrollbar-thumb-current"
        style={{ height: "calc(100vh - 180px)" }}
      >
        <AnimatePresence>
          {consoleState.history.map((line, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`font-mono text-sm leading-relaxed ${
                line.startsWith(">")
                  ? `text-terminal-green font-bold`
                  : line.startsWith("ERROR")
                  ? "text-terminal-red"
                  : line.startsWith("SUCCESS")
                  ? `text-terminal-green`
                  : "text-gray-300"
              } ${
                effectConfig.glow &&
                (line.startsWith(">") || line.startsWith("SUCCESS"))
                  ? "crt-glow"
                  : ""
              }`}
            >
              {line}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Processing Indicator */}
        {consoleState.isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`text-terminal-green font-mono text-sm mt-2`}
          >
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              Processing...
            </motion.span>
          </motion.div>
        )}
      </div>

      {/* Input Line */}
      <div className="border-t border-current p-4">
        <div className="flex items-center space-x-2">
          <span className={`text-terminal-green font-bold crt-glow`}>
            COPILOT&gt;
          </span>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={consoleState.currentInput}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              disabled={consoleState.isProcessing}
              className="w-full bg-transparent border-none outline-none text-gray-300 font-mono"
              style={{ caretColor: "transparent" }}
              autoComplete="off"
              spellCheck={false}
            />
            {/* Custom Cursor */}
            <motion.span
              animate={{ opacity: consoleState.cursor ? 1 : 0 }}
              className={`absolute top-0 bg-terminal-green w-2 h-5 pointer-events-none`}
              style={{ left: `${consoleState.currentInput.length * 0.6}em` }}
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-crt-medium text-xs p-2 flex justify-between items-center border-t border-current">
        <div className="flex space-x-4">
          <span>CONN: SECURE</span>
          <span>LAT: 42ms</span>
          <span>MEM: {Math.round(Math.random() * 100)}%</span>
        </div>
        <div className="flex space-x-4">
          <span>
            SIZE: {terminalSize.columns}x{terminalSize.rows}
          </span>
          <span className={`text-terminal-green`}>●</span>
        </div>
      </div>
    </motion.div>
  );
};

export default Console;
