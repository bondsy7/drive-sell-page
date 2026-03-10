import React, { useState, useMemo } from 'react';
import { ArrowLeft, Sparkles, Loader2, FileText, Car, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { toast } from 'sonner';

const PAGE_TYPES = [
  { value: 'leasing', label: 'Leasing-Angebot', desc: 'Monatliche Rate, Flexibilität, Steuervorteile', icon: '📋' },
  { value: 'finanzierung', label: 'Finanzierung', desc: 'Ratenkauf mit flexiblen Konditionen', icon: '💰' },
  { value: 'barkauf', label: 'Barkauf / Neuwagen', desc: 'Direktkauf mit Preisvorteil', icon: '🚗' },
  { value: 'massenangebot', label: 'Massenangebot / Aktion', desc: 'Zeitlich begrenzte Sonderaktion', icon: '🔥' },
  { value: 'autoabo', label: 'Auto-Abo', desc: 'All-inclusive, flexible Laufzeiten', icon: '🔄' },
  { value: 'event', label: 'Event im Autohaus', desc: 'Einladung zu Veranstaltung', icon: '🎉' },
  { value: 'release', label: 'Fahrzeug-Release', desc: 'Premiere & Vorbestellung', icon: '✨' },
];

interface ManualLandingGeneratorProps {
  onBack: () => void;
  onComplete: (html: string) => void;
}

const ManualLandingGenerator: React.FC<ManualLandingGeneratorProps> = ({ onBack, onComplete }) => {
  const { user } = useAuth();
  const { balance } = useCredits();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [pageType, setPageType] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const canGenerate = brand.trim() && model.trim() && pageType;
  const cost = 3;

  const handleGenerate = async () => {
    if (!canGenerate || !user) return;

    if (balance < cost) {
      toast.error(`Nicht genügend Credits. Benötigt: ${cost}, Guthaben: ${balance}`);
      return;
    }

    setLoading(true);
    setProgress('Lade Händlerprofil...');

    try {
      // Load dealer profile
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const dealer = profile ? {
        name: (profile as any).company_name || '',
        address: (profile as any).address || '',
        postalCode: (profile as any).postal_code || '',
        city: (profile as any).city || '',
        phone: (profile as any).phone || '',
        email: (profile as any).email || '',
        website: (profile as any).website || '',
        logoUrl: (profile as any).logo_url || '',
        whatsappNumber: (profile as any).whatsapp_number || '',
        facebookUrl: (profile as any).facebook_url || '',
        instagramUrl: (profile as any).instagram_url || '',
        youtubeUrl: (profile as any).youtube_url || '',
        tiktokUrl: (profile as any).tiktok_url || '',
        defaultLegalText: (profile as any).default_legal_text || '',
      } : {};

      setProgress('KI generiert Inhalte & Bilder...');

      const { data, error } = await supabase.functions.invoke('generate-landing-page', {
        body: { brand, model, pageType, additionalInfo, dealer },
      });

      if (error) {
        toast.error('Fehler bei der Generierung.');
        console.error(error);
        return;
      }

      if (data?.error) {
        if (data.error === 'insufficient_credits') {
          toast.error(`Nicht genügend Credits. Guthaben: ${data.balance}, benötigt: ${data.cost}`);
        } else if (data.error.includes('Rate limit')) {
          toast.error(data.error);
        } else {
          toast.error(data.error);
        }
        return;
      }

      if (data?.html) {
        toast.success(`Landing Page erstellt! ${data.imageCount || 0} Bilder generiert.`);
        onComplete(data.html);
      } else {
        toast.error('Keine HTML-Daten erhalten.');
      }
    } catch (e) {
      console.error('Generate error:', e);
      toast.error('Ein Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const selectedType = useMemo(() => PAGE_TYPES.find(t => t.value === pageType), [pageType]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Landing Page Generator</h2>
          <p className="text-sm text-muted-foreground">KI erstellt eine komplette, SEO-optimierte Angebotsseite</p>
        </div>
      </div>

      {/* Form Card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        {/* Brand & Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" /> Marke
            </label>
            <Input
              placeholder="z.B. BMW, Mercedes, VW..."
              value={brand}
              onChange={e => setBrand(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Modell</label>
            <Input
              placeholder="z.B. 3er, C-Klasse, Golf..."
              value={model}
              onChange={e => setModel(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {/* Page Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Seitentyp
          </label>
          <Select value={pageType} onValueChange={setPageType} disabled={loading}>
            <SelectTrigger>
              <SelectValue placeholder="Wofür ist die Seite?" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>
                  <span className="flex items-center gap-2">
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                    <span className="text-muted-foreground text-xs">– {t.desc}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Additional Info */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Zusätzliche Infos
            <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <Textarea
            placeholder="z.B. Preis, besondere Ausstattung, Aktionszeitraum, Zielgruppe..."
            value={additionalInfo}
            onChange={e => setAdditionalInfo(e.target.value)}
            disabled={loading}
            rows={3}
          />
        </div>

        {/* Preview of selected type */}
        {selectedType && (
          <div className="rounded-lg bg-accent/5 border border-accent/20 p-3 flex items-start gap-3">
            <span className="text-2xl">{selectedType.icon}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedType.label}</p>
              <p className="text-xs text-muted-foreground">{selectedType.desc}</p>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <div className="pt-2">
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || loading}
            className="w-full h-12 text-base font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {progress}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Landing Page generieren
              </>
            )}
          </Button>
          <div className="flex items-center justify-center gap-1 mt-2">
            <span className="text-xs text-muted-foreground">
              Kosten: <strong className="text-accent">{cost} Credits</strong> — Guthaben: <strong className="text-foreground">{balance} Credits</strong>
            </span>
          </div>
        </div>
      </div>

      {/* What gets generated */}
      <div className="rounded-xl border border-border bg-card/50 p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Was wird generiert?</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '📝', text: 'SEO-optimierte Texte' },
            { icon: '🖼️', text: 'KI-generierte Bilder' },
            { icon: '📊', text: 'Strukturierte Daten (JSON-LD)' },
            { icon: '📱', text: 'Responsive Design' },
            { icon: '🏢', text: 'Deine Händlerdaten integriert' },
            { icon: '📞', text: 'Kontakt-CTAs (Telefon, WhatsApp)' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ManualLandingGenerator;
