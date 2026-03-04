import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Globe, Download, Zap, HardDrive } from 'lucide-react';

export type ExportMode = 'lightweight' | 'offline';

interface ExportChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (mode: ExportMode) => void;
  loading?: boolean;
}

const ExportChoiceDialog: React.FC<ExportChoiceDialogProps> = ({ open, onOpenChange, onChoose, loading }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">HTML exportieren</DialogTitle>
          <DialogDescription>Wie sollen die Bilder eingebunden werden?</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 mt-2">
          <button
            onClick={() => onChoose('lightweight')}
            disabled={loading}
            className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all text-left group disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="font-semibold text-sm text-foreground">Leichtgewicht</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Bilder werden über URLs geladen. Kleine Dateigröße (~50 KB), benötigt Internet.
              </div>
            </div>
          </button>
          <button
            onClick={() => onChoose('offline')}
            disabled={loading}
            className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all text-left group disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
              <HardDrive className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="font-semibold text-sm text-foreground">Offline (WebP-komprimiert)</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Bilder als WebP eingebettet. Funktioniert ohne Internet, ~70% kleiner als PNG.
              </div>
            </div>
          </button>
        </div>
        {loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-2">
            <div className="animate-spin w-4 h-4 border-2 border-accent border-t-transparent rounded-full" />
            Bilder werden komprimiert…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExportChoiceDialog;
