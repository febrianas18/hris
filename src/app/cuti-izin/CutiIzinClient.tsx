'use client';

import React, { useState, useMemo, useRef } from 'react';
import { calculateWorkingDays, HolidayItem } from '@/utils/workingDays';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  Plus,
  Upload,
  X,
  Search,
  Paperclip,
  Check,
  ArrowRight,
  Info,
  Trash2,
} from 'lucide-react';
import { PageHeader, MetaDot } from '@/components/app/PageHeader';
import { StatCard, Meter } from '@/components/app/StatCard';
import { StatusPill } from '@/components/app/StatusPill';
import { FormField } from '@/components/app/FormField';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface LeaveRequestRecord {
  id: string;
  karyawan_id: string;
  jenis: 'cuti_tahunan' | 'sakit' | 'izin';
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_hari: number;
  alasan: string;
  lampiran_path: string | null;
  status: 'diajukan' | 'disetujui_atasan' | 'disetujui' | 'ditolak' | 'dibatalkan';
  perlu_atasan: boolean;
  disetujui_atasan_pada: string | null;
  diputuskan_hrd_pada: string | null;
  alasan_penolakan: string | null;
  dibatalkan_pada: string | null;
  dibuat_pada: string;
}

interface KuotaCuti {
  tahun: number;
  jatah_hari: number;
  terpakai_hari: number;
}

interface CutiIzinClientProps {
  currentUserId: string;
  currentUserRole: string;
  tanggalMasuk: string;
  kuotaCuti: KuotaCuti | null;
  holidays: HolidayItem[];
  initialLeaves: LeaveRequestRecord[];
  todayStr: string;
}

/**
 * Komponen mini-stepper horizontal untuk indikator timeline alur persetujuan:
 * Diajukan -> Atasan (Tahap 1) -> HRD (Tahap 2)
 */
