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
        className="gap-1.5 bg-vehicle-green text-background hover:bg-vehicle-green/90"
      >
        <Video className="h-4 w-4" />
        Erklärung
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col rounded-none border-0 bg-background p-0 sm:h-auto sm:max-h-[85vh] sm:w-[min(88vw,1000px)] sm:max-w-[1000px] sm:rounded-lg sm:border-0 sm:shadow-2xl [&>button:last-child]:right-2 [&>button:last-child]:top-2">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">Erklärvideo</DialogDescription>
          {open && hasVideo ? (
              <video
                controls
                autoPlay
                playsInline
                preload="metadata"
                poster={source?.poster}
                className="h-[calc(100dvh)] max-h-[100dvh] w-full object-contain sm:max-h-[85vh]"
              >
                {source?.webm && <source src={source.webm} type="video/webm" />}
                {source?.mp4 && <source src={source.mp4} type="video/mp4" />}
              </video>
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-background/80">
                <PlayCircle className="h-12 w-12" />
                <p className="text-sm">Das Erklärvideo folgt in Kürze.</p>
              </div>
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
