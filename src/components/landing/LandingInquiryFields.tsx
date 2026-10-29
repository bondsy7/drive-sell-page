import React from 'react';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const LANDING_INQUIRY_CSS = `
.lp-inquiry{--inquiry-surface:0 0% 100%;--inquiry-text:220 15% 16%;--inquiry-border:220 25% 85%;background:hsl(var(--inquiry-surface));color:hsl(var(--inquiry-text));font-family:inherit;}
.lp-inquiry-fields{display:flex;flex-direction:column;gap:24px;}
.lp-inquiry-field{display:flex;flex-direction:column;gap:4px;}
.lp-inquiry label{font-size:16px;font-weight:400;line-height:1.5;color:inherit;}
.lp-inquiry input:not([type=checkbox]),.lp-inquiry textarea{box-sizing:border-box;width:100%;border:1px solid hsl(var(--inquiry-border));border-radius:6px;background:hsl(var(--inquiry-surface));color:hsl(var(--inquiry-text));font:inherit;padding:8px 10px;box-shadow:none;}
.lp-inquiry input:not([type=checkbox]){height:39px;}
.lp-inquiry textarea{min-height:220px;resize:vertical;line-height:1.4;}
.lp-inquiry input:focus-visible,.lp-inquiry textarea:focus-visible{outline:2px solid var(--inquiry-accent);outline-offset:2px;}
.lp-inquiry-consents{display:flex;flex-direction:column;gap:12px;margin-top:18px;}
.lp-inquiry .lp-inquiry-consent{display:grid;grid-template-columns:18px minmax(0,1fr);gap:8px;align-items:start;font-size:13px;cursor:pointer;}
.lp-inquiry-consent input{width:18px;height:18px;margin:1px 0 0;accent-color:var(--inquiry-accent);}
.lp-inquiry-consent strong{display:block;margin-bottom:4px;}
.lp-inquiry-consent span{font-size:12px;line-height:1.45;}
.lp-inquiry-consent a{color:var(--inquiry-accent);text-decoration:underline;}
.lp-inquiry-note{margin:24px 0 8px;line-height:1.5;font-size:16px;}
.lp-inquiry-actions{display:flex;justify-content:space-between;gap:20px;}
.lp-inquiry-actions .lp-inquiry-action{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;width:43%;border:0;border-radius:999px;background:var(--inquiry-accent);color:var(--inquiry-on-accent);font-size:15px;font-weight:700;text-decoration:none;cursor:pointer;padding:12px 16px;}
.lp-inquiry-action:disabled{opacity:.6;cursor:wait;}
@media(max-width:360px){.lp-inquiry-actions{gap:12px;}.lp-inquiry-actions .lp-inquiry-action{width:50%;padding:12px;}}
`;

export const DEFAULT_INQUIRY_MESSAGE = 'Hallo,\nich interessiere mich für das angebotene Fahrzeug und bitte um weitere Informationen.\nMit freundlichen Grüßen';

/**
 * Pre-filled enquiry text. When the page was created for a known make and model,
 * the vehicle is named automatically so the dealer receives a specific request.
 */
export function inquiryMessage(vehicleLabel?: string): string {
  const name = (vehicleLabel || '').trim();
  if (!name) return DEFAULT_INQUIRY_MESSAGE;
  return `Hallo,\nich interessiere mich für das angebotene Fahrzeug ${name} und bitte um weitere Informationen.\nMit freundlichen Grüßen`;
}

export function inquiryPhoneHref(phone?: string): string | undefined {
  const cleaned = (phone || '').replace(/[^+\d]/g, '');
  return /^\+?\d{3,20}$/.test(cleaned) ? `tel:${cleaned}` : undefined;
}

/** Shared fields keep the editor and exported landingpage form identical. */
export default function LandingInquiryFields({ phone, privacyUrl = '/datenschutz/', vehicleLabel }: { phone?: string; privacyUrl?: string; vehicleLabel?: string }) {
  const phoneHref = inquiryPhoneHref(phone);
  return <>
    <div className="lp-inquiry-fields">
      <div className="lp-inquiry-field"><Label htmlFor="lead-first-name">Vorname*</Label><Input id="lead-first-name" name="firstName" autoComplete="given-name" required maxLength={100} /></div>
      <div className="lp-inquiry-field"><Label htmlFor="lead-last-name">Nachname*</Label><Input id="lead-last-name" name="lastName" autoComplete="family-name" required maxLength={100} /></div>
      <div className="lp-inquiry-field"><Label htmlFor="lead-email">E-Mail-Adresse*</Label><Input id="lead-email" name="email" type="email" autoComplete="email" required maxLength={255} /></div>
      <div className="lp-inquiry-field"><Label htmlFor="lead-phone">Telefonnummer *</Label><Input id="lead-phone" name="phone" type="tel" autoComplete="tel" required maxLength={50} pattern="[+0-9() /.-]{3,50}" /></div>
      <div className="lp-inquiry-field"><Label htmlFor="lead-message">Ihre Nachricht (optional)</Label><Textarea id="lead-message" name="message" defaultValue={inquiryMessage(vehicleLabel)} maxLength={3000} rows={8} /></div>
    </div>
    <div className="lp-inquiry-consents">
      <label className="lp-inquiry-consent"><input type="checkbox" name="privacyConsent" required /><span><strong>Datenschutz</strong>Ja, ich habe die <a href={privacyUrl} target="_blank" rel="noopener noreferrer">Datenschutzerklärung</a> gelesen und stimme diesen zu.</span></label>
      <label className="lp-inquiry-consent"><input type="checkbox" name="marketingConsent" /><span><strong>Marketing</strong>Ja, ich stimme der Verarbeitung meiner personenbezogenen Daten für Marketingzwecke durch E-Mail- oder Telefonkontakt zu. (Optional)</span></label>
    </div>
    <p className="lp-inquiry-note">Bitte mit * gekennzeichnete Felder ausfüllen.<br />Kostenlos und unverbindlich!</p>
    <div className="lp-inquiry-actions">
      <Button type="submit" id="leadSubmitBtn" className="lp-inquiry-action">Senden</Button>
      {phoneHref && <Button asChild className="lp-inquiry-action"><a href={phoneHref}><Phone size={18} aria-hidden="true" />Anrufen</a></Button>}
    </div>
  </>;
}