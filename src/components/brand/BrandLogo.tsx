import brandLogo from '@/assets/brand/autohaus-ai-logo.svg';
import brandLogoLight from '@/assets/brand/autohaus-ai-logo-light.svg';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  /** 'dark' = dark wordmark for light surfaces (default), 'light' = white wordmark for dark surfaces */
  tone?: 'dark' | 'light';
}

export default function BrandLogo({ className, tone = 'dark' }: BrandLogoProps) {
  return (
    <img
      src={tone === 'light' ? brandLogoLight : brandLogo}
      alt="autohaus.ai"
      className={cn('h-7 w-auto object-contain', className)}
    />
  );
}
