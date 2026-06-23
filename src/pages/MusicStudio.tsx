import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Music, Sparkles, Download, Loader2, ArrowLeft, Play, Wand2, Mic2, Volume2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCredits } from "@/hooks/useCredits";

type ModelChoice = "lyria-3-pro-preview" | "lyria-3-clip-preview";

const STYLE_PRESETS = [
  { label: "Cinematic", text: "epic cinematic orchestral score, soaring strings, deep brass, dramatic percussion" },
  { label: "Lo-Fi Chill", text: "warm lo-fi hip hop beat, vinyl crackle, mellow Rhodes piano, lazy hi-hats, study vibe" },
  { label: "Electronic Pop", text: "upbeat electronic pop, bright synths, four-on-the-floor drums, catchy melodic hook" },
  { label: "Acoustic Folk", text: "intimate acoustic folk, fingerpicked guitar, soft male vocals, gentle harmonies" },
  { label: "Auto Werbung", text: "modern automotive commercial soundtrack, driving rhythm, premium feel, polished production, anthemic build" },
  { label: "Corporate", text: "uplifting corporate background music, soft piano, motivational strings, gentle electronic pulse" },
  { label: "Trap Beat", text: "hard 808 trap beat, rolling hi-hats, dark synth lead, heavy sub bass, modern hip hop production" },
  { label: "Jazz Bar", text: "smoky late-night jazz quartet, upright bass, brushed drums, smooth tenor saxophone, walking chord progression" },
  { label: "Chiptune 8-Bit", text: "bright chiptune melody in C Major, retro 8-bit video game style, square waves, arpeggiated leads" },
  { label: "Ambient", text: "atmospheric ambient soundscape, slow evolving pads, distant textures, meditative and dreamlike" },
];

const MOODS = ["Energetisch", "Entspannt", "Episch", "Romantisch", "Düster", "Fröhlich", "Melancholisch", "Mysteriös"];

const EXAMPLES = [
  {
    title: "Showroom-Spot",
    prompt:
      "Cinematic automotive trailer score, 60 seconds. Slow tension build with low pulsing synth and soft piano, joined by sweeping strings at 0:20, then a powerful drum hit and full orchestra at 0:35 for a premium, confident finale. Instrumental only.",
  },
  {
    title: "Indie Pop mit Lyrics",
    prompt: `Create a dreamy indie pop song.

[Verse 1]
Headlights paint the empty street,
city sleeping at our feet,
chasing dreams we can't define,
every second feels like wine.

[Chorus]
Drive me home through neon rain,
let the engine ease the pain,
we are young and we are free,
just the road and you and me.`,
  },
  {
    title: "Lo-Fi Studienbeat",
    prompt:
      "A calm lo-fi hip hop beat for studying. Warm Fender Rhodes chords, soft tape saturation, brushed drums, mellow upright bass. Instrumental, no vocals, looping atmosphere.",
  },
];

