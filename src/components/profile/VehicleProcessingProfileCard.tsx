import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SCENE_OPTIONS, LICENSE_PLATE_OPTIONS } from '@/lib/remaster-prompt';
import { ONESHOT_BANNER_FORMATS, type BannerFormatId } from '@/components/oneshot/oneshot-types';
import { useProcessingProfile } from '@/hooks/useProcessingProfile';
import {
  AUTO_SCHMITT_STANDARD, AUTO_SCHMITT_STANDARD_NAME, MODEL_TIER_OPTIONS, ONESHOT_PERSPECTIVE_JOBS, estimateJobCost, settingsHash,
  type AutomationMode, type ProcessingSettings,
} from '@/lib/auto3-processing';

const SCENES = SCENE_OPTIONS.filter((s) => s.value !== 'none' && s.value !== 'custom-showroom');
const PLATES = LICENSE_PLATE_OPTIONS.filter((p) => ['keep', 'remove', 'blur'].includes(p.value));
const BANNER_STYLES = [
  { value: 'premium', label: 'Premium' }, { value: 'minimal', label: 'Minimal' }, { value: 'cinematic', label: 'Kino' },
  { value: 'sport', label: 'Sportlich' }, { value: 'bold', label: 'Auffällig' }, { value: 'volkswagen', label: 'Volkswagen CI' },
];
const MODES: { value: AutomationMode; label: string; hint: string }[] = [
  { value: 'off', label: 'Aus', hint: 'Nach dem Import passiert nichts automatisch.' },
  { value: 'prepare', label: 'Importieren + vorbereiten', hint: 'Originale werden analysiert und ein Masterbild gewählt. Gestartet wird per Klick.' },
  { value: 'full', label: 'Vollautomatisch mit freigegebenem Profil', hint: 'Nach dem Import startet die Aufbereitung im Hintergrund – nur innerhalb der freigegebenen Credits pro Fahrzeug.' },
];

