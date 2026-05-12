import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type Row = { id: string; image_url: string | null; image_base64: string | null; perspective: string | null; created_at: string };

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
}

const GalleryPickerDialog: React.FC<Props> = ({ open, onClose, onPick }) => {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("project_images")
          .select("id, image_url, image_base64, perspective, created_at")
          .order("created_at", { ascending: false })
          .limit(60);
        if (!cancel) setItems((data as Row[]) || []);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open]);

  const resolveSrc = (r: Row) => {
    if (r.image_url) return r.image_url;
    if (r.image_base64) {
      return r.image_base64.startsWith("data:") ? r.image_base64 : `data:image/jpeg;base64,${r.image_base64}`;
    }
    return "";
  };

  const handlePick = (r: Row) => {
    const src = resolveSrc(r);
    if (!src) return;
    onPick(src);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bild aus Galerie wählen</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade Galerie…
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Noch keine Bilder in deiner Galerie.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto">
            {items.map((r) => {
              const src = resolveSrc(r);
              if (!src) return null;
              return (
                <button
                  key={r.id}
                  onClick={() => handlePick(r)}
                  className="group relative aspect-square overflow-hidden rounded-md border border-border hover:border-accent"
                  title={r.perspective || "Galerie-Bild"}
                >
                  <img src={src} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GalleryPickerDialog;
