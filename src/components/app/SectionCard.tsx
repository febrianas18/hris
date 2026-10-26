import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCENT_STYLES, type Accent } from '@/components/app/accents';

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  accent?: Accent;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Kerangka panel dashboard: header tipis dengan garis pemisah,
 * lalu area isi. Semua panel memakai radius, border, dan bayangan yang sama
 * supaya irama visual antar blok konsisten.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  accent = 'primary',
  action,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <section
      className={cn(
        'clay-card flex flex-col overflow-hidden',
        styles.surface,
        className
      )}
    >
      <header
        className={cn(
          'flex flex-wrap items-start justify-between gap-3 border-b border-white/60 bg-gradient-to-r px-5 py-4',
          styles.header
        )}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon ? (
            <span
              aria-hidden="true"
              className={cn(
                'clay-tile mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl',
                styles.tile
              )}
            >
              <Icon className="size-4" strokeWidth={1.9} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="font-heading text-[15px] font-extrabold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      <div className={cn('flex-1', bodyClassName ?? 'px-5 py-5')}>{children}</div>
    </section>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="clay-inset flex flex-col items-center justify-center border border-white/60 px-4 py-8 text-center">
      <span
        aria-hidden="true"
        className="clay-tile flex size-11 items-center justify-center rounded-xl bg-white/60 text-muted-foreground"
      >
        <Icon className="size-5" strokeWidth={1.6} />
      </span>
      <p className="mt-3 text-xs font-bold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-[32ch] text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
