import { readConsent } from './consent';
import { ATTRIBUTION_PARAMS, getAttribution, getLastTouch } from './funnel-attribution';

/** Hängt First-/Last-Touch-Attribution an ein Formular für submit-b2b-lead an. */
export function appendAttribution(body: FormData, fallbackLabel = 'paid_funnel') {
  const first = getAttribution();
  for (const key of ATTRIBUTION_PARAMS) {
    const value = first[key];
    if (value) body.append(key, value);
  }
  if (first.landing_page) body.append('landing_page', first.landing_page);
  if (first.first_referrer) body.append('first_referrer', first.first_referrer);
  body.append('source_label', first.source_label || fallbackLabel);
  const consent = readConsent();
  body.append('consent_marketing', consent?.marketing === true ? 'true' : 'false');
  if (consent?.consentId) body.append('consent_id', consent.consentId);
  const last = getLastTouch();
  if (Object.keys(last).length > 0) body.append('last_touch', JSON.stringify(last));
}
