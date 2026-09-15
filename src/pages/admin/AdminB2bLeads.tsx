import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Search, ExternalLink } from 'lucide-react';
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
  STATUS_OPTIONS, STATUS_LABELS, VOLUME_LABELS, LOCATION_LABELS, ROLE_LABELS,
  GOAL_LABELS, LEAD_CLASS_LABELS,
} from '@/lib/b2b-funnel-options';

interface B2bLead {
  id: string;
  created_at: string;
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
  msclkid: string | null;
  fbclid: string | null;
  li_fat_id: string | null;
  landing_page: string | null;
  first_referrer: string | null;
  status: string;
  source_label: string;
  demo_requested: boolean;
  admin_note: string | null;
}

const CLASS_STYLES: Record<string, string> = {
  hot: 'border-accent bg-accent/10 text-accent',
  warm: 'border-border bg-muted text-foreground',
  standard: 'border-border bg-transparent text-muted-foreground',
};

function toGoalList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdminB2bLeads() {
  const [leads, setLeads] = useState<B2bLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<B2bLead | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('b2b_marketing_leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Laden fehlgeschlagen', description: error.message, variant: 'destructive' });
    }
    setLeads((data as unknown as B2bLead[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (classFilter !== 'all' && l.lead_class !== classFilter) return false;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!term) return true;
      return [l.company_name, l.first_name, l.last_name, l.business_email, l.website ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [leads, search, classFilter, statusFilter]);

  const openLead = async (lead: B2bLead) => {
    setSelected(lead);
    setAdminNote(lead.admin_note ?? '');
    setImageUrl(null);
    if (lead.uploaded_image_path) {
      const { data } = await supabase.storage
        .from('b2b-test-uploads')
        .createSignedUrl(lead.uploaded_image_path, 600);
      setImageUrl(data?.signedUrl ?? null);
    }
  };

  const updateLead = async (patch: Partial<Pick<B2bLead, 'status' | 'admin_note'>>) => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from('b2b_marketing_leads').update(patch).eq('id', selected.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Speichern fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, ...patch } : l)));
    setSelected((prev) => (prev ? { ...prev, ...patch } : prev));
    toast({ title: 'Gespeichert' });
  };

  const exportCsv = () => {
    const columns: (keyof B2bLead)[] = [
      'created_at', 'company_name', 'first_name', 'last_name', 'business_email', 'website', 'phone',
      'monthly_vehicle_volume', 'location_count', 'role', 'lead_score', 'lead_class', 'status',
      'demo_requested', 'source_label', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
      'utm_term', 'gclid', 'msclkid', 'fbclid', 'li_fat_id', 'landing_page', 'first_referrer', 'note',
    ];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filtered.map((l) => columns.map((c) => escape(l[c])).join(';'));
    const csv = [columns.join(';'), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `b2b-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">B2B Leads</h1>
          <p className="text-sm text-muted-foreground">Testanfragen aus dem Paid-Funnel ({filtered.length} von {leads.length})</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" /> CSV-Export
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-9" placeholder="Unternehmen, Name, E-Mail, Domain" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger><SelectValue placeholder="Klasse" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Klassen</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Unternehmen</th>
              <th className="px-3 py-2 text-left">Name / Rolle</th>
              <th className="px-3 py-2 text-left">Volumen</th>
              <th className="px-3 py-2 text-left">Standorte</th>
              <th className="px-3 py-2 text-left">Klasse</th>
              <th className="px-3 py-2 text-left">Quelle</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Datum</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Keine Leads gefunden.</td></tr>
            )}
            {filtered.map((l) => (
              <tr
                key={l.id}
                tabIndex={0}
                role="button"
                onClick={() => void openLead(l)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void openLead(l); } }}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <td className="px-3 py-2 font-medium text-foreground">{l.company_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{l.first_name} {l.last_name}<br /><span className="text-xs">{ROLE_LABELS[l.role] ?? l.role}</span></td>
                <td className="px-3 py-2 text-muted-foreground">{VOLUME_LABELS[l.monthly_vehicle_volume] ?? l.monthly_vehicle_volume}</td>
                <td className="px-3 py-2 text-muted-foreground">{LOCATION_LABELS[l.location_count] ?? l.location_count}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={CLASS_STYLES[l.lead_class] ?? ''}>
                    {LEAD_CLASS_LABELS[l.lead_class] ?? l.lead_class} · {l.lead_score}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{l.utm_campaign || l.utm_source || l.source_label}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{STATUS_LABELS[l.status] ?? l.status}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.company_name}</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-5 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={CLASS_STYLES[selected.lead_class] ?? ''}>
                    {LEAD_CLASS_LABELS[selected.lead_class] ?? selected.lead_class} · Score {selected.lead_score}
                  </Badge>
                  {selected.demo_requested && <Badge variant="outline">Demo angefragt</Badge>}
                </div>

                <section className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Kontakt</h3>
                  <p className="text-foreground">{selected.first_name} {selected.last_name} · {ROLE_LABELS[selected.role] ?? selected.role}</p>
                  <p><a className="text-accent underline underline-offset-2" href={`mailto:${selected.business_email}`}>{selected.business_email}</a></p>
                  {selected.phone && <p className="text-muted-foreground">{selected.phone}</p>}
                  {selected.website && (
                    <p>
                      <a className="inline-flex items-center gap-1 text-accent underline underline-offset-2" href={selected.website} target="_blank" rel="noreferrer">
                        {selected.website} <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  )}
                </section>

                <section className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Betrieb</h3>
                  <p className="text-muted-foreground">Volumen: {VOLUME_LABELS[selected.monthly_vehicle_volume] ?? selected.monthly_vehicle_volume}</p>
                  <p className="text-muted-foreground">Standorte: {LOCATION_LABELS[selected.location_count] ?? selected.location_count}</p>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Ziele</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {toGoalList(selected.goals).length === 0 && <span className="text-muted-foreground">Keine Angaben</span>}
                    {toGoalList(selected.goals).map((g) => (
                      <Badge key={g} variant="secondary">{GOAL_LABELS[g] ?? g}</Badge>
                    ))}
                  </div>
                </section>

                {selected.note && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">Hinweis des Leads</h3>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.note}</p>
                  </section>
                )}

                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Testbild</h3>
                  {imageUrl ? (
                    <a href={imageUrl} target="_blank" rel="noreferrer">
                      <img src={imageUrl} alt="Hochgeladenes Testfahrzeug" className="mt-2 w-full rounded-lg border border-border object-cover" />
                    </a>
                  ) : (
                    <p className="mt-1 text-muted-foreground">{selected.uploaded_image_path ? 'Bild wird geladen …' : 'Kein Bild vorhanden'}</p>
                  )}
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Attribution</h3>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {([
                      ['Quelle', selected.source_label], ['utm_source', selected.utm_source], ['utm_medium', selected.utm_medium],
                      ['utm_campaign', selected.utm_campaign], ['utm_content', selected.utm_content], ['utm_term', selected.utm_term],
                      ['gclid', selected.gclid], ['msclkid', selected.msclkid], ['fbclid', selected.fbclid],
                      ['li_fat_id', selected.li_fat_id], ['Landingpage', selected.landing_page], ['Referrer', selected.first_referrer],
                      ['Eingegangen', formatDate(selected.created_at)],
                    ] as [string, string | null][]).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="truncate text-foreground" title={v ?? ''}>{v || '–'}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="space-y-3">
                  <div>
                    <Label htmlFor="lead-status">Status</Label>
                    <Select value={selected.status} onValueChange={(v) => void updateLead({ status: v })}>
                      <SelectTrigger id="lead-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="admin-note">Interne Notiz</Label>
                    <Textarea id="admin-note" rows={4} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
                    <Button size="sm" className="mt-2" disabled={saving} onClick={() => void updateLead({ admin_note: adminNote })}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Notiz speichern
                    </Button>
                  </div>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
