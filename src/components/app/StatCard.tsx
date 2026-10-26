import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCENT_STYLES, type Accent } from '@/components/app/accents';

export type StatAccent = Accent;

interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon: LucideIcon;
  accent?: StatAccent;
  footer?: ReactNode;
  action?: { href: string; label: string };
  className?: string;
}

/**
 * Kartu metrik tunggal. Angka memakai tabular-nums agar kolom angka
 * sejajar dan mudah dibandingkan saat dipindai. Warna aksen + elevasi
 * membantu membedakan jenis informasi tanpa harus membaca semuanya.
 */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  accent = 'primary',
  footer,
  action,
  className,
}: StatCardProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <div
      className={cn(
        'clay-card clay-lift group relative flex flex-col overflow-hidden',
        styles.surface,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 p-5 pb-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', styles.dot)} />
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            'clay-tile flex size-10 shrink-0 items-center justify-center rounded-xl',
            styles.tile
          )}
        >
          <Icon className="size-[19px]" strokeWidth={1.9} />
        </span>
      </div>

      <div className="mt-3 flex-1 px-5 pb-5">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="font-heading text-[32px] leading-none font-extrabold tracking-tight text-foreground tabular-nums">
            {value}
          </span>
          {unit ? <span className="text-xs font-semibold text-muted-foreground">{unit}</span> : null}
        </div>
        {hint ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}

        {footer ? <div className="mt-4">{footer}</div> : null}

        {action ? (
          <Link
            href={action.href}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {action.label}
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

interface MeterProps {
  value: number;
  max: number;
  label: string;
  tone?: 'primary' | 'warning' | 'info' | 'danger';
}

const METER_FILL: Record<NonNullable<MeterProps['tone']>, string> = {
  primary: 'from-primary to-primary/70',
  warning: 'from-chart-3 to-chart-2',
  info: 'from-info to-info/70',
  danger: 'from-destructive to-destructive/70',
};

/** Batang progres tipis dengan label aksesibel (tidak hanya mengandalkan warna). */
export function Meter({ value, max, label, tone = 'primary' }: MeterProps) {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.min(100, Math.max(0, Math.round((value / safeMax) * 100)));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${percent}%`}
      className="clay-inset h-2 w-full overflow-hidden rounded-full bg-white/45"
    >
      <div
        className={cn(
          'h-full rounded-full bg-gradient-to-r transition-[width] duration-500',
          METER_FILL[tone]
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