export default function MusicStudio() {
  const navigate = useNavigate();
  const { balance, fetchBalance } = useCredits();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelChoice>("lyria-3-pro-preview");
  const [instrumental, setInstrumental] = useState(false);
  const [withLyrics, setWithLyrics] = useState(false);
  const [customLyrics, setCustomLyrics] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [wav, setWav] = useState(false);
  const [busy, setBusy] = useState(false);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lyricsOut, setLyricsOut] = useState<string>("");
  const [mimeOut, setMimeOut] = useState<string>("audio/mpeg");

  const credits = model === "lyria-3-pro-preview" ? 8 : 4;

  const finalPrompt = useMemo(() => {
    let p = prompt.trim();
    if (mood) p = `${mood.toLowerCase()} mood. ${p}`;
    if (instrumental) p += "\n\nInstrumental only, no vocals.";
    if (withLyrics && customLyrics.trim()) {
      p += `\n\nUse these lyrics:\n${customLyrics.trim()}`;
    }
    return p;
  }, [prompt, mood, instrumental, withLyrics, customLyrics]);

  const handleGenerate = async () => {
    if (!finalPrompt || finalPrompt.length < 5) {
      toast.error("Bitte beschreibe deine Musik (mind. 5 Zeichen).");
      return;
    }
    if (balance < credits) {
      toast.error(`Nicht genug Credits (${balance}/${credits}).`);
      return;
    }
    setBusy(true);
    setAudioUrl(null);
    setLyricsOut("");
    try {
      const { data, error } = await supabase.functions.invoke("generate-music", {
        body: {
          prompt: finalPrompt,
          model,
          responseFormat: wav ? "wav" : "mp3",
        },
      });
      if (error) throw error;
      if (!data?.audioBase64) throw new Error("Keine Audio-Daten");
      const bin = atob(data.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.mimeType || "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setMimeOut(data.mimeType || "audio/mpeg");
      setLyricsOut(data.lyrics || "");
      refresh();
      toast.success(`Musik erstellt (-${data.creditsUsed} Credits)`);
    } catch (e: any) {
      const msg = e?.message || String(e);
      toast.error(msg.includes("credits") || msg.includes("Credits") ? "Nicht genug Credits" : `Fehler: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `musik-${Date.now()}.${mimeOut.includes("wav") ? "wav" : "mp3"}`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/generator")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
          </Button>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Musik Studio · Lyria 3
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Musik mit KI komponieren</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Beschreibe deinen Sound in Worten – Lyria 3 generiert hochwertiges Stereo-Audio (44,1 kHz) inkl.
            Gesang, Lyrics und Instrumenten. Nutze Stil-Presets, Stimmungen oder eigene Lyrics.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-5">
            <Card className="p-5 space-y-5">
              {/* Model */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Modell</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModel("lyria-3-pro-preview")}
                    className={`p-3 rounded-lg border text-left transition ${
                      model === "lyria-3-pro-preview"
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Lyria 3 Pro</span>
                      <Badge variant="secondary" className="text-[10px]">8 Cr</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Volle Songs mit Gesang, bis ~30s, WAV möglich.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModel("lyria-3-clip-preview")}
                    className={`p-3 rounded-lg border text-left transition ${
                      model === "lyria-3-clip-preview"
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Lyria 3 Clip</span>
                      <Badge variant="secondary" className="text-[10px]">4 Cr</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Kurze Loops/Clips, perfekt für Hintergrund & Spots.</p>
                  </button>
                </div>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <Label htmlFor="prompt" className="text-sm font-semibold flex items-center gap-2">
                  <Wand2 className="w-4 h-4" /> Was soll erklingen?
                </Label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="z.B. 'Cinematic Score für Autowerbung, dramatischer Build-up, Streicher und Drums'"
                  className="min-h-[120px] resize-none"
                />
                <p className="text-[11px] text-muted-foreground">
                  Tipp: Genaue Angaben funktionieren am besten – Genre, Tempo (BPM), Instrumente, Stimmung, Zeitleisten wie
                  <code className="px-1 bg-muted rounded mx-1">[0:00-0:10] Intro</code>.
                </p>
              </div>

              {/* Style Presets */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Stil-Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {STYLE_PRESETS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setPrompt((p) => (p ? p + "\n" : "") + s.text)}
                      className="px-3 py-1.5 rounded-full text-xs border border-border hover:border-accent hover:bg-accent/5 transition"
                    >
                      + {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Stimmung</Label>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMood(mood === m ? null : m)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${
                        mood === m
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border hover:border-accent/50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label className="text-sm cursor-pointer">Nur Instrumental</Label>
                      <p className="text-[11px] text-muted-foreground">Kein Gesang</p>
                    </div>
                  </div>
                  <Switch checked={instrumental} onCheckedChange={setInstrumental} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <Mic2 className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label className="text-sm cursor-pointer">Eigene Lyrics</Label>
                      <p className="text-[11px] text-muted-foreground">Songtext selbst schreiben</p>
                    </div>
                  </div>
                  <Switch checked={withLyrics} onCheckedChange={setWithLyrics} disabled={instrumental} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border sm:col-span-2">
                  <div>
                    <Label className="text-sm cursor-pointer">WAV statt MP3</Label>
                    <p className="text-[11px] text-muted-foreground">Verlustfreie Qualität (nur Pro)</p>
                  </div>
                  <Switch checked={wav} onCheckedChange={setWav} disabled={model !== "lyria-3-pro-preview"} />
                </div>
              </div>

              {withLyrics && !instrumental && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Lyrics</Label>
                  <Textarea
                    value={customLyrics}
                    onChange={(e) => setCustomLyrics(e.target.value)}
                    placeholder={`[Verse 1]\nHeadlights paint the empty street,\ncity sleeping at our feet...\n\n[Chorus]\nDrive me home through neon rain...`}
                    className="min-h-[160px] font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Strukturiere mit <code className="px-1 bg-muted rounded">[Verse]</code>,{" "}
                    <code className="px-1 bg-muted rounded">[Chorus]</code>,{" "}
                    <code className="px-1 bg-muted rounded">[Bridge]</code>.
                  </p>
                </div>
              )}

              {/* Generate */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  Kosten: <strong className="text-foreground">{credits} Credits</strong> · Guthaben:{" "}
                  <strong className="text-foreground">{balance}</strong>
                </div>
                <Button onClick={handleGenerate} disabled={busy} size="lg" className="gap-2">
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Komponiere…
                    </>
                  ) : (
                    <>
                      <Music className="w-4 h-4" /> Musik erstellen
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Output */}
            {audioUrl && (
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Play className="w-4 h-4 text-accent" /> Dein Track
                  </h3>
                  <Button size="sm" variant="outline" onClick={handleDownload} className="gap-2">
                    <Download className="w-4 h-4" /> Download
                  </Button>
                </div>
                <audio controls src={audioUrl} className="w-full" />
                {lyricsOut && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Lyrics</Label>
                    <pre className="text-xs whitespace-pre-wrap bg-muted/40 rounded-lg p-3 font-mono">{lyricsOut}</pre>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Right: Help */}
          <div className="space-y-4">
            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-sm">So funktioniert's</h3>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Beschreibe deinen Sound (Genre, Stimmung, Instrumente).</li>
                <li>Optional: Stil-Preset, Mood oder eigene Lyrics anhängen.</li>
                <li>Modell wählen – Pro für vollwertige Songs, Clip für kurze Loops.</li>
                <li>Auf <strong>Musik erstellen</strong> klicken & herunterladen.</li>
              </ol>
            </Card>

            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-sm">Beispiele zum Reinkopieren</h3>
              <Tabs defaultValue="0" className="w-full">
                <TabsList className="grid grid-cols-3 h-auto">
                  {EXAMPLES.map((e, i) => (
                    <TabsTrigger key={i} value={String(i)} className="text-[10px] py-1.5 px-1">
                      {e.title}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {EXAMPLES.map((e, i) => (
                  <TabsContent key={i} value={String(i)} className="space-y-2">
                    <pre className="text-[11px] whitespace-pre-wrap bg-muted/40 rounded p-2 font-mono max-h-48 overflow-auto">
                      {e.prompt}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => setPrompt(e.prompt)}
                    >
                      Übernehmen
                    </Button>
                  </TabsContent>
                ))}
              </Tabs>
            </Card>

            <Card className="p-5 space-y-2">
              <h3 className="font-semibold text-sm">Profi-Tipps</h3>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>Tempo in BPM nennen (z.B. "120 BPM").</li>
                <li>Tonart angeben ("in C major").</li>
                <li>Mit Zeitstempeln Struktur vorgeben.</li>
                <li>Mehrere Sprachen möglich – einfach im Prompt formulieren.</li>
                <li>Section-Tags: [Intro], [Verse], [Chorus], [Bridge], [Outro].</li>
              </ul>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
