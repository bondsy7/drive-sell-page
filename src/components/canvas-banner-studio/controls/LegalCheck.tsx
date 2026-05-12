import React, { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { BannerComposition, BannerFormat, BannerTextFields } from "../state/types";

interface LegalCheckProps {
  format: BannerFormat;
  composition: BannerComposition;
  textFields: BannerTextFields;
}

interface Issue {
  severity: "warn" | "info";
  message: string;
}

const MIN_LEGAL_PX_LARGE = 12;
const MIN_LEGAL_PX_SMALL = 9;

const LegalCheck: React.FC<LegalCheckProps> = ({ format, composition, textFields }) => {
  const issues = useMemo<Issue[]>(() => {
    const list: Issue[] = [];
    const isSmall = format.width < 400 || format.height < 300;
    const minPx = isSmall ? MIN_LEGAL_PX_SMALL : MIN_LEGAL_PX_LARGE;

    const legalLayer = composition.layers.find((l) => l.type === "legal");
    const hasLegalText = !!textFields.legalText?.trim();

    if (hasLegalText && legalLayer?.visible) {
      if ((legalLayer.fontSize ?? 0) < minPx) {
        list.push({
          severity: "warn",
          message: `Pflichtangaben-Schrift ist sehr klein (${legalLayer.fontSize}px). Empfohlen ≥ ${minPx}px für Lesbarkeit.`,
        });
      }
      // Safe-area check: legal layer outside 5% padding?
      const pad = Math.round(Math.min(format.width, format.height) * 0.05);
      if (legalLayer.x < pad || legalLayer.y < pad) {
        list.push({
          severity: "info",
          message: "Pflichtangaben liegen außerhalb des Sicherheitsbereichs (5% Rand).",
        });
      }
      // Width check
      if ((legalLayer.width ?? 0) > format.width - 2 * pad) {
        list.push({
          severity: "info",
          message: "Pflichtangaben-Block ist breiter als der empfohlene Sicherheitsbereich.",
        });
      }
    } else if (textFields.price?.trim()) {
      list.push({
        severity: "warn",
        message: "Bei Preisangabe sind in DE Pflichtangaben (Kraftstoffverbrauch / CO₂) erforderlich. Aktuell kein Pflichttext sichtbar.",
      });
    }

    if (isSmall && hasLegalText) {
      list.push({
        severity: "info",
        message: "Display-Format ist klein – prüfe, ob alle Pflichtangaben rechtssicher untergebracht werden können oder ob ein Disclaimer-Link genügt.",
      });
    }

    return list;
  }, [format, composition, textFields]);

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4" />
        <span>Keine Compliance-Hinweise – sieht gut aus.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((i, idx) => (
        <div
          key={idx}
          className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${
            i.severity === "warn"
              ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200"
              : "border-border bg-muted/40 text-muted-foreground"
          }`}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{i.message}</span>
        </div>
      ))}
    </div>
  );
};

export default LegalCheck;
