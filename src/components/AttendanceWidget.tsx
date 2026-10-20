'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

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
    fetchStatus();
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
      setDisplayTime(`${formatter.format(nowWIB)} WIB`);
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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex items-center justify-center min-h-[160px]">
        <div className="flex items-center gap-2.5 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span>Memuat status absensi server...</span>
        </div>
      </div>
    );
  }

  const attendance = data?.attendance;
  const isCheckedIn = Boolean(attendance);
  const isCheckedOut = Boolean(attendance?.jam_pulang);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md">
      {/* Header Widget */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Absensi Hari Ini
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
            Server WIB
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
          <Clock className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
          <span>{displayTime || data?.serverTime?.timeStr + ' WIB'}</span>
        </div>
      </div>

      {/* Status Utama */}
      <div className="mt-4">
        {attendance ? (
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Check-in {formatTimeOnly(attendance.jam_masuk)}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
                  attendance.status === 'hadir'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {attendance.status === 'hadir' ? 'Hadir' : 'Terlambat'}
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-1">
              {attendance.jam_pulang ? (
                <span className="text-emerald-700 font-medium">
                  Selesai kerja · Check-out pada pukul{' '}
                  <strong className="font-semibold">{formatTimeOnly(attendance.jam_pulang)} WIB</strong>
                </span>
              ) : (
                <span>Check-out bisa dilakukan sampai pukul 23.59 WIB</span>
              )}
            </p>
          </div>
        ) : (
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-800">
              Belum Check-in
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {data?.blockReason ? (
                <span className="text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" />
                  {data.blockReason}
                </span>
              ) : (
                <span>Jendela check-in: 06.00 s/d 12.00 WIB (Batas jam masuk 08.15 WIB)</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Tombol Aksi Check-in & Check-out */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button
          id="btn-attendance-check-in"
          type="button"
          onClick={handleCheckIn}
          disabled={!data?.canCheckIn || isSubmitting !== null}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all ${
            data?.canCheckIn && isSubmitting === null
              ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white shadow-sm shadow-indigo-200 cursor-pointer'
              : 'bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed opacity-60'
          }`}
        >
          {isSubmitting === 'check-in' ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          <span>Check-in</span>
        </button>

        <button
          id="btn-attendance-check-out"
          type="button"
          onClick={handleCheckOut}
          disabled={!data?.canCheckOut || isSubmitting !== null}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all ${
            data?.canCheckOut && isSubmitting === null
              ? 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-sm shadow-blue-200 cursor-pointer'
              : 'bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed opacity-60'
          }`}
        >
          {isSubmitting === 'check-out' ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          <span>Check-out</span>
        </button>
      </div>

      {/* Banner Notifikasi Pesan Feedback */}
      {feedback && (
        <div
          className={`mt-4 p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 leading-relaxed">{feedback.message}</span>
        </div>
      )}
    </div>
  );
}
