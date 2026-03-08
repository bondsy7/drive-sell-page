import { useState, useCallback } from 'react';
import { useCredits } from './useCredits';

interface CreditCheckOptions {
  actionType: string;
  modelTier?: string;
  description?: string;
  onConfirm?: () => void | Promise<void>;
}

export function useCreditCheck() {
  const { balance, getCost, deductCredits } = useCredits();
  const [showDialog, setShowDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<CreditCheckOptions | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const checkAndConfirm = useCallback((options: CreditCheckOptions) => {
    const cost = getCost(options.actionType, options.modelTier || 'standard');
    if (cost === 0) {
      // Free action, just execute
      options.onConfirm?.();
      return;
    }
    setPendingAction(options);
    setShowDialog(true);
  }, [getCost]);

  const confirmAction = useCallback(async () => {
    if (!pendingAction) return;
    setIsProcessing(true);
    try {
      const result = await deductCredits(
        pendingAction.actionType,
        pendingAction.modelTier || 'standard',
        pendingAction.description,
      );
      if (result.success) {
        setShowDialog(false);
        await pendingAction.onConfirm?.();
      }
      return result;
    } finally {
      setIsProcessing(false);
      setPendingAction(null);
    }
  }, [pendingAction, deductCredits]);

  const cancelAction = useCallback(() => {
    setShowDialog(false);
    setPendingAction(null);
  }, []);

  return {
    showDialog,
    pendingAction,
    isProcessing,
    balance,
    getCost,
    checkAndConfirm,
    confirmAction,
    cancelAction,
  };
}
