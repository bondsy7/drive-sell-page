import React from 'react';
import { Mail, PenLine, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { STAGE_CONFIG } from './crm-constants';
import type { SalesConversation } from '@/types/sales-assistant';

export interface ReplyDialogData {
  convId: string | null;
  leadId: string | null;
  customerName: string;
  conversations: SalesConversation[];
  contextLabel: string | null;
}

interface CrmReplyDialogProps {
  replyDialog: ReplyDialogData | null;
  replyText: string;
  onReplyTextChange: (value: string) => void;
  replyType: 'customer_reply' | 'internal_note';
  onReplyTypeChange: (value: 'customer_reply' | 'internal_note') => void;
  replyConvId: string;
  onReplyConvIdChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function CrmReplyDialog({
  replyDialog, replyText, onReplyTextChange,
  replyType, onReplyTypeChange,
  replyConvId, onReplyConvIdChange,
  onClose, onSubmit,
}: CrmReplyDialogProps) {
  return (
    <Dialog open={!!replyDialog} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-4 h-4" />
            {replyDialog?.customerName} — Eintrag hinzufügen
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {replyDialog?.contextLabel && (
            <div className="text-xs bg-muted/50 rounded-md p-2 border border-border/50">
              <span className="text-muted-foreground">Bezug:</span>{' '}
              <span className="font-medium text-foreground">{replyDialog.contextLabel}</span>
            </div>
          )}

          {replyDialog && replyDialog.conversations.length > 1 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bezieht sich auf Konversation</label>
              <Select value={replyConvId} onValueChange={onReplyConvIdChange}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Konversation wählen…" /></SelectTrigger>
                <SelectContent>
                  {replyDialog.conversations.map((conv) => (
                    <SelectItem key={conv.id} value={conv.id} className="text-xs">
                      {conv.conversation_title || 'Konversation'} — {STAGE_CONFIG[conv.journey_stage as string]?.label || conv.journey_stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={replyType === 'customer_reply' ? 'default' : 'outline'}
              onClick={() => onReplyTypeChange('customer_reply')}
              className="gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" /> Kundenantwort
            </Button>
            <Button
              size="sm"
              variant={replyType === 'internal_note' ? 'default' : 'outline'}
              onClick={() => onReplyTypeChange('internal_note')}
              className="gap-1.5"
            >
              <PenLine className="w-3.5 h-3.5" /> Interne Notiz
            </Button>
          </div>
          <Textarea
            placeholder={replyType === 'customer_reply'
              ? 'Kundenantwort hier einfügen (z.B. per E-Mail erhalten)…'
              : 'Interne Notiz erfassen…'}
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            rows={5}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={onSubmit} disabled={!replyText.trim()} className="gap-1.5">
            <Send className="w-3.5 h-3.5" /> Hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
