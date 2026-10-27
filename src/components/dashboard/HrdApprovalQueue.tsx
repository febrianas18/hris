'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Inbox,
  Loader2,
  X,
} from 'lucide-react';
import BentoCard from '@/components/dashboard/BentoCard';
import type { HrdQueueItem } from '@/components/dashboard/types';
import { cn } from '@/lib/utils';

interface HrdApprovalQueueProps {
  initialItems: HrdQueueItem[];
  initialPendingCount: number;
  className?: string;
}

type Feedback = { type: 'success' | 'error'; message: string };

const JENIS_META: Record<string, { label: string; className: string }> = {
  cuti_tahunan: {
    label: 'Cuti tahunan',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/25',
  },
  sakit: {
    label: 'Sakit',
    className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/25',
  },
  izin: {
    label: 'Izin',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/25',
  },
};

function getInitials(name: string) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function formatShortDate(dateString: string) {
  if (!dateString) return '-';
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(year, month - 1, day));
  } catch {
    return dateString;
  }
}

export default function HrdApprovalQueue({
  initialItems,
  initialPendingCount,
  className,
}: HrdApprovalQueueProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!rejectingId) return;
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [rejectingId]);

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setPendingCount((current) => Math.max(0, current - 1));
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    setFeedback(null);
    setRejectingId(null);
    setFormError(null);

    try {
      const res = await fetch('/api/leave/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pengajuan_id: id }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        removeItem(id);
        setFeedback({ type: 'success', message: json.message || 'Pengajuan disetujui.' });
        router.refresh();
      } else {
        setFeedback({
          type: 'error',
          message: json.error || 'Persetujuan gagal diproses.',
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Koneksi ke server gagal. Coba lagi.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rejectingId) return;

    if (reason.trim().length < 10) {
      setFormError('Alasan penolakan wajib minimal 10 karakter.');
      return;
    }

    setProcessingId(rejectingId);
    setFormError(null);
    setFeedback(null);

    try {
      const res = await fetch('/api/leave/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pengajuan_id: rejectingId,
          alasan_penolakan: reason.trim(),
        }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        removeItem(rejectingId);
        setRejectingId(null);
        setReason('');
        setFeedback({ type: 'success', message: json.message || 'Pengajuan ditolak.' });
        router.refresh();
      } else {
        setFormError(json.error || 'Penolakan gagal diproses.');
      }
    } catch {
      setFormError('Koneksi ke server gagal. Coba lagi.');
    } finally {
      setProcessingId(null);
    }
  };

  const openReject = (id: string) => {
    setRejectingId(id);
    setReason('');
    setFormError(null);
    setFeedback(null);
  };

  return (
    <BentoCard
      title="Antrean Keputusan Persetujuan"
      icon={Inbox}
      accent="amber"
      className={cn('w-full', className)}
      bodyClassName="flex flex-col px-0 pb-0 pt-0"
      action={
        <span
          className="dash-count-badge"
          aria-label={`${pendingCount} pengajuan menunggu keputusan`}
        >
          {pendingCount}
        </span>
      }
    >
      {feedback ? (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={cn(
            'mx-4 mt-4 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-5 sm:mx-5',
            feedback.type === 'success'
              ? 'bg-[#e7f8f1] text-[#0b6b53]'
              : 'bg-[#fff0f2] text-[#b4233c]'
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

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/25">
            <CheckCircle2 aria-hidden="true" className="size-5" strokeWidth={1.8} />
          </span>
          <p className="mt-3 text-sm font-bold text-foreground">Antrean bersih</p>
          <p className="mt-1 max-w-[28ch] text-xs leading-5 text-muted-foreground">
            Semua pengajuan cuti dan izin sudah diputuskan.
          </p>
        </div>
      ) : (
        <ul className="mt-1 flex-1 divide-y divide-amber-200/50 dark:divide-amber-900/30">
          {items.map((item) => {
            const meta = JENIS_META[item.jenis] || {
              label: item.jenis,
              className: 'bg-muted text-foreground ring-border',
            };
            const isProcessing = processingId === item.id;
            const isRejecting = rejectingId === item.id;

            return (
              <li key={item.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[11px] font-extrabold text-amber-800 dark:text-amber-200 ring-1 ring-inset ring-amber-500/25"
                  >
                    {getInitials(item.karyawan_nama)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-extrabold leading-5 text-foreground">
                          {item.karyawan_nama}
                        </p>
                        <p className="truncate text-[11px] leading-4 text-muted-foreground">
                          {item.divisi_nama} · <span className="font-mono text-foreground/80">{item.karyawan_nik}</span>
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                          meta.className
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[11px] font-medium text-foreground/80 tabular-nums">
                      {formatShortDate(item.tanggal_mulai)} – {formatShortDate(item.tanggal_selesai)}
                      <span className="mx-1.5 opacity-60">·</span>
                      {item.jumlah_hari} hari
                    </p>

                    {item.alasan ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                        “{item.alasan}”
                      </p>
                    ) : null}

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(item.id)}
                        disabled={isProcessing}
                        aria-label={`Setujui pengajuan ${item.karyawan_nama}`}
                        className="dash-approve-btn"
                      >
                        {isProcessing ? (
                          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                        ) : (
                          <Check aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
                        )}
                        Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => openReject(item.id)}
                        disabled={isProcessing}
                        aria-expanded={isRejecting}
                        aria-controls={`reject-form-${item.id}`}
                        aria-label={`Tolak pengajuan ${item.karyawan_nama}`}
                        className="dash-reject-btn"
                      >
                        <X aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
                        Tolak
                      </button>
                      {isProcessing ? (
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          Memproses...
                        </span>
                      ) : null}
                    </div>

                    {isRejecting ? (
                      <form
                        id={`reject-form-${item.id}`}
                        onSubmit={handleReject}
                        noValidate
                        className="mt-3 rounded-xl bg-background/90 p-3 ring-1 ring-inset ring-amber-200/80 dark:ring-amber-900/50 shadow-xs"
                      >
                        <label
                          htmlFor={`reject-reason-${item.id}`}
                          className="text-[11px] font-bold text-foreground"
                        >
                          Alasan penolakan
                        </label>
                        <textarea
                          ref={textareaRef}
                          id={`reject-reason-${item.id}`}
                          value={reason}
                          onChange={(event) => {
                            setReason(event.target.value);
                            if (formError) setFormError(null);
                          }}
                          rows={2}
                          minLength={10}
                          required
                          placeholder="Tuliskan alasan yang jelas, minimal 10 karakter..."
                          className="dash-reject-textarea mt-1.5 bg-background text-foreground placeholder:text-muted-foreground border-border"
                          aria-describedby={`reject-hint-${item.id}`}
                        />
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span
                            id={`reject-hint-${item.id}`}
                            className={cn(
                              'text-[10px] font-semibold tabular-nums',
                              reason.trim().length >= 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            )}
                          >
                            {reason.trim().length}/10 karakter
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setReason('');
                                setFormError(null);
                              }}
                              className="dash-cancel-btn"
                            >
                              Batal
                            </button>
                            <button
                              type="submit"
                              disabled={isProcessing}
                              className="dash-confirm-reject-btn"
                            >
                              {isProcessing ? (
                                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                              ) : null}
                              Kirim penolakan
                            </button>
                          </div>
                        </div>
                        {formError ? (
                          <p role="alert" className="mt-2 text-[10px] font-semibold leading-4 text-rose-600 dark:text-rose-400">
                            {formError}
                          </p>
                        ) : null}
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto border-t border-amber-200/50 dark:border-amber-900/30 px-4 py-3 sm:px-5">
        <Link
          href="/persetujuan"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-200"
        >
          Buka semua persetujuan
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </BentoCard>
  );
}
