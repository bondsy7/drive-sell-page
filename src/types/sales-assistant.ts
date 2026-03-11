// Sales Assistant Types

export type JourneyStage =
  | 'new_lead' | 'first_contact' | 'needs_analysis' | 'vehicle_interest'
  | 'finance_interest' | 'trade_in_interest' | 'offer_sent' | 'follow_up_1'
  | 'follow_up_2' | 'objection_phase' | 'hot_lead' | 'cold_lead'
  | 'appointment_booking' | 'test_drive' | 'closing' | 'after_offer_silence'
  | 'reactivation';

export type SourceChannel = 'email' | 'whatsapp' | 'phone' | 'website' | 'walkin' | 'mobile' | 'autoscout' | 'other';
export type ConversationStatus = 'open' | 'in_progress' | 'waiting' | 'closed_won' | 'closed_lost' | 'archived';
export type MessageType = 'reply' | 'follow_up' | 'offer_summary' | 'objection_reply' | 'call_script' | 'whatsapp_reply' | 'email_reply' | 'appointment_message' | 'closing_message' | 'internal_note' | 'summary';
export type MessageRole = 'user' | 'assistant' | 'system';
export type ApprovalStatus = 'draft' | 'approved' | 'sent' | 'discarded';
export type GenerationMode = 'quick_reply' | 'guided' | 'rag' | 'manual_edit' | 'regenerate';
export type TaskType = 'call_customer' | 'send_offer' | 'send_follow_up' | 'request_trade_in' | 'book_test_drive' | 'send_financing' | 'reactivate_lead' | 'internal_escalation' | 'prepare_vehicle' | 'other';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'open' | 'done' | 'cancelled';
export type DocumentType = 'customer_journey' | 'sales_playbook' | 'faq' | 'objection_handling' | 'financing_rules' | 'leasing_rules' | 'brand_guidelines' | 'dealer_process' | 'product_knowledge' | 'legal_notes' | 'offer_logic' | 'phone_script' | 'whatsapp_guide' | 'email_guide' | 'other';
export type EmbeddingStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface SalesAssistantProfile {
  id: string;
  user_id: string;
  assistant_name: string | null;
  default_tone: string;
  brand_voice: string | null;
  sales_goal: string | null;
  preferred_cta: string | null;
  whatsapp_style: string | null;
  email_style: string | null;
  objection_style: string | null;
  closing_style: string | null;
  response_language: string;
  max_response_length: string;
  should_push_financing: boolean;
  should_push_test_drive: boolean;
  should_push_trade_in: boolean;
  should_offer_callback: boolean;
  forbidden_phrases: string[] | null;
  must_use_phrases: string[] | null;
  compliance_notes: string | null;
  signature_name: string | null;
  signature_role: string | null;
  signature_phone: string | null;
  signature_email: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalesKnowledgeDocument {
  id: string;
  user_id: string;
  title: string;
  document_type: DocumentType;
  source_type: string;
  storage_path: string | null;
  public_url: string | null;
  mime_type: string | null;
  content_text: string | null;
  embedding_status: EmbeddingStatus;
  chunk_count: number;
  is_active: boolean;
  version_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerJourneyTemplate {
  id: string;
  user_id: string | null;
  name: string;
  vehicle_category: string | null;
  journey_stage: JourneyStage;
  description: string | null;
  buyer_intent_signals: string[] | null;
  recommended_goal: string | null;
  recommended_cta: string | null;
  recommended_objections: string[] | null;
  recommended_assets: string[] | null;
  default_prompt_block: string | null;
  is_global: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SalesConversation {
  id: string;
  user_id: string;
  project_id: string | null;
  lead_id: string | null;
  vehicle_context: Record<string, any>;
  customer_context: Record<string, any>;
  journey_stage: JourneyStage;
  source_channel: SourceChannel;
  conversation_title: string | null;
  status: ConversationStatus;
  next_action: string | null;
  next_action_due_at: string | null;
  summary: string | null;
  last_generated_output: string | null;
  last_prompt_snapshot: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface SalesMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MessageRole;
  message_type: MessageType;
  input_text: string | null;
  output_text: string | null;
  channel: string | null;
  approval_status: ApprovalStatus;
  generation_mode: GenerationMode;
  metadata: Record<string, any>;
  created_at: string;
}

export interface SalesTask {
  id: string;
  conversation_id: string;
  user_id: string;
  title: string;
  description: string | null;
  task_type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateRequest {
  conversationId?: string;
  projectId?: string;
  leadId?: string;
  vehicleContext?: Record<string, any>;
  customerContext?: Record<string, any>;
  journeyStage: JourneyStage;
  sourceChannel: SourceChannel;
  customerMessage: string;
  desiredOutputType: MessageType;
  tone: string;
  extraFlags?: {
    pushFinancing?: boolean;
    pushTestDrive?: boolean;
    pushTradeIn?: boolean;
    offerCallback?: boolean;
    prioritizeAvailable?: boolean;
    prioritizeStock?: boolean;
    mentionPromotion?: boolean;
  };
  selectedKnowledgeDocumentIds?: string[];
}

export interface GenerateResponse {
  generatedText: string;
  summary: string;
  recommendedNextSteps: { title: string; type: TaskType; description: string }[];
  usedContext: { source: string; title: string; snippet: string }[];
  confidenceNotes: string;
  conversationId: string;
  messageId: string;
}

export const JOURNEY_STAGE_LABELS: Record<JourneyStage, string> = {
  new_lead: 'Neuer Lead',
  first_contact: 'Erstkontakt',
  needs_analysis: 'Bedarfsanalyse',
  vehicle_interest: 'Fahrzeuginteresse',
  finance_interest: 'Finanzierungsinteresse',
  trade_in_interest: 'Inzahlungnahme-Interesse',
  offer_sent: 'Angebot gesendet',
  follow_up_1: 'Follow-up 1',
  follow_up_2: 'Follow-up 2',
  objection_phase: 'Einwandphase',
  hot_lead: 'Heißer Lead',
  cold_lead: 'Kalter Lead',
  appointment_booking: 'Terminvereinbarung',
  test_drive: 'Probefahrt',
  closing: 'Abschluss',
  after_offer_silence: 'Nach Angebot – Stille',
  reactivation: 'Reaktivierung',
};

export const SOURCE_CHANNEL_LABELS: Record<SourceChannel, string> = {
  email: 'E-Mail',
  whatsapp: 'WhatsApp',
  phone: 'Telefon',
  website: 'Website-Anfrage',
  walkin: 'Walk-In',
  mobile: 'Mobile.de',
  autoscout: 'AutoScout24',
  other: 'Andere',
};

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  reply: 'Antwort',
  follow_up: 'Follow-up',
  offer_summary: 'Angebotszusammenfassung',
  objection_reply: 'Einwandbehandlung',
  call_script: 'Telefonleitfaden',
  whatsapp_reply: 'WhatsApp-Antwort',
  email_reply: 'E-Mail-Antwort',
  appointment_message: 'Terminbestätigung',
  closing_message: 'Abschluss-Nachricht',
  internal_note: 'Interne Notiz',
  summary: 'Zusammenfassung',
};

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  waiting: 'Wartend',
  closed_won: 'Gewonnen',
  closed_lost: 'Verloren',
  archived: 'Archiviert',
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  call_customer: 'Kunden anrufen',
  send_offer: 'Angebot senden',
  send_follow_up: 'Follow-up senden',
  request_trade_in: 'Inzahlungnahme anfragen',
  book_test_drive: 'Probefahrt buchen',
  send_financing: 'Finanzierung senden',
  reactivate_lead: 'Lead reaktivieren',
  internal_escalation: 'Interne Eskalation',
  prepare_vehicle: 'Fahrzeug vorbereiten',
  other: 'Sonstiges',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  urgent: 'Dringend',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  customer_journey: 'Customer Journey',
  sales_playbook: 'Verkaufsleitfaden',
  faq: 'FAQ',
  objection_handling: 'Einwandbehandlung',
  financing_rules: 'Finanzierungsregeln',
  leasing_rules: 'Leasing-Regeln',
  brand_guidelines: 'Marken-Richtlinien',
  dealer_process: 'Händler-Prozesse',
  product_knowledge: 'Produktwissen',
  legal_notes: 'Rechtliche Hinweise',
  offer_logic: 'Angebotslogik',
  phone_script: 'Telefonskript',
  whatsapp_guide: 'WhatsApp-Leitfaden',
  email_guide: 'E-Mail-Leitfaden',
  other: 'Sonstiges',
};

export const TONE_OPTIONS = [
  { value: 'freundlich', label: 'Freundlich' },
  { value: 'verbindlich', label: 'Verbindlich' },
  { value: 'premium', label: 'Premium' },
  { value: 'direkt', label: 'Direkt' },
  { value: 'beratend', label: 'Beratend' },
  { value: 'dringlich_dezent', label: 'Dringlich (dezent)' },
];
