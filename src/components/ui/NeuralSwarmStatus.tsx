import React from "react";
import { motion } from "framer-motion";
import { useAnimation } from "../../hooks/useAnimation";

interface NeuralSwarmStatusProps {
  status: string;
  state: "working" | "waiting" | "error" | "idle";
  theme: string;
  className?: string;
}

const SWARM_FRAMES = ["◐", "◓", "◑", "◒"];
const NEURAL_PATTERNS = ["⟡", "⟢", "⟣", "⟤", "⟥", "⟦"];

export const NeuralSwarmStatus: React.FC<NeuralSwarmStatusProps> = ({
  status,
  state,
  theme,
  className = "",
}) => {
  const fastFrame = useAnimation(80);
  const mediumFrame = useAnimation(200);
  const slowFrame = useAnimation(1000);

  const renderStatusIndicator = () => {
    switch (state) {
      case "working":
        return (
          <motion.div
            className={`inline-flex items-center gap-3 ${className}`}
            animate={{
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Main Swarm Spinner */}
            <motion.span
              className="text-xl"
              style={{
                color: ["#00ff00", "#00ffff", "#ffff00", "#ff6600"][
                  slowFrame % 4
                ],
              }}
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              {SWARM_FRAMES[fastFrame % SWARM_FRAMES.length]}
            </motion.span>

            {/* Neural Network Pattern */}
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((index) => (
                <motion.span
                  key={index}
                  className="text-sm"
                  style={{
                    color: `hsl(${
                      (mediumFrame * 10 + index * 60) % 360
                    }, 70%, 60%)`,
                  }}
                  animate={{
                    opacity: [0.3, 1, 0.3],
                    scale: [0.8, 1.2, 0.8],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: index * 0.1,
                    ease: "easeInOut",
                  }}
                >
                  {NEURAL_PATTERNS[index]}
                </motion.span>
              ))}
            </div>

            {/* Status Text */}
            <motion.span
              className={`text-terminal-${theme} font-bold`}
              animate={{
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
              {status}
            </motion.span>
          </motion.div>
        );

      case "waiting":
        return (
          <motion.div
            className={`inline-flex items-center gap-2 ${className}`}
            animate={{
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <motion.span
              className={`text-terminal-${theme}`}
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              ⏳
            </motion.span>
            <span className={`text-terminal-${theme}`}>{status}</span>
          </motion.div>
        );

      case "error":
        return (
          <motion.div
            className={`inline-flex items-center gap-2 ${className}`}
            animate={{
              x: [-1, 1, -1],
            }}
            transition={{
              duration: 0.3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <motion.span
              className="text-red-500"
              animate={{
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              ❌
            </motion.span>
            <span className="text-red-500">{status}</span>
          </motion.div>
        );

      default:
        return (
          <div className={`inline-flex items-center gap-2 ${className}`}>
            <span className={`text-terminal-${theme} opacity-60`}>⚪</span>
            <span className={`text-terminal-${theme} opacity-60`}>
              {status}
            </span>
          </div>
        );
    }
  };

  return renderStatusIndicator();
};

export default NeuralSwarmStatus;
