import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Download, Trash2, Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

type Song = {
  id: string;
  title: string;
  prompt: string | null;
  lyrics: string | null;
  storage_path: string;
  mime_type: string;
  model: string | null;
  created_at: string;
};

export default function SongsTab() {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_songs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Songs konnten nicht geladen werden");
      setLoading(false);
      return;
    }
    const rows = (data || []) as Song[];
    setSongs(rows);
    // Signed URLs (1h)
    const next: Record<string, string> = {};
    await Promise.all(
      rows.map(async (s) => {
        const { data: signed } = await supabase.storage
          .from("songs")
          .createSignedUrl(s.storage_path, 3600);
        if (signed?.signedUrl) next[s.id] = signed.signedUrl;
      })
    );
    setUrls(next);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (s: Song) => {
    if (!confirm(`"${s.title}" löschen?`)) return;
    await supabase.storage.from("songs").remove([s.storage_path]);
    await supabase.from("user_songs").delete().eq("id", s.id);
    setSongs((prev) => prev.filter((x) => x.id !== s.id));
    toast.success("Song gelöscht");
  };

  const handleDownload = (s: Song) => {
    const url = urls[s.id];
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s.title}.${s.mime_type.includes("wav") ? "wav" : "mp3"}`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <Card className="p-10 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
          <Music className="w-7 h-7" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Noch keine Songs</h3>
          <p className="text-sm text-muted-foreground">
            Erstelle deinen ersten Song im Musik Studio.
          </p>
        </div>
        <Button onClick={() => navigate("/generator/music-studio")}>
          <Plus className="w-4 h-4 mr-1" /> Song erstellen
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{songs.length} Song{songs.length === 1 ? "" : "s"}</p>
        <Button size="sm" onClick={() => navigate("/generator/music-studio")}>
          <Plus className="w-4 h-4 mr-1" /> Neuer Song
        </Button>
      </div>
      <div className="grid gap-3">
        {songs.map((s) => (
          <Card key={s.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-accent shrink-0" />
                  <h4 className="font-semibold truncate">{s.title}</h4>
                </div>
                {s.prompt && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{s.prompt}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: de })}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => handleDownload(s)} title="Download">
                  <Download className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(s)} title="Löschen">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
            {urls[s.id] && (
              <audio controls src={urls[s.id]} className="w-full h-10" preload="none" />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
