import { Link } from 'react-router-dom';
import { RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Spin360Job } from './types';

interface Props {
  jobs: Spin360Job[];
  onOpen: (jobId: string) => void;
  onDelete: (jobId: string) => void;
}

export default function Spin360Tab({ jobs, onOpen, onDelete }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <RotateCw className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Noch keine 360° Spins erstellt.</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">Erstelle deinen ersten interaktiven 360°-Fahrzeug-Spin unter „Fotos & Remastering".</p>
        <Link to="/"><Button variant="outline" size="sm" className="mt-2"><RotateCw className="w-3.5 h-3.5 mr-1.5" /> 360° Spin erstellen</Button></Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <div key={job.id} className="bg-card rounded-xl border border-border overflow-hidden group">
          <div
            className={`aspect-video bg-muted relative flex items-center justify-center ${job.displayStatus === 'completed' ? 'cursor-pointer' : ''}`}
            onClick={() => job.displayStatus === 'completed' && onOpen(job.id)}
          >
            <RotateCw className={`w-10 h-10 text-muted-foreground/40 ${job.displayStatus !== 'completed' && job.displayStatus !== 'failed' ? 'animate-spin' : ''}`} />
            {job.displayStatus === 'completed' && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-foreground/20">
                <div className="bg-background/80 backdrop-blur rounded-full p-3"><RotateCw className="w-6 h-6 text-foreground" /></div>
              </div>
            )}
            <span className={`absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${
              job.displayStatus === 'completed' ? 'bg-green-500/10 text-green-600' :
              job.displayStatus === 'failed' ? 'bg-destructive/10 text-destructive' :
              'bg-accent/10 text-accent'
            }`}>
              {job.displayStatus === 'completed' ? 'Fertig' : job.displayStatus === 'failed' ? 'Abgebrochen' : 'In Bearbeitung'}
            </span>
          </div>
          <div className="p-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>{new Date(job.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              {job.manifest?.frameCount && <p>{job.manifest.frameCount} Frames</p>}
              {job.displayStatus === 'failed' && job.displayError && <p className="text-destructive">{job.displayError}</p>}
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}