import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
  periodEnd?: string | null;
}

const CONFIRM_WORD = 'KÜNDIGEN';

export default function CancelSubscriptionDialog({
  open, onOpenChange, onConfirm, isLoading, periodEnd,
}: CancelSubscriptionDialogProps) {
  const [input, setInput] = useState('');
  const isValid = input.trim().toUpperCase() === CONFIRM_WORD;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm();
    setInput('');
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) setInput(''); onOpenChange(o); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Abo wirklich kündigen?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Dein Abo wird zum Ende der aktuellen Laufzeit gekündigt.
                {periodEnd && (
                  <> Du behältst alle Vorteile bis zum <strong>{new Date(periodEnd).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>.</>
                )}
              </p>
              <p>Danach wirst du automatisch auf den kostenlosen Plan zurückgestuft.</p>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Bitte tippe <span className="font-bold text-destructive">{CONFIRM_WORD}</span> ein, um die Kündigung zu bestätigen:
                </p>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  className="font-mono text-center tracking-widest"
                  autoFocus
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Abbrechen</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
          >
            {isLoading ? 'Wird gekündigt…' : 'Endgültig kündigen'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
