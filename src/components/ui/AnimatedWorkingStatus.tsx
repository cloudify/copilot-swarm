import React from "react";
import { motion } from "framer-motion";
import { useAnimation } from "../../hooks/useAnimation";

interface AnimatedWorkingStatusProps {
  theme: string;
  className?: string;
}

const PULSE_COLORS = [
  "#00ff00", // Green
  "#00ffff", // Cyan
  "#ffff00", // Yellow
  "#ff6600", // Orange
  "#ff0066", // Pink
];

export const AnimatedWorkingStatus: React.FC<AnimatedWorkingStatusProps> = ({
  theme,
  className = "",
}) => {
  const pulseFrame = useAnimation(300); // Slower color cycling

  const currentColor = PULSE_COLORS[pulseFrame % PULSE_COLORS.length];

  return (
    <motion.div
      className={`inline-flex items-center gap-2 ${className}`}
      animate={{
        scale: [1, 1.05, 1],
        textShadow: [
          "0 0 5px currentColor",
          "0 0 15px currentColor",
          "0 0 5px currentColor",
        ],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {/* Spinning Circle Loader */}
      <motion.div
        className="w-4 h-4 rounded-full border-2 border-transparent"
        style={{
          borderLeftColor: currentColor,
          borderTopColor: currentColor,
        }}
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          rotate: { duration: 1, repeat: Infinity, ease: "linear" },
        }}
      />

      {/* Working Text */}
      <motion.span
        className={`text-terminal-${theme} font-bold`}
        animate={{
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        COPILOT WORKING
      </motion.span>
    </motion.div>
  );
};

export default AnimatedWorkingStatus;
