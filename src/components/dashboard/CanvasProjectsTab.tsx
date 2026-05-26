import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Layers, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  title: string;
  vehicle_id: string | null;
  master_image_url: string | null;
  updated_at: string;
  created_at: string;
}

export default function CanvasProjectsTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("banner_projects")
      .select("id, title, vehicle_id, master_image_url, updated_at, created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRows((data as Row[]) ?? []);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase.from("banner_projects").delete().eq("id", id);
      if (error) throw error;
      setRows((r) => (r ?? []).filter((x) => x.id !== id));
      toast.success("Projekt gelöscht");
    } catch (e: any) {
      toast.error(e?.message ?? "Löschen fehlgeschlagen");
    } finally {
      setDeleting(null);
    }
  };

  if (!rows) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Lade Canvas-Projekte…</div>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <Layers className="w-8 h-8 mx-auto mb-2 opacity-60" />
        <p className="text-sm">Noch keine Canvas-Projekte. Im Banner-Studio kannst du Entwürfe als Canvas speichern – mit oder ohne verknüpftes Fahrzeug.</p>
        <Link to="/generator/canvas-banner-studio" className="inline-block mt-3">
          <Button size="sm">Banner-Studio öffnen</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <Card key={r.id} className="overflow-hidden">
          <div className="aspect-video bg-muted/40 relative">
            {r.master_image_url ? (
              <img src={r.master_image_url} alt={r.title} className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <Layers className="w-8 h-8 opacity-50" />
              </div>
            )}
            {!r.vehicle_id && (
              <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">No-VIN</Badge>
            )}
          </div>
          <div className="p-3 space-y-2">
            <div className="font-semibold text-sm text-foreground truncate">{r.title}</div>
            <div className="text-[11px] text-muted-foreground">
              Aktualisiert {new Date(r.updated_at).toLocaleString("de-DE")}
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/generator/canvas-banner-studio?project=${r.id}`} className="flex-1">
                <Button size="sm" variant="outline" className="w-full">
                  <Pencil className="w-3 h-3 mr-1" /> Weiter bearbeiten
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" disabled={deleting === r.id}>
                    {deleting === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Canvas-Projekt löschen?</AlertDialogTitle>
                    <AlertDialogDescription>„{r.title}" wird unwiderruflich entfernt.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(r.id)}>Löschen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
