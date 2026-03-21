import { RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Spin360Viewer from '@/components/spin360/Spin360Viewer';

interface Props {
  loading: boolean;
  frames: string[];
  onClose: () => void;
}

export default function SpinViewerModal({ loading, frames, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-display font-semibold text-foreground">360° Spin Viewer</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RotateCw className="w-6 h-6 animate-spin text-accent" />
              <span className="ml-2 text-sm text-muted-foreground">Frames werden geladen…</span>
            </div>
          ) : frames.length > 0 ? (
            <Spin360Viewer frames={frames} autoplay autoplaySpeed={100} />
          ) : (
            <p className="text-center py-10 text-sm text-muted-foreground">Keine Frames gefunden.</p>
          )}
        </div>
      </div>
    </div>
  );
}
