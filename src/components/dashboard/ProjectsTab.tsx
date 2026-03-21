import { Link } from 'react-router-dom';
import { FileText, ExternalLink, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Project, getVehicleField } from './types';

interface Props {
  projects: Project[];
  onExport: (project: Project) => void;
  onDelete: (id: string) => void;
}

export default function ProjectsTab({ projects, onExport, onDelete }: Props) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Noch keine Projekte erstellt.</p>
        <Link to="/"><Button>Erstes Projekt erstellen</Button></Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map(p => {
        const vd = p.vehicle_data;
        const brand = getVehicleField(vd, 'vehicle', 'brand');
        const model = getVehicleField(vd, 'vehicle', 'model');
        const variant = getVehicleField(vd, 'vehicle', 'variant');
        const monthlyRate = getVehicleField(vd, 'finance', 'monthlyRate');
        const category = getVehicleField(vd, 'category').toLowerCase();

        const categoryBadge = category.includes('leasing')
          ? <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 whitespace-nowrap">Leasing</span>
          : (category.includes('finanzierung') || category.includes('kredit'))
          ? <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 whitespace-nowrap">Finanzierung</span>
          : (category.includes('barkauf') || category.includes('kauf') || category.includes('neuwagen') || category.includes('gebrauchtwagen') || category.includes('tageszulassung'))
          ? <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 whitespace-nowrap">Kauf</span>
          : null;

        const imgSrc = p.main_image_url || (p.main_image_base64?.startsWith('data:') ? p.main_image_base64 : p.main_image_base64 ? `data:image/png;base64,${p.main_image_base64}` : null);

        return (
          <div key={p.id} className="bg-card rounded-xl border border-border overflow-hidden group">
            {imgSrc && (
              <div className="aspect-video bg-muted overflow-hidden">
                <img src={imgSrc} alt={p.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-foreground text-sm truncate">{brand} {model}</h3>
                {categoryBadge}
              </div>
              {variant && <p className="text-xs text-muted-foreground">{variant}</p>}
              {monthlyRate && (
                <p className="text-sm font-semibold text-foreground">{monthlyRate} <span className="text-xs font-normal text-muted-foreground">/ Monat</span></p>
              )}
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
