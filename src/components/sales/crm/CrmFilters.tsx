import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JOURNEY_STAGE_LABELS, CONVERSATION_STATUS_LABELS } from '@/types/sales-assistant';

interface CrmFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterStage: string;
  onFilterStage: (value: string) => void;
  filterIntent: string;
  onFilterIntent: (value: string) => void;
  filterStatus: string;
  onFilterStatus: (value: string) => void;
}

export function CrmFilters({
  searchTerm, onSearchChange,
  filterStage, onFilterStage,
  filterIntent, onFilterIntent,
  filterStatus, onFilterStatus,
}: CrmFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Kunde, E-Mail, Fahrzeug suchen…" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="pl-9" />
      </div>
      <Select value={filterStage} onValueChange={onFilterStage}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Phase" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Phasen</SelectItem>
          {Object.entries(JOURNEY_STAGE_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filterIntent} onValueChange={onFilterIntent}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Interesse" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Interessen</SelectItem>
          {['Probefahrt', 'Inzahlungnahme', 'Leasing', 'Finanzierung', 'Kauf', 'Gewerbekunde'].map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filterStatus} onValueChange={onFilterStatus}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Status</SelectItem>
          {Object.entries(CONVERSATION_STATUS_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
