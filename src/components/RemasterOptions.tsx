import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Paintbrush, Tag, Building2, Car, CheckCircle2, AlertCircle, Eraser, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  type RemasterConfig,
  SCENE_OPTIONS,
  LICENSE_PLATE_OPTIONS,
  CLEANUP_OPTIONS,
  fetchManufacturerLogos,
  type DynamicLogo,
} from '@/lib/remaster-prompt';
import { ensureCachedBase64, prewarmCache, ensureLogoCachedAsPng } from '@/lib/image-base64-cache';
import { compressImageForAI, fileToBase64 } from '@/lib/image-compress';
import VehicleBrandModelPicker from '@/components/VehicleBrandModelPicker';
import SceneGallery, { type SceneTileOption } from '@/components/capture/SceneGallery';
import OptionCards, { type CardOption } from '@/components/capture/OptionCards';
import { useModuleAccess } from '@/hooks/useModuleAccess';

interface RemasterOptionsProps {
  config: RemasterConfig;
  onChange: (config: RemasterConfig) => void;
  /** Aktive Fahrzeugklasse – steuert klassenspezifische Optionen (z. B. Baumaschinen). */
  vehicleClass?: string;
  vehicleBrand?: string;
  onBrandChange?: (brand: string) => void;
  onModelChange?: (model: string) => void;
  vehicleModel?: string;
  /** Status of automatic brand detection */
  brandDetectionStatus?: 'idle' | 'detecting' | 'found' | 'not-found';
}

// fileToBase64 imported from '@/lib/image-compress'

