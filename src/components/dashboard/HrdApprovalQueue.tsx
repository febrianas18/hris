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
}

type Feedback = { type: 'success' | 'error'; message: string };

const JENIS_META: Record<string, { label: string; className: string }> = {
  cuti_tahunan: {
    label: 'Cuti tahunan',
    className: 'bg-[#eaf4ff] text-[#1559a8] ring-[#cfe3fb]',
  },
  sakit: {
    label: 'Sakit',
    className: 'bg-[#fff0f2] text-[#b4233c] ring-[#f6cbd2]',
  },
  izin: {
    label: 'Izin',
    className: 'bg-[#fff6e8] text-[#a86300] ring-[#f8dfb3]',
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
      title="Antrean keputusan"
      description={
        pendingCount > 0
          ? `${pendingCount} pengajuan menunggu keputusan akhir HRD`
          : 'Tidak ada pengajuan yang menunggu'
      }
      eyebrow="Persetujuan"
      icon={Inbox}
      accent="amber"
      className="h-full xl:col-span-5"
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
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#e7f8f1] text-[#0b6b53]">
            <CheckCircle2 aria-hidden="true" className="size-5" strokeWidth={1.8} />
          </span>
          <p className="mt-3 text-sm font-bold text-[#162033]">Antrean bersih</p>
          <p className="mt-1 max-w-[28ch] text-xs leading-5 text-[#64748b]">
            Semua pengajuan cuti dan izin sudah diputuskan.
          </p>
        </div>
      ) : (
        <ul className="mt-1 flex-1 divide-y divide-[#edf3fa]">
          {items.map((item) => {
            const meta = JENIS_META[item.jenis] || {
              label: item.jenis,
              className: 'bg-[#f1f5f9] text-[#475569] ring-[#e2e8f0]',
            };
            const isProcessing = processingId === item.id;
            const isRejecting = rejectingId === item.id;

            return (
              <li key={item.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#eaf4ff,#d7eaff)] text-[11px] font-extrabold text-[#1559a8] ring-1 ring-inset ring-[#cfe3fb]"
                  >
                    {getInitials(item.karyawan_nama)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-extrabold leading-5 text-[#162033]">
                          {item.karyawan_nama}
                        </p>
                        <p className="truncate text-[11px] leading-4 text-[#64748b]">
                          {item.divisi_nama} · <span className="font-mono">{item.karyawan_nik}</span>
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

                    <p className="mt-1.5 text-[11px] font-medium text-[#475569] tabular-nums">
                      {formatShortDate(item.tanggal_mulai)} – {formatShortDate(item.tanggal_selesai)}
                      <span className="mx-1.5 text-[#cbd5e1]">·</span>
                      {item.jumlah_hari} hari
                    </p>

                    {item.alasan ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#64748b]">
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
                        <span className="text-[10px] font-semibold text-[#64748b]">
                          Memproses...
                        </span>
                      ) : null}
                    </div>

                    {isRejecting ? (
                      <form
                        id={`reject-form-${item.id}`}
                        onSubmit={handleReject}
                        noValidate
                        className="mt-3 rounded-xl bg-[#fff8f9] p-3 ring-1 ring-inset ring-[#f6cbd2]"
                      >
                        <label
                          htmlFor={`reject-reason-${item.id}`}
                          className="text-[11px] font-bold text-[#8f1d32]"
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
                          className="dash-reject-textarea mt-1.5"
                          aria-describedby={`reject-hint-${item.id}`}
                        />
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span
                            id={`reject-hint-${item.id}`}
                            className={cn(
                              'text-[10px] font-semibold tabular-nums',
                              reason.trim().length >= 10 ? 'text-[#0b6b53]' : 'text-[#8f1d32]'
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
                          <p role="alert" className="mt-2 text-[10px] font-semibold leading-4 text-[#b4233c]">
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

      <div className="mt-auto border-t border-[#edf3fa] px-4 py-3 sm:px-5">
        <Link
          href="/persetujuan"
          className="dash-inline-link inline-flex items-center gap-1.5 text-[11px] font-bold"
        >
          Buka semua persetujuan
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </BentoCard>
  );
}
