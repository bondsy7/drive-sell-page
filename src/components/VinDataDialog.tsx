import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, ArrowRight } from 'lucide-react';

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
  onApply: (selectedFields: string[]) => void;
  vin: string;
}

const VinDataDialog: React.FC<VinDataDialogProps> = ({ open, onClose, diffs, onApply, vin }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(diffs.map(d => d.field)));

  const toggle = (field: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const handleApply = () => {
    onApply(Array.from(selected));
    onClose();
  };

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

        {diffs.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Check className="w-8 h-8 text-accent mx-auto mb-2" />
            Alle Daten stimmen überein – keine Änderungen nötig.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
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
          </div>
        )}

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Abbrechen
          </Button>
          {diffs.length > 0 && (
            <Button size="sm" onClick={handleApply} disabled={selected.size === 0} className="gap-1.5">
              <Check className="w-3.5 h-3.5" />
              {selected.size} {selected.size === 1 ? 'Feld' : 'Felder'} übernehmen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VinDataDialog;
