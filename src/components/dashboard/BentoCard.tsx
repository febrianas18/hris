import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BentoAccent = 'blue' | 'green' | 'amber' | 'coral' | 'violet';

const ACCENT_BAR: Record<BentoAccent, string> = {
  blue: 'bg-[linear-gradient(90deg,#4099ff,#73b4ff)]',
  green: 'bg-[linear-gradient(90deg,#0e7a5f,#2ed8b6)]',
  amber: 'bg-[linear-gradient(90deg,#b45309,#ffb64d)]',
  coral: 'bg-[linear-gradient(90deg,#b4233c,#ff8ba0)]',
  violet: 'bg-[linear-gradient(90deg,#5b46b8,#a99ff0)]',
};

const ACCENT_DOT: Record<BentoAccent, string> = {
  blue: 'bg-[#1f6fd0]',
  green: 'bg-[#0e7a5f]',
  amber: 'bg-[#b45309]',
  coral: 'bg-[#b4233c]',
  violet: 'bg-[#5b46b8]',
};

const ACCENT_TILE: Record<BentoAccent, string> = {
  blue: 'bg-[#eaf4ff] text-[#1f6fd0]',
  green: 'bg-[#e7f8f1] text-[#0b6b53]',
  amber: 'bg-[#fff4df] text-[#a86300]',
  coral: 'bg-[#fff0f2] text-[#b4233c]',
  violet: 'bg-[#f2eeff] text-[#5b46b8]',
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
    <section className={cn('dash-card relative flex flex-col overflow-hidden', className)}>
      <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-[3px]', ACCENT_BAR[accent])} />

      <header className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="dash-eyebrow">
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', ACCENT_DOT[accent])} />
              {eyebrow}
            </p>
          ) : null}
          <h2 className="dash-card-title mt-1">{title}</h2>
          {description ? <p className="dash-card-description">{description}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {action}
          {Icon ? (
            <span className={cn('dash-icon-tile', ACCENT_TILE[accent])}>
              <Icon aria-hidden="true" className="size-4" strokeWidth={1.9} />
            </span>
          ) : null}
        </div>
      </header>

      <div className={cn('flex-1 px-5 pb-5 pt-4 sm:px-6 sm:pb-6', bodyClassName)}>{children}</div>
    </section>
  );
}
