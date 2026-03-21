import React from 'react';
import { ArrowRight, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { STAGE_CONFIG } from './crm-constants';

interface CrmStageDialogProps {
  stageDialog: { convId: string; currentStage: string; newStage: string } | null;
  stageReason: string;
  onStageReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function CrmStageDialog({ stageDialog, stageReason, onStageReasonChange, onClose, onConfirm }: CrmStageDialogProps) {
  return (
    <Dialog open={!!stageDialog} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4" /> Phase ändern
          </DialogTitle>
        </DialogHeader>
        {stageDialog && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{STAGE_CONFIG[stageDialog.currentStage]?.label}</Badge>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <Badge className={`${STAGE_CONFIG[stageDialog.newStage]?.color} text-white border-0`}>
                {STAGE_CONFIG[stageDialog.newStage]?.label}
              </Badge>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Grund (optional)</label>
              <Textarea
                placeholder="z.B. Kunde hat Angebot akzeptiert…"
                value={stageReason}
                onChange={(e) => onStageReasonChange(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={onConfirm}>Phase ändern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
