/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./public/**/*.html"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["Roboto Mono", "Courier New", "monospace"],
        space: ["Space Mono", "monospace"],
        pixel: ["Press Start 2P", "monospace"],
        major: ["Major Mono Display", "monospace"],
      },
      colors: {
        terminal: {
          green: "#00ff00",
          amber: "#ffb000",
          blue: "#00aaff",
          red: "#ff0000",
          cyan: "#00ffff",
          magenta: "#ff00ff",
          yellow: "#ffff00",
        },
        crt: {
          dark: "#0a0a0a",
          medium: "#1a1a1a",
          light: "#2a2a2a",
          glow: "#00ff0033",
        },
      },
      animation: {
        scanline: "scanline 2s linear infinite",
        flicker: "flicker 0.3s infinite linear",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite alternate",
        "sine-wave": "sine-wave 6s ease-in-out infinite",
        "raster-bar": "raster-bar 4s linear infinite",
        glitch: "glitch 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both",
        "boot-text": "boot-text 0.5s ease-out forwards",
        countdown: "countdown 1s ease-in-out",
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-100vh)" },
          "100%": { transform: "translateY(100vh)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.98" },
        },
        "glow-pulse": {
          from: {
            textShadow:
              "0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor",
            filter: "brightness(1)",
          },
          to: {
            textShadow:
              "0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor",
            filter: "brightness(1.2)",
          },
        },
        "sine-wave": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "raster-bar": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        glitch: {
          "0%": {
            transform: "translate(0)",
            filter: "hue-rotate(0deg)",
          },
          "20%": {
            transform: "translate(-2px, 2px)",
            filter: "hue-rotate(90deg)",
          },
          "40%": {
            transform: "translate(-2px, -2px)",
            filter: "hue-rotate(180deg)",
          },
          "60%": {
            transform: "translate(2px, 2px)",
            filter: "hue-rotate(270deg)",
          },
          "80%": {
            transform: "translate(2px, -2px)",
            filter: "hue-rotate(360deg)",
          },
          "100%": {
            transform: "translate(0)",
            filter: "hue-rotate(0deg)",
          },
        },
        "boot-text": {
          "0%": {
            opacity: "0",
            transform: "translateX(-10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        countdown: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.2)", opacity: "0.8" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      backdropBlur: {
        crt: "1px",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
