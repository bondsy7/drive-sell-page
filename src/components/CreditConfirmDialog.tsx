import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Zap } from 'lucide-react';

interface CreditConfirmDialogProps {
  open: boolean;
  cost: number;
  balance: number;
  actionLabel?: string;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CreditConfirmDialog({
  open, cost, balance, actionLabel, isProcessing, onConfirm, onCancel,
}: CreditConfirmDialogProps) {
  const insufficient = balance < cost;

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            Credits bestätigen
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-sm text-muted-foreground">Kosten</span>
                <span className="font-semibold text-foreground">{cost} Credits</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-sm text-muted-foreground">Dein Guthaben</span>
                <span className={`font-semibold ${insufficient ? 'text-destructive' : 'text-foreground'}`}>
                  {balance} Credits
                </span>
              </div>
              {insufficient && (
                <p className="text-sm text-destructive font-medium">
                  Nicht genug Credits. Bitte lade Credits auf oder upgrade dein Abo.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={insufficient || isProcessing}>
            {isProcessing ? 'Wird ausgeführt…' : (actionLabel || 'Fortfahren')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
