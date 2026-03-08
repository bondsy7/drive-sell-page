import { Zap } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { Link } from 'react-router-dom';

export default function CreditBadge() {
  const { balance, loading } = useCredits();

  if (loading) return null;

  return (
    <Link
      to="/pricing"
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors bg-accent/15 text-accent hover:bg-accent/25"
    >
      <Zap className="w-3 h-3" />
      <span>{balance}</span>
    </Link>
  );
}
