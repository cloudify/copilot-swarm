import React from "react";
import { Box } from "ink";
import SafeText from "./SafeText.js";

interface HelpBarProps {
  terminalWidth: number;
}

function HelpBar({ terminalWidth }: HelpBarProps): React.ReactElement {
  const shortcuts = [
    { key: "Q", desc: "Quit" },
    { key: "Ctrl+C", desc: "Exit" },
  ];

  const helpText = shortcuts
    .map(({ key, desc }) => `${key}: ${desc}`)
    .join(" | ");

  return (
    <Box width={terminalWidth} justifyContent="center" flexShrink={0}>
      <SafeText color="gray">{helpText}</SafeText>
    </Box>
  );
}

export default HelpBar;
