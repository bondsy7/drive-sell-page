import { useState } from "react";
import { PlayCircle, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export interface ExplainerVideoSource {
  /** WebM first (preview browsers), MP4 fallback for real browsers. */
  webm?: string;
  mp4?: string;
  poster?: string;
}

interface Props {
  title: string;
  source?: ExplainerVideoSource | null;
}

/**
 * Button + player for an explainer video. Desktop: centered dialog.
 * Mobile: near full-screen sheet with native controls (incl. fullscreen),
 * video only loads after opening (preload="none" until opened).
 */
export function ExplainerVideoButton({ title, source }: Props) {
  const [open, setOpen] = useState(false);
  const hasVideo = !!(source?.webm || source?.mp4);

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Video className="h-4 w-4" />
        Erklärung
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="fixed left-1/2 top-1/2 grid w-screen max-w-none -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-2xl sm:w-[min(92vw,calc((100dvh_-_3rem)*16/9))] sm:rounded-lg [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:z-10">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">Erklärvideo</DialogDescription>
          <div className="aspect-video w-full">
            {open && hasVideo ? (
              <video
                controls
                autoPlay
                playsInline
                preload="metadata"
                poster={source?.poster}
                className="h-full w-full bg-background object-contain"
              >
                {source?.webm && <source src={source.webm} type="video/webm" />}
                {source?.mp4 && <source src={source.mp4} type="video/mp4" />}
              </video>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-background/80">
                <PlayCircle className="h-12 w-12" />
                <p className="text-sm">Das Erklärvideo folgt in Kürze.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
