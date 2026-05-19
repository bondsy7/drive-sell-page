import React, { useState } from "react";
import ProShell from "./CanvasBannerStudioProShell";
import QuickShell from "./CanvasBannerStudioQuickShell";

type Mode = "quick" | "pro";

/**
 * Top-level entry that switches between Quick (default) and optional Pro mode.
 */
const CanvasBannerStudioShell: React.FC = () => {
  const [mode, setMode] = useState<Mode>("quick");

  if (mode === "quick") {
    return <QuickShell onSwitchToPro={() => setMode("pro")} />;
  }
  return <ProShell onSwitchToQuick={() => setMode("quick")} />;
};

export default CanvasBannerStudioShell;
