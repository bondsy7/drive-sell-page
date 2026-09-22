import brandLogo from '@/assets/brand/autohaus-ai-logo.png';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
}

export default function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      src={brandLogo}
      alt="autohaus.ai"
      className={cn('h-7 w-auto object-contain', className)}
    />
  );
}