const RemasterOptions: React.FC<RemasterOptionsProps> = ({ config, onChange, vehicleClass, vehicleBrand, onBrandChange, onModelChange, vehicleModel, brandDetectionStatus = 'idle' }) => {
  const { user } = useAuth();
  const { disabledModules } = useModuleAccess();
  const cleanupAllowed = !disabledModules.has('remaster-cleanup');
  const [profileShowroomUrl, setProfileShowroomUrl] = useState<string | null>(null);
  const [profileLogoUrl, setProfileLogoUrl] = useState<string | null>(null);
  const [dynamicLogos, setDynamicLogos] = useState<DynamicLogo[]>([]);
  const [selectedBrand, setSelectedBrand] = useState(vehicleBrand || '');
  const [selectedModel, setSelectedModel] = useState(vehicleModel || '');
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const showroomInputRef = useRef<HTMLInputElement>(null);
  const plateImageRef = useRef<HTMLInputElement>(null);
  const manufacturerLogoRef = useRef<HTMLInputElement>(null);

  const configRef = React.useRef(config);
  configRef.current = config;

  // Sync external vehicleBrand into local state
  useEffect(() => {
    if (vehicleBrand && vehicleBrand !== selectedBrand) {
      setSelectedBrand(vehicleBrand);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleBrand]);

  useEffect(() => {
    if (vehicleModel && vehicleModel !== selectedModel) {
      setSelectedModel(vehicleModel);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleModel]);

  // Load profile data & dynamic logos
  useEffect(() => {
    fetchManufacturerLogos().then(logos => {
      setDynamicLogos(logos);
      prewarmCache(logos.map(l => l.url));
    });
    if (!user) return;
    supabase.from('profiles').select('custom_showroom_url, logo_url').eq('id', user.id).single()
      .then(async ({ data }) => {
        if (data) {
          const showroomUrl = (data as any).custom_showroom_url || null;
          const logoUrl = data.logo_url || null;
          setProfileShowroomUrl(showroomUrl);
          setProfileLogoUrl(logoUrl);
          const urlsToCache = [showroomUrl, logoUrl].filter(Boolean) as string[];
          if (urlsToCache.length) prewarmCache(urlsToCache);
          if (logoUrl) {
            const logoB64 = await ensureCachedBase64(logoUrl);
            onChange({ ...configRef.current, dealerLogoUrl: logoUrl, dealerLogoBase64: logoB64 });
          }
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Built-in scenes that ship their own reference image (e.g. Showroom 4).
  // The image is passed through the existing showroom reference channel so the
  // model sees the exact environment; user uploads are never overwritten.
  const autoSceneRefRef = useRef<string | null>(null);
  useEffect(() => {
    const scene = SCENE_OPTIONS.find(s => s.value === config.scene) as any;
    const refUrl: string | undefined = scene?.reference;
    if (refUrl) {
      const current = configRef.current.customShowroomBase64;
      if (current && current !== autoSceneRefRef.current) return; // user upload wins
      ensureCachedBase64(refUrl).then(b64 => {
        autoSceneRefRef.current = b64;
        onChange({ ...configRef.current, customShowroomBase64: b64 });
      }).catch(() => {});
    } else if (autoSceneRefRef.current && configRef.current.customShowroomBase64 === autoSceneRefRef.current) {
      const prev = autoSceneRefRef.current;
      autoSceneRefRef.current = null;
      if (configRef.current.customShowroomBase64 === prev) {
        onChange({ ...configRef.current, customShowroomBase64: null });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.scene]);

  // Brand alias map for logo matching
  const BRAND_ALIASES: Record<string, string[]> = {
    'volkswagen': ['vw'],
    'vw': ['volkswagen'],
    'mercedesbenz': ['mercedes', 'mb', 'mercedesamg'],
    'mercedes': ['mercedesbenz', 'mb', 'mercedesamg'],
    'mb': ['mercedesbenz', 'mercedes'],
    'bmw': ['bayerischemotorenwerke'],
    'alfaromeo': ['alfa-romeo', 'alfa'],
    'alfa-romeo': ['alfaromeo', 'alfa'],
    'astonmartin': ['aston-martin'],
    'aston-martin': ['astonmartin'],
    'landrover': ['land-rover', 'land rover'],
    'land-rover': ['landrover'],
    'rollsroyce': ['rolls-royce', 'rolls royce'],
    'rolls-royce': ['rollsroyce'],
  };

  // Auto-resolve manufacturer logo when selectedBrand changes
  useEffect(() => {
    if (!selectedBrand || dynamicLogos.length === 0) {
      if (!selectedBrand) {
        onChange({ ...configRef.current, manufacturerLogoUrl: null, manufacturerLogoBase64: null });
      }
      return;
    }
    const brandNorm = selectedBrand.toLowerCase().replace(/[-_\s]+/g, '');
    
    const findLogo = () => {
      const exact = dynamicLogos.find(l => l.name.toLowerCase().replace(/[-_\s]+/g, '') === brandNorm);
      if (exact) return exact;
      const aliases = BRAND_ALIASES[brandNorm] || [];
      for (const alias of aliases) {
        const aliasMatch = dynamicLogos.find(l => l.name.toLowerCase().replace(/[-_\s]+/g, '') === alias);
        if (aliasMatch) return aliasMatch;
      }
      return dynamicLogos.find(l => l.name.toLowerCase().includes(brandNorm) || brandNorm.includes(l.name.toLowerCase()));
    };

    const match = findLogo();
    if (match) {
      console.log(`[RemasterOptions] Auto-resolved logo for "${selectedBrand}": ${match.name} → ${match.url}`);
      ensureLogoCachedAsPng(match.url).then(b64 => {
        console.log(`[RemasterOptions] Logo cached as PNG (${Math.round(b64.length / 1024)}KB), starts with: ${b64.substring(0, 30)}`);
        onChange({ ...configRef.current, manufacturerLogoUrl: match.url, manufacturerLogoBase64: b64 });
      });
    } else {
      onChange({ ...configRef.current, manufacturerLogoUrl: null, manufacturerLogoBase64: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrand, dynamicLogos]);

  // Clear cleanup items if user is not allowed to use the feature
  useEffect(() => {
    if (!cleanupAllowed && (configRef.current.cleanupItems?.length ?? 0) > 0) {
      onChange({ ...configRef.current, cleanupItems: [] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupAllowed]);

  const update = (partial: Partial<RemasterConfig>) => onChange({ ...config, ...partial });

  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedModel('');
    onBrandChange?.(brand);
    onModelChange?.('');
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    onModelChange?.(model);
  };

  const handleManufacturerLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Bitte ein Bild auswählen.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max. 5MB.'); return; }
    const base64 = await compressImageForAI(await fileToBase64(file), 512).catch(() => fileToBase64(file));
    update({ manufacturerLogoBase64: base64 as string, manufacturerLogoUrl: base64 as string });
    toast.success('Hersteller-Logo hochgeladen.');
  };


  const handleShowroomUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Bitte ein Bild auswählen.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Max. 10MB.'); return; }
    const raw = await fileToBase64(file);
    const base64 = await compressImageForAI(raw, 1024).catch(() => raw);
    update({ customShowroomBase64: base64 });

    if (user) {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/showroom.${ext}`;
      const { error } = await supabase.storage.from('vehicle-images').upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('vehicle-images').getPublicUrl(path);
        const url = urlData.publicUrl + '?t=' + Date.now();
        await supabase.from('profiles').update({ custom_showroom_url: url } as any).eq('id', user.id);
        setProfileShowroomUrl(url);
      }
    }
  };

  const handlePlateImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Bitte ein Bild auswählen.'); return; }
    const raw = await fileToBase64(file);
    const base64 = await compressImageForAI(raw, 800).catch(() => raw);
    update({ customPlateImageBase64: base64 });
  };

  // Render the brand detection status indicator
  const renderBrandStatus = () => {
    if (brandDetectionStatus === 'detecting') {
      return (
        <div className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-2 animate-pulse">
          <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] text-accent-foreground font-medium">Marke wird erkannt…</span>
        </div>
      );
    }

    if (config.manufacturerLogoUrl && selectedBrand) {
      return (
        <div className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-2">
          <img src={config.manufacturerLogoUrl} alt={selectedBrand} className="w-6 h-6 object-contain" />
          <span className="text-[11px] text-accent-foreground font-medium">
            Logo für „{selectedBrand}" gefunden
          </span>
          <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
        </div>
      );
    }

    if (selectedBrand && !config.manufacturerLogoUrl) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Kein Logo für „{selectedBrand}"</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-[11px] h-7 gap-1"
            onClick={() => manufacturerLogoRef.current?.click()}
          >
            <Upload className="w-3 h-3" /> Logo hochladen
          </Button>
        </div>
      );
    }

    if (brandDetectionStatus === 'not-found') {
      return (
        <div className="flex items-center gap-2 bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
          <span className="text-[11px] text-destructive font-medium">Keine Marke erkannt – Logo kann nicht zugeordnet werden</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">

      {/* Szene – visuelle Auswahl */}
      <div className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-3">
        <Label className="text-xs font-semibold text-foreground">Showroom / Setting <span className="text-destructive">*</span></Label>
        <SceneGallery
          options={SCENE_OPTIONS as unknown as SceneTileOption[]}
          value={config.scene}
          onChange={(v) => update({ scene: v })}
        />


        {config.scene === 'custom-showroom' && (
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-muted-foreground">Dein Showroom-Hintergrund. Deine Fahrzeuge werden automatisch darin platziert.</p>
            {config.customShowroomBase64 ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img src={config.customShowroomBase64} alt="Eigener Showroom" className="w-full h-32 object-cover" />
                <button onClick={() => update({ customShowroomBase64: null })} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : profileShowroomUrl ? (
              <div className="space-y-2">
                <div className="relative rounded-lg overflow-hidden border border-accent">
                  <img src={profileShowroomUrl} alt="Gespeicherter Showroom" className="w-full h-32 object-cover" />
                  <div className="absolute bottom-1.5 left-1.5 bg-accent text-accent-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-md">Gespeichert</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-xs flex-1" onClick={async () => {
                    try {
                      const resp = await fetch(profileShowroomUrl);
                      const blob = await resp.blob();
                      const reader = new FileReader();
                      reader.onload = () => update({ customShowroomBase64: reader.result as string });
                      reader.readAsDataURL(blob);
                    } catch { update({ customShowroomBase64: profileShowroomUrl }); }
                  }}>Verwenden</Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => showroomInputRef.current?.click()}>
                    <Upload className="w-3 h-3 mr-1" /> Neues Bild
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => showroomInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-accent rounded-lg p-6 text-center cursor-pointer transition-colors bg-muted/30 hover:bg-muted/50"
              >
                <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Showroom-Hintergrund hochladen</p>
              </div>
            )}
            <input ref={showroomInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleShowroomUpload(f); e.target.value = ''; }}
            />
          </div>
        )}
      </div>

      {/* License Plate */}
      <div className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-3">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" /> Nummernschild
        </Label>
        <OptionCards
          options={LICENSE_PLATE_OPTIONS as unknown as CardOption[]}
          value={config.licensePlate}
          onChange={(v) => update({ licensePlate: v })}
        />

        {config.licensePlate === 'custom' && (
          <div className="mt-2 space-y-2">
            <Input
              placeholder="z.B. M-XY 1234"
              value={config.customPlateText || ''}
              onChange={(e) => update({ customPlateText: e.target.value })}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground/60">Oder lade ein Bild deines Kennzeichens hoch:</p>
            {config.customPlateImageBase64 ? (
              <div className="relative inline-block">
                <img src={config.customPlateImageBase64} alt="Kennzeichen" className="h-12 rounded border border-border" />
                <button onClick={() => update({ customPlateImageBase64: null })} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px]">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => plateImageRef.current?.click()}>
                <Upload className="w-3 h-3" /> Kennzeichen-Bild
              </Button>
            )}
            <input ref={plateImageRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePlateImageUpload(f); e.target.value = ''; }}
            />
          </div>
        )}
      </div>
      </div>

      {/* Baumaschinen: Aufräumen/Reinigen bewusst ein- und ausschaltbar */}
      {vehicleClass === 'machinery' && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex min-h-6 items-start justify-between gap-3">
            <Label className="flex items-start gap-1.5 text-xs font-semibold text-foreground">
              <Eraser className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>
                Maschine aufräumen und reinigen
                <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                  Aus: Zustand exakt wie fotografiert (Schmutz, Staub, Erde bleiben). Ein: gewaschen und verkaufsfertig – Kratzer, Rost und Verschleiß bleiben trotzdem sichtbar.
                </span>
              </span>
            </Label>
            <Switch
              checked={config.machineryTidyUp === true}
              onCheckedChange={(v) => update({ machineryTidyUp: v })}
              aria-label="Maschine aufräumen und reinigen"
            />
          </div>
        </div>
      )}

      {/* Spezifische Bereinigung – kompakt und standardmäßig eingeklappt */}
      {cleanupAllowed && (() => {
        const items = config.cleanupItems || [];
        const allValues = CLEANUP_OPTIONS.map(o => o.value);
        const allChecked = items.length === CLEANUP_OPTIONS.length;
        const toggle = (v: string, on: boolean) => {
          const next = on
            ? Array.from(new Set([...(items), v]))
            : items.filter(x => x !== v);
          update({ cleanupItems: next });
        };
        const toggleAll = (on: boolean) => update({ cleanupItems: on ? allValues : [] });
        return (
          <Collapsible open={cleanupOpen} onOpenChange={setCleanupOpen} className="rounded-lg border border-border bg-card">
            <div className="flex min-h-12 items-center gap-3 px-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Eraser className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">Spezifische Bereinigung</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {items.length > 0 ? `${items.length} Optionen ausgewählt` : 'Optional für LKW & Flottenfahrzeuge'}
                  </p>
                </div>
              </div>
              <label className="flex shrink-0 items-center gap-1.5 cursor-pointer">
                <Switch checked={allChecked} onCheckedChange={toggleAll} aria-label="Alle Bereinigungen auswählen" />
                <span className="hidden text-[10px] text-muted-foreground sm:inline">Alle</span>
              </label>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={cleanupOpen ? 'Bereinigung einklappen' : 'Bereinigung aufklappen'}>
                  <ChevronDown className={`h-4 w-4 transition-transform ${cleanupOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="border-t border-border px-3 pb-3 pt-2.5">
              <p className="mb-2 text-[11px] text-muted-foreground">
                Entfernt beim Remastern Spediteurs- und Firmenmerkmale.
              </p>
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {CLEANUP_OPTIONS.map(opt => (
                <label key={opt.value} className="flex min-h-7 items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={items.includes(opt.value)}
                    onCheckedChange={(v) => toggle(opt.value, !!v)}
                  />
                  <span className="text-[11px] text-foreground">{opt.label}</span>
                </label>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })()}


      {/* Color Change */}
      <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Paintbrush className="h-3.5 w-3.5 text-muted-foreground" /> Fahrzeugfarbe ändern
          </Label>
          <Switch checked={config.changeColor} onCheckedChange={(v) => update({ changeColor: v })} />
        </div>
        {config.changeColor && (
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5">
            {[
              { value: '#FFFFFF', className: 'bg-vehicle-white' },
              { value: '#1F2933', className: 'bg-vehicle-black' },
              { value: '#C8CDD2', className: 'bg-vehicle-silver' },
              { value: '#174F6B', className: 'bg-vehicle-blue' },
              { value: '#A62A2A', className: 'bg-vehicle-red' },
              { value: '#2F7A4C', className: 'bg-vehicle-green' },
            ].map(color => (
              <Button
                key={color.value}
                type="button"
                variant="outline"
                size="icon"
                onClick={() => update({ colorHex: color.value })}
                className={`h-6 w-6 shrink-0 rounded-full p-0 ${color.className} ${config.colorHex?.toUpperCase() === color.value ? 'border-accent ring-2 ring-accent/30' : 'border-border'}`}
                aria-label={`Farbe ${color.value} auswählen`}
              />
            ))}
            <input
              type="color"
              value={config.colorHex || '#000000'}
              onChange={(e) => update({ colorHex: e.target.value })}
              className="h-7 w-7 shrink-0 cursor-pointer rounded-full border border-border bg-transparent p-0.5"
              aria-label="Eigene Fahrzeugfarbe auswählen"
            />
            <Input
              value={config.colorHex || '#000000'}
              onChange={(e) => update({ colorHex: e.target.value })}
              placeholder="#000000"
              className="h-8 min-w-0 flex-[1_1_84px] text-[11px] font-mono"
            />
          </div>
        )}
      </div>

      {/* Logo Configuration */}
      <div className="space-y-2.5 rounded-lg border border-border bg-card p-3">
        <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Branding
        </Label>

        {/* Manufacturer Logo Toggle – always enabled */}
        <div className="space-y-2">
          <div className="flex min-h-8 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-[11px] text-foreground">Herstellerlogo</span>
              {config.manufacturerLogoUrl && (
                <img src={config.manufacturerLogoUrl} alt="Herstellerlogo" className="h-6 w-8 object-contain" />
              )}
            </div>
            <Switch
              checked={config.showManufacturerLogo}
              onCheckedChange={(v) => update({ showManufacturerLogo: v })}
            />
          </div>

          {/* Brand status – always visible regardless of toggle */}
          {config.showManufacturerLogo && renderBrandStatus()}

          {/* Brand & Model Picker – shown when toggle is ON */}
          {config.showManufacturerLogo && (
            <div className="space-y-2 pl-1 border-l-2 border-accent/20 ml-1">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Car className="w-3 h-3" /> Fahrzeugmarke & Modell
              </Label>
              <VehicleBrandModelPicker
                brand={selectedBrand}
                model={selectedModel}
                onBrandChange={handleBrandChange}
                onModelChange={handleModelChange}
                compact
              />
            </div>
          )}
        </div>

        {/* Dealer Logo */}
        <div className="flex min-h-8 items-center justify-between gap-2 border-t border-border pt-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-[11px] text-foreground">Autohaus-Logo</span>
            {profileLogoUrl && <img src={profileLogoUrl} alt="Autohaus-Logo" className="h-6 max-w-16 object-contain" />}
            {!profileLogoUrl && (
              <span className="truncate text-[9px] text-muted-foreground">Im Profil hinterlegen</span>
            )}
          </div>
          <Switch
            checked={config.showDealerLogo}
            onCheckedChange={(v) => update({ showDealerLogo: v })}
            disabled={!profileLogoUrl}
          />
        </div>
      </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={manufacturerLogoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleManufacturerLogoUpload(f);
          e.target.value = '';
        }}
      />
    </div>
  );
};

export default RemasterOptions;
