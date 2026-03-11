import React, { useState } from 'react';
import { ArrowLeft, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import VehicleBrandModelPicker from '@/components/VehicleBrandModelPicker';
import { Input } from '@/components/ui/input';
import type { ModelTier } from '@/components/ModelSelector';

interface VehicleSelectBeforeGenerateProps {
  modelTier: ModelTier;
  onBack: () => void;
  onConfirm: (brand: string, model: string, variant: string, color: string) => void;
}

const VehicleSelectBeforeGenerate: React.FC<VehicleSelectBeforeGenerateProps> = ({
  modelTier, onBack, onConfirm,
}) => {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [variant, setVariant] = useState('');
  const [color, setColor] = useState('');

  const canConfirm = brand && model;

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Fahrzeug auswählen</h2>
          <p className="text-sm text-muted-foreground">Wähle Marke und Modell für die KI-Bildgenerierung</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <VehicleBrandModelPicker
          brand={brand}
          model={model}
          onBrandChange={setBrand}
          onModelChange={setModel}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Variante (optional)</label>
            <Input
              value={variant}
              onChange={e => setVariant(e.target.value)}
              placeholder="z.B. Competition, AMG, RS..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Farbe (optional)</label>
            <Input
              value={color}
              onChange={e => setColor(e.target.value)}
              placeholder="z.B. Schwarz, Weiß..."
            />
          </div>
        </div>

        <Button
          onClick={() => onConfirm(brand, model, variant, color)}
          disabled={!canConfirm}
          className="w-full gap-2"
        >
          <Wand2 className="w-4 h-4" />
          Bilder generieren
        </Button>
      </div>
    </div>
  );
};

export default VehicleSelectBeforeGenerate;
