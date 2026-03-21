import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type VideoFile } from './types';

interface Props {
  video: VideoFile;
  onClose: () => void;
  onDownload: (video: VideoFile) => void;
}

export default function VideoPlayerModal({ video, onClose, onDownload }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-3xl mx-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-background hover:text-background/80 transition-colors">
          <X className="w-6 h-6" />
        </button>
        <video src={video.url} controls autoPlay className="w-full rounded-xl shadow-2xl" />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-background/70">
            {video.created_at ? new Date(video.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
          </p>
          <Button variant="secondary" size="sm" onClick={() => onDownload(video)} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Herunterladen
          </Button>
        </div>
      </div>
    </div>
  );
}
