/**
 * Peta aksen warna bersama untuk kartu metrik, panel, dan header.
 *
 * Setiap aksen membawa empat peran visual:
 * - `bar`    : gradasi aksen di bagian atas kartu
 * - `tile`   : kotak ikon pastel dengan bayangan clay
 * - `surface`: warna pastel utama kartu
 * - `header` : sapuan header panel yang lebih pekat
 * - `soft`   : pill label lembut
 *
 * Semua class ditulis literal agar terdeteksi pemindai Tailwind.
 */
export type Accent = 'primary' | 'info' | 'warning' | 'danger' | 'neutral' | 'success';

export interface AccentStyle {
  bar: string;
  tile: string;
  surface: string;
  header: string;
  soft: string;
  dot: string;
}

export const ACCENT_STYLES: Record<Accent, AccentStyle> = {
  primary: {
    bar: 'from-primary to-primary/60',
    tile: 'bg-primary/10 text-primary',
    surface: 'bg-card border-border/80',
    header: 'bg-muted/20 border-border/60',
    soft: 'bg-primary/10 text-primary ring-primary/20',
    dot: 'bg-primary',
  },
  success: {
    bar: 'from-emerald-600 to-teal-500',
    tile: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    surface: 'bg-card border-border/80',
    header: 'bg-muted/20 border-border/60',
    soft: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  info: {
    bar: 'from-blue-600 to-indigo-500',
    tile: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    surface: 'bg-card border-border/80',
    header: 'bg-muted/20 border-border/60',
    soft: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/20',
    dot: 'bg-blue-600',
  },
  warning: {
    bar: 'from-amber-500 to-orange-500',
    tile: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    surface: 'bg-card border-border/80',
    header: 'bg-muted/20 border-border/60',
    soft: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20',
    dot: 'bg-amber-500',
  },
  danger: {
    bar: 'from-rose-500 to-red-500',
    tile: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    surface: 'bg-card border-border/80',
    header: 'bg-muted/20 border-border/60',
    soft: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20',
    dot: 'bg-rose-500',
  },
  neutral: {
    bar: 'from-slate-600 to-slate-400',
    tile: 'bg-muted text-muted-foreground',
    surface: 'bg-card border-border/80',
    header: 'bg-muted/20 border-border/60',
    soft: 'bg-muted text-muted-foreground ring-border',
    dot: 'bg-muted-foreground',
  },
};
