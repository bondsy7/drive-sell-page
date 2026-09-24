import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Search, ExternalLink, AlertTriangle, FileSpreadsheet, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import {
  STATUS_OPTIONS, STATUS_LABELS, STATUS_EVENT, LOST_REASONS, VOLUME_LABELS, LOCATION_LABELS, ROLE_LABELS,
  GOAL_OPTIONS, GOAL_LABELS, LEAD_CLASS_LABELS,
} from '@/lib/b2b-funnel-options';

interface B2bLead {
  id: string;
  created_at: string;
  funnel_type: string;
  company_name: string;
  first_name: string;
  last_name: string;
  business_email: string;
  website: string | null;
  phone: string | null;
  monthly_vehicle_volume: string;
  location_count: string;
  role: string;
  goals: unknown;
  note: string | null;
  uploaded_image_path: string | null;
  lead_score: number;
  lead_class: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  msclkid: string | null;
  fbclid: string | null;
  li_fat_id: string | null;
  landing_page: string | null;
  first_referrer: string | null;
  last_touch: Record<string, string> | null;
  consent_marketing: boolean;
  consent_id: string | null;
  status: string;
  source_label: string;
  demo_requested: boolean;
  admin_note: string | null;
  owner: string | null;
  next_step: string | null;
  next_step_date: string | null;
  lost_reason: string | null;
  opportunity_id: string | null;
  license_id: string | null;
  license_qty: number | null;
  net_contract_value: number | null;
  demo_scheduled_for: string | null;
  step2_completed_at: string | null;
  validated_at: string | null;
  contacted_at: string | null;
  demo_requested_at: string | null;
  demo_booked_at: string | null;
  demo_held_at: string | null;
  sql_at: string | null;
  proposal_at: string | null;
  won_at: string | null;
  lost_at: string | null;
}

type Editable = Pick<B2bLead,
  'status' | 'admin_note' | 'owner' | 'next_step' | 'next_step_date' | 'lost_reason' | 'opportunity_id' |
  'license_id' | 'license_qty' | 'net_contract_value' | 'demo_scheduled_for'>;

const OPEN_STATUSES = new Set(['new', 'validated', 'contacted', 'demo_requested', 'demo_booked', 'demo_held', 'sql', 'proposal']);
const CLASS_STYLES: Record<string, string> = {
  hot: 'border-accent bg-accent/10 text-accent',
  warm: 'border-border bg-muted text-foreground',
  standard: 'border-border bg-transparent text-muted-foreground',
};

