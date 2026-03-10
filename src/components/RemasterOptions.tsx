import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Paintbrush, Tag, Building2, Car } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  type RemasterConfig,
  SCENE_OPTIONS,
  LICENSE_PLATE_OPTIONS,
  fetchManufacturerLogos,
  type DynamicLogo,
} from '@/lib/remaster-prompt';

interface RemasterOptionsProps {
  config: RemasterConfig;
  onChange: (config: RemasterConfig) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const RemasterOptions: React.FC<RemasterOptionsProps> = ({ config, onChange }) => {
  const { user } = useAuth();
  const [profileShowroomUrl, setProfileShowroomUrl] = useState<string | null>(null);
  const [profileLogoUrl, setProfileLogoUrl] = useState<string | null>(null);
  const [dynamicLogos, setDynamicLogos] = useState<DynamicLogo[]>([]);
  const showroomInputRef = useRef<HTMLInputElement>(null);
  const plateImageRef = useRef<HTMLInputElement>(null);

  // Load profile data & dynamic logos
  useEffect(() => {
    fetchManufacturerLogos().then(setDynamicLogos);
    if (!user) return;
    supabase.from('profiles').select('custom_showroom_url, logo_url').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfileShowroomUrl((data as any).custom_showroom_url || null);
          setProfileLogoUrl(data.logo_url || null);
          if (data.logo_url) {
            onChange({ ...config, dealerLogoUrl: data.logo_url });
          }
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const update = (partial: Partial<RemasterConfig>) => onChange({ ...config, ...partial });

  const selectedScene = SCENE_OPTIONS.find(s => s.value === config.scene);
  const scenePreview = selectedScene && 'preview' in selectedScene ? (selectedScene as any).preview : null;

  const handleShowroomUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Bitte ein Bild auswählen.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Max. 10MB.'); return; }
    const base64 = await fileToBase64(file);
    update({ customShowroomBase64: base64 });

    // Also save to profile for future use
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
    const base64 = await fileToBase64(file);
    update({ customPlateImageBase64: base64 });
  };

  return (
    <div className="space-y-5 bg-card border border-border rounded-xl p-5">
      <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
        <Paintbrush className="w-4 h-4 text-muted-foreground" />
        Remaster-Optionen
      </h3>

      {/* Scene Dropdown */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Szene</Label>
        <p className="text-[11px] text-muted-foreground/70">Wähle eine spezielle Szene für den Hintergrund</p>
        <Select value={config.scene} onValueChange={(v) => update({ scene: v })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SCENE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Scene preview */}
        {scenePreview && (
          <div className="mt-2 rounded-lg overflow-hidden border border-border">
            <img src={scenePreview} alt="Szene Vorschau" className="w-full h-32 object-cover" />
          </div>
        )}

        {/* Custom showroom */}
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
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" /> Nummernschild
        </Label>
        <p className="text-[11px] text-muted-foreground/70">Was soll mit dem Nummernschild passieren?</p>
        <Select value={config.licensePlate} onValueChange={(v) => update({ licensePlate: v })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LICENSE_PLATE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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

      {/* Color Change */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground">Fahrzeugfarbe ändern</Label>
          <Switch checked={config.changeColor} onCheckedChange={(v) => update({ changeColor: v })} />
        </div>
        {config.changeColor && (
          <div className="flex items-center gap-3 mt-1">
            <input
              type="color"
              value={config.colorHex || '#000000'}
              onChange={(e) => update({ colorHex: e.target.value })}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
            />
            <Input
              value={config.colorHex || '#000000'}
              onChange={(e) => update({ colorHex: e.target.value })}
              placeholder="#000000"
              className="text-sm font-mono w-28"
            />
          </div>
        )}
      </div>

      {/* Logo Configuration */}
      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" /> Logo-Konfiguration
        </Label>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-foreground">Hersteller-Logo einblenden</span>
            {dynamicLogos.length === 0 && (
              <span className="text-[10px] text-muted-foreground/60">(keine Logos vorhanden)</span>
            )}
          </div>
          <Switch
            checked={config.showManufacturerLogo}
            onCheckedChange={(v) => update({ showManufacturerLogo: v })}
            disabled={dynamicLogos.length === 0}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-foreground">Autohaus-Logo einblenden</span>
            {!profileLogoUrl && (
              <span className="text-[10px] text-muted-foreground/60">(im Profil hinterlegen)</span>
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
  );
};

export default RemasterOptions;
