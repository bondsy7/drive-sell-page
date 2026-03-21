import { Video, Play, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type VideoFile } from './types';

interface Props {
  videos: VideoFile[];
  onPlay: (video: VideoFile) => void;
  onDownload: (video: VideoFile) => void;
  onDelete: (name: string) => void;
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
        <div key={video.name} className="bg-card rounded-xl border border-border overflow-hidden group">
          <div className="aspect-video bg-muted relative cursor-pointer" onClick={() => onPlay(video)}>
            <video
              src={video.url}
              className="w-full h-full object-cover"
              muted loop playsInline
              onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
              onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
            />
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
      ))}
    </div>
  );
}
