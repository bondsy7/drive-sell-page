import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Eye, Check, X } from "lucide-react";

export interface PresetData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  prompt_secret: string;
  type: string;
  example_preview_url: string | null;
  example_images: Array<{ before?: string; after: string; label?: string }>;
  requires_user_template: boolean;
  requires_premium_model: boolean;
  premium_reason: string | null;
  allowed_aspect_ratios: string[];
}

interface PresetSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPreset: (preset: PresetData) => void;
  selectedPresetId?: string;
}

export default function PresetSelectionModal({
  open,
  onOpenChange,
  onSelectPreset,
  selectedPresetId,
}: PresetSelectionModalProps) {
  const [presets, setPresets] = useState<PresetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [previewImages, setPreviewImages] = useState<Array<{ before?: string; after: string }> | null>(null);

  useEffect(() => {
    if (open) loadPresets();
  }, [open]);

  const loadPresets = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("presets")
        .select("*")
        .eq("active", true)
        .order("display_order")
        .order("name");
      
      if (data) {
        const mapped = data.map((p: any) => ({
          ...p,
          example_images: (p.example_images as any[]) || [],
        })) as PresetData[];
        setPresets(mapped);
        const uniqueCats = Array.from(new Set(mapped.map(p => p.category).filter(Boolean)));
        setCategories(uniqueCats);
      }
    } catch (error) {
      console.error("Error loading presets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (preset: PresetData) => {
    onSelectPreset(preset);
    onOpenChange(false);
  };

  const filteredPresets = selectedCategory
    ? presets.filter(p => p.category === selectedCategory)
    : presets;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[85vh] max-h-[750px] p-0 flex flex-col">
          <div className="sr-only">
            <DialogTitle>Preset auswählen</DialogTitle>
            <DialogDescription>Wähle eine Vorlage für deine Bildbearbeitung</DialogDescription>
          </div>

          <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="p-4 md:p-6 border-b bg-background/95 backdrop-blur shrink-0">
              <h3 className="font-display font-semibold text-lg mb-1">Preset auswählen</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Wähle eine Vorlage für deine Bildbearbeitung
              </p>
              {categories.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  <Button
                    variant={selectedCategory === null ? "default" : "outline"}
                    onClick={() => setSelectedCategory(null)}
                    size="sm"
                    className="shrink-0"
                  >
                    Alle
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      onClick={() => setSelectedCategory(category)}
                      size="sm"
                      className="shrink-0"
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Preset List */}
            <div className="flex-1 overflow-y-auto p-3 md:p-6 min-h-0">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Card key={i} className="h-24 md:h-28 animate-pulse bg-muted" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPresets.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    const previewImage = preset.example_preview_url ||
                      (preset.example_images.length > 0 ? preset.example_images[0].after : null);

                    return (
                      <Card
                        key={preset.id}
                        className={`relative overflow-hidden cursor-pointer transition-all hover:shadow-lg group ${
                          isSelected ? "ring-2 ring-accent shadow-lg" : "hover:border-accent/50"
                        }`}
                        onClick={() => handlePresetClick(preset)}
                      >
                        <div className="flex gap-3 md:gap-4 p-3 md:p-4">
                          {previewImage && (
                            <div className="relative w-20 h-20 md:w-28 md:h-28 shrink-0 bg-muted rounded-lg overflow-hidden">
                              <img
                                src={previewImage}
                                alt={preset.name}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                              {isSelected && (
                                <div className="absolute top-1 left-1">
                                  <Badge className="bg-accent text-accent-foreground text-xs px-1.5 py-0.5">
                                    <Check className="w-3 h-3" />
                                  </Badge>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className="font-semibold text-sm md:text-base leading-tight">
                                {preset.name}
                              </h3>
                              <Sparkles className="w-4 h-4 text-accent shrink-0" />
                            </div>
                            {preset.description && (
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                {preset.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-[10px]">
                                {preset.category}
                              </Badge>
                              {preset.requires_premium_model && (
                                <Badge className="bg-accent/10 text-accent text-[10px]">Premium</Badge>
                              )}
                              {preset.example_images.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-2 text-[10px]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewImages(preset.example_images);
                                  }}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  {preset.example_images.length} Beispiele
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {!loading && filteredPresets.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                  <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm">Keine Presets verfügbar</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Example Preview Dialog */}
      {previewImages && (
        <Dialog open={!!previewImages} onOpenChange={() => setPreviewImages(null)}>
          <DialogContent className="max-w-3xl">
            <DialogTitle>Beispielbilder</DialogTitle>
            <DialogDescription>Vorher/Nachher Vergleiche</DialogDescription>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
              {previewImages.map((img, i) => (
                <div key={i} className="space-y-2">
                  {img.before && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Vorher</p>
                      <img src={img.before} alt="Vorher" className="w-full rounded-lg" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nachher</p>
                    <img src={img.after} alt="Nachher" className="w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
