import { useMemo, useState } from "react";
import type { ExplainerVideoSource } from "@/components/ExplainerVideoButton";

/** Picks the format the browser can really decode (H.264 MP4 preferred,
 * WebM only where MP4 is unsupported, e.g. the preview browser) and switches
 * to the other file if playback fails. Always offers a direct file link. */
export function pickExplainerOrder(source: ExplainerVideoSource, canPlay: (t: string) => string): string[] {
  const mp4Ok = !!source.mp4 && canPlay('video/mp4; codecs="avc1.640028, mp4a.40.2"') !== "";
  const list = mp4Ok ? [source.mp4, source.webm] : [source.webm, source.mp4];
  return list.filter((u): u is string => !!u);
}

interface Props {
  source: ExplainerVideoSource;
  autoPlay?: boolean;
  className?: string;
}

export function ExplainerVideoPlayer({ source, autoPlay, className }: Props) {
  const order = useMemo(() => {
    const probe = typeof document !== "undefined" ? document.createElement("video") : null;
    return pickExplainerOrder(source, (t) => (probe ? probe.canPlayType(t) : "probably"));
  }, [source]);
  const [idx, setIdx] = useState(0);
  const src = order[Math.min(idx, order.length - 1)];
  const failed = idx >= order.length;

  return (
    <div className="flex w-full flex-col gap-2">
      <video
        key={src}
        src={src}
        controls
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        poster={source.poster}
        onError={() => setIdx((i) => i + 1)}
        className={className ?? "block aspect-video w-full bg-foreground object-contain"}
      />
      <a
        href={failed ? order[0] : src}
        target="_blank"
        rel="noopener noreferrer"
        className="self-center text-xs text-muted-foreground underline underline-offset-2"
      >
        Video wird nicht angezeigt? Direkt öffnen
      </a>
    </div>
  );
}
