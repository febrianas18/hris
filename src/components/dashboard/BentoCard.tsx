import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BentoAccent = 'blue' | 'green' | 'amber' | 'coral' | 'violet';

const ACCENT_BAR: Record<BentoAccent, string> = {
  blue: 'bg-[linear-gradient(90deg,#3b82f6,#60a5fa)]',
  green: 'bg-[linear-gradient(90deg,#10b981,#34d399)]',
  amber: 'bg-[linear-gradient(90deg,#f59e0b,#fbbf24)]',
  coral: 'bg-[linear-gradient(90deg,#ef4444,#f87171)]',
  violet: 'bg-[linear-gradient(90deg,#6366f1,#818cf8)]',
};

const ACCENT_DOT: Record<BentoAccent, string> = {
  blue: 'bg-blue-600',
  green: 'bg-emerald-600',
  amber: 'bg-amber-600',
  coral: 'bg-rose-600',
  violet: 'bg-indigo-600',
};

const ACCENT_TILE: Record<BentoAccent, string> = {
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/25',
  green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/25',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/25',
  coral: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-500/25',
  violet: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-500/25',
};

const ACCENT_SURFACE: Record<BentoAccent, string> = {
  blue: 'dash-soft-blue-card',
  green: 'dash-soft-emerald-card',
  amber: 'dash-soft-amber-card',
  coral: 'dash-soft-rose-card',
  violet: 'dash-soft-indigo-card',
};

interface BentoCardProps {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  accent?: BentoAccent;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export default function BentoCard({
  title,
  description,
  eyebrow,
  icon: Icon,
  accent = 'blue',
  action,
  children,
  className,
  bodyClassName,
}: BentoCardProps) {
  return (
    <section className={cn('dash-card relative flex flex-col overflow-hidden rounded-2xl shadow-xs', ACCENT_SURFACE[accent], className)}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-white/40 dark:bg-white/5 blur-2xl"
      />
      <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-[3px]', ACCENT_BAR[accent])} />

      <header className="relative z-10 flex items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', ACCENT_DOT[accent])} />
              {eyebrow}
            </p>
          ) : null}
          <h2 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground mt-0.5">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground mt-0.5">{description}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {action}
          {Icon ? (
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl shadow-2xs', ACCENT_TILE[accent])}>
              <Icon aria-hidden="true" className="size-4" strokeWidth={1.9} />
            </span>
          ) : null}
        </div>
      </header>

      <div className={cn('relative z-10 flex-1 px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4', bodyClassName)}>{children}</div>
    </section>
  );
}
