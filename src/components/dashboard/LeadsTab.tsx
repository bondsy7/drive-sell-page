import { MessageSquare, Mail, Phone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Lead } from './types';

interface Props {
  leads: Lead[];
  onDelete: (id: string) => void;
}

export default function LeadsTab({ leads, onDelete }: Props) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Noch keine Anfragen eingegangen.</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">Sobald ein Interessent das Kontaktformular auf einer Ihrer Angebotsseiten ausfüllt, erscheint die Anfrage hier.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leads.map(lead => (
        <div key={lead.id} className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display font-semibold text-foreground text-sm">{lead.name}</h3>
                {lead.vehicle_title && (
                  <span className="text-[10px] font-medium bg-accent/10 text-accent px-2 py-0.5 rounded-full truncate max-w-[200px]">{lead.vehicle_title}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors"><Mail className="w-3 h-3" /> {lead.email}</a>
                {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors"><Phone className="w-3 h-3" /> {lead.phone}</a>}
                <span>{new Date(lead.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {lead.message && <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 mt-2">{lead.message}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => onDelete(lead.id)} className="shrink-0"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}
