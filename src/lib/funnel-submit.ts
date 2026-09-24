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
  const last = getLastTouch();
  if (Object.keys(last).length > 0) body.append('last_touch', JSON.stringify(last));
}
