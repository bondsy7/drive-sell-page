import { Link } from 'react-router-dom';
import { Layout, ExternalLink, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Project, getVehicleField } from './types';

const PAGE_TYPE_LABELS: Record<string, string> = {
  leasing: 'Leasing', finanzierung: 'Finanzierung', barkauf: 'Barkauf',
  massenangebot: 'Aktion', autoabo: 'Auto-Abo', event: 'Event', release: 'Release',
};

interface Props {
  projects: Project[];
  onExport: (project: Project) => void;
  onDelete: (id: string) => void;
}

export default function LandingsTab({ projects, onExport, onDelete }: Props) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <Layout className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Noch keine Landing Pages erstellt.</p>
        <Link to="/"><Button>Erste Landing Page erstellen</Button></Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map(p => {
        const vd = p.vehicle_data;
        const brand = getVehicleField(vd, 'brand');
        const model = getVehicleField(vd, 'model');
        const pageType = getVehicleField(vd, 'pageType');
        return (
          <div key={p.id} className="bg-card rounded-xl border border-border overflow-hidden group">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-foreground text-sm truncate">{brand} {model}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 whitespace-nowrap">
                  {PAGE_TYPE_LABELS[pageType] || 'Landing Page'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString('de-DE')}</p>
              <div className="flex gap-1.5 pt-1">
                <Link to={`/project/${p.id}`}><Button variant="outline" size="sm"><ExternalLink className="w-3.5 h-3.5" /></Button></Link>
                <Button variant="outline" size="sm" onClick={() => onExport(p)}><Download className="w-3.5 h-3.5" /></Button>
                <Button variant="outline" size="sm" onClick={() => onDelete(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
