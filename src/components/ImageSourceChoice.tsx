import React from 'react';
import { Wand2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageSourceChoiceProps {
  onChooseGenerate: () => void;
  onChooseUpload: () => void;
}

const ImageSourceChoice: React.FC<ImageSourceChoiceProps> = ({ onChooseGenerate, onChooseUpload }) => {
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">Fahrzeugbilder erstellen</h2>
        <p className="text-sm text-muted-foreground">Wähle wie die Bilder für deine Landing Page erstellt werden sollen.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            Die KI erstellt 7 fotorealistische Perspektiven des Fahrzeugs in einem Showroom-Setting. Komplett automatisch.
          </p>
        </button>

        {/* Option 2: Upload & Remaster */}
        <button
          onClick={onChooseUpload}
          className="group bg-card rounded-2xl border-2 border-border hover:border-accent p-6 text-left transition-all hover:shadow-card"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="font-display font-semibold text-foreground text-sm mb-1">Eigene Bilder hochladen</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Lade eigene Fahrzeugfotos hoch. Die KI setzt das Auto in einen professionellen Showroom mit neuen Schatten & Spiegelungen.
          </p>
        </button>
      </div>
    </div>
  );
};

export default ImageSourceChoice;
