import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization")!;
  
  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const admin = createClient(supabaseUrl, serviceKey);
  const userId = user.id;

  const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

  // ── 1. INSERT LEADS ──
  const b = (v?: boolean) => v === true;
  const lead = (d: any) => ({
    interested_purchase: b(d.interested_purchase),
    interested_test_drive: b(d.interested_test_drive),
    interested_trade_in: b(d.interested_trade_in),
    interested_leasing: b(d.interested_leasing),
    interested_financing: b(d.interested_financing),
    ...d,
  });

  const leadsData = [
    lead({ name: "Stefan Müller", email: "stefan.mueller@gmail.com", phone: "+49 176 12345678", vehicle_title: "BMW 320i M Sport 2024", message: "Guten Tag, ich interessiere mich für den BMW 320i M Sport. Können Sie mir ein Angebot machen? Barkauf bevorzugt.", interested_purchase: true, interested_test_drive: true, dealer_user_id: userId, created_at: daysAgo(21) }),
    lead({ name: "Anna Schmidt", email: "anna.schmidt@web.de", phone: "+49 151 98765432", vehicle_title: "Mercedes-Benz GLC 300 4MATIC", message: "Hallo, was kostet der GLC 300 im Leasing? Laufzeit 36 Monate, 15.000 km/Jahr wäre ideal. Probefahrt wäre super!", interested_leasing: true, interested_test_drive: true, dealer_user_id: userId, created_at: daysAgo(14) }),
    lead({ name: "Thomas Weber", email: "t.weber@firma-weber.de", phone: "+49 170 55443322", vehicle_title: "Audi Q5 Sportback S-Line", message: "Sehr geehrte Damen und Herren, als Gewerbekunde suche ich den Q5 Sportback. Finanzierung über 48 Monate. Bitte um Rückruf.", interested_financing: true, dealer_user_id: userId, created_at: daysAgo(10) }),
    lead({ name: "Thomas Weber", email: "t.weber@firma-weber.de", phone: "+49 170 55443322", vehicle_title: "Audi Q5 Sportback S-Line", message: "Nachtrag: Wir hätten auch noch einen Audi A4 Avant als Inzahlungnahme. BJ 2020, 65.000 km.", interested_financing: true, interested_trade_in: true, dealer_user_id: userId, created_at: daysAgo(8) }),
    lead({ name: "Lisa Hoffmann", email: "lisa.hoffmann@outlook.de", phone: "+49 152 11223344", vehicle_title: "VW Golf 8 R-Line", message: "Hi, ich suche einen Golf 8 R-Line in Schwarz. Gibt es Rabatt bei Barkauf?", interested_purchase: true, dealer_user_id: userId, created_at: daysAgo(7) }),
    lead({ name: "Markus Bauer", email: "m.bauer@t-online.de", phone: "+49 173 99887766", vehicle_title: "Hyundai IONIQ 5", message: "Hallo, welche Elektrofahrzeuge haben Sie aktuell? Der IONIQ 5 interessiert mich besonders. Was ist der aktuelle Preis?", interested_purchase: true, dealer_user_id: userId, created_at: daysAgo(3) }),
    lead({ name: "Sabine Klein", email: "s.klein@gmx.de", phone: "+49 160 44556677", vehicle_title: "Toyota RAV4 Hybrid", message: "Guten Tag, können Sie mir den RAV4 Hybrid anbieten? Privat-Leasing wäre interessant. Haben Sie auch einen Corolla?", interested_leasing: true, dealer_user_id: userId, created_at: daysAgo(12) }),
    lead({ name: "Sabine Klein", email: "s.klein@gmx.de", phone: "+49 160 44556677", vehicle_title: "Toyota Corolla Touring Sports", message: "Doch lieber der Corolla. Können wir telefonieren?", interested_leasing: true, dealer_user_id: userId, created_at: daysAgo(9) }),
    lead({ name: "Jürgen Neumann", email: "j.neumann@yahoo.de", phone: null, vehicle_title: "Skoda Octavia Combi", message: "Haben Sie den Octavia Combi sofort verfügbar? Brauche dringend ein Fahrzeug.", interested_purchase: true, dealer_user_id: userId, created_at: daysAgo(1) }),
    lead({ name: "Petra Richter", email: "petra.richter@posteo.de", phone: "+49 157 33221100", vehicle_title: "Opel Mokka-e Elegance", message: "Ich möchte den Mokka-e bestellen. Finanzierung über 36 Monate, Anzahlung 5.000€.", interested_financing: true, interested_purchase: true, dealer_user_id: userId, created_at: daysAgo(28) }),
  ];

  const { data: insertedLeads, error: leadsErr } = await admin.from("leads").insert(leadsData).select("id, email, name");
  if (leadsErr) return new Response(JSON.stringify({ error: leadsErr.message }), { status: 500, headers: corsHeaders });

  const leadMap: Record<string, string[]> = {};
  for (const l of insertedLeads || []) {
    if (!leadMap[l.email]) leadMap[l.email] = [];
    leadMap[l.email].push(l.id);
  }

  // ── 2. INSERT CONVERSATIONS ──
  const conversations = [
    {
      user_id: userId, lead_id: leadMap["stefan.mueller@gmail.com"]?.[0],
      conversation_title: "Stefan Müller – BMW 320i Kaufinteresse", journey_stage: "closing", status: "in_progress",
      source_channel: "email", summary: "Kunde hat Angebot akzeptiert. Kaufvertrag wird vorbereitet. Übergabe nächste Woche geplant.",
      next_action: "Kaufvertrag zusenden",
      customer_context: { name: "Stefan Müller", budget: "45.000€", timeline: "sofort" },
      vehicle_context: { title: "BMW 320i M Sport 2024", price: 44500 },
      created_at: daysAgo(21), updated_at: daysAgo(1),
    },
    {
      user_id: userId, lead_id: leadMap["anna.schmidt@web.de"]?.[0],
      conversation_title: "Anna Schmidt – GLC Leasing-Anfrage", journey_stage: "test_drive", status: "in_progress",
      source_channel: "email", summary: "Probefahrt für Samstag 14:00 vereinbart. Kundin ist sehr interessiert am GLC 300.",
      next_action: "Probefahrt durchführen, danach Leasingangebot finalisieren",
      customer_context: { name: "Anna Schmidt", preference: "Leasing 36M/15k km" },
      vehicle_context: { title: "Mercedes-Benz GLC 300 4MATIC", leasingRate: 589 },
      created_at: daysAgo(14), updated_at: daysAgo(2),
    },
    {
      user_id: userId, lead_id: leadMap["t.weber@firma-weber.de"]?.[0],
      conversation_title: "Thomas Weber – Audi Q5 Gewerbe", journey_stage: "hot_lead", status: "in_progress",
      source_channel: "email", summary: "Gewerbekunde mit hoher Kaufabsicht. Finanzierungsangebot gesendet. Inzahlungnahme A4 Avant wird geprüft.",
      next_action: "Bewertung Inzahlungnahme A4 abschließen und Gesamtangebot senden",
      customer_context: { name: "Thomas Weber", type: "Gewerbe", company: "Weber GmbH" },
      vehicle_context: { title: "Audi Q5 Sportback S-Line", tradeIn: "Audi A4 Avant 2020" },
      created_at: daysAgo(10), updated_at: daysAgo(1),
    },
    {
      user_id: userId, lead_id: leadMap["lisa.hoffmann@outlook.de"]?.[0],
      conversation_title: "Lisa Hoffmann – VW Golf 8 R-Line", journey_stage: "offer_sent", status: "waiting",
      source_channel: "website", summary: "Barkauf-Angebot mit 3% Nachlass gesendet. Warten auf Rückmeldung.",
      next_action: "Follow-up in 3 Tagen wenn keine Antwort",
      customer_context: { name: "Lisa Hoffmann", preference: "Barkauf, schwarz" },
      vehicle_context: { title: "VW Golf 8 R-Line", price: 38900, discount: "3%" },
      created_at: daysAgo(7), updated_at: daysAgo(4),
    },
    {
      user_id: userId, lead_id: leadMap["m.bauer@t-online.de"]?.[0],
      conversation_title: "Markus Bauer – E-Auto Interesse", journey_stage: "first_contact", status: "open",
      source_channel: "website", summary: "Erste E-Mail mit Infomaterial zum IONIQ 5 gesendet.",
      next_action: "Telefonischen Kontakt herstellen",
      customer_context: { name: "Markus Bauer" },
      vehicle_context: { title: "Hyundai IONIQ 5" },
      created_at: daysAgo(3), updated_at: daysAgo(2),
    },
    {
      user_id: userId, lead_id: leadMap["s.klein@gmx.de"]?.[0],
      conversation_title: "Sabine Klein – Toyota Leasing", journey_stage: "vehicle_interest", status: "in_progress",
      source_channel: "email", summary: "Kundin hat sich auf den Corolla festgelegt. Telefonat für morgen vereinbart.",
      next_action: "Telefonat führen, Leasing-Konditionen besprechen",
      customer_context: { name: "Sabine Klein", preference: "Privat-Leasing" },
      vehicle_context: { title: "Toyota Corolla Touring Sports" },
      created_at: daysAgo(12), updated_at: daysAgo(3),
    },
    {
      user_id: userId, lead_id: leadMap["petra.richter@posteo.de"]?.[0],
      conversation_title: "Petra Richter – Opel Mokka-e Kauf", journey_stage: "closing", status: "closed_won",
      source_channel: "email", summary: "Kaufvertrag unterschrieben. Fahrzeug wird vorbereitet. Übergabe am 15.03.",
      next_action: "Fahrzeugübergabe vorbereiten",
      customer_context: { name: "Petra Richter", financing: "36M, 5.000€ Anzahlung" },
      vehicle_context: { title: "Opel Mokka-e Elegance", price: 36500 },
      created_at: daysAgo(28), updated_at: daysAgo(5),
    },
  ];

  const { data: insertedConvs, error: convsErr } = await admin.from("sales_assistant_conversations").insert(conversations).select("id, lead_id, journey_stage");
  if (convsErr) return new Response(JSON.stringify({ error: convsErr.message }), { status: 500, headers: corsHeaders });

  const convMap: Record<string, { id: string; stage: string }> = {};
  for (const c of insertedConvs || []) {
    if (c.lead_id) convMap[c.lead_id] = { id: c.id, stage: c.journey_stage };
  }

  // ── 3. STAGE CHANGE LOGS ──
  const stageLogs: any[] = [];
  const stefanConv = convMap[leadMap["stefan.mueller@gmail.com"]?.[0]]?.id;
  if (stefanConv) {
    stageLogs.push(
      { conversation_id: stefanConv, user_id: userId, previous_stage: null, new_stage: "new_lead", reason: "Lead über Website eingegangen", changed_by: "bot", created_at: daysAgo(21) },
      { conversation_id: stefanConv, user_id: userId, previous_stage: "new_lead", new_stage: "first_contact", reason: "Erstantwort per E-Mail gesendet", changed_by: "bot", created_at: daysAgo(20) },
      { conversation_id: stefanConv, user_id: userId, previous_stage: "first_contact", new_stage: "vehicle_interest", reason: "Kunde bestätigt Interesse am BMW 320i", changed_by: "manual", created_at: daysAgo(18) },
      { conversation_id: stefanConv, user_id: userId, previous_stage: "vehicle_interest", new_stage: "offer_sent", reason: "Angebot über 44.500€ per E-Mail gesendet", changed_by: "bot", created_at: daysAgo(15) },
      { conversation_id: stefanConv, user_id: userId, previous_stage: "offer_sent", new_stage: "hot_lead", reason: "Kunde möchte verhandeln, sehr kaufbereit", changed_by: "manual", created_at: daysAgo(10) },
      { conversation_id: stefanConv, user_id: userId, previous_stage: "hot_lead", new_stage: "test_drive", reason: "Probefahrt durchgeführt, Kunde begeistert", changed_by: "manual", created_at: daysAgo(5) },
      { conversation_id: stefanConv, user_id: userId, previous_stage: "test_drive", new_stage: "closing", reason: "Kaufzusage erhalten, Vertrag wird vorbereitet", changed_by: "manual", created_at: daysAgo(2) },
    );
  }

  const annaConv = convMap[leadMap["anna.schmidt@web.de"]?.[0]]?.id;
  if (annaConv) {
    stageLogs.push(
      { conversation_id: annaConv, user_id: userId, previous_stage: null, new_stage: "new_lead", reason: "Anfrage über Landingpage", changed_by: "bot", created_at: daysAgo(14) },
      { conversation_id: annaConv, user_id: userId, previous_stage: "new_lead", new_stage: "first_contact", reason: "Leasing-Info und Prospekt gesendet", changed_by: "bot", created_at: daysAgo(13) },
      { conversation_id: annaConv, user_id: userId, previous_stage: "first_contact", new_stage: "vehicle_interest", reason: "Kundin hat konkrete Fragen zum GLC gestellt", changed_by: "manual", created_at: daysAgo(10) },
      { conversation_id: annaConv, user_id: userId, previous_stage: "vehicle_interest", new_stage: "offer_sent", reason: "Leasingangebot 589€/mtl. gesendet", changed_by: "bot", created_at: daysAgo(7) },
      { conversation_id: annaConv, user_id: userId, previous_stage: "offer_sent", new_stage: "test_drive", reason: "Probefahrt für Samstag 14:00 vereinbart", changed_by: "bot", created_at: daysAgo(3) },
    );
  }

  const thomasConv = convMap[leadMap["t.weber@firma-weber.de"]?.[0]]?.id;
  if (thomasConv) {
    stageLogs.push(
      { conversation_id: thomasConv, user_id: userId, previous_stage: null, new_stage: "new_lead", reason: "Gewerbeanfrage eingegangen", changed_by: "bot", created_at: daysAgo(10) },
      { conversation_id: thomasConv, user_id: userId, previous_stage: "new_lead", new_stage: "first_contact", reason: "Rückruf durchgeführt, Anforderungen aufgenommen", changed_by: "manual", created_at: daysAgo(9) },
      { conversation_id: thomasConv, user_id: userId, previous_stage: "first_contact", new_stage: "offer_sent", reason: "Finanzierungsangebot mit Gewerbekonditionen erstellt", changed_by: "bot", created_at: daysAgo(7) },
      { conversation_id: thomasConv, user_id: userId, previous_stage: "offer_sent", new_stage: "hot_lead", reason: "Kunde will A4 in Zahlung geben, sehr hohe Kaufbereitschaft", changed_by: "manual", created_at: daysAgo(3) },
    );
  }

  const petraConv = convMap[leadMap["petra.richter@posteo.de"]?.[0]]?.id;
  if (petraConv) {
    stageLogs.push(
      { conversation_id: petraConv, user_id: userId, previous_stage: null, new_stage: "new_lead", reason: "Kaufanfrage Mokka-e", changed_by: "bot", created_at: daysAgo(28) },
      { conversation_id: petraConv, user_id: userId, previous_stage: "new_lead", new_stage: "first_contact", reason: "Finanzierungsberatung per Telefon", changed_by: "manual", created_at: daysAgo(26) },
      { conversation_id: petraConv, user_id: userId, previous_stage: "first_contact", new_stage: "offer_sent", reason: "Finanzierungsangebot 36M/5k Anzahlung gesendet", changed_by: "bot", created_at: daysAgo(22) },
      { conversation_id: petraConv, user_id: userId, previous_stage: "offer_sent", new_stage: "hot_lead", reason: "Kundin hat Angebot angenommen", changed_by: "manual", created_at: daysAgo(15) },
      { conversation_id: petraConv, user_id: userId, previous_stage: "hot_lead", new_stage: "closing", reason: "Kaufvertrag unterschrieben", changed_by: "manual", created_at: daysAgo(8) },
    );
  }

  if (stageLogs.length > 0) {
    await admin.from("conversation_stage_log").insert(stageLogs);
  }

  // ── 4. CRM MANUAL NOTES ──
  const notes: any[] = [];
  
  if (stefanConv) {
    notes.push(
      { conversation_id: stefanConv, lead_id: leadMap["stefan.mueller@gmail.com"]?.[0], user_id: userId, note_type: "customer_reply", content: "Vielen Dank für das Angebot. Der Preis ist okay, aber können Sie bei der Ausstattung noch etwas drauflegen? Vielleicht das M Sportlenkrad?", created_at: daysAgo(14) },
      { conversation_id: stefanConv, lead_id: leadMap["stefan.mueller@gmail.com"]?.[0], user_id: userId, note_type: "internal_note", content: "Telefonat geführt: Kunde verhandelt fair. M Sportlenkrad als Goodwill angeboten.", created_at: daysAgo(12) },
      { conversation_id: stefanConv, lead_id: leadMap["stefan.mueller@gmail.com"]?.[0], user_id: userId, note_type: "customer_reply", content: "Super, dann nehme ich ihn! Wann kann ich zur Probefahrt kommen?", created_at: daysAgo(7) },
      { conversation_id: stefanConv, lead_id: leadMap["stefan.mueller@gmail.com"]?.[0], user_id: userId, note_type: "customer_reply", content: "Probefahrt war klasse. Ich kaufe den Wagen. Bitte senden Sie mir den Kaufvertrag.", created_at: daysAgo(3) },
    );
  }

  if (annaConv) {
    notes.push(
      { conversation_id: annaConv, lead_id: leadMap["anna.schmidt@web.de"]?.[0], user_id: userId, note_type: "customer_reply", content: "Danke für die Infos! 589€ klingt gut. Kann ich am Samstag zur Probefahrt kommen? Am besten nachmittags.", created_at: daysAgo(5) },
      { conversation_id: annaConv, lead_id: leadMap["anna.schmidt@web.de"]?.[0], user_id: userId, note_type: "internal_note", content: "Probefahrt Samstag 14:00 eingetragen. GLC in Obsidianschwarz vorfahrbereit.", created_at: daysAgo(4) },
    );
  }

  if (thomasConv) {
    notes.push(
      { conversation_id: thomasConv, lead_id: leadMap["t.weber@firma-weber.de"]?.[0], user_id: userId, note_type: "customer_reply", content: "Das Finanzierungsangebot sieht gut aus. Den A4 Avant würden wir gerne in Zahlung geben. Zustand ist sehr gut, scheckheftgepflegt.", created_at: daysAgo(5) },
      { conversation_id: thomasConv, lead_id: leadMap["t.weber@firma-weber.de"]?.[0], user_id: userId, note_type: "internal_note", content: "Inzahlungnahme-Bewertung angefordert: Audi A4 Avant 2020, 65.000 km, sehr guter Zustand. Voraussichtlich 22.000-24.000€.", created_at: daysAgo(4) },
    );
  }

  const lisaConv = convMap[leadMap["lisa.hoffmann@outlook.de"]?.[0]]?.id;
  if (lisaConv) {
    notes.push(
      { conversation_id: lisaConv, lead_id: leadMap["lisa.hoffmann@outlook.de"]?.[0], user_id: userId, note_type: "internal_note", content: "Barkauf-Angebot erstellt: Golf 8 R-Line Schwarz, UPE 40.100€, Nachlass 3% = 38.897€. Per E-Mail gesendet.", created_at: daysAgo(6) },
    );
  }

  if (notes.length > 0) {
    await admin.from("crm_manual_notes").insert(notes);
  }

  // ── 5. BOT MESSAGES (sales_assistant_messages) ──
  const botMessages: any[] = [];

  if (stefanConv) {
    botMessages.push(
      { conversation_id: stefanConv, user_id: userId, role: "assistant", message_type: "email_draft", channel: "email", output_text: "Sehr geehrter Herr Müller,\n\nvielen Dank für Ihr Interesse am BMW 320i M Sport 2024. Ein großartiges Fahrzeug mit beeindruckender Ausstattung!\n\nIch habe Ihnen ein individuelles Angebot vorbereitet:\n\n• BMW 320i M Sport, Mineralweiß Metallic\n• M Sportpaket, Lederausstattung Vernasca\n• Driving Assistant Professional\n• Head-up Display\n\nPreis: 44.500€ (Barkauf)\n\nGerne können wir auch eine Probefahrt vereinbaren. Haben Sie nächste Woche Zeit?\n\nMit freundlichen Grüßen", created_at: daysAgo(20) },
      { conversation_id: stefanConv, user_id: userId, role: "assistant", message_type: "email_draft", channel: "email", output_text: "Sehr geehrter Herr Müller,\n\nschön, dass Ihnen das Angebot zusagt! Bezüglich des M Sportlenkrads: Ich kann Ihnen das als Sonderausstattung ohne Aufpreis anbieten — als unser Dankeschön für Ihr Vertrauen.\n\nDer finale Preis bleibt bei 44.500€ inkl. M Sportlenkrad.\n\nFür die Probefahrt schlage ich Samstag, 10:00 Uhr vor. Passt das bei Ihnen?\n\nHerzliche Grüße", created_at: daysAgo(11) },
      { conversation_id: stefanConv, user_id: userId, role: "assistant", message_type: "email_draft", channel: "email", output_text: "Sehr geehrter Herr Müller,\n\nes freut mich sehr, dass Sie sich für den BMW 320i M Sport entschieden haben! 🎉\n\nIch bereite den Kaufvertrag vor und sende Ihnen diesen bis morgen per E-Mail zu. Die Übergabe können wir für nächste Woche Mittwoch planen.\n\nBenötigte Unterlagen:\n• Personalausweis\n• Bankverbindung für die Überweisung\n\nHerzlichen Glückwunsch zu Ihrem neuen BMW!\n\nMit besten Grüßen", created_at: daysAgo(2) },
    );
  }

  if (annaConv) {
    botMessages.push(
      { conversation_id: annaConv, user_id: userId, role: "assistant", message_type: "email_draft", channel: "email", output_text: "Liebe Frau Schmidt,\n\nvielen Dank für Ihre Anfrage zum Mercedes-Benz GLC 300 4MATIC!\n\nIch habe für Sie ein Leasingangebot kalkuliert:\n\n• Laufzeit: 36 Monate\n• Jährliche Fahrleistung: 15.000 km\n• Monatliche Rate: 589,00€ (netto)\n• Sonderzahlung: 0€\n\nDer GLC 300 überzeugt besonders durch sein souveränes Fahrwerk und den geräumigen Innenraum.\n\nGerne lade ich Sie zu einer Probefahrt ein! Wann passt es Ihnen?\n\nHerzliche Grüße", created_at: daysAgo(13) },
      { conversation_id: annaConv, user_id: userId, role: "assistant", message_type: "email_draft", channel: "email", output_text: "Liebe Frau Schmidt,\n\nwunderbar! Ich habe die Probefahrt für Sie eingetragen:\n\n📅 Samstag, 14:00 Uhr\n🚗 Mercedes-Benz GLC 300 4MATIC in Obsidianschwarz\n📍 Unser Autohaus, Hauptstraße 42\n\nBitte bringen Sie Ihren Führerschein mit. Die Probefahrt dauert ca. 45 Minuten — gerne auch auf der Autobahn.\n\nIch freue mich auf Ihren Besuch!\n\nMit freundlichen Grüßen", created_at: daysAgo(4) },
    );
  }

  if (thomasConv) {
    botMessages.push(
      { conversation_id: thomasConv, user_id: userId, role: "assistant", message_type: "email_draft", channel: "email", output_text: "Sehr geehrter Herr Weber,\n\nvielen Dank für Ihre Anfrage als Gewerbekunde. Gerne unterbreite ich Ihnen folgendes Finanzierungsangebot für den Audi Q5 Sportback S-Line:\n\n• Fahrzeugpreis (netto): 52.100€\n• Laufzeit: 48 Monate\n• Monatliche Rate: 698,00€ (netto)\n• Anzahlung: 10.000€ (netto)\n• Schlussrate: 18.500€\n\nAls Gewerbekunde profitieren Sie zusätzlich von:\n• Vorsteuerabzug\n• Sonderkonditionen über unsere Flottenabteilung\n\nBezüglich der Inzahlungnahme Ihres Audi A4 Avant: Gerne bewerten wir das Fahrzeug. Können Sie mir die FIN und aktuelle Fotos zusenden?\n\nMit freundlichen Grüßen", created_at: daysAgo(8) },
    );
  }

  if (lisaConv) {
    botMessages.push(
      { conversation_id: lisaConv, user_id: userId, role: "assistant", message_type: "email_draft", channel: "email", output_text: "Liebe Frau Hoffmann,\n\nvielen Dank für Ihr Interesse am VW Golf 8 R-Line!\n\nIch freue mich, Ihnen folgendes Angebot machen zu können:\n\n• VW Golf 8 R-Line, Deep Black Perleffekt\n• 2.0 TSI, 150 PS, DSG\n• Digital Cockpit Pro, Harman Kardon\n• IQ.LIGHT LED-Matrixscheinwerfer\n\nUPE: 40.100€\nIhr Preis (3% Barkauf-Nachlass): 38.897€\n\nDas Fahrzeug ist sofort verfügbar und kann innerhalb von 5 Werktagen übergeben werden.\n\nSoll ich das Fahrzeug für Sie reservieren?\n\nMit freundlichen Grüßen", created_at: daysAgo(6) },
    );
  }

  const markusConv = convMap[leadMap["m.bauer@t-online.de"]?.[0]]?.id;
  if (markusConv) {
    botMessages.push(
      { conversation_id: markusConv, user_id: userId, role: "assistant", message_type: "email_draft", channel: "email", output_text: "Sehr geehrter Herr Bauer,\n\nvielen Dank für Ihre Anfrage zum Hyundai IONIQ 5!\n\nAktuell haben wir zwei IONIQ 5 auf Lager:\n\n1. IONIQ 5 Dynamiq, 77,4 kWh, Gravity Gold Matt — 47.900€\n2. IONIQ 5 Uniq, 77,4 kWh, Digital Teal — 52.400€\n\nBeide Modelle verfügen über:\n• 800V-Ladetechnologie (18 Min. von 10-80%)\n• Vehicle-to-Load (V2L) Funktion\n• Bis zu 507 km Reichweite (WLTP)\n\nGerne sende ich Ihnen detaillierte Unterlagen. Darf ich Sie telefonisch erreichen, um Ihre Wünsche zu besprechen?\n\nMit freundlichen Grüßen", created_at: daysAgo(2) },
    );
  }

  const sabineConv = convMap[leadMap["s.klein@gmx.de"]?.[0]]?.id;
  if (sabineConv) {
    botMessages.push(
      { conversation_id: sabineConv, user_id: userId, role: "assistant", message_type: "email_draft", channel: "email", output_text: "Liebe Frau Klein,\n\nvielen Dank für Ihre Anfragen! Ich verstehe, dass Sie sich nun für den Toyota Corolla Touring Sports entschieden haben — eine ausgezeichnete Wahl!\n\nFür das Privat-Leasing biete ich Ihnen:\n\n• Toyota Corolla Touring Sports 1.8 Hybrid\n• Laufzeit: 36 Monate\n• 10.000 km/Jahr\n• Monatliche Rate: 329,00€\n\nGerne besprechen wir die Details telefonisch. Ich rufe Sie morgen Vormittag an — passt das?\n\nHerzliche Grüße", created_at: daysAgo(8) },
    );
  }

  if (petraConv) {
    botMessages.push(
      { conversation_id: petraConv, user_id: userId, role: "assistant", message_type: "email_draft", channel: "email", output_text: "Liebe Frau Richter,\n\nvielen Dank für Ihr Interesse am Opel Mokka-e Elegance!\n\nHier Ihr individuelles Finanzierungsangebot:\n\n• Opel Mokka-e Elegance, Voltaic Blue\n• Fahrzeugpreis: 36.500€\n• Anzahlung: 5.000€\n• Laufzeit: 36 Monate\n• Monatliche Rate: 445,00€\n• Effektiver Jahreszins: 3,99%\n\nInkl. Opel-Garantie und 8 Jahre Batteriegarantie.\n\nSoll ich den Kaufvertrag vorbereiten?\n\nMit freundlichen Grüßen", created_at: daysAgo(25) },
      { conversation_id: petraConv, user_id: userId, role: "assistant", message_type: "email_draft", channel: "email", output_text: "Liebe Frau Richter,\n\nherzlichen Glückwunsch zu Ihrem neuen Opel Mokka-e! 🎉\n\nDer Kaufvertrag ist unterzeichnet. Ihr Fahrzeug wird nun für die Übergabe vorbereitet:\n\n📅 Übergabetermin: 15.03.2026, 10:00 Uhr\n📍 Unser Autohaus\n\nWir kümmern uns um:\n• Vollständige Fahrzeugaufbereitung\n• Einweisung in alle Funktionen (ca. 45 Min.)\n• Ladeeinführung & App-Setup\n\nBitte bringen Sie mit:\n• Personalausweis\n• Führerschein\n• Bankverbindung\n\nWir freuen uns auf die Übergabe!\n\nMit herzlichen Grüßen", created_at: daysAgo(7) },
    );
  }

  if (botMessages.length > 0) {
    await admin.from("sales_assistant_messages").insert(botMessages);
  }

  return new Response(JSON.stringify({ 
    success: true, 
    leads: insertedLeads?.length || 0, 
    conversations: insertedConvs?.length || 0,
    stage_logs: stageLogs.length,
    notes: notes.length,
    bot_messages: botMessages.length,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
