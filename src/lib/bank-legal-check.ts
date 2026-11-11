import type { VehicleData } from '@/types/vehicle';
import { ADDRESS_PLACEHOLDER, BANK_SHORTCODES, shortcodeValues } from './bank-legal-template';

export interface ProfileBank { bank_name: string; legal_text: string; bank_type?: string }
export type CheckLevel = 'ok' | 'warn' | 'error';
export interface BankCheckItem { level: CheckLevel; label: string }

const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
const KNOWN = new Set([...BANK_SHORTCODES.map(s => s.code.slice(1, -1)), 'laufzeit_zahl']);

/** Checks whether the offer's bank text matches the profile bank, the address was filled in and all shortcodes resolve. */
export function checkBankLegal(text: string, bankName: string, banks: ProfileBank[], data: VehicleData): BankCheckItem[] {
  const items: BankCheckItem[] = [];
  if (!norm(text)) return [{ level: 'error', label: 'Kein Banktext eingetragen.' }];
  const bank = banks.find(b => norm(b.bank_name) === norm(bankName));
  if (!bankName?.trim()) items.push({ level: 'error', label: 'Keine Bank gewählt – bitte gespeicherten Banktext aus dem Profil auswählen.' });
  else if (!bank) items.push({ level: 'warn', label: `Bank „${bankName}“ ist nicht im Profil hinterlegt.` });
  else if (norm(bank.legal_text) === norm(text)) items.push({ level: 'ok', label: `Banktext stimmt mit dem Profil (${bank.bank_name}) überein.` });
  else items.push({ level: 'warn', label: `Banktext weicht vom Profiltext (${bank.bank_name}) ab – bitte Änderungen prüfen.` });

  if (text.includes(ADDRESS_PLACEHOLDER)) items.push({ level: 'error', label: 'Anschrift der Bank fehlt – Platzhalter „[Anschrift der Bank eintragen]“ ersetzen.' });
  else items.push({ level: 'ok', label: 'Anschrift der Bank wurde eingetragen.' });

  const codes = Array.from(new Set(Array.from(text.matchAll(/\{([a-z_]+)\}/g)).map(m => m[1])));
  const vals = shortcodeValues(data, bankName);
  const unknown = codes.filter(c => !KNOWN.has(c));
  const empty = codes.filter(c => KNOWN.has(c) && !vals[c]);
  if (unknown.length) items.push({ level: 'error', label: `Unbekannte Platzhalter: ${unknown.map(c => `{${c}}`).join(', ')}` });
  if (empty.length) {
    const label = (c: string) => BANK_SHORTCODES.find(s => s.code === `{${c}}`)?.label ?? c;
    items.push({ level: 'warn', label: `Ohne Angebotswert (wird ausgeblendet): ${empty.map(label).join(', ')}` });
  }
  if (codes.length && !unknown.length && !empty.length) items.push({ level: 'ok', label: 'Alle Platzhalter {…} werden automatisch aus dem Angebot befüllt.' });
  return items;
}
