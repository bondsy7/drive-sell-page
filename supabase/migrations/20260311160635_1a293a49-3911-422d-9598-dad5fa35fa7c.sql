
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 1. sales_assistant_profiles
CREATE TABLE public.sales_assistant_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  assistant_name text,
  default_tone text DEFAULT 'freundlich',
  brand_voice text,
  sales_goal text,
  preferred_cta text,
  whatsapp_style text,
  email_style text,
  objection_style text,
  closing_style text,
  response_language text DEFAULT 'de',
  max_response_length text DEFAULT 'medium',
  should_push_financing boolean DEFAULT true,
  should_push_test_drive boolean DEFAULT true,
  should_push_trade_in boolean DEFAULT true,
  should_offer_callback boolean DEFAULT true,
  forbidden_phrases text[],
  must_use_phrases text[],
  compliance_notes text,
  signature_name text,
  signature_role text,
  signature_phone text,
  signature_email text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_assistant_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sales profile" ON public.sales_assistant_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all sales profiles" ON public.sales_assistant_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. sales_knowledge_documents
CREATE TABLE public.sales_knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  document_type text NOT NULL DEFAULT 'other',
  source_type text NOT NULL DEFAULT 'upload',
  storage_path text,
  public_url text,
  mime_type text,
  content_text text,
  embedding_status text DEFAULT 'pending',
  chunk_count int DEFAULT 0,
  is_active boolean DEFAULT true,
  version_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own knowledge docs" ON public.sales_knowledge_documents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all knowledge docs" ON public.sales_knowledge_documents FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. sales_knowledge_chunks
CREATE TABLE public.sales_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.sales_knowledge_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  chunk_index int,
  chunk_text text NOT NULL,
  token_count int,
  embedding extensions.vector(768),
  metadata jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own chunks" ON public.sales_knowledge_chunks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all chunks" ON public.sales_knowledge_chunks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. customer_journey_templates
CREATE TABLE public.customer_journey_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  vehicle_category text,
  journey_stage text NOT NULL,
  description text,
  buyer_intent_signals text[],
  recommended_goal text,
  recommended_cta text,
  recommended_objections text[],
  recommended_assets text[],
  default_prompt_block text,
  is_global boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_journey_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own journey templates" ON public.customer_journey_templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can read global templates" ON public.customer_journey_templates FOR SELECT TO authenticated USING (is_global = true);
CREATE POLICY "Admins can manage all journey templates" ON public.customer_journey_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. sales_assistant_conversations
CREATE TABLE public.sales_assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  vehicle_context jsonb DEFAULT '{}',
  customer_context jsonb DEFAULT '{}',
  journey_stage text DEFAULT 'new_lead',
  source_channel text DEFAULT 'email',
  conversation_title text,
  status text DEFAULT 'open',
  next_action text,
  next_action_due_at timestamptz,
  summary text,
  last_generated_output text,
  last_prompt_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_assistant_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own conversations" ON public.sales_assistant_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all conversations" ON public.sales_assistant_conversations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. sales_assistant_messages
CREATE TABLE public.sales_assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.sales_assistant_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user',
  message_type text NOT NULL DEFAULT 'reply',
  input_text text,
  output_text text,
  channel text,
  approval_status text DEFAULT 'draft',
  generation_mode text DEFAULT 'quick_reply',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own messages" ON public.sales_assistant_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all messages" ON public.sales_assistant_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. sales_assistant_tasks
CREATE TABLE public.sales_assistant_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.sales_assistant_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  task_type text DEFAULT 'other',
  priority text DEFAULT 'medium',
  status text DEFAULT 'open',
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_assistant_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tasks" ON public.sales_assistant_tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all tasks" ON public.sales_assistant_tasks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('sales-knowledge', 'sales-knowledge', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload sales knowledge" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sales-knowledge' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own sales knowledge" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'sales-knowledge' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own sales knowledge" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'sales-knowledge' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins can manage all sales knowledge" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'sales-knowledge' AND public.has_role(auth.uid(), 'admin'));

