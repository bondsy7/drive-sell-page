import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Globe, Download, Zap, HardDrive, Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ExportMode = 'lightweight' | 'offline';

interface ExportChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (mode: ExportMode) => void;
  loading?: boolean;
  projectId?: string | null;
}

const ExportChoiceDialog: React.FC<ExportChoiceDialogProps> = ({ open, onOpenChange, onChoose, loading, projectId }) => {
  const [ftpUploading, setFtpUploading] = useState(false);

  const handleFtpUpload = async () => {
    if (!projectId) {
      toast.error('Projekt muss zuerst gespeichert sein.');
      return;
    }
    setFtpUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ftp-upload', {
        body: { project_id: projectId },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(data.message || 'Erfolgreich hochgeladen!');
        onOpenChange(false);
      } else {
        toast.error(data?.error || data?.message || 'Upload fehlgeschlagen');
      }
    } catch (err: any) {
      toast.error(err.message || 'FTP-Upload fehlgeschlagen');
    } finally {
      setFtpUploading(false);
    }
  };

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
            disabled={loading || ftpUploading}
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
            disabled={loading || ftpUploading}
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

          {/* FTP Upload option */}
          {projectId && (
            <button
              onClick={handleFtpUpload}
              disabled={loading || ftpUploading}
              className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all text-left group disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
                {ftpUploading ? (
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-accent" />
                )}
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground">
                  {ftpUploading ? 'Wird hochgeladen…' : 'Auf Server hochladen (FTP)'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  HTML direkt auf deinen Webserver uploaden. FTP muss unter Schnittstellen konfiguriert sein.
                </div>
              </div>
            </button>
          )}
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
