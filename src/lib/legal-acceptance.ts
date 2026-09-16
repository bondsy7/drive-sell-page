import { supabase } from '@/integrations/supabase/client';
import { LEGAL_VERSIONS, TERMS_DOCUMENT, B2B_DOCUMENT } from './legal-config';

export type LegalAuthMethod = 'password' | 'google' | 'onboarding';

function buildEvidence(companyName: string, authMethod: LegalAuthMethod) {
  // Bewusst ohne IP-Adresse, ohne Passwörter und ohne sonstige sensible Merkmale.
  // Die Datenschutzerklärung wird nur als "angezeigt" dokumentiert, NICHT als Einwilligung.
  return {
    company_name: companyName.trim() || null,
    auth_method: authMethod,
    notice_version_shown: LEGAL_VERSIONS.privacy,
    ui_version: LEGAL_VERSIONS.agb,
  };
}

/**
 * Versionierte Vertragsannahme. Es werden ZWEI getrennte Nachweise geführt:
 * die AGB-Annahme (`agb`) und die Unternehmer-/Altersbestätigung (`b2b_confirmation`).
 * Es wird bewusst KEINE IP-Adresse gespeichert.
 */
export async function hasCurrentTermsAcceptance(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('legal_acceptances')
    .select('document')
    .eq('user_id', userId)
    .eq('version', LEGAL_VERSIONS.agb)
    .eq('confirms_business_and_age', true)
    .in('document', [TERMS_DOCUMENT, B2B_DOCUMENT]);

  if (error) return false;
  const docs = new Set((data ?? []).map((r) => r.document));
  return docs.has(TERMS_DOCUMENT) && docs.has(B2B_DOCUMENT);
}

export async function recordTermsAcceptance(
  userId: string,
  companyName: string,
  authMethod: LegalAuthMethod = 'onboarding',
) {
  const evidence = buildEvidence(companyName, authMethod);
  const base = {
    user_id: userId,
    version: LEGAL_VERSIONS.agb,
    company_name: companyName.trim() || null,
    confirms_business_and_age: true,
    evidence,
  };

  // accepted_at wird serverseitig per Default gesetzt.
  return supabase.from('legal_acceptances').insert([
    { ...base, document: TERMS_DOCUMENT },
    { ...base, document: B2B_DOCUMENT },
  ]);
}
