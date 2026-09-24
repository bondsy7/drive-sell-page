import React from 'react';
import {
  ArrowRight, Camera, Coins, Database, FileText, Image, Layout, Lock,
  Music, RotateCw, Scissors, Search, Sparkles, Video, Wand2, Wrench, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCredits } from '@/hooks/useCredits';
import { useModuleAccess, type ModuleKey } from '@/hooks/useModuleAccess';
import { cn } from '@/lib/utils';
import beforeAsset from '@/assets/funnel/before.webp.asset.json';
import afterAsset from '@/assets/funnel/after1.webp.asset.json';
import photoAsset from '@/assets/foto-aufnehmen.webp.asset.json';
import marketingAsset from '@/assets/marketing-formate.webp.asset.json';
import cityAsset from '@/assets/scene-previews/city.webp.asset.json';

export type HubAction =
  | 'studio'
  | 'photos'
  | 'background-swap'
  | 'pdf-landing'
  | 'manual-landing'
  | 'banner'
  | 'canvas-banner-studio'
  | 'video'
  | 'music-studio'
  | 'spin360'
  | 'damage-repair'
  | 'damage-analysis'
  | 'sales-assistant'
  | 'reference-v2';

type ToolGroup = 'fahrzeugbilder' | 'werbung' | 'verkauf' | 'analyse' | 'assistenten';

interface ActionTile {
  id: HubAction;
  icon: React.ReactNode;
  title: string;
  description: string;
  group: ToolGroup;
  badge?: string;
  image?: string;
  disabled?: boolean;
}

const TILE_MODULE_KEY: Partial<Record<HubAction, ModuleKey>> = {
  spin360: 'photos-spin360',
};

const TILES: ActionTile[] = [
  { id: 'studio', icon: <Zap />, title: 'One-Shot Studio', description: 'Fahrzeugfotos, komplettes Bilderset, Banner und Video in einem Durchgang.', group: 'fahrzeugbilder', badge: 'Beta', image: afterAsset.url },
  { id: 'photos', icon: <Camera />, title: 'Fotos & Remastering', description: 'Fahrzeugfotos aufnehmen oder hochladen und als professionelle Showroom-Bilder aufbereiten.', group: 'fahrzeugbilder', image: photoAsset.url },
  { id: 'background-swap', icon: <Scissors />, title: 'Hintergrund tauschen', description: 'Fahrzeug freistellen und auf Showroom, eigenen Hintergrund, Farbe oder KI-Szene setzen.', group: 'fahrzeugbilder', badge: 'Neu', image: cityAsset.url },
  { id: 'spin360', icon: <RotateCw />, title: '360° Spin', description: 'Aus vier oder mehr Fahrzeugfotos einen interaktiven Rundumblick mit 48 Bildern erzeugen.', group: 'fahrzeugbilder', badge: 'Beta', image: afterAsset.url },
  { id: 'banner', icon: <Image />, title: 'Banner Generator', description: 'Werbebanner für soziale Medien und Anzeigen aus Fahrzeugdaten erstellen.', group: 'werbung', image: marketingAsset.url },
  { id: 'canvas-banner-studio', icon: <Layout />, title: 'Banner Studio', description: 'Banner in mehreren Formaten mit editierbaren Texten, Logos und Pflichtangaben gestalten.', group: 'werbung', badge: 'Neu' },
  { id: 'video', icon: <Video />, title: 'Video erstellen', description: 'Fahrzeugbilder in ein professionelles Showroom-Video verwandeln.', group: 'werbung', image: afterAsset.url },
  { id: 'music-studio', icon: <Music />, title: 'Musik Studio', description: 'Musik, Jingles und Spot-Soundtracks mit Gesang oder Instrumenten komponieren.', group: 'werbung', badge: 'Neu' },
  { id: 'pdf-landing', icon: <FileText />, title: 'PDF → Angebotsseite', description: 'Angebots-PDF hochladen, Daten auslesen und eine fertige Angebotsseite erstellen.', group: 'verkauf' },
  { id: 'manual-landing', icon: <Layout />, title: 'Landing Page manuell', description: 'Fahrzeugdaten eingeben und eine Angebotsseite ohne PDF erstellen.', group: 'verkauf' },
  { id: 'damage-repair', icon: <Wrench />, title: 'Schadensreparatur', description: 'Dellen, Kratzer und Steinschläge auf Fahrzeugbildern digital reparieren.', group: 'analyse', image: beforeAsset.url },
  { id: 'damage-analysis', icon: <Search />, title: 'Schadensanalyse', description: 'Schäden markieren, Kosten schätzen und einen Sachverständigenbericht erstellen.', group: 'analyse', image: beforeAsset.url },
  { id: 'reference-v2', icon: <Database />, title: 'Referenz-Bibliothek V2', description: 'Fahrzeugreferenzen aufnehmen, Perspektiven planen und Abdeckung prüfen.', group: 'assistenten', badge: 'Neu' },
  { id: 'sales-assistant', icon: <Sparkles />, title: 'KI Verkaufsassistent', description: 'Passende Antworten, Follow-ups und Empfehlungen für den Fahrzeugverkauf formulieren.', group: 'assistenten' },
];

