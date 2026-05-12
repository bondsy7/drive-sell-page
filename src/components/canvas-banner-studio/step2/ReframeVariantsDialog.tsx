import React, { useState } from "react";
import { Loader2, Sparkles, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { reframeImageForFormat } from "../ai/reframeClient";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceImageUrl?: string;
  targetWidth: number;
  targetHeight: number;
  onPick: (url: string) => void;
}

interface Variant {
  url?: string;
  loading: boolean;
  error?: string;
}

const ReframeVariantsDialog: React.FC<Props> = ({
  open, onOpenChange, sourceImageUrl, targetWidth, targetHeight, onPick,
}) => {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [busy, setBusy] = useState(false);

  const startGeneration = async () => {
    if (!sourceImageUrl || !sourceImageUrl.startsWith("data:")) {
      toast.error("Quelle ist kein Daten-URL — bitte Master neu hochladen.");
      return;
    }
    setBusy(true);
    setVariants([{ loading: true }, { loading: true }, { loading: true }]);
    const updateAt = (i: number, v: Variant) => {
      setVariants((prev) => {
        const next = [...prev];
        next[i] = v;
        return next;
      });
    };
    await Promise.all(
      [0, 1, 2].map(async (i) => {
        try {
          const out = await reframeImageForFormat(sourceImageUrl, targetWidth, targetHeight);
          updateAt(i, { loading: false, url: out.imageDataUrl });
        } catch (e: any) {
          console.error("variant reframe failed", i, e);
          updateAt(i, { loading: false, error: e?.message ?? "Fehler" });
        }
      }),
    );
    setBusy(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) setVariants([]);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            Reframe-Varianten · {targetWidth}×{targetHeight}
          </DialogTitle>
        </DialogHeader>

        {variants.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Erzeuge gleich 3 unterschiedliche Reframe-Versionen vom Master und wähle die beste aus.
              Spart Zeit gegenüber wiederholtem Einzelreframe.
            </p>
            <Button onClick={startGeneration} disabled={busy || !sourceImageUrl}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              3 Varianten erzeugen
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {variants.map((v, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-muted/30 overflow-hidden flex flex-col"
                >
                  <div className="aspect-video bg-background flex items-center justify-center">
                    {v.loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
                    {!v.loading && v.url && (
                      <img src={v.url} alt={`Variante ${i + 1}`} className="w-full h-full object-cover" />
                    )}
                    {!v.loading && !v.url && (
                      <div className="text-xs text-destructive p-3 text-center">{v.error ?? "Fehler"}</div>
                    )}
                  </div>
                  <div className="p-2 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Variante {i + 1}</span>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={!v.url}
                      onClick={() => {
                        if (v.url) {
                          onPick(v.url);
                          handleClose(false);
                        }
                      }}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Diese
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={startGeneration} disabled={busy}>
                {busy ? "Läuft…" : "Erneut generieren"}
              </Button>
              <Button variant="ghost" onClick={() => handleClose(false)}>Abbrechen</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReframeVariantsDialog;
