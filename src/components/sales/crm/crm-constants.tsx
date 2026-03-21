import React from 'react';
import {
  Search, Circle, CheckCircle2, XCircle, MessageSquare, Car,
  CalendarDays, FileText, ArrowRight, Flame, Snowflake,
} from 'lucide-react';
import type { SalesConversation } from '@/types/sales-assistant';
import type { CustomerLeadThread } from '@/lib/sales-customer-utils';

/* ── Journey stage config with visual styling ── */
export const STAGE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new_lead: { label: 'Neuer Lead', color: 'bg-blue-500', icon: <Circle className="w-3 h-3" /> },
  first_contact: { label: 'Erstkontakt', color: 'bg-sky-500', icon: <MessageSquare className="w-3 h-3" /> },
  needs_analysis: { label: 'Bedarfsanalyse', color: 'bg-indigo-500', icon: <Search className="w-3 h-3" /> },
  vehicle_interest: { label: 'Fahrzeuginteresse', color: 'bg-violet-500', icon: <Car className="w-3 h-3" /> },
  offer_sent: { label: 'Angebot gesendet', color: 'bg-amber-500', icon: <FileText className="w-3 h-3" /> },
  follow_up_1: { label: 'Follow-up 1', color: 'bg-orange-500', icon: <ArrowRight className="w-3 h-3" /> },
  follow_up_2: { label: 'Follow-up 2', color: 'bg-orange-600', icon: <ArrowRight className="w-3 h-3" /> },
  hot_lead: { label: 'Heißer Lead', color: 'bg-red-500', icon: <Flame className="w-3 h-3" /> },
  cold_lead: { label: 'Kalter Lead', color: 'bg-slate-400', icon: <Snowflake className="w-3 h-3" /> },
  test_drive: { label: 'Probefahrt', color: 'bg-emerald-500', icon: <CalendarDays className="w-3 h-3" /> },
  closing: { label: 'Abschluss', color: 'bg-green-600', icon: <CheckCircle2 className="w-3 h-3" /> },
  closed_won: { label: 'Gewonnen', color: 'bg-green-600', icon: <CheckCircle2 className="w-3 h-3" /> },
  closed_lost: { label: 'Verloren', color: 'bg-red-400', icon: <XCircle className="w-3 h-3" /> },
};

export const STATUS_COLORS: Record<string, string> = {
  open: 'border-blue-400 bg-blue-500/10',
  in_progress: 'border-amber-400 bg-amber-500/10',
  waiting: 'border-orange-400 bg-orange-500/10',
  closed_won: 'border-green-400 bg-green-500/10',
  closed_lost: 'border-red-400 bg-red-500/10',
  archived: 'border-muted bg-muted/30',
};

export const INTENT_COLORS: Record<string, string> = {
  Probefahrt: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Inzahlungnahme: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Leasing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Finanzierung: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  Kauf: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Gewerbekunde: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Privatkunde: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Zeitnaher Bedarf': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: 'new_lead', label: 'Neu' },
  { key: 'first_contact', label: 'Kontakt' },
  { key: 'vehicle_interest', label: 'Interesse' },
  { key: 'offer_sent', label: 'Angebot' },
  { key: 'hot_lead', label: 'Heiß' },
  { key: 'test_drive', label: 'Probefahrt' },
  { key: 'closing', label: 'Abschluss' },
];

export interface StageLog {
  id: string;
  conversation_id: string;
  previous_stage: string | null;
  new_stage: string;
  reason: string | null;
  changed_by: string;
  created_at: string;
}

export interface CrmNote {
  id: string;
  conversation_id: string | null;
  lead_id: string | null;
  note_type: string;
  content: string;
  created_at: string;
}

export interface BotMessage {
  id: string;
  conversation_id: string;
  role: string;
  input_text: string | null;
  output_text: string | null;
  message_type: string;
  channel: string | null;
  created_at: string;
}

export interface CustomerWithJourney extends CustomerLeadThread {
  conversations: SalesConversation[];
  currentStage: string;
  currentStatus: string;
}

export function formatCrmDate(d: string): string {
  return new Date(d).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
