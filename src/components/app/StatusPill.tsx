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
    className: 'bg-primary/10 text-primary ring-primary/25',
    dot: 'bg-primary',
  },
  disetujui_atasan: {
    label: 'Tahap HRD',
    className: 'bg-info/10 text-info ring-info/25',
    dot: 'bg-info',
  },
  diajukan: {
    label: 'Menunggu',
    className: 'bg-chart-2/15 text-chart-5 ring-chart-2/35',
    dot: 'bg-chart-2',
  },
  ditolak: {
    label: 'Ditolak',
    className: 'bg-destructive/10 text-destructive ring-destructive/25',
    dot: 'bg-destructive',
  },
  dibatalkan: {
    label: 'Dibatalkan',
    className: 'bg-muted text-muted-foreground ring-border',
    dot: 'bg-muted-foreground/40',
  },
};

const ATTENDANCE_STYLES: Record<string, { label: string; className: string; dot: string }> = {
  hadir: {
    label: 'Hadir',
    className: 'bg-primary/10 text-primary ring-primary/25',
    dot: 'bg-primary',
  },
  terlambat: {
    label: 'Terlambat',
    className: 'bg-chart-2/15 text-chart-5 ring-chart-2/40',
    dot: 'bg-chart-2',
  },
  alpa: {
    label: 'Tanpa Keterangan',
    className: 'bg-destructive/10 text-destructive ring-destructive/25',
    dot: 'bg-destructive',
  },
  cuti: {
    label: 'Cuti',
    className: 'bg-info/10 text-info ring-info/25',
    dot: 'bg-info',
  },
  izin: {
    label: 'Izin',
    className: 'bg-info/10 text-info ring-info/25',
    dot: 'bg-info',
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
        'clay-pill inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        style.className,
        className
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}
