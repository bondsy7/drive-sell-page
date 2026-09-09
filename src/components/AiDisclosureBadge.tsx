import React from "react";
import { cn } from "@/lib/utils";
import {
  getAiDisclosureLabelAlt,
  getAiDisclosureLabelAsset,
  getAiDisclosureText,
  getAiDisclosureKind,
  type AiDisclosureContext,
} from "@/lib/ai-disclosure";

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
      "inline-flex items-center",
      overlay
        ? "absolute right-2 top-2 z-10"
        : "align-middle",
      className,
    )}
    title={getAiDisclosureText(context)}
  >
    <img
      src={getAiDisclosureLabelAsset(context)}
      alt={getAiDisclosureLabelAlt(context)}
      className={cn(
        "block w-auto object-contain",
        getAiDisclosureKind(context) === "basic" ? "h-7" : "h-5 sm:h-6",
      )}
    />
  </span>
);

export default AiDisclosureBadge;
