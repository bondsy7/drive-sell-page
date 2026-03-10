import React, { useState } from 'react';
import { Wand2, Upload, Camera, Zap, Sparkles, Crown } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import type { ModelTier } from '@/components/ModelSelector';

interface ImageSourceChoiceProps {
  onChooseGenerate: (modelTier: ModelTier) => void;
  onChooseUpload: (modelTier: ModelTier) => void;
  onChooseCapture: (modelTier: ModelTier) => void;
}

const TIERS: { id: ModelTier; label: string; sublabel: string; icon: React.ReactNode }[] = [
  { id: 'schnell', label: 'Schnell', sublabel: 'schnell & günstig', icon: <Zap className="w-3 h-3" /> },
  { id: 'qualitaet', label: 'Qualität', sublabel: 'ausgewogen', icon: <Sparkles className="w-3 h-3" /> },
  { id: 'premium', label: 'Premium', sublabel: 'beste Ergebnisse', icon: <Crown className="w-3 h-3" /> },
];

const ImageSourceChoice: React.FC<ImageSourceChoiceProps> = ({ onChooseGenerate, onChooseUpload, onChooseCapture }) => {
  const { getCost, balance } = useCredits();
  const [modelTier, setModelTier] = useState<ModelTier>('schnell');

  const generateCost = getCost('image_generate', modelTier) * 7;
  const remasterCost = getCost('image_remaster', modelTier);
  const vinOcrCost = getCost('vin_ocr', 'schnell');

  const CostBadge = ({ cost, extra }: { cost: number; extra?: string }) => (
    <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
      <Zap className="w-3 h-3 text-accent" />
      <span className="text-[11px] font-semibold text-accent">{cost} Credits</span>
      {extra && <span className="text-[11px] text-muted-foreground">({extra})</span>}
    </div>
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">Fahrzeugbilder erstellen</h2>
        <p className="text-sm text-muted-foreground">Wähle wie die Bilder für deine Landing Page erstellt werden sollen.</p>
        <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <Zap className="w-3 h-3 text-accent" />
          <span>Dein Guthaben: <strong className="text-foreground">{balance} Credits</strong></span>
        </div>

        {/* Model Tier Selector */}
        <div className="flex items-center justify-center gap-1 mt-4 p-1 rounded-lg bg-muted inline-flex">
          {TIERS.map((tier) => (
            <button
              key={tier.id}
              onClick={() => setModelTier(tier.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
                modelTier === tier.id
                  ? tier.id === 'premium'
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tier.icon}
              {tier.label}
              <span className="text-[10px] opacity-70">({tier.sublabel})</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Option 1: AI Generate */}
        <button
          onClick={() => onChooseGenerate(modelTier)}
          className="group bg-card rounded-2xl border-2 border-border hover:border-accent p-6 text-left transition-all hover:shadow-card"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
            <Wand2 className="w-6 h-6" />
          </div>
          <h3 className="font-display font-semibold text-foreground text-sm mb-1">KI-Bilder generieren</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            7 fotorealistische Perspektiven im Showroom-Setting. Komplett automatisch.
          </p>
          <CostBadge cost={generateCost} extra={`${getCost('image_generate', modelTier)} pro Bild`} />
        </button>

        {/* Option 2: Smartphone/Camera Capture */}
        <button
          onClick={() => onChooseCapture(modelTier)}
          className="group bg-card rounded-2xl border-2 border-border hover:border-accent p-6 text-left transition-all hover:shadow-card"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="font-display font-semibold text-foreground text-sm mb-1">Fotos aufnehmen</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Fotografiere das Fahrzeug mit dem Smartphone. KI-Remastering + automatische VIN-Erkennung.
          </p>
          <CostBadge cost={remasterCost} extra={`pro Bild + ${vinOcrCost} für VIN`} />
        </button>

        {/* Option 3: Upload & Remaster */}
        <button
          onClick={() => onChooseUpload(modelTier)}
          className="group bg-card rounded-2xl border-2 border-border hover:border-accent p-6 text-left transition-all hover:shadow-card"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="font-display font-semibold text-foreground text-sm mb-1">Bilder hochladen</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Eigene Fahrzeugfotos hochladen. Die KI setzt sie in einen professionellen Showroom.
          </p>
          <CostBadge cost={remasterCost} extra="pro Bild" />
        </button>
      </div>
    </div>
  );
};

export default ImageSourceChoice;
