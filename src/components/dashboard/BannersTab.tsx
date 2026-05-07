import { useState } from 'react';
import { LayoutGrid, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type BannerFile } from './types';
import BannerLightbox from './BannerLightbox';

interface Props {
  banners: BannerFile[];
  onDownload: (banner: BannerFile) => void;
  onDelete: (fullPath: string, name: string) => void;
}

interface FormatInfo {
  platform: string;
  ratio: string;
  size: string;
}

function detectFormat(w: number, h: number): FormatInfo {
  const r = w / h;
  // Find closest known format
  const formats: Array<{ platform: string; ratio: string; value: number }> = [
    { platform: 'Instagram Story / Reel', ratio: '9:16', value: 9 / 16 },
    { platform: 'Instagram Post', ratio: '1:1', value: 1 },
    { platform: 'Instagram Portrait', ratio: '4:5', value: 4 / 5 },
    { platform: 'Facebook Feed', ratio: '1.91:1', value: 1.91 },
    { platform: 'Facebook Cover', ratio: '16:9', value: 16 / 9 },
    { platform: 'YouTube / Web Banner', ratio: '16:9', value: 16 / 9 },
    { platform: 'Web Banner', ratio: '21:9', value: 21 / 9 },
    { platform: 'Mobilebanner', ratio: '3:2', value: 3 / 2 },
    { platform: 'Print Hochformat', ratio: '2:3', value: 2 / 3 },
    { platform: 'Print', ratio: '4:3', value: 4 / 3 },
    { platform: 'Print Hochformat', ratio: '3:4', value: 3 / 4 },
  ];
  let best = formats[0];
  let bestDiff = Math.abs(Math.log(r / best.value));
  for (const f of formats) {
    const d = Math.abs(Math.log(r / f.value));
    if (d < bestDiff) { bestDiff = d; best = f; }
  }
  return { platform: best.platform, ratio: best.ratio, size: `${w}×${h}` };
}

export default function BannersTab({ banners, onDownload, onDelete }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [formats, setFormats] = useState<Record<string, FormatInfo>>({});

  if (banners.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <LayoutGrid className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Noch keine Banner generiert.</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">Generierte Banner aus dem Banner Generator werden hier automatisch gespeichert.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banners.map((banner, i) => {
          const fmt = formats[banner.name];
          return (
            <div
              key={banner.name}
              className="bg-card rounded-xl border border-border overflow-hidden group cursor-pointer"
              onClick={() => setLightboxIndex(i)}
            >
              <div className="relative aspect-video bg-muted overflow-hidden">
                <img
                  src={banner.url}
                  alt={banner.name}
                  className="w-full h-full object-cover"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (!formats[banner.name] && img.naturalWidth && img.naturalHeight) {
                      setFormats((prev) => ({
                        ...prev,
                        [banner.name]: detectFormat(img.naturalWidth, img.naturalHeight),
                      }));
                    }
                  }}
                />
                {fmt && (
                  <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                    <span className="px-2 py-0.5 rounded-md bg-foreground/85 text-background text-[10px] font-medium backdrop-blur-sm">
                      {fmt.platform}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-background/90 text-foreground text-[10px] font-mono backdrop-blur-sm border border-border">
                      {fmt.ratio} · {fmt.size}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {banner.created_at ? new Date(banner.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Banner'}
                </p>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onDownload(banner); }}><Download className="w-3.5 h-3.5" /></Button>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(banner.fullPath, banner.name); }}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BannerLightbox
        banners={banners}
        initialIndex={lightboxIndex}
        open={lightboxIndex >= 0}
        onClose={() => setLightboxIndex(-1)}
        onDownload={onDownload}
        onDelete={(fullPath, name) => {
          onDelete(fullPath, name);
          if (banners.length <= 1) {
            setLightboxIndex(-1);
          } else if (lightboxIndex >= banners.length - 1) {
            setLightboxIndex(0);
          }
        }}
      />
    </>
  );
}
