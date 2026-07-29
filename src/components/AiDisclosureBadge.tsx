import React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAiDisclosureText, type AiDisclosureContext } from "@/lib/ai-disclosure";

interface AiDisclosureBadgeProps {
  context?: AiDisclosureContext;
  className?: string;
  /** Als Overlay auf einem Bild/Viewer positionieren */
  overlay?: boolean;
}

/**
 * Sichtbare KI-Kennzeichnung gem. EU AI Act Art. 50 Abs. 4.
 * Darf nicht entfernbar sein, wo KI-Medien nach außen sichtbar werden.
 */
const AiDisclosureBadge: React.FC<AiDisclosureBadgeProps> = ({
  context = "banner",
  className,
  overlay = false,
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold leading-none",
      overlay
        ? "absolute bottom-2 left-2 z-10 bg-black/60 text-white backdrop-blur-sm"
        : "bg-muted text-muted-foreground",
      className,
    )}
    title={getAiDisclosureText(context)}
  >
    <Sparkles className="h-3 w-3" />
    {getAiDisclosureText(context)}
  </span>
);

export default AiDisclosureBadge;
