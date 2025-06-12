import React from "react";
import { motion } from "framer-motion";
import { useAnimation } from "../../hooks/useAnimation";

interface EnhancedWorkingStatusProps {
  theme: string;
  className?: string;
  size?: "small" | "medium" | "large";
}

const PULSE_COLORS = [
  "#00ff00", // Green
  "#00ffff", // Cyan
  "#ff6600", // Orange
  "#ffff00", // Yellow
  "#ff0066", // Pink
  "#9966ff", // Purple
];

export const EnhancedWorkingStatus: React.FC<EnhancedWorkingStatusProps> = ({
  theme,
  className = "",
  size = "medium",
}) => {
  const colorFrame = useAnimation(500); // Color cycling

  const currentColor = PULSE_COLORS[colorFrame % PULSE_COLORS.length];

  const sizeClasses = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg",
  };

  return (
    <motion.div
      className={`inline-flex items-center gap-3 ${sizeClasses[size]} ${className}`}
      animate={{
        scale: [1, 1.03, 1],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {/* Spinning Circle Loader */}
      <motion.div
        className="w-5 h-5 rounded-full border-2 border-transparent"
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
      <motion.div className="flex flex-col">
        <motion.span
          className={`text-terminal-${theme} font-bold`}
          style={{
            color: currentColor,
            textShadow: `0 0 8px ${currentColor}`,
          }}
          animate={{
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          AI NEURAL SWARM ACTIVE
        </motion.span>
        <motion.span
          className="text-xs opacity-70"
          animate={{
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.3,
          }}
        >
          Clone army is working...
        </motion.span>
      </motion.div>
    </motion.div>
  );
};

export default EnhancedWorkingStatus;