-- Seed: Admin settings for sales assistant defaults
INSERT INTO public.admin_settings (key, value, updated_at) VALUES
('sales_assistant_system_prompt', '{"prompt": "Du bist ein erfahrener KI-Verkaufsassistent für ein Autohaus. Deine Aufgabe ist es, den Verkäufer bei der Kundenkommunikation zu unterstützen. Du kennst die hinterlegten Firmenvorgaben, Verkaufsleitfäden und Produktinformationen.\n\nDeine Antworten sind:\n- Verkaufsorientiert\n- Hilfreich und vertrauenswürdig\n- Konkret und firmenkonform\n- Kundenorientiert\n- Abschlussorientiert, aber niemals aggressiv\n\nWICHTIG:\n- Erfinde KEINE falschen technischen Fahrzeugangaben\n- Mache KEINE rechtlich problematischen Aussagen\n- Priorisiere vorhandene Firmenvorgaben\n- Wenn dir Informationen fehlen, antworte vorsichtig und verkaufsfördernd ohne falsche Fakten\n- Für WhatsApp schreibe knapper als für E-Mail\n- Je nach Customer Journey Phase verfolge ein passendes Ziel\n- Antworte immer auf Deutsch"}', now()),
('sales_assistant_default_objections', '{"objections": [{"objection": "Das ist mir zu teuer", "response": "Ich verstehe Ihre Bedenken. Lassen Sie uns gemeinsam schauen, welche Finanzierungsmöglichkeiten wir haben, die zu Ihrem Budget passen.", "bridge": "Darf ich Ihnen ein unverbindliches Finanzierungsangebot erstellen?"}, {"objection": "Ich muss noch darüber nachdenken", "response": "Das ist völlig verständlich – eine Fahrzeugentscheidung will gut überlegt sein. Gibt es bestimmte Punkte, bei denen ich Ihnen noch weiterhelfen kann?", "bridge": "Soll ich Ihnen die wichtigsten Fakten nochmal per E-Mail zusammenfassen?"}, {"objection": "Ich habe woanders ein besseres Angebot", "response": "Danke, dass Sie das ansprechen. Wir möchten sicherstellen, dass Sie das beste Gesamtpaket erhalten – Service, Garantie und Betreuung eingeschlossen.", "bridge": "Darf ich mir das Vergleichsangebot anschauen? Vielleicht können wir nachbessern."}, {"objection": "Ich bin noch nicht sicher, ob das das richtige Fahrzeug ist", "response": "Das kann ich gut nachvollziehen. Eine Probefahrt gibt Ihnen die Möglichkeit, das Fahrzeug wirklich zu erleben.", "bridge": "Wann hätten Sie Zeit für eine unverbindliche Probefahrt?"}, {"objection": "Die Lieferzeit ist zu lang", "response": "Ich verstehe, dass Sie das Fahrzeug zeitnah benötigen. Lassen Sie mich prüfen, ob wir ein vergleichbares Lagerfahrzeug haben.", "bridge": "Alternativ kann ich auch bei unseren Partnerstandorten nachfragen."}, {"objection": "Ich möchte erst meinen Partner fragen", "response": "Natürlich, das ist eine gemeinsame Entscheidung. Gerne können Sie Ihren Partner zur nächsten Besichtigung oder Probefahrt mitbringen.", "bridge": "Soll ich einen Termin vorschlagen, der für Sie beide passt?"}, {"objection": "Die Versicherung/Steuer ist zu hoch", "response": "Guter Punkt. Die laufenden Kosten sind natürlich wichtig. Ich kann Ihnen eine Übersicht der Gesamtkosten erstellen.", "bridge": "Möchten Sie, dass ich die KFZ-Steuer und mögliche Versicherungstarife für Sie berechne?"}, {"objection": "Ich warte auf ein neues Modell", "response": "Das kommende Modell hat sicher seine Reize. Gleichzeitig bieten die aktuellen Modelle bereits ein hervorragendes Preis-Leistungs-Verhältnis.", "bridge": "Darf ich Ihnen die Vorteile des aktuellen Modells nochmal im Detail zeigen?"}, {"objection": "Ich kaufe grundsätzlich keine Gebrauchtwagen", "response": "Ich verstehe Ihre Präferenz. Unsere Gebrauchtwagen durchlaufen eine strenge Qualitätsprüfung und kommen mit umfassender Garantie.", "bridge": "Darf ich Ihnen unser Prüf- und Garantiepaket vorstellen?"}, {"objection": "Online finde ich das günstiger", "response": "Online-Preise sind oft ohne Service und persönliche Beratung. Bei uns erhalten Sie ein Komplettpaket mit Vor-Ort-Service.", "bridge": "Lassen Sie uns schauen, was wir Ihnen als Gesamtpaket anbieten können."}]}', now()),
('sales_assistant_default_ctas', '{"ctas": ["Vereinbaren Sie jetzt eine unverbindliche Probefahrt", "Lassen Sie sich ein individuelles Finanzierungsangebot erstellen", "Rufen Sie uns an – wir beraten Sie gerne persönlich", "Sichern Sie sich dieses Fahrzeug mit einer unverbindlichen Reservierung", "Besuchen Sie uns im Autohaus für eine persönliche Beratung"]}', now()),
('sales_assistant_channel_rules', '{"email": "Professionelle E-Mail mit Betreff, Begrüßung, Haupttext, CTA und Grußformel. Mittlere Länge.", "whatsapp": "Kurz, direkt, natürlich. Max 3-4 Sätze plus ein CTA. Emojis sparsam. Persönlich.", "phone": "Telefonleitfaden mit Einstieg, 2-3 Kernargumenten und Abschlussfrage. Gesprächsnotizen-Format."}', now())
ON CONFLICT (key) DO NOTHING;

