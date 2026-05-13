import React, { useState, useEffect } from "react";
import WizardShell from "./wizard/WizardShell";
import ProShell from "./CanvasBannerStudioProShell";

const MODE_KEY = "cbs:mode";

/**
 * Top-level entry that switches between the new 3-step Wizard (default)
 * and the original 5-step Pro mode. Choice is persisted in localStorage.
 */
const CanvasBannerStudioShell: React.FC = () => {
  const [mode, setMode] = useState<"wizard" | "pro">(() => {
    if (typeof window === "undefined") return "wizard";
    return (localStorage.getItem(MODE_KEY) as "wizard" | "pro") ?? "wizard";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  return mode === "wizard"
    ? <WizardShell onSwitchToPro={() => setMode("pro")} />
    : <ProShell onSwitchToWizard={() => setMode("wizard")} />;
};

export default CanvasBannerStudioShell;
