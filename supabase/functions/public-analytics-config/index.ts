// Liefert ausschließlich öffentliche Mess-Konfiguration (GA4-Mess-ID ist im Browser ohnehin sichtbar).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const raw = (Deno.env.get('GOOGLE_ANALYTICS_MEASUREMENT_ID') ?? '').trim();
  const ga4MeasurementId = /^G-[A-Z0-9]{4,20}$/i.test(raw) ? raw.toUpperCase() : null;
  return new Response(JSON.stringify({ ga4MeasurementId }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  });
});
