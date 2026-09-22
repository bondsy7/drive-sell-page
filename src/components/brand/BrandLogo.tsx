import brandLogo from '@/assets/brand/autohaus-ai-logo.png.asset.json';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
}

export default function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      src={brandLogo.url}
      alt="autohaus.ai"
      className={cn('h-7 w-auto object-contain', className)}
    />
  );
}