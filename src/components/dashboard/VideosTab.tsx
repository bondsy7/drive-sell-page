import { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Play, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type VideoFile } from './types';

interface Props {
  videos: VideoFile[];
  onPlay: (video: VideoFile) => void;
  onDownload: (video: VideoFile) => void;
  onDelete: (name: string) => void;
}

/** Generate a thumbnail from a video URL by seeking to 1s */
function useVideoThumbnail(videoUrl: string) {
  const [thumb, setThumb] = useState<string | null>(null);
  const attempted = useRef(false);

  const generate = useCallback(() => {
    if (attempted.current) return;
    attempted.current = true;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          setThumb(canvas.toDataURL('image/jpeg', 0.7));
        }
      } catch { /* CORS or other error – fallback to no thumb */ }
      video.src = '';
    };

    video.onerror = () => { attempted.current = false; };
    video.src = videoUrl;
  }, [videoUrl]);

  useEffect(() => { generate(); }, [generate]);

  return thumb;
}

function VideoCard({ video, onPlay, onDownload, onDelete }: {
  video: VideoFile;
  onPlay: (v: VideoFile) => void;
  onDownload: (v: VideoFile) => void;
  onDelete: (name: string) => void;
}) {
  const thumbnail = useVideoThumbnail(video.url);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden group">
      <div className="aspect-video bg-muted relative cursor-pointer" onClick={() => onPlay(video)}>
        {thumbnail ? (
          <img src={thumbnail} alt="Video preview" className="w-full h-full object-cover" />
        ) : (
          <video
            src={video.url}
            className="w-full h-full object-cover"
            muted loop playsInline
            onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
            onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-foreground/20">
          <div className="bg-background/80 backdrop-blur rounded-full p-3"><Play className="w-6 h-6 text-foreground" /></div>
        </div>
      </div>
      <div className="p-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {video.created_at ? new Date(video.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Video'}
        </p>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={() => onDownload(video)}><Download className="w-3.5 h-3.5" /></Button>
          <Button variant="outline" size="sm" onClick={() => onDelete(video.name)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function VideosTab({ videos, onPlay, onDownload, onDelete }: Props) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <Video className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Noch keine Videos generiert.</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">Generierte Videos aus dem Video-Generator erscheinen hier automatisch.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map(video => (
        <VideoCard key={video.name} video={video} onPlay={onPlay} onDownload={onDownload} onDelete={onDelete} />
      ))}
    </div>
  );
}