function ApprovalTimeline({ item }: { item: LeaveRequestRecord }) {
  // Step 1: Pengajuan (Karyawan)
  // Step 2: Atasan
  // Step 3: HRD
  const isCancelled = item.status === 'dibatalkan';
  const isRejected = item.status === 'ditolak';
  const isApproved = item.status === 'disetujui';
  const isAtasanApproved = item.status === 'disetujui_atasan' || isApproved;
  const rejectedAtHRD = isRejected && Boolean(item.disetujui_atasan_pada);
  const rejectedAtAtasan = isRejected && !item.disetujui_atasan_pada;

  if (isCancelled) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
        <span className="flex size-4 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Ban className="size-2.5" />
        </span>
        <span>Dibatalkan oleh pemohon</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-0.5">
      <div className="flex items-center gap-1 text-[11px]">
        {/* Step 1: Diajukan */}
        <span
          className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
          title="Diajukan oleh Karyawan"
        >
          <Check className="size-2.5 stroke-[2.5]" />
        </span>

        <span className="h-0.5 w-3 bg-border" />

        {/* Step 2: Atasan */}
        {!item.perlu_atasan ? (
          <span
            className="flex items-center text-[10px] text-muted-foreground font-medium"
            title="Langsung ke HRD (tidak memerlukan atasan)"
          >
            [Bypass]
          </span>
        ) : isAtasanApproved ? (
          <span
            className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
            title="Telah disetujui Atasan"
          >
            <Check className="size-2.5 stroke-[2.5]" />
          </span>
        ) : rejectedAtAtasan ? (
          <span
            className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold"
            title="Ditolak oleh Atasan"
          >
            <X className="size-2.5 stroke-[2.5]" />
          </span>
        ) : (
          <span
            className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 animate-pulse font-bold"
            title="Menunggu Persetujuan Atasan (Tahap 1)"
          >
            <span className="size-1.5 rounded-full bg-amber-500" />
          </span>
        )}

        <span className="h-0.5 w-3 bg-border" />

        {/* Step 3: HRD */}
        {isApproved ? (
          <span
            className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
            title="Disetujui HRD (Final)"
          >
            <Check className="size-2.5 stroke-[2.5]" />
          </span>
        ) : rejectedAtHRD ? (
          <span
            className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold"
            title="Ditolak oleh HRD"
          >
            <X className="size-2.5 stroke-[2.5]" />
          </span>
        ) : item.status === 'disetujui_atasan' || (!item.perlu_atasan && item.status === 'diajukan') ? (
          <span
            className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-600 animate-pulse font-bold"
            title="Menunggu Keputusan HRD (Tahap 2)"
          >
            <span className="size-1.5 rounded-full bg-indigo-500" />
          </span>
        ) : (
          <span
            className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground/50 text-[9px] font-bold"
            title="Antrean tahap berikutnya"
          >
            3
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {item.status === 'diajukan' && item.perlu_atasan && (
          <span className="text-amber-600 dark:text-amber-400 font-medium">Verifikasi Atasan</span>
        )}
        {item.status === 'diajukan' && !item.perlu_atasan && (
          <span className="text-indigo-600 dark:text-indigo-400 font-medium">Verifikasi HRD</span>
        )}
        {item.status === 'disetujui_atasan' && (
          <span className="text-indigo-600 dark:text-indigo-400 font-medium">Verifikasi HRD</span>
        )}
        {item.status === 'disetujui' && (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Disetujui Penuh</span>
        )}
        {item.status === 'ditolak' && (
          <span className="text-rose-600 dark:text-rose-400 font-medium">
            {rejectedAtHRD ? 'Ditolak HRD' : 'Ditolak Atasan'}
          </span>
        )}
      </div>
    </div>
  );
}

export default function CutiIzinClient({
  tanggalMasuk,
  kuotaCuti: initialKuota,
  holidays,
  initialLeaves,
  todayStr,
}: CutiIzinClientProps) {
  const [leaves, setLeaves] = useState<LeaveRequestRecord[]>(initialLeaves);
  const [kuota, setKuota] = useState<KuotaCuti | null>(initialKuota);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [jenis, setJenis] = useState<'cuti_tahunan' | 'sakit' | 'izin'>('cuti_tahunan');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [alasan, setAlasan] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter State
  const [statusFilter, setStatusFilter] = useState<string>('semua');
  const [jenisFilter, setJenisFilter] = useState<string>('semua');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Pembatalan
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedLeaveToCancel, setSelectedLeaveToCancel] = useState<LeaveRequestRecord | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sisa Kuota Cuti
  const jatahHari = kuota?.jatah_hari ?? 12;
  const terpakaiHari = kuota?.terpakai_hari ?? 0;
  const sisaKuota = Math.max(0, jatahHari - terpakaiHari);

  // Kalkulasi hari kerja real-time menggunakan fungsi calculateWorkingDays (BR-04, BR-05)
  const workingDaysCalc = useMemo(() => {
    if (!tanggalMulai || !tanggalSelesai) return null;
    return calculateWorkingDays(tanggalMulai, tanggalSelesai, holidays);
  }, [tanggalMulai, tanggalSelesai, holidays]);

  const formatDateDisplay = (dateString: string) => {
    try {
      const parts = dateString.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return dateString;
    }
  };

  // Validasi Aturan BR-05 secara proaktif
  const ruleFeedback = useMemo(() => {
    if (!workingDaysCalc || !workingDaysCalc.isValid || !tanggalMulai) return null;

    const startDate = new Date(tanggalMulai);
    const today = new Date(todayStr);
    const diffTime = startDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (jenis === 'cuti_tahunan') {
      if (diffDays < 3) {
        return {
          type: 'warning',
          message: 'Pengajuan cuti tahunan sebaiknya dilakukan minimal H-3 kalender sebelum tanggal mulai.',
        };
      }
      if (workingDaysCalc.workingDays > sisaKuota) {
        return {
          type: 'error',
          message: `Sisa kuota cuti tahunan tidak mencukupi (Sisa: ${sisaKuota} hari, Diajukan: ${workingDaysCalc.workingDays} hari).`,
        };
      }
    }

    if (jenis === 'izin') {
      if (workingDaysCalc.workingDays > 2) {
        return {
          type: 'error',
          message: 'Izin maksimal 2 hari kerja. Untuk keperluan lebih lama, silakan gunakan cuti tahunan.',
        };
      }
      if (diffDays < 1) {
        return {
          type: 'warning',
          message: 'Pengajuan izin sebaiknya dilakukan minimal H-1 kalender.',
        };
      }
    }

    if (jenis === 'sakit') {
      if (workingDaysCalc.workingDays > 1 && !fileToUpload) {
        return {
          type: 'error',
          message: 'Pengajuan sakit lebih dari 1 hari kerja wajib melampirkan surat keterangan dokter.',
        };
      }
    }

    return null;
  }, [workingDaysCalc, jenis, tanggalMulai, todayStr, sisaKuota, fileToUpload]);

  // Handle Drag & Drop Berkas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateAndSetFile = (file: File) => {
    setFileError(null);
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setFileError('Format berkas tidak didukung. Harap unggah PDF, JPG, atau PNG.');
      return;
    }
    const maxSizeBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSizeBytes) {
      setFileError(`Ukuran berkas (${(file.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal 2 MB.`);
      return;
    }
    setFileToUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // Submit Pengajuan Baru
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!workingDaysCalc || !workingDaysCalc.isValid) {
      setFormError(workingDaysCalc?.error || 'Rentang tanggal tidak valid.');
      return;
    }

    if (jenis === 'cuti_tahunan' && workingDaysCalc.workingDays > sisaKuota) {
      setFormError(`Sisa kuota cuti tahunan Anda tidak mencukupi (sisa: ${sisaKuota}, diminta: ${workingDaysCalc.workingDays} hari).`);
      return;
    }

    if (jenis === 'sakit' && workingDaysCalc.workingDays > 1 && !fileToUpload) {
      setFormError('Pengajuan sakit lebih dari 1 hari kerja wajib melampirkan surat dokter (PDF/JPG/PNG maksimal 2MB).');
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedFilePath: string | null = null;

      // Unggah surat dokter jika ada file
      if (fileToUpload) {
        setUploadingFile(true);
        const formData = new FormData();
        formData.append('file', fileToUpload);

        const uploadRes = await fetch('/api/leave/upload-medical', {
          method: 'POST',
          body: formData,
        });
        const uploadJson = await uploadRes.json();
        setUploadingFile(false);

        if (!uploadRes.ok || !uploadJson.success) {
          setFormError(uploadJson.error || 'Gagal mengunggah surat dokter.');
          setIsSubmitting(false);
          return;
        }
        uploadedFilePath = uploadJson.filePath;
      }

      // Kirim Pengajuan ke API
      const res = await fetch('/api/leave/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenis,
          tanggal_mulai: tanggalMulai,
          tanggal_selesai: tanggalSelesai,
          alasan: alasan.trim(),
          lampiran_path: uploadedFilePath,
        }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        setFormSuccess(resJson.message);
        setLeaves((prev) => [resJson.data, ...prev]);

        // Perbarui sisa kuota jika cuti tahunan
        if (jenis === 'cuti_tahunan') {
          setKuota((prev) =>
            prev
              ? { ...prev, terpakai_hari: prev.terpakai_hari + workingDaysCalc.workingDays }
              : null
          );
        }

        setTimeout(() => {
          setModalOpen(false);
          setTanggalMulai('');
          setTanggalSelesai('');
          setAlasan('');
          setFileToUpload(null);
          setFormSuccess(null);
        }, 1500);
      } else {
        setFormError(resJson.error || 'Gagal mengirim pengajuan.');
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Batalkan Pengajuan (BR-10)
  const handleCancel = async () => {
    if (!selectedLeaveToCancel) return;
    setCancelling(true);

    try {
      const res = await fetch('/api/leave/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pengajuan_id: selectedLeaveToCancel.id }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        setLeaves((prev) =>
          prev.map((l) => (l.id === selectedLeaveToCancel.id ? resJson.data : l))
        );

        // Jika cuti tahunan, kembalikan kuota di UI
        if (selectedLeaveToCancel.jenis === 'cuti_tahunan') {
          setKuota((prev) =>
            prev
              ? {
                  ...prev,
                  terpakai_hari: Math.max(0, prev.terpakai_hari - selectedLeaveToCancel.jumlah_hari),
                }
              : null
          );
        }

        setCancelModalOpen(false);
        setSelectedLeaveToCancel(null);
      } else {
        alert(resJson.error || 'Gagal membatalkan pengajuan.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setCancelling(false);
    }
  };

  // Filter Leaves
  const filteredLeaves = useMemo(() => {
    return leaves.filter((item) => {
      // Filter Status
      if (statusFilter === 'menunggu') {
        if (item.status !== 'diajukan' && item.status !== 'disetujui_atasan') return false;
      } else if (statusFilter !== 'semua' && item.status !== statusFilter) {
        return false;
      }

      // Filter Jenis
      if (jenisFilter !== 'semua' && item.jenis !== jenisFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchAlasan = item.alasan.toLowerCase().includes(query);
        const matchJenis = item.jenis.toLowerCase().includes(query);
        const matchTanggal =
          item.tanggal_mulai.includes(query) || item.tanggal_selesai.includes(query);
        if (!matchAlasan && !matchJenis && !matchTanggal) return false;
      }

      return true;
    });
  }, [leaves, statusFilter, jenisFilter, searchQuery]);

  const suratDokterWajib = Boolean(workingDaysCalc && workingDaysCalc.workingDays > 1);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        accent="info"
        title="Pengajuan Cuti, Sakit, & Izin"
        icon={CalendarDays}
        actions={
          <Button
            id="btn-open-ajukan-cuti"
            onClick={() => {
              setFormError(null);
              setFormSuccess(null);
              setModalOpen(true);
            }}
            className="gap-2 font-semibold shadow-xs"
          >
            <Plus className="size-4" strokeWidth={2} />
            <span>Buat Pengajuan Baru</span>
          </Button>
        }
      />

      {/* 3 Kartu Metrik Ringkas */}
      <section
        aria-label="Ringkasan kuota dan status pengajuan"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <div
          aria-label="Sisa Kuota Cuti"
          className="dash-leave-card relative flex flex-col justify-between overflow-hidden rounded-xl p-5 text-white shadow-2xs w-full h-full"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full border border-white/10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 top-10 size-24 rounded-full bg-[#2ed8b6]/15 blur-xl"
          />

          <div>
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[#2ed8b6]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
                  Sisa Kuota Cuti {kuota?.tahun ?? 2026}
                </p>
              </div>
              <span className="dash-icon-tile bg-white/10 text-[#8df1d8] ring-1 ring-inset ring-white/10">
                <CalendarDays aria-hidden="true" className="size-4" strokeWidth={1.9} />
              </span>
            </div>

            <div className="relative z-10 mt-3">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="font-heading font-mono text-3xl font-extrabold text-white tabular-nums">
                  {sisaKuota}
                </span>
                <span className="text-xs font-semibold text-white/90">
                  dari {jatahHari} hari (Maks. 12 hari/tahun)
                </span>
              </div>
              <p className="mt-1 text-xs text-white/80">
                {terpakaiHari} hari terpakai tahun ini
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-4 space-y-1.5 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-white/90">
              <span>Pemakaian kuota</span>
              <span className="font-mono tabular-nums font-bold text-white">
                {jatahHari > 0 ? Math.round((terpakaiHari / jatahHari) * 100) : 0}%
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={Math.max(jatahHari, 1)}
              aria-valuenow={terpakaiHari}
              aria-label="Pemakaian kuota cuti tahunan"
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#2ed8b6,#8df1d8)] transition-all duration-300"
                style={{
                  width: `${jatahHari > 0 ? Math.min(100, Math.round((terpakaiHari / jatahHari) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div
          aria-label="Total Riwayat Pengajuan"
          className="dash-soft-blue-card relative flex flex-col justify-between overflow-hidden rounded-xl p-5 shadow-2xs w-full h-full"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-blue-400/10 blur-xl"
          />
          <div>
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-blue-500" />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Total Riwayat Pengajuan
                </p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-2xs ring-1 ring-inset ring-blue-500/25">
                <FileCheck className="size-4.5" strokeWidth={1.9} />
              </span>
            </div>

            <div className="relative z-10 mt-3">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="font-heading font-mono text-3xl font-extrabold text-foreground tabular-nums">
                  {leaves.length}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">pengajuan</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {leaves.filter((l) => l.status === 'disetujui').length} disetujui · {leaves.filter((l) => l.status === 'diajukan' || l.status === 'disetujui_atasan').length} diproses
              </p>
            </div>
          </div>
        </div>

        <div
          aria-label="Tanggal Mulai Bekerja"
          className="dash-soft-amber-card relative flex flex-col justify-between overflow-hidden rounded-xl p-5 shadow-2xs w-full h-full"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-amber-400/10 blur-xl"
          />
          <div>
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Tanggal Mulai Bekerja
                </p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-2xs ring-1 ring-inset ring-amber-500/25">
                <Clock className="size-4.5" strokeWidth={1.9} />
              </span>
            </div>

            <div className="relative z-10 mt-3">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="font-heading font-mono text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums">
                  {formatDateDisplay(tanggalMasuk)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Terdaftar sebagai karyawan aktif
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabel Riwayat Pengajuan & Filter */}
      <Card className="dash-soft-indigo-card relative flex flex-col overflow-hidden rounded-2xl shadow-xs border border-indigo-200/60 dark:border-indigo-900/40">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 size-48 rounded-full bg-indigo-400/10 blur-2xl"
        />
        <CardHeader className="relative z-10 pb-3 border-b border-indigo-200/50 dark:border-indigo-900/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Riwayat Pengajuan
              </CardTitle>
            </div>
            <Badge
              variant="outline"
              className="self-start sm:self-auto font-mono text-xs bg-indigo-50/80 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60"
            >
              {filteredLeaves.length} dari {leaves.length} Pengajuan
            </Badge>
          </div>

          {/* Baris Filter & Pencarian */}
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Filter Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'semua', label: 'Semua Status' },
                { id: 'menunggu', label: 'Menunggu' },
                { id: 'disetujui', label: 'Disetujui' },
                { id: 'ditolak', label: 'Ditolak' },
                { id: 'dibatalkan', label: 'Dibatalkan' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                    statusFilter === tab.id
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filter Jenis & Pencarian Input */}
            <div className="flex items-center gap-2">
              <select
                value={jenisFilter}
                onChange={(e) => setJenisFilter(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background/90 px-2.5 text-xs font-medium text-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                <option value="semua">Semua Jenis</option>
                <option value="cuti_tahunan">Cuti Tahunan</option>
                <option value="izin">Izin</option>
                <option value="sakit">Sakit</option>
              </select>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari alasan / tanggal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-44 pl-8 text-xs lg:w-56 bg-background/90"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 p-0">
          {filteredLeaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                <FileText className="size-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {leaves.length === 0 ? 'Belum ada pengajuan' : 'Tidak ada hasil pengajuan'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                {leaves.length === 0
                  ? 'Klik tombol "Buat Pengajuan Baru" di atas untuk mengajukan cuti tahunan, sakit, atau izin.'
                  : 'Coba ubah kata kunci pencarian atau sesuaikan opsi filter status.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-indigo-500/5 dark:bg-indigo-950/20 hover:bg-indigo-500/5 border-b border-indigo-200/40 dark:border-indigo-900/30">
                    <TableHead className="font-semibold text-xs text-foreground">Jenis & Alasan</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground">Rentang Tanggal</TableHead>
                    <TableHead className="font-semibold text-xs text-center text-foreground">Durasi</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground">Alur Persetujuan</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-xs text-right text-foreground">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeaves.map((item) => {
                    const isCancellable =
                      item.status === 'diajukan' || item.status === 'disetujui_atasan';
                    return (
                      <TableRow key={item.id} className="border-b border-indigo-100/60 dark:border-indigo-950/40 hover:bg-indigo-500/5 transition-colors">
                        {/* Jenis & Alasan */}
                        <TableCell className="align-top py-3 max-w-[260px]">
                          <div className="space-y-1">
                            <span className="font-semibold text-xs capitalize text-foreground">
                              {item.jenis.replace('_', ' ')}
                            </span>
                            <p className="text-xs text-muted-foreground line-clamp-2" title={item.alasan}>
                              {item.alasan}
                            </p>
                            {item.status === 'ditolak' && item.alasan_penolakan && (
                              <p className="text-[11px] font-semibold text-destructive mt-1">
                                Catatan Penolakan: {item.alasan_penolakan}
                              </p>
                            )}
                            {item.lampiran_path && (
                              <div className="pt-0.5">
                                <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  <Paperclip className="size-3 shrink-0" />
                                  <span className="truncate">
                                    Surat Dokter ({item.lampiran_path.split('/').pop()})
                                  </span>
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Rentang Tanggal */}
                        <TableCell className="align-top py-3 whitespace-nowrap">
                          <div className="text-xs font-medium text-foreground">
                            {formatDateDisplay(item.tanggal_mulai)}
                            {item.tanggal_mulai !== item.tanggal_selesai && (
                              <span className="text-muted-foreground block text-[11px] mt-0.5">
                                s/d {formatDateDisplay(item.tanggal_selesai)}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 block">
                            Diajukan: {formatDateDisplay(item.dibuat_pada.slice(0, 10))}
                          </span>
                        </TableCell>

                        {/* Durasi */}
                        <TableCell className="align-top py-3 text-center whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                            {item.jumlah_hari}
                          </span>
                          <span className="text-[11px] text-muted-foreground block">hari kerja</span>
                        </TableCell>

                        {/* Alur Persetujuan (Timeline) */}
                        <TableCell className="align-top py-3 min-w-[150px]">
                          <ApprovalTimeline item={item} />
                        </TableCell>

                        {/* Status */}
                        <TableCell className="align-top py-3 whitespace-nowrap">
                          <StatusPill status={item.status} />
                        </TableCell>

                        {/* Aksi: Batalkan jika memenuhi syarat BR-10 */}
                        <TableCell className="align-top py-3 text-right whitespace-nowrap">
                          {isCancellable ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                setSelectedLeaveToCancel(item);
                                setCancelModalOpen(true);
                              }}
                              className="text-xs font-semibold text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive transition-colors gap-1"
                            >
                              <Ban className="size-3" />
                              <span>Batalkan</span>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL FORM PENGAJUAN BARU (SHADCN DIALOG STYLE) */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Formulir pengajuan cuti, sakit, atau izin"
          className="fixed inset-0 z-50 overflow-y-auto bg-foreground/40 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in duration-200"
        >
          <Card className="w-full max-w-lg border-border/80 shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Formulir Pengajuan
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Cuti Tahunan, Izin, atau Sakit
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4 pt-4">
                {formError && (
                  <Alert variant="destructive" className="py-2.5 px-3">
                    <AlertCircle className="size-4" />
                    <AlertDescription className="text-xs">{formError}</AlertDescription>
                  </Alert>
                )}

                {formSuccess && (
                  <Alert className="border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 py-2.5 px-3">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <AlertDescription className="text-xs">{formSuccess}</AlertDescription>
                  </Alert>
                )}

                {/* Jenis Pengajuan (Segmented Controls) */}
                <FormField label="Jenis Pengajuan" required>
                  <div
                    role="group"
                    aria-label="Pilih jenis pengajuan"
                    className="grid grid-cols-3 gap-2"
                  >
                    {[
                      { id: 'cuti_tahunan', label: 'Cuti Tahunan' },
                      { id: 'izin', label: 'Izin (Maks 2 Hari)' },
                      { id: 'sakit', label: 'Sakit' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setJenis(opt.id as any)}
                        className={cn(
                          'h-9 rounded-lg border text-xs font-semibold transition-all',
                          jenis === opt.id
                            ? 'border-primary bg-primary/10 text-primary shadow-2xs font-bold'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </FormField>

                {/* Rentang Tanggal */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Tanggal Mulai" htmlFor="input-tanggal-mulai" required>
                    <Input
                      id="input-tanggal-mulai"
                      type="date"
                      required
                      value={tanggalMulai}
                      onChange={(e) => {
                        setTanggalMulai(e.target.value);
                        if (!tanggalSelesai || tanggalSelesai < e.target.value) {
                          setTanggalSelesai(e.target.value);
                        }
                      }}
                      className="font-mono text-xs tabular-nums"
                    />
                  </FormField>

                  <FormField label="Tanggal Selesai" htmlFor="input-tanggal-selesai" required>
                    <Input
                      id="input-tanggal-selesai"
                      type="date"
                      required
                      min={tanggalMulai}
                      value={tanggalSelesai}
                      onChange={(e) => setTanggalSelesai(e.target.value)}
                      className="font-mono text-xs tabular-nums"
                    />
                  </FormField>
                </div>

                {/* Kalkulator Hari Kerja & Validasi Kuota Dinamis (BR-05, BR-06) */}
                {workingDaysCalc && (
                  <div
                    className={cn(
                      'rounded-xl border p-3.5 text-xs transition-colors',
                      workingDaysCalc.isValid
                        ? 'border-primary/25 bg-primary/5 text-foreground'
                        : 'border-destructive/30 bg-destructive/5 text-destructive'
                    )}
                  >
                    {workingDaysCalc.isValid ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold text-primary">
                            <Clock className="size-4" />
                            Lama Hari Kerja Efektif:
                          </span>
                          <span className="font-mono text-sm font-extrabold text-foreground tabular-nums">
                            {workingDaysCalc.workingDays} Hari
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                          <span className="rounded bg-muted px-2 py-0.5">
                            Total Kalender: {workingDaysCalc.totalCalendarDays} hari
                          </span>
                          {workingDaysCalc.weekendDates.length > 0 && (
                            <span className="rounded bg-muted px-2 py-0.5">
                              Akhir Pekan Dilewati: {workingDaysCalc.weekendDates.length} hari
                            </span>
                          )}
                          {workingDaysCalc.holidaysEncountered.length > 0 && (
                            <span className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5">
                              Libur Resmi Dilewati: {workingDaysCalc.holidaysEncountered.map((h) => h.keterangan).join(', ')}
                            </span>
                          )}
                        </div>

                        {jenis === 'cuti_tahunan' && (
                          <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[11px]">
                            <span className="text-muted-foreground">Sisa kuota setelah pengajuan ini:</span>
                            <span className="font-mono font-bold text-foreground tabular-nums">
                              {Math.max(0, sisaKuota - workingDaysCalc.workingDays)} dari {jatahHari} hari
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-4 shrink-0" />
                        <span>{workingDaysCalc.error}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Feedback Aturan Proaktif */}
                {ruleFeedback && (
                  <div
                    className={cn(
                      'rounded-lg p-2.5 text-xs flex items-start gap-2',
                      ruleFeedback.type === 'error'
                        ? 'border border-destructive/30 bg-destructive/10 text-destructive'
                        : 'border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                    )}
                  >
                    <Info className="size-4 shrink-0 mt-0.5" />
                    <span>{ruleFeedback.message}</span>
                  </div>
                )}

                {/* Drag-and-Drop Area Upload Surat Dokter (BR-08) */}
                {jenis === 'sakit' && (
                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <div className="flex items-center justify-between">
                      <FormField
                        label="Surat Keterangan Dokter"
                        required={suratDokterWajib}
                        hint={
                          suratDokterWajib
                            ? 'Wajib diunggah untuk sakit lebih dari 1 hari kerja.'
                            : 'Opsional jika sakit hanya 1 hari kerja.'
                        }
                      >
                        <span />
                      </FormField>
                    </div>

                    {fileToUpload ? (
                      <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FileText className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {fileToUpload.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {(fileToUpload.size / 1024).toFixed(0)} KB · Berkas siap diunggah
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setFileToUpload(null)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-5 text-center transition-all',
                          isDragging
                            ? 'border-primary bg-primary/10 scale-[0.99]'
                            : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40'
                        )}
                      >
                        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-1">
                          <Upload className="size-5" />
                        </div>
                        <p className="text-xs font-semibold text-foreground">
                          {isDragging ? 'Lepaskan berkas di sini' : 'Tarik & lepas berkas ke sini, atau klik untuk memilih'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Mendukung PDF, JPG, atau PNG (Maksimal 2 MB)
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,image/jpeg,image/png,image/jpg"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              validateAndSetFile(e.target.files[0]);
                            }
                          }}
                          className="sr-only"
                        />
                      </div>
                    )}

                    {fileError && (
                      <p className="text-xs font-medium text-destructive">{fileError}</p>
                    )}
                  </div>
                )}

                {/* Alasan Pengajuan */}
                <div className="space-y-1.5 border-t border-border/60 pt-3">
                  <div className="flex items-center justify-between">
                    <FormField
                      label="Alasan Pengajuan"
                      htmlFor="input-alasan-pengajuan"
                      required
                    >
                      <span />
                    </FormField>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {alasan.trim().length} / min. 5 karakter
                    </span>
                  </div>
                  <Textarea
                    id="input-alasan-pengajuan"
                    rows={3}
                    required
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    placeholder="Tuliskan keterangan keperluan cuti, izin, atau kondisi sakit Anda..."
                    className="text-xs resize-none"
                  />
                </div>

                {uploadingFile && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                    <span>Sedang mengunggah berkas surat dokter ke server...</span>
                  </div>
                )}
              </CardContent>

              <div className="flex items-center justify-end gap-2 border-t border-border/60 px-6 py-3.5 bg-muted/20 rounded-b-xl">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !workingDaysCalc?.isValid ||
                    alasan.trim().length < 5 ||
                    (jenis === 'cuti_tahunan' && (workingDaysCalc?.workingDays ?? 0) > sisaKuota) ||
                    (jenis === 'sakit' && (workingDaysCalc?.workingDays ?? 0) > 1 && !fileToUpload) ||
                    (jenis === 'izin' && (workingDaysCalc?.workingDays ?? 0) > 2)
                  }
                  className="gap-1.5 font-semibold"
                >
                  {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Kirim Pengajuan</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL KONFIRMASI PEMBATALAN (BR-10) */}
      {cancelModalOpen && selectedLeaveToCancel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <Card className="w-full max-w-sm border-border/80 shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Ban className="size-6" />
              </div>
              <CardTitle id="cancel-dialog-title" className="text-base font-bold text-foreground">
                Batalkan Pengajuan Ini?
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Tindakan ini tidak dapat diurungkan kembali.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-1 text-center text-xs">
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3 space-y-1.5 text-left">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jenis:</span>
                  <span className="font-semibold text-foreground capitalize">
                    {selectedLeaveToCancel.jenis.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal:</span>
                  <span className="font-semibold text-foreground">
                    {formatDateDisplay(selectedLeaveToCancel.tanggal_mulai)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Durasi:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedLeaveToCancel.jumlah_hari} hari kerja
                  </span>
                </div>
              </div>

              {selectedLeaveToCancel.jenis === 'cuti_tahunan' && (
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Jatah {selectedLeaveToCancel.jumlah_hari} hari kuota cuti tahunan Anda akan langsung dikembalikan otomatis ke saldo kuota.
                </p>
              )}
            </CardContent>

            <div className="grid grid-cols-2 gap-2 border-t border-border/60 p-4 bg-muted/20 rounded-b-xl">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelModalOpen(false)}
              >
                Kembali
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={cancelling}
                className="gap-1.5"
              >
                {cancelling && <Loader2 className="size-3.5 animate-spin" />}
                <span>Ya, Batalkan</span>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
