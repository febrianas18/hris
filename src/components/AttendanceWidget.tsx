'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { StatusPill } from '@/components/app/StatusPill';
import { cn } from '@/lib/utils';

interface AttendanceData {
  id: string;
  tanggal: string;
  jam_masuk: string;
  jam_pulang: string | null;
  status: 'hadir' | 'terlambat';
}

interface ServerTimeInfo {
  dateStr: string;
  timeStr: string;
  fullDisplayStr: string;
  weekdayStr: string;
  isWeekend: boolean;
  hour: number;
  minute: number;
  second: number;
  isBetween06And12: boolean;
  statusKehadiran: 'hadir' | 'terlambat';
  timestamptzStr: string;
}

interface AttendanceStatusResponse {
  success: boolean;
  serverTime: ServerTimeInfo;
  attendance: AttendanceData | null;
  holiday: { tanggal: string; keterangan: string; jenis: string } | null;
  activeLeave: { id: string; jenis: string; tanggal_mulai: string; tanggal_selesai: string } | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
  blockReason: string | null;
}

export default function AttendanceWidget({
  onStatusChange,
}: {
  onStatusChange?: () => void;
}) {
  const [data, setData] = useState<AttendanceStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<'check-in' | 'check-out' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Jam berjalan di sisi klien yang diselaraskan dengan server time WIB
  const [displayTime, setDisplayTime] = useState<string>('');
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/check-in', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const json: AttendanceStatusResponse = await res.json();
        setData(json);

        // Hitung selisih waktu antara jam lokal client dan server WIB
        if (json.serverTime?.timestamptzStr) {
          const serverDateObj = new Date(json.serverTime.timestamptzStr).getTime();
          const localDateObj = Date.now();
          setClockOffsetMs(serverDateObj - localDateObj);
        }
      }
    } catch (err) {
      console.error('Gagal memuat status absensi:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Muat status setelah render pertama selesai agar tidak memicu render berantai.
    const loadStatus = async () => {
      await fetchStatus();
    };
    void loadStatus();
  }, [fetchStatus]);

  // Update tampilan jam setiap detik diselaraskan dengan waktu WIB
  useEffect(() => {
    const timer = setInterval(() => {
      const nowWIB = new Date(Date.now() + clockOffsetMs);
      const formatter = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setDisplayTime(formatter.format(nowWIB));
    }, 1000);

    return () => clearInterval(timer);
  }, [clockOffsetMs]);

  const handleCheckIn = async () => {
    setFeedback(null);
    setIsSubmitting('check-in');
    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const resData = await res.json();

      if (res.ok && resData.success) {
        setFeedback({
          type: 'success',
          message: resData.message || 'Check-in berhasil tercatat!',
        });
        await fetchStatus();
        onStatusChange?.();
      } else {
        setFeedback({
          type: 'error',
          message: resData.error || 'Gagal melakukan check-in.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Koneksi ke server gagal. Silakan coba beberapa saat lagi.',
      });
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleCheckOut = async () => {
    setFeedback(null);
    setIsSubmitting('check-out');
    try {
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const resData = await res.json();

      if (res.ok && resData.success) {
        setFeedback({
          type: 'success',
          message: resData.message || 'Check-out berhasil dicatat!',
        });
        await fetchStatus();
        onStatusChange?.();
      } else {
        setFeedback({
          type: 'error',
          message: resData.error || 'Gagal melakukan check-out.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Koneksi ke server gagal. Silakan coba beberapa saat lagi.',
      });
    } finally {
      setIsSubmitting(null);
    }
  };

  const formatTimeOnly = (isoString: string | null) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d);
    } catch {
      return '-';
    }
  };

  if (isLoading) {
    return (
      <div
        className="clay-card flex min-h-[260px] flex-col justify-center gap-4 bg-[#d9f5e8] p-5"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Memuat status absensi server…</span>
        <div className="flex items-center justify-between">
          <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-24 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-16 animate-pulse rounded-xl bg-muted/70" />
        <div className="h-9 animate-pulse rounded-xl bg-muted/70" />
      </div>
    );
  }

  const attendance = data?.attendance;
  const isCheckedIn = Boolean(attendance);

  return (
    <section
      aria-labelledby="attendance-widget-title"
      className="clay-card relative flex flex-col overflow-hidden bg-[#d9f5e8]"
    >
      {/* Header: label, status ringkas, dan jam server WIB */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p
            id="attendance-widget-title"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Absensi Hari Ini
          </p>
          <p className="mt-1 truncate font-heading text-sm font-semibold text-foreground">
            {isCheckedIn
              ? attendance?.jam_pulang
                ? 'Sesi kerja selesai'
                : 'Sedang bekerja'
              : 'Belum check-in'}
          </p>
        </div>

        <div className="clay-inset flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold text-muted-foreground tabular-nums">
          <Clock aria-hidden="true" className="size-3 text-primary" />
          <span>{displayTime ? `${displayTime} WIB` : `${data?.serverTime?.timeStr ?? '--:--:--'} WIB`}</span>
        </div>
      </div>

      {/* Isi utama */}
      <div className="mt-4 flex-1 px-5">
        {attendance ? (
          <>
            <div className="clay-inset grid grid-cols-2 divide-x divide-white/60 overflow-hidden">
              <div className="bg-primary/[0.06] px-3.5 py-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <LogIn aria-hidden="true" className="size-3 text-primary" /> Masuk
                </p>
                <p className="mt-1 font-heading text-xl font-extrabold text-foreground tabular-nums">
                  {formatTimeOnly(attendance.jam_masuk)}
                </p>
              </div>
              <div className="bg-info/[0.06] px-3.5 py-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <LogOut aria-hidden="true" className="size-3 text-info" /> Pulang
                </p>
                <p
                  className={cn(
                    'mt-1 font-heading text-xl font-extrabold tabular-nums',
                    attendance.jam_pulang ? 'text-foreground' : 'text-muted-foreground/60'
                  )}
                >
                  {attendance.jam_pulang ? formatTimeOnly(attendance.jam_pulang) : '--:--'}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill kind="attendance" status={attendance.status} />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {attendance.jam_pulang
                  ? 'Catatan kehadiran hari ini sudah lengkap.'
                  : 'Check-out dapat dilakukan hingga 23.59 WIB.'}
              </p>
            </div>
          </>
        ) : (
          <div>
            <p className="font-mono text-[26px] leading-none font-semibold text-foreground tabular-nums">
              {displayTime || data?.serverTime?.timeStr || '--:--:--'}
              <span className="ml-1 font-sans text-xs font-medium text-muted-foreground">WIB</span>
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {data?.blockReason ? (
                <>
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-chart-5" />
                  <span>{data.blockReason}</span>
                </>
              ) : (
                <span>Jendela check-in 06.00–12.00 WIB · batas jam masuk 08.15 WIB.</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Tombol aksi */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 px-5 pb-5">
        <button
          id="btn-attendance-check-in"
          type="button"
          onClick={handleCheckIn}
          disabled={!data?.canCheckIn || isSubmitting !== null}
          className={cn(
            'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all duration-200',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            data?.canCheckIn && isSubmitting === null
              ? 'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-sm hover:from-primary/90 hover:to-primary/80 active:translate-y-px'
              : 'cursor-not-allowed border border-border/70 bg-muted text-muted-foreground/60'
          )}
        >
          {isSubmitting === 'check-in' ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <LogIn aria-hidden="true" className="size-4" />
          )}
          <span>Check-in</span>
        </button>

        <button
          id="btn-attendance-check-out"
          type="button"
          onClick={handleCheckOut}
          disabled={!data?.canCheckOut || isSubmitting !== null}
          className={cn(
            'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all duration-200',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            data?.canCheckOut && isSubmitting === null
              ? 'border border-border bg-gradient-to-b from-card to-muted/40 text-foreground shadow-xs hover:to-muted active:translate-y-px'
              : 'cursor-not-allowed border border-border/70 bg-muted text-muted-foreground/60'
          )}
        >
          {isSubmitting === 'check-out' ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <LogOut aria-hidden="true" className="size-4" />
          )}
          <span>Check-out</span>
        </button>
      </div>

      {/* Feedback aksi */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'mx-5 mb-5 flex items-start gap-2.5 rounded-xl border p-3 text-xs animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none',
            feedback.type === 'success'
              ? 'border-primary/25 bg-gradient-to-r from-primary/15 to-primary/5 text-primary'
              : 'border-destructive/25 bg-gradient-to-r from-destructive/15 to-destructive/5 text-destructive'
          )}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          )}
          <span className="flex-1 leading-relaxed">{feedback.message}</span>
        </div>
      )}
    </section>
  );
}