-- Seed: Global customer journey templates
INSERT INTO public.customer_journey_templates (name, journey_stage, description, recommended_goal, recommended_cta, recommended_objections, buyer_intent_signals, is_global, is_active, sort_order) VALUES
('Neuer Lead', 'new_lead', 'Ein neuer Interessent hat sich gemeldet. Erste Reaktion muss schnell und professionell sein.', 'Schnell reagieren, Vertrauen aufbauen, Interesse qualifizieren', 'Persönliches Gespräch anbieten oder Probefahrt vorschlagen', ARRAY['Das ist mir zu teuer', 'Ich muss noch darüber nachdenken'], ARRAY['Hat Kontaktformular ausgefüllt', 'Hat Fahrzeug angefragt', 'Hat Probefahrt-Anfrage gestellt'], true, true, 1),
('Erstkontakt', 'first_contact', 'Erster persönlicher Kontakt nach Lead-Eingang.', 'Bedarf ermitteln, Vertrauen stärken, nächsten Schritt vereinbaren', 'Termin für Beratung oder Probefahrt vorschlagen', ARRAY['Ich schaue mich noch um', 'Ich bin noch nicht sicher'], ARRAY['Antwortet auf Kontaktaufnahme', 'Stellt konkrete Fragen'], true, true, 2),
('Finanzierungsinteresse', 'finance_interest', 'Kunde hat Interesse an Finanzierung oder Leasing signalisiert.', 'Finanzierung nicht kompliziert wirken lassen, nächste Hürde abbauen', 'Unverbindliches Finanzierungsangebot erstellen', ARRAY['Das ist mir zu teuer', 'Die Raten sind zu hoch', 'Ich habe schon ein Angebot von der Bank'], ARRAY['Fragt nach monatlichen Raten', 'Erwähnt Budget', 'Fragt nach Leasing'], true, true, 3),
('Angebot gesendet', 'offer_sent', 'Ein konkretes Angebot wurde erstellt und an den Kunden gesendet.', 'Unsicherheit reduzieren, Dringlichkeit schaffen ohne aggressiv zu sein', 'Rückfragen klären und Termin zur Besprechung anbieten', ARRAY['Ich muss noch darüber nachdenken', 'Ich habe woanders ein besseres Angebot', 'Ich möchte erst meinen Partner fragen'], ARRAY['Hat Angebot erhalten', 'Hat Angebot geöffnet', 'Stellt Nachfragen zum Angebot'], true, true, 4),
('Nach Angebot – Stille', 'after_offer_silence', 'Kunde hat nach dem Angebot nicht mehr reagiert.', 'Freundlich nachfassen, Gespräch reaktivieren', 'Unverbindlichen Rückruf oder neues Angebot anbieten', ARRAY['Ich habe gerade keine Zeit', 'Ich habe mich anders entschieden'], ARRAY['Keine Reaktion seit mehreren Tagen', 'E-Mail nicht beantwortet'], true, true, 5),
('Abschluss', 'closing', 'Kunde ist kaufbereit, Abschluss steht bevor.', 'Klare Abschlussfrage, Verbindlichkeit erzeugen', 'Kaufvertrag vorbereiten, Übergabetermin vereinbaren', ARRAY['Ich brauche noch einen Tag', 'Können Sie noch was am Preis machen?'], ARRAY['Fragt nach Verfügbarkeit', 'Fragt nach Übergabetermin', 'Will Vertrag sehen'], true, true, 6),
('Reaktivierung', 'reactivation', 'Ehemaliger Interessent soll reaktiviert werden.', 'Interesse neu wecken, aktuelle Angebote zeigen', 'Neues passendes Fahrzeug vorschlagen oder Sonderaktion teilen', ARRAY['Ich habe kein Interesse mehr', 'Ich habe schon gekauft'], ARRAY['War länger nicht aktiv', 'Hat früher Interesse gezeigt'], true, true, 7);