interface ActionHubProps {
  onSelect: (action: HubAction) => void;
}

const ActionHub: React.FC<ActionHubProps> = ({ onSelect }) => {
  const { balance } = useCredits();
  const { disabledModules } = useModuleAccess();

  const availableTiles = TILES.filter((tile) => {
    const key = TILE_MODULE_KEY[tile.id] ?? (tile.id as ModuleKey);
    return !disabledModules.has(key);
  });

  const renderTool = (tile: ActionTile, featured = false) => {
    const moduleKey = TILE_MODULE_KEY[tile.id] ?? (tile.id as ModuleKey);
    const isDisabled = Boolean(tile.disabled || disabledModules.has(moduleKey));

    return (
      <Button
        key={tile.id}
        variant="outline"
        onClick={() => !isDisabled && onSelect(tile.id)}
        disabled={isDisabled}
        className={cn(
          'group relative h-full min-h-40 w-full items-stretch justify-start overflow-hidden rounded-lg border-border bg-card p-0 text-left whitespace-normal shadow-card transition-all duration-300',
          'hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:text-card-foreground hover:shadow-elevated',
          featured && 'min-h-64 border-primary/20 bg-primary/10 hover:bg-primary/10',
        )}
      >
        <div className={cn('relative z-10 flex w-full flex-col p-5', featured && 'sm:w-[54%] sm:p-7')}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground [&>svg]:size-5">
              {tile.icon}
            </span>
            <span className="flex items-center gap-2">
              {tile.badge && <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase text-secondary-foreground">{tile.badge}</span>}
              {isDisabled ? <Lock className="size-4 text-muted-foreground" /> : <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />}
            </span>
          </div>
          <h3 className={cn('font-display text-lg font-bold text-foreground', featured && 'text-2xl sm:text-3xl')}>{tile.title}</h3>
          <p className={cn('mt-2 max-w-md text-xs leading-relaxed text-muted-foreground', featured && 'text-sm')}>{tile.description}</p>
          {featured && (
            <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-md bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              Studio öffnen <ArrowRight className="size-3.5" />
            </span>
          )}
        </div>
        {tile.image && (
          <div className={cn('relative mt-auto h-28 w-full overflow-hidden border-t border-border/70', featured && 'sm:absolute sm:inset-y-0 sm:right-0 sm:h-full sm:w-[46%] sm:border-l sm:border-t-0')}>
            <img src={tile.image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/15 to-transparent" />
          </div>
        )}
      </Button>
    );
  };

  const hero = availableTiles.find((tile) => tile.id === 'studio');
  const backgroundSwap = availableTiles.find((tile) => tile.id === 'background-swap');
  const remainingPhotoTiles = availableTiles.filter((tile) => tile.group === 'fahrzeugbilder' && tile.id !== 'studio' && tile.id !== 'background-swap');
  const remainingTiles = availableTiles.filter((tile) => tile.group !== 'fahrzeugbilder');

  return (
    <div className="space-y-8 pb-8">
      <header className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase text-primary">
            <Wand2 className="size-3.5" /> autohaus.ai Generator
          </div>
          <h1 className="max-w-3xl font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">Was möchten Sie heute erstellen?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Fahrzeugbilder, Videos, Anzeigen und Verkaufsunterlagen – zentral mit KI erstellen.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3">
          <Coins className="size-4 text-primary" />
          <span className="text-xs text-muted-foreground">Guthaben</span>
          <strong className="text-sm text-foreground">{balance} Credits</strong>
        </div>
      </header>

      <section aria-labelledby="generator-photo-tools" className="space-y-4">
        <div>
          <h2 id="generator-photo-tools" className="font-display text-xl font-bold text-foreground">Fahrzeugbilder</h2>
          <p className="text-xs text-muted-foreground">Aufnahmen optimieren und neue Perspektiven erstellen</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {hero && <div className="lg:col-span-8">{renderTool(hero, true)}</div>}
          {backgroundSwap && <div className="lg:col-span-4">{renderTool(backgroundSwap)}</div>}
          {remainingPhotoTiles.map((tile) => <div key={tile.id} className="lg:col-span-6">{renderTool(tile)}</div>)}
        </div>
      </section>

      <section aria-labelledby="generator-more-tools" className="space-y-4">
        <div>
          <h2 id="generator-more-tools" className="font-display text-xl font-bold text-foreground">Weitere Werkzeuge</h2>
          <p className="text-xs text-muted-foreground">Werbung, Verkaufsseiten, Analyse und Beratung</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {remainingTiles.map((tile) => renderTool(tile))}
        </div>
      </section>

      <div className="flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Ergebnisse stehen automatisch für passende Folgeaktionen bereit.</span>
        <span className="inline-flex items-center gap-2 font-semibold text-foreground"><span className="size-2 rounded-full bg-primary" /> Systeme verfügbar</span>
      </div>
    </div>
  );
};

export default ActionHub;