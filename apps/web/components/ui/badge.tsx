import type { BadgeTone } from '@gc/ui';
import { cn } from '@/lib/utils';

const TONS: Record<BadgeTone, string> = {
  ok: 'bg-success-bg text-success',
  warn: 'bg-warning-bg text-warning',
  info: 'bg-info-bg text-info',
  bad: 'bg-danger-bg text-danger',
  neu: 'bg-neutral-bg text-ink-2',
};

export function Badge({ tom = 'neu', className, children }: { tom?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold',
        TONS[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}
