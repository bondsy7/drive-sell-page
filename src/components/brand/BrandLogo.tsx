import brandLogo from '@/assets/brand/autohaus-ai-logo.svg';
import brandLogoLight from '@/assets/brand/autohaus-ai-logo-light.svg';
import animatedLogo from '@/assets/brand/autohaus-ai-logo-loop.gif.asset.json';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  /** 'dark' = dark wordmark for light surfaces (default), 'light' = white wordmark for dark surfaces */
  tone?: 'dark' | 'light';
  animated?: boolean;
}

export default function BrandLogo({ className, tone = 'dark', animated = false }: BrandLogoProps) {
  if (animated && tone === 'dark') {
    return (
      <span className={cn('relative block h-7 w-[150px] shrink-0', className)}>
        <img
          src={animatedLogo.url}
          alt="autohaus.ai"
          className="absolute left-0 top-[-17.6px] w-[152.2px] max-w-none mix-blend-multiply"
        />
      </span>
    );
  }
  return (
    <img
      src={tone === 'light' ? brandLogoLight : brandLogo}
      alt="autohaus.ai"
      className={cn('h-7 w-auto object-contain', className)}
    />
  );
}
