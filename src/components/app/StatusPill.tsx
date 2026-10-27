import { cn } from '@/lib/utils';

export type LeaveStatus =
  | 'disetujui'
  | 'disetujui_atasan'
  | 'diajukan'
  | 'ditolak'
  | 'dibatalkan'
  | string;

export type AttendanceStatus = 'hadir' | 'terlambat' | 'alpa' | 'cuti' | 'izin' | string;

const LEAVE_STYLES: Record<string, { label: string; className: string; dot: string }> = {
  disetujui: {
    label: 'Disetujui',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30 border border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  disetujui_atasan: {
    label: 'Disetujui Atasan',
    className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 ring-indigo-500/30 border border-indigo-500/20',
    dot: 'bg-indigo-500',
  },
  diajukan: {
    label: 'Diajukan',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30 border border-amber-500/20',
    dot: 'bg-amber-500',
  },
  ditolak: {
    label: 'Ditolak',
    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 ring-rose-500/30 border border-rose-500/20',
    dot: 'bg-rose-500',
  },
  dibatalkan: {
    label: 'Dibatalkan',
    className: 'bg-muted text-muted-foreground ring-border border border-border',
    dot: 'bg-muted-foreground/40',
  },
};

const ATTENDANCE_STYLES: Record<string, { label: string; className: string; dot: string }> = {
  hadir: {
    label: 'Hadir',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30 border border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  terlambat: {
    label: 'Terlambat',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30 border border-amber-500/20',
    dot: 'bg-amber-500',
  },
  alpa: {
    label: 'Tanpa Keterangan',
    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 ring-rose-500/30 border border-rose-500/20',
    dot: 'bg-rose-500',
  },
  absen: {
    label: 'Tidak Absen',
    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 ring-rose-500/30 border border-rose-500/20',
    dot: 'bg-rose-500',
  },
  cuti: {
    label: 'Cuti',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-500/30 border border-blue-500/20',
    dot: 'bg-blue-500',
  },
  izin: {
    label: 'Izin',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-500/30 border border-blue-500/20',
    dot: 'bg-blue-500',
  },
  sakit: {
    label: 'Sakit',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-500/30 border border-blue-500/20',
    dot: 'bg-blue-500',
  },
};

interface StatusPillProps {
  status: LeaveStatus;
  kind?: 'leave' | 'attendance';
  className?: string;
}

/**
 * Label status seragam: titik penanda + teks, sehingga status
 * tetap terbaca tanpa mengandalkan warna saja.
 */
export function StatusPill({ status, kind = 'leave', className }: StatusPillProps) {
  const map = kind === 'leave' ? LEAVE_STYLES : ATTENDANCE_STYLES;
  const style =
    map[status] ?? {
      label: status,
      className: 'bg-muted text-muted-foreground ring-border',
      dot: 'bg-muted-foreground/50',
    };

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        style.className,
        className
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}
