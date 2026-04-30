import React from 'react';
import { Camera, FileText, Layout, Image, Video, Sparkles, Lock, Zap } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { useModuleAccess } from '@/hooks/useModuleAccess';

export type HubAction = 
  | 'studio'          // 🚀 One-Shot Studio (Beta) — Bilder + Banner + Video in einem Rutsch
  | 'photos'          // Fotos aufnehmen & remastern
  | 'pdf-landing'     // PDF → Landing Page
  | 'manual-landing'  // Landing Page ohne PDF
  | 'banner'          // Banner Generator
  | 'video'           // Video Erstellung
  | 'sales-assistant'; // KI Verkaufsassistent

interface ActionTile {
  id: HubAction;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  disabled?: boolean;
}

const TILES: ActionTile[] = [
  {
    id: 'studio',
    icon: <Zap className="w-7 h-7" />,
    title: 'One-Shot Studio',
    description: 'Power-Button: Fahrzeugfotos + komplettes Bilderset + Banner & Video in einem Rutsch.',
    badge: 'BETA',
  },
  {
    id: 'photos',
    icon: <Camera className="w-7 h-7" />,
    title: 'Fotos & Remastering',
    description: 'Fahrzeugfotos aufnehmen oder hochladen – KI verwandelt sie in professionelle Showroom-Bilder.',
  },
  {
    id: 'pdf-landing',
    icon: <FileText className="w-7 h-7" />,
    title: 'PDF → Angebotsseite',
    description: 'Angebots-PDF hochladen, KI liest alle Daten aus und erstellt eine fertige Landing Page.',
  },
  {
    id: 'manual-landing',
    icon: <Layout className="w-7 h-7" />,
    title: 'Landing Page manuell',
    description: 'Fahrzeugdaten selbst eingeben und eine Angebotsseite ohne PDF erstellen.',
  },
  {
    id: 'banner',
    icon: <Image className="w-7 h-7" />,
    title: 'Banner Generator',
    description: 'Werbebanner für Social Media & Anzeigen aus Fahrzeugdaten erstellen.',
  },
  {
    id: 'video',
    icon: <Video className="w-7 h-7" />,
    title: 'Video Erstellung',
    description: 'Fahrzeugbild hochladen und ein professionelles Showroom-Video per KI erstellen.',
  },
  {
    id: 'sales-assistant',
    icon: <Sparkles className="w-7 h-7" />,
    title: 'KI Verkaufsassistent',
    description: 'Hilft mit passenden Antworten, Follow-ups und Empfehlungen dabei, Fahrzeuge schneller zu verkaufen.',
  },
];

interface ActionHubProps {
  onSelect: (action: HubAction) => void;
}

const ActionHub: React.FC<ActionHubProps> = ({ onSelect }) => {
  const { balance } = useCredits();
  const { disabledModules } = useModuleAccess();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Was möchtest du tun?
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
          Aktion wählen
        </h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Wähle einen Prozess – die Ergebnisse werden automatisch für andere Aktionen verfügbar.
        </p>
      </div>

      {/* Credit Balance */}
      <div className="flex justify-center">
        <span className="text-xs text-muted-foreground">
          Guthaben: <strong className="text-foreground">{balance} Credits</strong>
        </span>
      </div>

      {/* Tile Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((tile) => {
          const isDisabledByAdmin = disabledModules.has(tile.id);
          const isDisabled = tile.disabled || isDisabledByAdmin;

          return (
            <button
              key={tile.id}
              onClick={() => !isDisabled && onSelect(tile.id)}
              disabled={isDisabled}
              className={`relative group text-left p-5 rounded-xl border transition-all duration-200 ${
                isDisabled
                  ? 'border-border/50 bg-muted/30 opacity-60 cursor-not-allowed'
                  : 'border-border bg-card hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5 cursor-pointer'
              }`}
            >
              {isDisabledByAdmin && (
                <span className="absolute top-3 right-3">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </span>
              )}
              {tile.badge && !isDisabledByAdmin && (
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                  {tile.badge}
                </span>
              )}
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                isDisabled
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-foreground'
              }`}>
                {tile.icon}
              </div>
              <h3 className="font-semibold text-foreground text-sm mb-1">{tile.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{tile.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ActionHub;
