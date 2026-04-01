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

export default function BannersTab({ banners, onDownload, onDelete }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);

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
        {banners.map((banner, i) => (
          <div
            key={banner.name}
            className="bg-card rounded-xl border border-border overflow-hidden group cursor-pointer"
            onClick={() => setLightboxIndex(i)}
          >
            <div className="aspect-video bg-muted overflow-hidden">
              <img src={banner.url} alt={banner.name} className="w-full h-full object-cover" />
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
        ))}
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
