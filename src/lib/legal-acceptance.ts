import { supabase } from '@/integrations/supabase/client';
import { LEGAL_VERSIONS, TERMS_DOCUMENT } from './legal-config';

/**
 * Versionierte Vertragsannahme (AGB + Unternehmer-/Altersbestätigung).
 * Es wird bewusst KEINE IP-Adresse gespeichert.
 */
export async function hasCurrentTermsAcceptance(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('legal_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('document', TERMS_DOCUMENT)
    .eq('version', LEGAL_VERSIONS.agb)
    .eq('confirms_business_and_age', true)
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function recordTermsAcceptance(
  userId: string,
  companyName: string,
  authMethod: 'password' | 'google' | 'onboarding' = 'onboarding',
) {
  return supabase.from('legal_acceptances').insert({
    user_id: userId,
    document: TERMS_DOCUMENT,
    version: LEGAL_VERSIONS.agb,
    company_name: companyName.trim() || null,
    confirms_business_and_age: true,
    // Beweisbegleitdaten – bewusst ohne IP-Adresse, ohne Passwörter, ohne
    // sonstige sensible Merkmale. Die Datenschutzerklärung wird nur als
    // "angezeigt" dokumentiert, NICHT als Einwilligung.
    evidence: {
      company_name: companyName.trim() || null,
      auth_method: authMethod,
      notice_version_shown: LEGAL_VERSIONS.privacy,
      ui_version: LEGAL_VERSIONS.agb,
    },
  });
}
