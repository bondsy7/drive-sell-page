import React, { useState, useEffect } from "react";
import ProShell from "./CanvasBannerStudioProShell";
import QuickShell from "./CanvasBannerStudioQuickShell";

const MODE_KEY = "cbs:mode";
type Mode = "quick" | "pro";

/**
 * Top-level entry that switches between Quick (default) and optional Pro mode.
 * Choice is persisted in localStorage.
 */
const CanvasBannerStudioShell: React.FC = () => {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "quick";
    const stored = localStorage.getItem(MODE_KEY) as Mode | null;
    return stored === "pro" || stored === "quick" ? stored : "quick";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  if (mode === "quick") {
    return <QuickShell onSwitchToPro={() => setMode("pro")} />;
  }
  return <ProShell onSwitchToQuick={() => setMode("quick")} />;
};

export default CanvasBannerStudioShell;
