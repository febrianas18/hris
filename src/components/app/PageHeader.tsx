import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCENT_STYLES, type Accent } from '@/components/app/accents';

interface PageHeaderProps {
  /** Label kecil di atas judul, mis. nama modul atau konteks peran. */
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Aksen warna modul; membantu pengguna mengenali konteks halaman. */
  accent?: Accent;
  /** Baris informasi tambahan: tanggal, NIK, jumlah data, dsb. */
  meta?: ReactNode;
  /** Tombol aksi utama di sisi kanan. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Header halaman standar: eyebrow, judul, deskripsi singkat, dan aksi.
 * Dipakai konsisten di seluruh modul agar pengguna selalu tahu
 * "sedang di mana" dan "bisa melakukan apa".
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  accent = 'primary',
  meta,
  actions,
  className,
}: PageHeaderProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wider ring-1 ring-inset',
              styles.soft
            )}
          >
            <span aria-hidden="true" className={cn('size-1.5 rounded-full', styles.dot)} />
            {eyebrow}
          </span>
        ) : null}

        <div className={cn('flex items-center gap-3', eyebrow && 'mt-3')}>
          {Icon ? (
            <span
              aria-hidden="true"
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl shadow-2xs',
                styles.tile
              )}
            >
              <Icon className="size-5" strokeWidth={1.9} />
            </span>
          ) : null}
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-[30px]">
            {title}
          </h1>
        </div>

        {description ? (
          <p className="mt-2.5 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {description}
          </p>
        ) : null}

        {meta ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>
      ) : null}
    </header>
  );
}

export function MetaDot() {
  return <span aria-hidden="true" className="size-1 rounded-full bg-border" />;
}