/** Dealer "Fahrzeug-Aufbereitung" profile + Auto3 automation mode. */
export default function VehicleProcessingProfileCard({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { getCost, balance } = useCredits();
  const { data, refresh } = useProcessingProfile();
  const [name, setName] = useState('Auto Schmitt Standard');
  const [s, setS] = useState<ProcessingSettings>(AUTO_SCHMITT_STANDARD);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.profile) { setName(data.profile.name); setS(data.profile.settings); }
  }, [data?.profile]);

  const cost = useMemo(() => estimateJobCost(s, getCost), [s, getCost]);
  const dirty = !data?.profile || settingsHash(s) !== settingsHash(data.profile.settings) || name !== data.profile.name;
  const approved = !!data?.approved && !dirty;
  const set = <K extends keyof ProcessingSettings>(k: K, v: ProcessingSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  const save = async (approve?: boolean) => {
    if (!user) return;
    if (approve && !window.confirm(`Profil „${name}“ freigeben?\n\nSie erlauben damit, dass die automatische Aufbereitung je Fahrzeug bis zu ${cost.total} Credits verbraucht. Website-Veröffentlichung bleibt manuell.`)) return;
    setSaving(true);
    const hash = settingsHash(s);
    const keepApproval = !approve && data?.profile?.approved_settings_hash === hash && !!data.profile.approved_at;
    const row = {
      user_id: user.id, name: name.trim() || 'Standard', settings: s as never, cost_per_job: cost.total,
      ...(approve
        ? { approved_at: new Date().toISOString(), approved_max_credits_per_job: cost.total, approved_settings_hash: hash }
        : keepApproval ? {} : { approved_at: null, approved_max_credits_per_job: null, approved_settings_hash: null }),
    };
    const { error } = await supabase.from('vehicle_processing_profiles').upsert(row, { onConflict: 'user_id' });
    setSaving(false);
    if (error) { toast.error('Profil konnte nicht gespeichert werden.'); return; }
    toast.success(approve ? `Profil freigegeben: bis ${cost.total} Credits pro Fahrzeug.` : keepApproval ? 'Profil gespeichert.' : 'Profil gespeichert – Freigabe für automatische Verarbeitung erforderlich.');
    if (!approve && !keepApproval && data?.mode === 'full') await setMode('prepare', true);
    refresh();
  };

  const revoke = async () => {
    if (!user) return;
    await supabase.from('vehicle_processing_profiles').update({ approved_at: null, approved_max_credits_per_job: null, approved_settings_hash: null }).eq('user_id', user.id);
    if (data?.mode === 'full') await setMode('prepare', true);
    toast.success('Freigabe zurückgezogen.'); refresh();
  };

  const setMode = async (m: AutomationMode, silent = false) => {
    if (!user) return;
    if (m === 'full' && !approved) { toast.error('Bitte das Profil zuerst speichern und ausdrücklich freigeben.'); return; }
    const { error } = await supabase.from('profiles').update({ auto3_autopilot_mode: m }).eq('id', user.id);
    if (error) toast.error('Einstellung konnte nicht gespeichert werden.');
    else if (!silent) toast.success('Automatik gespeichert.');
    refresh();
  };

  const togglePerspective = (k: string) => set('perspectiveKeys', s.perspectiveKeys.includes(k) ? s.perspectiveKeys.filter((x) => x !== k) : [...s.perspectiveKeys, k]);
  const toggleFormat = (f: BannerFormatId) => set('bannerFormats', s.bannerFormats.includes(f) ? s.bannerFormats.filter((x) => x !== f) : [...s.bannerFormats, f]);

  return (
    <div className={`space-y-4 ${embedded ? '' : 'rounded-lg border border-border p-3'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">Fahrzeug-Aufbereitung</h4>
        {approved ? <Badge><ShieldCheck className="w-3 h-3 mr-1" />Freigegeben · {data?.profile?.approved_max_credits_per_job} Credits/Fahrzeug</Badge>
          : <Badge variant="secondary">Nicht freigegeben</Badge>}
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Auto3-Automatik</h4>
        <div className="grid gap-2 lg:grid-cols-3">
          {MODES.map((o) => {
            const disabled = o.value === 'full' && !approved;
            return (
              <label key={o.value} className={`flex gap-2 rounded-md border border-border p-2 text-sm ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
                <input type="radio" name="auto3-mode" checked={data?.mode === o.value} disabled={disabled} onChange={() => setMode(o.value)} className="mt-1" />
                <span><span className="font-medium">{o.label}</span><span className="block text-xs text-muted-foreground">{o.hint}{disabled ? ' Erst nach Freigabe des Profils wählbar.' : ''}</span></span>
              </label>
            );
          })}
        </div>
      </div>

      <Accordion type="multiple" className="rounded-md border border-border px-3">
        <AccordionItem value="style">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Bildstil <span className="ml-auto mr-3 hidden text-xs font-normal text-muted-foreground sm:inline">Showroom, Kennzeichen, Qualität</span></AccordionTrigger>
          <AccordionContent className="space-y-3">
            <Button type="button" size="sm" variant="outline" onClick={() => { setName(AUTO_SCHMITT_STANDARD_NAME); setS(AUTO_SCHMITT_STANDARD); }}>Standard „Auto Schmitt“ einsetzen</Button>
            <label className="block text-xs font-medium">Profilname<Input className="mt-1 h-8" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium">Hintergrund / Showroom<select className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm" value={s.scene} onChange={(e) => set('scene', e.target.value)}>{SCENES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
              <label className="text-xs font-medium">Kennzeichen<select className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm" value={s.licensePlate} onChange={(e) => set('licensePlate', e.target.value as ProcessingSettings['licensePlate'])}>{PLATES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
              <label className="text-xs font-medium">Qualitätsstufe<select className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm" value={s.modelTier} onChange={(e) => set('modelTier', e.target.value as ProcessingSettings['modelTier'])}>{MODEL_TIER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            </div>
            <p className="text-[11px] text-muted-foreground">Eigenes Händlerkennzeichen und eigener Showroom brauchen eine Bildvorlage und sind in der Automatik noch nicht verfügbar.</p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="perspectives">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Perspektiven & Bildumfang <span className="ml-auto mr-3 hidden text-xs font-normal text-muted-foreground sm:inline">{cost.images} Fahrzeugbilder</span></AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {ONESHOT_PERSPECTIVE_JOBS.map((j) => <label key={j.key} className="flex items-center gap-2 text-sm"><Checkbox checked={s.perspectiveKeys.includes(j.key)} onCheckedChange={() => togglePerspective(j.key)} /><span>{j.labelDe}{(j.extraPrompts?.length || 0) > 0 ? ` (${1 + j.extraPrompts!.length} Bilder)` : ''}</span></label>)}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Innenraum-Perspektiven entstehen nur mit einer passenden Originalaufnahme.</p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="extras" className="border-0">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Zusatzausgaben <span className="ml-auto mr-3 hidden text-xs font-normal text-muted-foreground sm:inline">Banner, Social, Video, Website</span></AccordionTrigger>
          <AccordionContent className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><Switch checked={s.showManufacturerLogo} onCheckedChange={(v) => set('showManufacturerLogo', v)} />Herstellerlogo einbinden</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={s.bannerEnabled} onCheckedChange={(v) => set('bannerEnabled', v)} />Banner automatisch erzeugen</label>
            {s.bannerEnabled && <div className="ml-10 space-y-2"><div className="flex flex-wrap gap-1.5">{ONESHOT_BANNER_FORMATS.map((f) => <Button key={f.id} type="button" size="sm" variant={s.bannerFormats.includes(f.id) ? 'default' : 'outline'} onClick={() => toggleFormat(f.id)}>{f.label}</Button>)}</div><label className="text-xs font-medium">Banner-Stil<select className="ml-2 rounded border border-border bg-background p-1 text-sm" value={s.bannerStyle} onChange={(e) => set('bannerStyle', e.target.value)}>{BANNER_STYLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label></div>}
            <label className="flex items-center gap-2 text-sm"><Switch checked={s.socialSet} onCheckedChange={(v) => set('socialSet', v)} />Social-Set (Story + Post)</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={s.videoEnabled} onCheckedChange={(v) => set('videoEnabled', v)} />Video (Standard: aus)</label>
            {s.videoEnabled && <Input className="ml-10 h-8 max-w-md" placeholder="Optionale Videoanweisung" value={s.videoPrompt} onChange={(e) => set('videoPrompt', e.target.value)} maxLength={500} />}
            <label className="flex items-center gap-2 text-sm"><Switch checked={s.websiteTarget === 'autoschmitt'} onCheckedChange={(v) => set('websiteTarget', v ? 'autoschmitt' : 'none')} />Website-Ziel „Auto Schmitt“ vormerken <span className="text-xs text-muted-foreground">(Veröffentlichung bleibt manuell)</span></label>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="rounded-md bg-muted/40 p-2 text-sm space-y-0.5">
        <div className="flex justify-between"><span>{cost.images} Fahrzeugbilder × {cost.perImage} Credits</span><span>{cost.imageCost}</span></div>
        <div className="text-xs text-muted-foreground">1 Masterbild + {cost.images - 1} Perspektiven</div>
        {cost.banners > 0 && <div className="flex justify-between"><span>{cost.banners} Banner × {Math.round(cost.bannerCost / cost.banners)} Credits</span><span>{cost.bannerCost}</span></div>}
        {cost.video > 0 && <div className="flex justify-between"><span>Video</span><span>{cost.video}</span></div>}
        <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Maximal pro Fahrzeug</span><span>{cost.total} Credits</span></div>
        <div className="text-xs text-muted-foreground">Guthaben: {balance} Credits. Reicht das Guthaben nicht, pausiert der Job und meldet sich.</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => save(false)} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}Profil speichern</Button>
        <Button size="sm" onClick={() => save(true)} disabled={saving || !s.perspectiveKeys.length && cost.images < 1}>
          <ShieldCheck className="w-4 h-4 mr-1.5" />Profil freigeben – automatische Aufbereitung bis {cost.total} Credits je Fahrzeug erlauben
        </Button>
        {data?.profile?.approved_at && <Button size="sm" variant="ghost" onClick={revoke}>Freigabe zurückziehen</Button>}
      </div>
      <p className="text-[11px] text-muted-foreground">Mit der Freigabe erlauben Sie, dass ein Auto3-Fahrzeug im Hintergrund bis zu diesem Betrag Credits verbraucht. Jede Änderung am Profil hebt die Freigabe auf.</p>

    </div>
  );
}
