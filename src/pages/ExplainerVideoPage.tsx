import { useEffect } from "react";
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
        <video
          className="aspect-video w-full max-w-[min(100%,calc((100dvh-3rem)*16/9))] bg-foreground"
          controls
          playsInline
          preload="metadata"
          poster={video.poster}
        >
          <source src={video.webm} type="video/webm" />
          <source src={video.mp4} type="video/mp4" />
        </video>
      ) : (
        <p className="text-background">Das Erklärvideo folgt in Kürze.</p>
      )}
    </main>
  );
}
