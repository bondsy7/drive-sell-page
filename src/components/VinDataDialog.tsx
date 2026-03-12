import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, ChevronDown, ChevronUp, List } from 'lucide-react';

export interface VinFieldDiff {
  label: string;
  field: string;
  currentValue: string;
  outvinValue: string;
}

interface VinDataDialogProps {
  open: boolean;
  onClose: () => void;
  diffs: VinFieldDiff[];
  equipment: string[];
  onApply: (selectedFields: string[], replaceEquipment: boolean, selectedEquipment: string[]) => void;
  vin: string;
}

const VinDataDialog: React.FC<VinDataDialogProps> = ({ open, onClose, diffs, equipment, onApply, vin }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(diffs.map(d => d.field)));
  const [replaceEquipment, setReplaceEquipment] = useState(false);
  const [equipmentExpanded, setEquipmentExpanded] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<number>>(new Set());

  // Reset state when diffs/equipment change
  useEffect(() => {
    setSelected(new Set(diffs.map(d => d.field)));
    setSelectedEquipment(new Set(equipment.map((_, i) => i)));
    setReplaceEquipment(false);
    setEquipmentExpanded(false);
  }, [diffs, equipment]);

  const toggle = (field: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const toggleEquipmentItem = (index: number) => {
    setSelectedEquipment(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleApply = () => {
    const selEquip = replaceEquipment
      ? equipment.filter((_, i) => selectedEquipment.has(i))
      : [];
    onApply(Array.from(selected), replaceEquipment, selEquip);
    onClose();
  };

  const totalSelected = selected.size + (replaceEquipment ? 1 : 0);
  const hasContent = diffs.length > 0 || equipment.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            🔍 VIN-Datenabgleich
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{vin}</span>
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground mb-3">
          Die OutVin-API hat folgende abweichende Daten gefunden. Wähle, welche Werte du übernehmen möchtest:
        </p>

        {!hasContent ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Check className="w-8 h-8 text-accent mx-auto mb-2" />
            Alle Daten stimmen überein – keine Änderungen nötig.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {/* Field diffs */}
            {diffs.map((d) => (
              <button
                key={d.field}
                onClick={() => toggle(d.field)}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  selected.has(d.field)
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selected.has(d.field) ? 'border-accent bg-accent text-accent-foreground' : 'border-muted-foreground/30'
                }`}>
                  {selected.has(d.field) && <Check className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-muted-foreground mb-0.5">{d.label}</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground line-through truncate">{d.currentValue || '–'}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-foreground truncate">{d.outvinValue}</span>
                  </div>
                </div>
              </button>
            ))}

            {/* Equipment section */}
            {equipment.length > 0 && (
              <div className={`rounded-xl border transition-colors ${
                replaceEquipment ? 'border-accent bg-accent/5' : 'border-border bg-card'
              }`}>
                {/* Equipment toggle header */}
                <button
                  onClick={() => setReplaceEquipment(!replaceEquipment)}
                  className="w-full text-left flex items-center gap-3 p-3"
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    replaceEquipment ? 'border-accent bg-accent text-accent-foreground' : 'border-muted-foreground/30'
                  }`}>
                    {replaceEquipment && <Check className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-muted-foreground mb-0.5">Ausstattung</div>
                    <div className="text-sm font-semibold text-foreground">
                      {equipment.length} Merkmale aus VIN übernehmen
                    </div>
                  </div>
                  <List className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>

                {/* Expand/collapse equipment details */}
                <div className="px-3 pb-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEquipmentExpanded(!equipmentExpanded); }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {equipmentExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {equipmentExpanded ? 'Ausblenden' : 'Details anzeigen'}
                    <span className="text-muted-foreground/60 ml-1">({selectedEquipment.size}/{equipment.length})</span>
                  </button>

                  {equipmentExpanded && (
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {equipment.map((item, i) => (
                        <button
                          key={i}
                          onClick={(e) => { e.stopPropagation(); toggleEquipmentItem(i); }}
                          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                            selectedEquipment.has(i)
                              ? 'bg-accent/10 text-foreground'
                              : 'text-muted-foreground hover:bg-muted/50'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                            selectedEquipment.has(i) ? 'border-accent bg-accent text-accent-foreground' : 'border-muted-foreground/30'
                          }`}>
                            {selectedEquipment.has(i) && <Check className="w-2 h-2" />}
                          </div>
                          <span className="truncate">{item}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Abbrechen
          </Button>
          {hasContent && (
            <Button size="sm" onClick={handleApply} disabled={totalSelected === 0} className="gap-1.5">
              <Check className="w-3.5 h-3.5" />
              {totalSelected} {totalSelected === 1 ? 'Feld' : 'Felder'} übernehmen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VinDataDialog;
