import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  CONTACT_LIMITS, DEFAULT_CONTACT_HEADING, isValidRecipientEmail, type LandingContactFormConfig,
} from '@/lib/landing-contact-config';
import { landingPrimary, readableOn } from '@/lib/landing-theme';

export const ContactFormConfigDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: LandingContactFormConfig;
  onConfirm: (value: LandingContactFormConfig) => void;
}> = ({ open, onOpenChange, value, onConfirm }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (open) setDraft(value); }, [open, value]);
  const emailOk = isValidRecipientEmail(draft.recipientEmail);
  const set = (key: keyof LandingContactFormConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft(d => ({ ...d, [key]: e.target.value.slice(0, CONTACT_LIMITS[key]) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kontaktformular einstellen</DialogTitle>
          <DialogDescription>Gilt nur für diese Landingpage. Die Empfängeradresse ist für Besucher nicht sichtbar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cf-recipient">Empfänger-E-Mail *</Label>
            <Input id="cf-recipient" type="email" value={draft.recipientEmail} onChange={set('recipientEmail')} placeholder="verkauf-skoda@autohaus.de" />
            {draft.recipientEmail && !emailOk && <p className="text-xs text-destructive">Bitte genau eine gültige E-Mail-Adresse eingeben.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-subject">Betreff der Anfrage-E-Mail</Label>
            <Input id="cf-subject" value={draft.subject} onChange={set('subject')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-heading">Überschrift im Formular</Label>
            <Input id="cf-heading" value={draft.heading} onChange={set('heading')} placeholder={DEFAULT_CONTACT_HEADING} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-intro">Text im Formular</Label>
            <Textarea id="cf-intro" rows={3} value={draft.intro} onChange={set('intro')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button disabled={!emailOk} onClick={() => { onConfirm({ ...draft, recipientEmail: draft.recipientEmail.trim() }); onOpenChange(false); }}>
            Bestätigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Editor-only stand-in for the floating "Jetzt anfragen" widget of the published page. */
export const ContactFormWidgetPreview: React.FC<{ config: LandingContactFormConfig; primary?: string }> = ({ config, primary }) => {
  const [open, setOpen] = useState(false);
  // Same resolver as the page itself: the widget must not show another brand colour.
  const pagePrimary = landingPrimary({ primaryColor: primary });
  const onPrimary = readableOn(pagePrimary);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full px-6 h-12 gap-2 shadow-lg"
        style={{ background: pagePrimary, color: onPrimary }}
      >
        <MessageSquare className="w-4 h-4" /> Jetzt anfragen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{config.heading || DEFAULT_CONTACT_HEADING}</DialogTitle>
            {config.intro && <DialogDescription className="whitespace-pre-line">{config.intro}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Ihr Name *" disabled />
            <Input placeholder="Ihre E-Mail *" disabled />
            <Input placeholder="Telefonnummer (optional)" disabled />
            <Textarea placeholder="Ihre Nachricht (optional)" rows={3} disabled />
            <Button className="w-full" disabled style={{ background: pagePrimary, color: onPrimary }}>Anfrage senden</Button>
            <p className="text-xs text-muted-foreground text-center">
              Vorschau – auf der Website geht die Anfrage an {config.recipientEmail || 'die hinterlegte Adresse'}.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
