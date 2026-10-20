import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DETAIL_ROLE_LABELS } from '@/lib/detail-perspective-analysis';
import type { DetailAnalysisState } from '@/hooks/useDetailPerspectiveAnalysis';

export default function DetailPerspectiveAssignment({ index, role, analysis, onChange }: {
  index: number; role: string; analysis?: DetailAnalysisState; onChange: (role: string) => void;
}) {
  return <div className="absolute inset-x-0 bottom-0 space-y-1 bg-background p-1.5">
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground" aria-live="polite">
      {analysis?.status === 'analyzing' && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
      <span className="min-w-0 truncate" title={analysis?.label}>{analysis?.status === 'analyzing' ? 'Analyse läuft' : analysis?.status === 'unavailable' ? 'Analyse nicht verfügbar' : analysis?.status === 'uncertain' ? `Bitte zuordnen${analysis.label ? ` · ${analysis.label}` : ''}` : analysis?.label ?? 'Nicht analysiert'}</span>
    </div>
    <Select value={role || 'unassigned-detail'} onValueChange={value => onChange(value === 'unassigned-detail' ? '' : value)}>
      <SelectTrigger aria-label={`Referenzrolle Detail ${index + 1}`} className="h-7 w-full text-xs"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="unassigned-detail">Nicht zugeordnet</SelectItem>{Object.entries(DETAIL_ROLE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}