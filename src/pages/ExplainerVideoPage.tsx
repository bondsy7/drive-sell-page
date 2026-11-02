import { useEffect } from "react";
import { ExplainerVideoPlayer } from "@/components/ExplainerVideoPlayer";
import { EXPLAINER_VIDEOS } from "@/lib/explainer-videos";

/** Public stand-alone page for the remastering explainer video (shareable link). */
export default function ExplainerVideoPage() {
  const video = EXPLAINER_VIDEOS.fotos;
  useEffect(() => {
    document.title = "Erklärvideo Foto & Remastering – autohaus.ai";
  }, []);
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-foreground p-0 sm:p-6">
      {video ? (
        <div className="w-full max-w-5xl">
          <ExplainerVideoPlayer source={video} />
        </div>
      ) : (
        <p className="text-background">Das Erklärvideo folgt in Kürze.</p>
      )}
    </main>
  );
}
