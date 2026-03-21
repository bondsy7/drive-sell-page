import { Link } from 'react-router-dom';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Spin360Job } from './types';

interface Props {
  jobs: Spin360Job[];
  onOpen: (jobId: string) => void;
}

export default function Spin360Tab({ jobs, onOpen }: Props) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {jobs.map((job) => (
        <div
          key={job.id}
          className={`bg-card rounded-xl border border-border p-5 space-y-3 transition-all ${job.displayStatus === 'completed' ? 'cursor-pointer hover:border-accent/50 hover:shadow-md' : ''}`}
          onClick={() => job.displayStatus === 'completed' && onOpen(job.id)}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-foreground text-sm">360° Spin</h3>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              job.displayStatus === 'completed' ? 'bg-green-500/10 text-green-600' :
              job.displayStatus === 'failed' ? 'bg-destructive/10 text-destructive' :
              'bg-accent/10 text-accent'
            }`}>
              {job.displayStatus === 'completed' ? 'Fertig' : job.displayStatus === 'failed' ? 'Abgebrochen' : 'In Bearbeitung'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(job.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          {job.manifest?.frameCount && <p className="text-xs text-muted-foreground">{job.manifest.frameCount} Frames</p>}
          {job.displayStatus === 'failed' && job.displayError && <p className="text-xs text-destructive">{job.displayError}</p>}
          {job.displayStatus === 'completed' && <p className="text-xs text-accent">Zum Öffnen antippen ›</p>}
        </div>
      ))}
    </div>
  );
}
