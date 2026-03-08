import React from 'react';
import { Wand2, Upload, Camera, Zap } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';

interface ImageSourceChoiceProps {
  onChooseGenerate: () => void;
  onChooseUpload: () => void;
  onChooseCapture: () => void;
}

const ImageSourceChoice: React.FC<ImageSourceChoiceProps> = ({ onChooseGenerate, onChooseUpload, onChooseCapture }) => {
  const { getCost, balance } = useCredits();

  const generateCost = getCost('image_generate', 'standard') * 7; // 7 perspectives
  const remasterCost = getCost('image_remaster', 'standard');
  const vinOcrCost = getCost('vin_ocr', 'standard');

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
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Option 1: AI Generate */}
        <button
          onClick={onChooseGenerate}
          className="group bg-card rounded-2xl border-2 border-border hover:border-accent p-6 text-left transition-all hover:shadow-card"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
            <Wand2 className="w-6 h-6" />
          </div>
          <h3 className="font-display font-semibold text-foreground text-sm mb-1">KI-Bilder generieren</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            7 fotorealistische Perspektiven im Showroom-Setting. Komplett automatisch.
          </p>
          <CostBadge cost={generateCost} extra={`${getCost('image_generate', 'standard')} pro Bild`} />
        </button>

        {/* Option 2: Smartphone/Camera Capture */}
        <button
          onClick={onChooseCapture}
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
          onClick={onChooseUpload}
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
