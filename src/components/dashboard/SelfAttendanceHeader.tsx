'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  LogIn,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttendanceRecord {
  id: string;
  tanggal: string;
  jam_masuk: string;
  jam_pulang: string | null;
  status: 'hadir' | 'terlambat';
}

interface AttendanceResponse {
  success: boolean;
  serverTime?: {
    dateStr: string;
    timeStr: string;
    timestamptzStr: string;
  };
  attendance?: AttendanceRecord | null;
  canCheckIn?: boolean;
  canCheckOut?: boolean;
  blockReason?: string | null;
  activeLeave?: { id: string; jenis: string } | null;
  error?: string;
}

interface SelfAttendanceHeaderProps {
  initialTime: string;
  dateLabel: string;
}

function formatTimeOnly(isoString: string | null) {
  if (!isoString) return '--:--';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(isoString));
  } catch {
    return '--:--';
  }
}

export default function SelfAttendanceHeader({
  initialTime,
  dateLabel,
}: SelfAttendanceHeaderProps) {
  const router = useRouter();
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'check-in' | 'check-out' | null>(null);
  const [displayTime, setDisplayTime] = useState(initialTime || '--:--:--');
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/check-in', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const json: AttendanceResponse = await res.json();

      if (!mountedRef.current) return;

      if (res.ok && json.success) {
        setData(json);
        if (json.serverTime?.timestamptzStr) {
          setClockOffsetMs(new Date(json.serverTime.timestamptzStr).getTime() - Date.now());
        }
      } else {
        setFeedback({
          type: 'error',
          message: json.error || 'Status presensi tidak dapat dimuat.',
        });
      }
    } catch {
      if (mountedRef.current) {
        setFeedback({
          type: 'error',
          message: 'Status presensi tidak dapat dimuat. Periksa koneksi Anda.',
        });
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Sinkronisasi status presensi dilakukan sekali setelah mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStatus();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchStatus]);

  useEffect(() => {
    const tick = () => {
      const nowWIB = new Date(Date.now() + clockOffsetMs);
      setDisplayTime(
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(nowWIB)
      );
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [clockOffsetMs]);

  const handleSubmit = async (action: 'check-in' | 'check-out') => {
    setSubmitting(action);
    setFeedback(null);

    try {
      const res = await fetch(`/api/attendance/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setFeedback({
          type: 'success',
          message: json.message || (action === 'check-in' ? 'Check-in tercatat.' : 'Check-out tercatat.'),
        });
        await fetchStatus();
        router.refresh();
      } else {
        setFeedback({
          type: 'error',
          message: json.error || 'Aksi presensi gagal diproses.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Koneksi ke server gagal. Coba lagi beberapa saat lagi.',
      });
    } finally {
      setSubmitting(null);
    }
  };

  const attendance = data?.attendance;
  const isCheckedIn = Boolean(attendance);
  const isCheckedOut = Boolean(attendance?.jam_pulang);
  const action = isCheckedIn ? (isCheckedOut ? null : 'check-out') : 'check-in';
  const checkInUnavailable = !isLoading && action === 'check-in' && !data?.canCheckIn;
  const checkOutUnavailable = !isLoading && action === 'check-out' && !data?.canCheckOut;
  const actionDisabled =
    isLoading ||
    submitting !== null ||
    (action === 'check-in' ? !data?.canCheckIn : action === 'check-out' ? !data?.canCheckOut : true);

  const statusLabel = isLoading
    ? 'Memuat status'
    : isCheckedOut
      ? 'Sesi selesai'
      : isCheckedIn
        ? 'Sedang bekerja'
        : 'Belum check-in';

  const statusDetail = attendance
    ? `Masuk ${formatTimeOnly(attendance.jam_masuk)}${attendance.jam_pulang ? ` · Pulang ${formatTimeOnly(attendance.jam_pulang)}` : ' · check-out belum tercatat'}`
    : data?.blockReason || 'Jendela check-in 06.00–12.00 WIB. Batas tepat waktu 08.15 WIB.';

  return (
    <section
      aria-labelledby="self-attendance-title"
      className="self-attendance-panel relative z-10"
    >
      <div className="flex items-center justify-between gap-3">
        <p id="self-attendance-title" className="flex items-center gap-2 text-[11px] font-bold text-white/[0.75]">
          <span aria-hidden="true" className="live-dot" />
          Presensi mandiri
        </p>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[10px] font-bold',
            isCheckedOut
              ? 'bg-[#2ed8b6]/20 text-[#9ff5e1]'
              : isCheckedIn
                ? 'bg-white/[0.12] text-white/[0.85]'
                : 'bg-white/10 text-white/[0.70]'
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <p className="font-heading text-[2rem] font-extrabold leading-none tracking-tight text-white tabular-nums sm:text-[2.35rem]">
          {displayTime}
          <span className="ml-1.5 align-middle text-[11px] font-bold tracking-normal text-white/[0.70]">WIB</span>
        </p>
        <p className="flex items-center gap-1.5 pb-1 text-[11px] font-medium text-white/[0.75]">
          <Clock3 aria-hidden="true" className="size-3.5" strokeWidth={1.9} />
          {dateLabel}
        </p>
      </div>

      <p
        className="mt-2 min-h-8 text-[11px] leading-5 text-white/[0.70]"
        aria-live="polite"
      >
        {statusDetail}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {action ? (
          <button
            type="button"
            onClick={() => handleSubmit(action)}
            disabled={actionDisabled}
            title={!actionDisabled ? undefined : data?.blockReason || undefined}
            className={cn(
              'dash-hero-btn-primary',
              actionDisabled && 'cursor-not-allowed'
            )}
          >
            {submitting === action ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : action === 'check-in' ? (
              <LogIn aria-hidden="true" className="size-4" strokeWidth={2} />
            ) : (
              <LogOut aria-hidden="true" className="size-4" strokeWidth={2} />
            )}
            {submitting === action
              ? 'Memproses...'
              : action === 'check-in'
                ? checkInUnavailable
                  ? 'Check-in belum tersedia'
                  : 'Check-in sekarang'
                : checkOutUnavailable
                  ? 'Check-out belum tersedia'
                  : 'Check-out sekarang'}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2ed8b6]/15 px-3 py-1.5 text-[11px] font-bold text-[#9ff5e1] ring-1 ring-inset ring-[#2ed8b6]/25">
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
            Presensi hari ini lengkap
          </span>
        )}

        {isCheckedIn && !isCheckedOut ? (
          <span className="text-[11px] font-medium text-white/[0.70]">
            Pulang dapat dicatat hingga 23.59 WIB
          </span>
        ) : null}
      </div>

      {feedback ? (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={cn(
            'mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-5',
            feedback.type === 'success'
              ? 'bg-[#2ed8b6]/12 text-[#b9f9e8]'
              : 'bg-[#ff5370]/15 text-[#ffd1da]'
          )}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          )}
          {feedback.message}
        </div>
      ) : null}
    </section>
  );
}
