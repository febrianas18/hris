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
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  className,
}: {
  onStatusChange?: () => void;
  className?: string;
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
      <Card
        className={cn(
          'flex min-h-[220px] flex-col justify-between border-border/80 shadow-xs',
          className
        )}
        aria-busy="true"
        aria-live="polite"
      >
        <CardHeader className="pb-2">
          <div className="space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="h-16 w-full animate-pulse rounded-xl bg-muted/60" />
          <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted/40" />
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-0">
          <div className="h-10 w-full sm:w-36 animate-pulse rounded-lg bg-muted" />
          <div className="h-10 w-full sm:w-36 animate-pulse rounded-lg bg-muted" />
        </CardFooter>
      </Card>
    );
  }

  const attendance = data?.attendance;
  const isCheckedIn = Boolean(attendance);

  return (
    <Card
      aria-labelledby="attendance-widget-title"
      className={cn(
        'dash-soft-blue-card relative flex flex-col justify-between overflow-hidden rounded-2xl text-foreground shadow-xs p-0',
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-blue-500/10 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full border border-blue-500/5"
      />
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#3b82f6,#60a5fa)]" />
      <CardHeader className="relative z-10 pb-2 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <p
            id="attendance-widget-title"
            className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400"
          >
            Presensi Hari Ini
          </p>
          <CardTitle className="mt-0.5 truncate text-base font-bold text-foreground">
            {isCheckedIn
              ? attendance?.jam_pulang
                ? 'Sesi Kerja Selesai'
                : 'Sedang Bekerja'
              : 'Belum Check-in'}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 flex-1 space-y-3 pt-1 px-5 sm:px-6">
        {attendance ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-background/80 backdrop-blur-xs p-2.5 w-full sm:max-w-xs shrink-0">
              <div className="rounded-lg bg-emerald-500/10 p-2.5 border border-emerald-500/25">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <LogIn aria-hidden="true" className="size-3 text-emerald-600 dark:text-emerald-400" /> Masuk
                </p>
                <p className="mt-1 font-mono text-xl font-bold text-foreground tabular-nums">
                  {formatTimeOnly(attendance.jam_masuk)}
                </p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2.5 border border-blue-500/25">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  <LogOut aria-hidden="true" className="size-3 text-blue-600 dark:text-blue-400" /> Pulang
                </p>
                <p
                  className={cn(
                    'mt-1 font-mono text-xl font-bold tabular-nums text-foreground',
                    !attendance.jam_pulang && 'opacity-50'
                  )}
                >
                  {attendance.jam_pulang ? formatTimeOnly(attendance.jam_pulang) : '--:--'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1.5 min-w-0">
              <StatusPill kind="attendance" status={attendance.status} />
              <p className="text-xs text-muted-foreground leading-relaxed sm:text-right">
                {attendance.jam_pulang
                  ? 'Catatan kehadiran hari ini sudah lengkap.'
                  : 'Check-out dapat dilakukan hingga 23.59 WIB.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-background/80 backdrop-blur-xs p-3.5">
            <p className="font-mono text-2xl font-bold text-foreground tabular-nums">
              {displayTime || data?.serverTime?.timeStr || '--:--:--'}
              <span className="ml-1.5 font-sans text-xs font-semibold text-muted-foreground">WIB</span>
            </p>
            <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {data?.blockReason ? (
                <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span>{data.blockReason}</span>
                </div>
              ) : (
                <p>Jendela check-in 06.00–12.00 WIB · batas toleransi jam masuk 08.15 WIB.</p>
              )}
            </div>
          </div>
        )}

        {/* Feedback aksi */}
        {feedback && (
          <Alert
            role="status"
            aria-live="polite"
            variant={feedback.type === 'success' ? 'default' : 'destructive'}
            className={cn(
              'py-2 px-3 text-xs',
              feedback.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                : 'border-rose-500/40 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
            )}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle aria-hidden="true" className="size-4" />
            )}
            <AlertDescription className="text-xs font-medium">
              {feedback.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="relative z-10 flex flex-wrap items-center gap-2.5 pt-2 px-5 pb-5 sm:px-6 sm:pb-6">
        <Button
          id="btn-attendance-check-in"
          type="button"
          onClick={handleCheckIn}
          disabled={!data?.canCheckIn || isSubmitting !== null}
          className="h-10 flex-1 sm:flex-initial sm:w-36 cursor-pointer font-bold shadow-xs bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50"
        >
          {isSubmitting === 'check-in' ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin mr-1.5" />
          ) : (
            <LogIn aria-hidden="true" className="size-4 mr-1.5" />
          )}
          <span>Check-in</span>
        </Button>

        <Button
          id="btn-attendance-check-out"
          type="button"
          variant="outline"
          onClick={handleCheckOut}
          disabled={!data?.canCheckOut || isSubmitting !== null}
          className="h-10 flex-1 sm:flex-initial sm:w-36 cursor-pointer font-bold shadow-xs border-border bg-background hover:bg-muted text-foreground disabled:opacity-50"
        >
          {isSubmitting === 'check-out' ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin mr-1.5" />
          ) : (
            <LogOut aria-hidden="true" className="size-4 mr-1.5" />
          )}
          <span>Check-out</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
