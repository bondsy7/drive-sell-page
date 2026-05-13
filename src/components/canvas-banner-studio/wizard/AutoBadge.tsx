import React from "react";
import { Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  source?: string;
  className?: string;
}

/** Tiny "✨ auto" pill shown next to fields that were auto-filled. */
const AutoBadge: React.FC<Props> = ({ source = "Automatisch befüllt", className = "" }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider cursor-help ${className}`}
      >
        <Sparkles className="w-2.5 h-2.5" />
        auto
      </span>
    </TooltipTrigger>
    <TooltipContent>
      <p className="text-xs">{source} – beim Tippen wird der Wert manuell überschrieben.</p>
    </TooltipContent>
  </Tooltip>
);

export default AutoBadge;