function toGoalList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–';
}
function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}
function campaignOf(l: B2bLead) {
  return l.utm_campaign || l.utm_source || l.source_label || 'ohne Kampagne';
}
function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function needsNextStep(l: B2bLead) {
  if (!OPEN_STATUSES.has(l.status) || l.status === 'new') return false;
  return !l.next_step_date || new Date(l.next_step_date) < new Date(new Date().toDateString());
}
function downloadCsv(name: string, header: string[], rows: unknown[][], sep = ';') {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header.map(esc).join(sep), ...rows.map((r) => r.map(esc).join(sep))].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminB2bLeads() {
  const [leads, setLeads] = useState<B2bLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [goalFilter, setGoalFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [selected, setSelected] = useState<B2bLead | null>(null);
  const [draft, setDraft] = useState<Partial<Editable>>({});
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('b2b_marketing_leads').select('*').order('created_at', { ascending: false });
    if (error) toast({ title: 'Laden fehlgeschlagen', description: error.message, variant: 'destructive' });
    setLeads((data as unknown as B2bLead[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const deleteLead = async (lead: B2bLead) => {
    if (!window.confirm(`Lead von „${lead.company_name}“ wirklich endgültig löschen?`)) return;
    const { error } = await supabase.from('b2b_marketing_leads').delete().eq('id', lead.id);
    if (error) {
      toast({ title: 'Löschen fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    toast({ title: 'Lead gelöscht' });
  };

  const campaigns = useMemo(() => Array.from(new Set(leads.map(campaignOf))).sort(), [leads]);
  const months = useMemo(() => Array.from(new Set(leads.map((l) => l.created_at.slice(0, 7)))).sort().reverse(), [leads]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (classFilter !== 'all' && l.lead_class !== classFilter) return false;
      if (statusFilter === 'overdue' ? !needsNextStep(l) : statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (campaignFilter !== 'all' && campaignOf(l) !== campaignFilter) return false;
      if (goalFilter !== 'all' && !toGoalList(l.goals).includes(goalFilter)) return false;
      if (monthFilter !== 'all' && !l.created_at.startsWith(monthFilter)) return false;
      if (!term) return true;
      return [l.company_name, l.first_name, l.last_name, l.business_email, l.website ?? '', l.owner ?? '']
        .join(' ').toLowerCase().includes(term);
    });
  }, [leads, search, classFilter, statusFilter, campaignFilter, goalFilter, monthFilter]);

  const kpis = useMemo(() => {
    const reached = (l: B2bLead, ts: (keyof B2bLead)[]) => ts.some((k) => !!l[k]);
    const won = filtered.filter((l) => l.status === 'won');
    return {
      leads: filtered.length,
      sql: filtered.filter((l) => reached(l, ['sql_at', 'proposal_at', 'won_at'])).length,
      demos: filtered.filter((l) => reached(l, ['demo_held_at'])).length,
      proposals: filtered.filter((l) => reached(l, ['proposal_at', 'won_at'])).length,
      licenses: won.reduce((s, l) => s + (l.license_qty ?? 0), 0),
      wonValue: won.reduce((s, l) => s + Number(l.net_contract_value ?? 0), 0),
      pipeline: filtered.filter((l) => ['sql', 'proposal'].includes(l.status)).reduce((s, l) => s + Number(l.net_contract_value ?? 0), 0),
      overdue: filtered.filter(needsNextStep).length,
    };
  }, [filtered]);

  const byCampaign = useMemo(() => {
    const m = new Map<string, { leads: number; sql: number; won: number; licenses: number }>();
    for (const l of filtered) {
      const k = campaignOf(l);
      const r = m.get(k) ?? { leads: 0, sql: 0, won: 0, licenses: 0 };
      r.leads++;
      if (l.sql_at || l.proposal_at || l.won_at) r.sql++;
      if (l.status === 'won') { r.won++; r.licenses += l.license_qty ?? 0; }
      m.set(k, r);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].leads - a[1].leads);
  }, [filtered]);

  const openLead = async (lead: B2bLead) => {
    setSelected(lead);
    setDraft({
      owner: lead.owner, next_step: lead.next_step, next_step_date: lead.next_step_date, lost_reason: lead.lost_reason,
      opportunity_id: lead.opportunity_id, license_id: lead.license_id, license_qty: lead.license_qty,
      net_contract_value: lead.net_contract_value, demo_scheduled_for: lead.demo_scheduled_for, admin_note: lead.admin_note,
    });
    setImageUrl(null);
    if (lead.uploaded_image_path) {
      const { data } = await supabase.storage.from('b2b-test-uploads').createSignedUrl(lead.uploaded_image_path, 600);
      setImageUrl(data?.signedUrl ?? null);
    }
  };

  const save = async (patch: Partial<Editable>) => {
    if (!selected) return;
    if (patch.status === 'demo_booked' && !(patch.demo_scheduled_for ?? draft.demo_scheduled_for)) {
      toast({ title: 'Termin fehlt', description: '„Demo gebucht" erst mit eingetragenem Termin.', variant: 'destructive' });
      return;
    }
    if (patch.status === 'lost' && !(patch.lost_reason ?? draft.lost_reason)) {
      toast({ title: 'Verlustgrund fehlt', description: 'Bitte zuerst einen Verlustgrund wählen.', variant: 'destructive' });
      return;
    }
    if (patch.status === 'won' && !(draft.license_qty && draft.license_qty > 0)) {
      toast({ title: 'Lizenzmenge fehlt', description: 'Bitte Lizenzmenge und Vertragswert eintragen.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from('b2b_marketing_leads').update(patch).eq('id', selected.id).select('*').single();
    setSaving(false);
    if (error) {
      toast({ title: 'Speichern fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    const updated = data as unknown as B2bLead;
    if (patch.status && patch.status !== selected.status && STATUS_EVENT[patch.status]) {
      const evt = STATUS_EVENT[patch.status];
      await supabase.from('marketing_events').insert({
        event_name: evt,
        event_id: `${evt}:${selected.id}`,
        lead_id: selected.id,
        source: 'admin',
        utm_source: selected.utm_source,
        utm_medium: selected.utm_medium,
        utm_campaign: selected.utm_campaign,
        has_click_id: !!(selected.gclid || selected.gbraid || selected.wbraid),
        metadata: { status: patch.status },
      });
    }
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setSelected(updated);
    toast({ title: 'Gespeichert' });
  };

  const exportCsv = () => {
    const cols: (keyof B2bLead)[] = [
      'id', 'created_at', 'funnel_type', 'company_name', 'first_name', 'last_name', 'business_email', 'website', 'phone',
      'monthly_vehicle_volume', 'location_count', 'role', 'lead_score', 'lead_class', 'status', 'owner', 'next_step',
      'next_step_date', 'lost_reason', 'opportunity_id', 'license_id', 'license_qty', 'net_contract_value',
      'validated_at', 'contacted_at', 'demo_requested_at', 'demo_booked_at', 'demo_scheduled_for', 'demo_held_at',
      'sql_at', 'proposal_at', 'won_at', 'lost_at', 'source_label', 'utm_source', 'utm_medium', 'utm_campaign',
      'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid', 'msclkid', 'fbclid', 'li_fat_id', 'landing_page', 'first_referrer',
    ];
    downloadCsv(`b2b-leads-${new Date().toISOString().slice(0, 10)}.csv`, cols, filtered.map((l) => cols.map((c) => l[c])));
  };

  /** Google-Ads-Offline-Import: eine Zeile pro erreichter Stufe mit Klick-ID. */
  const exportAdsCsv = () => {
    const stages: { name: string; ts: keyof B2bLead; value?: (l: B2bLead) => number | '' }[] = [
      { name: 'qualify_lead', ts: 'sql_at' },
      { name: 'close_convert_lead', ts: 'won_at', value: (l) => Number(l.net_contract_value ?? 0) || '' },
    ];
    const fmt = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      const off = -d.getTimezoneOffset();
      const sign = off >= 0 ? '+' : '-';
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(Math.abs(off) / 60))}${pad(Math.abs(off) % 60)}`;
    };
    const rows: unknown[][] = [];
    for (const l of leads) {
      if (!l.gclid && !l.gbraid && !l.wbraid) continue;
      if (!l.consent_marketing) continue; // nur mit Marketing-Einwilligung an Google übermitteln
      for (const s of stages) {
        const t = l[s.ts] as string | null;
        if (!t) continue;
        const v = s.value ? s.value(l) : '';
        rows.push([l.gclid ?? '', l.gbraid ?? '', l.wbraid ?? '', s.name, fmt(t), v, v === '' ? '' : 'EUR', `${s.name}:${l.id}`]);
      }
    }
    if (rows.length === 0) {
      toast({ title: 'Keine Daten', description: 'Noch keine qualifizierten oder gewonnenen Leads mit Google-Klick-ID und Marketing-Einwilligung.' });
      return;
    }
    downloadCsv(`google-ads-offline-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Google Click ID', 'GBRAID', 'WBRAID', 'Conversion Name', 'Conversion Time', 'Conversion Value', 'Conversion Currency', 'Order ID'],
      rows, ',');
  };

  const d = draft;
  const setD = (k: keyof Editable, v: unknown) => setDraft((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">B2B Leads</h1>
          <p className="text-sm text-muted-foreground">Paid-Funnel bis zur Lizenz ({filtered.length} von {leads.length})</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportAdsCsv}><FileSpreadsheet className="mr-2 h-4 w-4" /> Google-Ads-Import</Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}><Download className="mr-2 h-4 w-4" /> CSV-Export</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {([
          ['Leads', kpis.leads], ['SQL', kpis.sql], ['Demos', kpis.demos], ['Angebote', kpis.proposals],
          ['Lizenzen', kpis.licenses], ['Gewonnen (netto)', eur(kpis.wonValue)], ['Pipeline', eur(kpis.pipeline)],
        ] as [string, string | number][]).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{v}</p>
          </div>
        ))}
      </div>

      {kpis.overdue > 0 && (
        <button type="button" onClick={() => setStatusFilter('overdue')} className="flex w-full items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-left text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
          {kpis.overdue} offene Leads ohne datierten oder mit überfälligem nächsten Schritt – anzeigen
        </button>
      )}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="relative sm:col-span-3 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-9" placeholder="Suche" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="overdue">Nächster Schritt fehlt</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger><SelectValue placeholder="Kampagne" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kampagnen</SelectItem>
            {campaigns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={goalFilter} onValueChange={setGoalFilter}>
          <SelectTrigger><SelectValue placeholder="Anliegen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Anliegen</SelectItem>
            {GOAL_OPTIONS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger><SelectValue placeholder="Monat" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Monate</SelectItem>
            {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger><SelectValue placeholder="Klasse" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Klassen</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {byCampaign.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">Kampagne</th><th className="px-3 py-2 text-right">Leads</th><th className="px-3 py-2 text-right">SQL</th><th className="px-3 py-2 text-right">Gewonnen</th><th className="px-3 py-2 text-right">Lizenzen</th></tr>
            </thead>
            <tbody>
              {byCampaign.map(([c, r]) => (
                <tr key={c} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-foreground">{c}</td>
                  <td className="px-3 py-2 text-right">{r.leads}</td>
                  <td className="px-3 py-2 text-right">{r.sql}</td>
                  <td className="px-3 py-2 text-right">{r.won}</td>
                  <td className="px-3 py-2 text-right">{r.licenses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Unternehmen</th>
              <th className="px-3 py-2 text-left">Name / Rolle</th>
              <th className="px-3 py-2 text-left">Klasse</th>
              <th className="px-3 py-2 text-left">Kampagne</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Verantwortlich</th>
              <th className="px-3 py-2 text-left">Nächster Schritt</th>
              <th className="px-3 py-2 text-left">Eingang</th>
              <th className="px-3 py-2 text-right" aria-label="Aktionen" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-3 py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Keine Leads gefunden.</td></tr>}
            {filtered.map((l) => (
              <tr
                key={l.id}
                tabIndex={0}
                role="button"
                onClick={() => void openLead(l)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void openLead(l); } }}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  {l.company_name}
                  {l.funnel_type === 'process_check' && <Badge variant="outline" className="ml-2 text-[10px]">Prozesscheck</Badge>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {l.first_name || l.last_name ? `${l.first_name} ${l.last_name}` : <span className="italic">Schritt 2 offen</span>}
                  <br /><span className="text-xs">{ROLE_LABELS[l.role] ?? l.role}</span>
                </td>
                <td className="px-3 py-2"><Badge variant="outline" className={CLASS_STYLES[l.lead_class] ?? ''}>{LEAD_CLASS_LABELS[l.lead_class] ?? l.lead_class} · {l.lead_score}</Badge></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{campaignOf(l)}{(l.gclid || l.gbraid || l.wbraid) && <span className="ml-1 text-accent">· Google</span>}</td>
                <td className="px-3 py-2 text-xs text-foreground">{STATUS_LABELS[l.status] ?? l.status}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{l.owner || '–'}</td>
                <td className={`px-3 py-2 text-xs ${needsNextStep(l) ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                  {l.next_step_date ? new Date(l.next_step_date).toLocaleDateString('de-DE') : needsNextStep(l) ? 'fehlt' : '–'}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(l.created_at)}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Lead von ${l.company_name} löschen`}
                    onClick={(e) => { e.stopPropagation(); void deleteLead(l); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader><SheetTitle>{selected.company_name}</SheetTitle></SheetHeader>

              <div className="mt-4 space-y-5 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={CLASS_STYLES[selected.lead_class] ?? ''}>{LEAD_CLASS_LABELS[selected.lead_class] ?? selected.lead_class} · Score {selected.lead_score}</Badge>
                  {selected.demo_requested && <Badge variant="outline">Demo gewünscht</Badge>}
                  {selected.funnel_type === 'process_check' && <Badge variant="outline">Prozesscheck</Badge>}
                </div>

                {/* Vertrieb */}
                <section className="space-y-3 rounded-lg border border-border p-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Vertrieb</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="lead-status">Status</Label>
                      <Select value={selected.status} onValueChange={(v) => void save({ ...d, status: v })}>
                        <SelectTrigger id="lead-status"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="lead-owner">Verantwortlich</Label>
                      <Input id="lead-owner" value={d.owner ?? ''} onChange={(e) => setD('owner', e.target.value || null)} maxLength={80} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="lead-next">Nächster Schritt</Label>
                      <Input id="lead-next" value={d.next_step ?? ''} onChange={(e) => setD('next_step', e.target.value || null)} maxLength={200} placeholder="z. B. Demo-Termin per E-Mail vorschlagen" />
                    </div>
                    <div>
                      <Label htmlFor="lead-next-date">Datum nächster Schritt</Label>
                      <Input id="lead-next-date" type="date" value={d.next_step_date ?? ''} onChange={(e) => setD('next_step_date', e.target.value || null)} />
                    </div>
                    <div>
                      <Label htmlFor="lead-demo">Demo-Termin</Label>
                      <Input id="lead-demo" type="datetime-local" value={toLocalInput(d.demo_scheduled_for ?? null)} onChange={(e) => setD('demo_scheduled_for', e.target.value ? new Date(e.target.value).toISOString() : null)} />
                    </div>
                    <div>
                      <Label htmlFor="lead-opp">Angebots-/Opportunity-Nr.</Label>
                      <Input id="lead-opp" value={d.opportunity_id ?? ''} onChange={(e) => setD('opportunity_id', e.target.value || null)} maxLength={60} />
                    </div>
                    <div>
                      <Label htmlFor="lead-lic-id">Lizenz-/Vertrags-Nr.</Label>
                      <Input id="lead-lic-id" value={d.license_id ?? ''} onChange={(e) => setD('license_id', e.target.value || null)} maxLength={60} />
                    </div>
                    <div>
                      <Label htmlFor="lead-qty">Lizenzmenge</Label>
                      <Input id="lead-qty" type="number" min={0} value={d.license_qty ?? ''} onChange={(e) => setD('license_qty', e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0))} />
                    </div>
                    <div>
                      <Label htmlFor="lead-value">Netto-Vertragswert (EUR)</Label>
                      <Input id="lead-value" type="number" min={0} step="0.01" value={d.net_contract_value ?? ''} onChange={(e) => setD('net_contract_value', e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0))} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="lead-lost">Verlustgrund</Label>
                      <Select value={d.lost_reason ?? ''} onValueChange={(v) => setD('lost_reason', v)}>
                        <SelectTrigger id="lead-lost"><SelectValue placeholder="nur bei Verlust" /></SelectTrigger>
                        <SelectContent>{LOST_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="admin-note">Interne Notiz</Label>
                      <Textarea id="admin-note" rows={3} value={d.admin_note ?? ''} onChange={(e) => setD('admin_note', e.target.value)} />
                    </div>
                  </div>
                  <Button size="sm" disabled={saving} onClick={() => void save(d)}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Speichern
                  </Button>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Verlauf</h3>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {([
                      ['Eingang', selected.created_at], ['Validiert', selected.validated_at], ['Kontaktiert', selected.contacted_at],
                      ['Demo gewünscht', selected.demo_requested_at], ['Demo gebucht', selected.demo_booked_at],
                      ['Demo stattgefunden', selected.demo_held_at], ['SQL', selected.sql_at], ['Angebot', selected.proposal_at],
                      ['Gewonnen', selected.won_at], ['Verloren', selected.lost_at],
                    ] as [string, string | null][]).map(([k, v]) => (
                      <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="text-foreground">{formatDate(v)}</dd></div>
                    ))}
                  </dl>
                </section>

                <section className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Kontakt</h3>
                  <p className="text-foreground">{selected.first_name || selected.last_name ? `${selected.first_name} ${selected.last_name}` : 'Name noch nicht ergänzt'}{selected.role && ` · ${ROLE_LABELS[selected.role] ?? selected.role}`}</p>
                  <p><a className="text-accent underline underline-offset-2" href={`mailto:${selected.business_email}`}>{selected.business_email}</a></p>
                  {selected.phone && <p className="text-muted-foreground">{selected.phone}</p>}
                  {selected.website && (
                    <p><a className="inline-flex items-center gap-1 text-accent underline underline-offset-2" href={selected.website} target="_blank" rel="noreferrer">{selected.website} <ExternalLink className="h-3 w-3" /></a></p>
                  )}
                  <p className="text-muted-foreground">Volumen: {VOLUME_LABELS[selected.monthly_vehicle_volume] ?? (selected.monthly_vehicle_volume || '–')} · Standorte: {LOCATION_LABELS[selected.location_count] ?? (selected.location_count || '–')}</p>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Ziele</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {toGoalList(selected.goals).length === 0 && <span className="text-muted-foreground">Keine Angaben</span>}
                    {toGoalList(selected.goals).map((g) => <Badge key={g} variant="secondary">{GOAL_LABELS[g] ?? g}</Badge>)}
                  </div>
                </section>

                {selected.note && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">Hinweis des Leads</h3>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.note}</p>
                  </section>
                )}

                {selected.uploaded_image_path && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">Testbild</h3>
                    {imageUrl ? (
                      <a href={imageUrl} target="_blank" rel="noreferrer"><img src={imageUrl} alt="Hochgeladenes Testfahrzeug" className="mt-2 w-full rounded-lg border border-border object-cover" /></a>
                    ) : <p className="mt-1 text-muted-foreground">Bild wird geladen …</p>}
                  </section>
                )}

                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Attribution (First Touch)</h3>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {([
                      ['Quelle', selected.source_label], ['utm_source', selected.utm_source], ['utm_medium', selected.utm_medium],
                      ['utm_campaign', selected.utm_campaign], ['utm_content', selected.utm_content], ['utm_term', selected.utm_term],
                      ['gclid', selected.gclid], ['gbraid', selected.gbraid], ['wbraid', selected.wbraid], ['msclkid', selected.msclkid],
                      ['fbclid', selected.fbclid], ['li_fat_id', selected.li_fat_id], ['Landingpage', selected.landing_page], ['Referrer', selected.first_referrer],
                      ['Marketing-Einwilligung', selected.consent_marketing ? `ja (${selected.consent_id ?? 'ohne ID'})` : 'nein'],
                    ] as [string, string | null][]).map(([k, v]) => (
                      <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="truncate text-foreground" title={v ?? ''}>{v || '–'}</dd></div>
                    ))}
                  </dl>
                  {selected.last_touch && Object.keys(selected.last_touch).length > 0 && (
                    <>
                      <h3 className="mt-3 text-xs font-semibold uppercase text-muted-foreground">Last Touch</h3>
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {Object.entries(selected.last_touch).map(([k, v]) => (
                          <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="truncate text-foreground" title={v}>{v}</dd></div>
                        ))}
                      </dl>
                    </>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
