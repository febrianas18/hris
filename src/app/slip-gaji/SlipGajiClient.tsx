'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Search,
  Plus,
  Copy,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  DollarSign,
  FileText,
  Trash2,
  Edit,
  ExternalLink,
  X,
  Sparkles,
  ShieldCheck,
  Info,
  Building2,
  Calendar,
} from 'lucide-react';
import { formatRupiah, formatPeriodeBulan } from '@/utils/formatters';
import PayslipDocument, { PayslipData } from '@/components/PayslipDocument';
import { PageHeader } from '@/components/app/PageHeader';
import { StatCard } from '@/components/app/StatCard';
import { FormField } from '@/components/app/FormField';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface EmployeeProfileSummary {
  id: string;
  nik_karyawan: string;
  nama_lengkap: string;
  jabatan: string;
  divisi_id: string;
  divisi?: {
    id: string;
    nama: string;
  } | null;
}

export interface DivisionItem {
  id: string;
  nama: string;
}

interface SlipGajiClientProps {
  userRole: 'karyawan' | 'atasan' | 'hrd';
  userId: string;
  userName: string;
  initialSlips: PayslipData[];
  employees: EmployeeProfileSummary[];
  divisions: DivisionItem[];
  defaultPeriode: string; // e.g. '2026-10-01'
}

export default function SlipGajiClient({
  userRole,
  userId,
  userName,
  initialSlips,
  employees,
  divisions,
  defaultPeriode,
}: SlipGajiClientProps) {
  const isHrd = userRole === 'hrd';

  // State Utama
  const [slips, setSlips] = useState<PayslipData[]>(initialSlips);
  const [selectedPeriode, setSelectedPeriode] = useState<string>(defaultPeriode);
  const [selectedDivisi, setSelectedDivisi] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Modal States
  const [previewSlip, setPreviewSlip] = useState<PayslipData | null>(null);
  const [publishModalSlip, setPublishModalSlip] = useState<PayslipData | null>(null);
  const [showDraftModal, setShowDraftModal] = useState<boolean>(false);
  const [draftForm, setDraftForm] = useState<{
    id: string | null;
    karyawan_id: string;
    periode: string;
    gaji_pokok: number | string;
    tunjangan: number | string;
    potongan: number | string;
    catatan: string;
  }>({
    id: null,
    karyawan_id: '',
    periode: defaultPeriode,
    gaji_pokok: '',
    tunjangan: 0,
    potongan: 0,
    catatan: '',
  });

  const [copyingPrevious, setCopyingPrevious] = useState<boolean>(false);
  const [submittingDraft, setSubmittingDraft] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Ambil daftar unik periode dari data slip yang ada
  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    set.add(defaultPeriode);
    set.add('2026-09-01');
    set.add('2026-10-01');
    set.add('2026-11-01');
    slips.forEach((s) => {
      if (s.periode) set.add(s.periode);
    });
    return Array.from(set).sort().reverse();
  }, [slips, defaultPeriode]);

  // Filter Slip Gaji
  const filteredSlips = useMemo(() => {
    return slips.filter((s) => {
      if (isHrd) {
        // Filter Periode
        if (selectedPeriode !== 'all' && s.periode !== selectedPeriode) return false;
        // Filter Divisi
        if (
          selectedDivisi !== 'all' &&
          s.karyawan?.divisi?.id !== selectedDivisi &&
          (s.karyawan as any)?.divisi_id !== selectedDivisi
        ) {
          return false;
        }
        // Filter Status
        if (selectedStatus !== 'all' && s.status !== selectedStatus) return false;
        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = s.karyawan?.nama_lengkap.toLowerCase().includes(q);
          const matchNik = s.karyawan?.nik_karyawan.toLowerCase().includes(q);
          const matchNoSlip = s.nomor_slip?.toLowerCase().includes(q);
          if (!matchName && !matchNik && !matchNoSlip) return false;
        }
      } else {
        // Karyawan / Atasan: Hanya slip miliknya sendiri dan berstatus 'terbit' (BR-11)
        if (s.status !== 'terbit') return false;
        if (s.karyawan?.id !== userId && (s as any).karyawan_id !== userId) return false;
      }
      return true;
    });
  }, [slips, isHrd, selectedPeriode, selectedDivisi, selectedStatus, searchQuery, userId]);

  // Statistik untuk HRD pada periode terpilih
  const stats = useMemo(() => {
    const periodSlips =
      selectedPeriode === 'all'
        ? slips
        : slips.filter((s) => s.periode === selectedPeriode);

    const total = periodSlips.length;
    const draf = periodSlips.filter((s) => s.status === 'draf').length;
    const terbit = periodSlips.filter((s) => s.status === 'terbit').length;
    const totalGajiTerbit = periodSlips
      .filter((s) => s.status === 'terbit')
      .reduce((acc, curr) => acc + Number(curr.total_diterima), 0);

    return { total, draf, terbit, totalGajiTerbit };
  }, [slips, selectedPeriode]);

  // Karyawan aktif yang belum memiliki slip pada periode yang dipilih
  const employeesWithoutSlip = useMemo(() => {
    if (!isHrd || selectedPeriode === 'all') return [];
    const existingEmployeeIds = new Set(
      slips
        .filter((s) => s.periode === selectedPeriode)
        .map((s) => s.karyawan?.id || (s as any).karyawan_id)
    );
    return employees.filter((emp) => !existingEmployeeIds.has(emp.id));
  }, [employees, slips, selectedPeriode, isHrd]);

  // Refresh data slip dari API
  const refreshSlips = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/payroll');
      const data = await res.json();
      if (data.success && data.data) {
        setSlips(data.data);
      }
    } catch (err) {
      console.error('Gagal memuat slip gaji:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handler Buka Form Buat Draf Baru
  const handleOpenCreateDraft = (preselectedKaryawanId?: string) => {
    setDraftForm({
      id: null,
      karyawan_id: preselectedKaryawanId || (employees[0]?.id || ''),
      periode: selectedPeriode !== 'all' ? selectedPeriode : defaultPeriode,
      gaji_pokok: '',
      tunjangan: 0,
      potongan: 0,
      catatan: '',
    });
    setShowDraftModal(true);
  };

  // Handler Buka Form Edit Draf
  const handleOpenEditDraft = (slip: PayslipData) => {
    if (slip.status === 'terbit') {
      alert('Slip gaji yang sudah terbit terkunci permanen dan tidak dapat diedit.');
      return;
    }
    setDraftForm({
      id: slip.id,
      karyawan_id: slip.karyawan?.id || (slip as any).karyawan_id,
      periode: slip.periode,
      gaji_pokok: slip.gaji_pokok,
      tunjangan: slip.tunjangan,
      potongan: slip.potongan,
      catatan: slip.catatan || '',
    });
    setShowDraftModal(true);
  };

  // Handler "Salin dari periode sebelumnya" untuk karyawan yang dipilih di form
  const handleCopyFromPrevious = async () => {
    if (!draftForm.karyawan_id) {
      alert('Pilih karyawan terlebih dahulu.');
      return;
    }
    try {
      setCopyingPrevious(true);
      const res = await fetch(
        `/api/payroll/previous?karyawan_id=${draftForm.karyawan_id}&periode=${draftForm.periode}`
      );
      const json = await res.json();

      if (!json.success || !json.data) {
        setNotification({
          type: 'info',
          message:
            json.message ||
            'Tidak ditemukan data slip gaji periode sebelumnya untuk karyawan ini.',
        });
        return;
      }

      const prev = json.data;
      setDraftForm((prevForm) => ({
        ...prevForm,
        gaji_pokok: prev.gaji_pokok,
        tunjangan: prev.tunjangan,
        potongan: prev.potongan,
        catatan: prev.catatan || `Salin dari periode ${prev.periode}`,
      }));

      setNotification({
        type: 'success',
        message: `Komponen gaji berhasil disalin dari periode ${formatPeriodeBulan(prev.periode)}!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyalin komponen gaji.';
      setNotification({ type: 'error', message: msg });
    } finally {
      setCopyingPrevious(false);
    }
  };

  // Handler Batch "Salin Semua dari Periode Sebelumnya"
  const handleBatchCopyPrevious = async () => {
    if (selectedPeriode === 'all') {
      alert('Silakan pilih bulan/periode tertentu terlebih dahulu untuk melakukan salin massal.');
      return;
    }

    const confirmMsg = `Salin otomatis komponen gaji dari bulan sebelumnya untuk semua karyawan yang belum memiliki slip di periode ${formatPeriodeBulan(
      selectedPeriode
    )}?`;
    if (!confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const res = await fetch('/api/payroll/previous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_periode: selectedPeriode }),
      });
      const json = await res.json();

      if (!json.success) {
        setNotification({ type: 'error', message: json.error });
        return;
      }

      setNotification({
        type: 'success',
        message: json.message,
      });

      await refreshSlips();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      setNotification({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  // Submit Simpan Draf Slip Gaji
  const handleSubmitDraft = async (e: React.FormEvent) => {
    e.preventDefault();

    const gPokok = Number(draftForm.gaji_pokok);
    const tunj = Number(draftForm.tunjangan || 0);
    const pot = Number(draftForm.potongan || 0);

    if (isNaN(gPokok) || gPokok < 0) {
      alert('Gaji pokok wajib diisi dan tidak boleh bernilai negatif.');
      return;
    }
    if (tunj < 0 || pot < 0) {
      alert('Tunjangan dan potongan tidak boleh bernilai negatif.');
      return;
    }
    if (gPokok + tunj - pot < 0) {
      alert('Total gaji yang diterima tidak boleh bernilai negatif.');
      return;
    }

    try {
      setSubmittingDraft(true);
      const res = await fetch('/api/payroll/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draftForm.id || undefined,
          karyawan_id: draftForm.karyawan_id,
          periode: draftForm.periode,
          gaji_pokok: gPokok,
          tunjangan: tunj,
          potongan: pot,
          catatan: draftForm.catatan,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        setNotification({ type: 'error', message: json.error });
        return;
      }

      setNotification({
        type: 'success',
        message: 'Draf slip gaji berhasil disimpan dan dicatat ke audit log.',
      });

      setShowDraftModal(false);
      await refreshSlips();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan draf slip gaji.';
      setNotification({ type: 'error', message: msg });
    } finally {
      setSubmittingDraft(false);
    }
  };

  // Handler Hapus Draf Slip Gaji
  const handleDeleteDraft = async (slipId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus draf slip gaji ini?')) return;

    try {
      setDeletingId(slipId);
      const res = await fetch(`/api/payroll/draft?id=${slipId}`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (!json.success) {
        setNotification({ type: 'error', message: json.error });
        return;
      }

      setNotification({
        type: 'success',
        message: 'Draf slip gaji berhasil dihapus.',
      });

      await refreshSlips();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus draf slip gaji.';
      setNotification({ type: 'error', message: msg });
    } finally {
      setDeletingId(null);
    }
  };

  // Handler Terbitkan Slip Gaji (BR-12)
  const handlePublishSlip = async () => {
    if (!publishModalSlip) return;

    try {
      setPublishing(true);
      const res = await fetch('/api/payroll/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slip_id: publishModalSlip.id }),
      });
      const json = await res.json();

      if (!json.success) {
        setNotification({ type: 'error', message: json.error });
        return;
      }

      setNotification({
        type: 'success',
        message: `Slip gaji berhasil diterbitkan dengan nomor resmi ${json.data?.nomor_slip} dan status terkunci.`,
      });

      setPublishModalSlip(null);
      await refreshSlips();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menerbitkan slip gaji.';
      setNotification({ type: 'error', message: msg });
    } finally {
      setPublishing(false);
    }
  };

  // Hitung preview Total Diterima di form draf
  const currentTotalDiterima = useMemo(() => {
    const gp = Number(draftForm.gaji_pokok) || 0;
    const tj = Number(draftForm.tunjangan) || 0;
    const pt = Number(draftForm.potongan) || 0;
    return gp + tj - pt;
  }, [draftForm.gaji_pokok, draftForm.tunjangan, draftForm.potongan]);

  return (
    <div className="space-y-6">
      {/* Toast Notifikasi */}
      {notification && (
        <Alert
          variant={notification.type === 'error' ? 'destructive' : 'default'}
          className={cn(
            notification.type === 'success' &&
              'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
          )}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="size-4" />
          )}
          <div className="flex-1">
            <AlertTitle className="text-xs font-bold">
              {notification.type === 'success'
                ? 'Berhasil'
                : notification.type === 'error'
                ? 'Terjadi Kesalahan'
                : 'Informasi'}
            </AlertTitle>
            <AlertDescription className="text-xs">{notification.message}</AlertDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setNotification(null)}
          >
            <X className="size-3.5" />
          </Button>
        </Alert>
      )}

      {/* Header Halaman */}
      <PageHeader
        accent="info"
        title={isHrd ? 'Manajemen Slip Gaji Karyawan' : 'Slip Gaji Pribadi'}
        icon={Receipt}
        actions={
          isHrd ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleBatchCopyPrevious}
                disabled={loading}
                className="gap-1.5 font-semibold text-xs shadow-2xs"
              >
                <Copy className="size-4 text-muted-foreground" />
                <span>Salin Semua dari Bulan Lalu</span>
              </Button>

              <Button
                type="button"
                onClick={() => handleOpenCreateDraft()}
                className="gap-1.5 font-semibold text-xs shadow-xs"
              >
                <Plus className="size-4" />
                <span>Buat Draf Slip</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* HRD Statistics Overview */}
      {isHrd && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* 1. Total Slip (Bold Blue) */}
          <div
            aria-label="Total Slip Gaji"
            className="dash-blue-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-sm"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-blue-400/20 blur-xl"
            />
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-blue-300" />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
                  Total Slip ({formatPeriodeBulan(selectedPeriode)})
                </p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-200 ring-1 ring-inset ring-white/15 shadow-2xs">
                <FileText className="size-4.5" strokeWidth={1.9} />
              </span>
            </div>
            <div className="relative z-10 mt-3">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="font-heading font-mono text-3xl font-extrabold text-white tabular-nums">
                  {stats.total}
                </span>
                <span className="text-xs font-semibold text-white/80">slip</span>
              </div>
              <p className="mt-1.5 text-xs text-white/80">Seluruh slip pada periode terpilih</p>
            </div>
          </div>

          {/* 2. Draf (Bold Amber) */}
          <div
            aria-label="Draf Slip Gaji"
            className="dash-amber-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-sm"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-amber-400/20 blur-xl"
            />
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-amber-300" />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
                  Draf (Belum Terbit)
                </p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-amber-200 ring-1 ring-inset ring-white/15 shadow-2xs">
                <Clock className="size-4.5" strokeWidth={1.9} />
              </span>
            </div>
            <div className="relative z-10 mt-3">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="font-heading font-mono text-3xl font-extrabold text-white tabular-nums">
                  {stats.draf}
                </span>
                <span className="text-xs font-semibold text-white/80">slip</span>
              </div>
              <p className="mt-1.5 text-xs text-white/80">Masih dapat diedit oleh HRD</p>
            </div>
          </div>

          {/* 3. Terbit & Terkunci (Bold Emerald) */}
          <div
            aria-label="Slip Terbit dan Terkunci"
            className="dash-emerald-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-sm"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-emerald-400/20 blur-xl"
            />
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[#2ed8b6]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
                  Terbit & Terkunci
                </p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#8df1d8] ring-1 ring-inset ring-white/15 shadow-2xs">
                <CheckCircle2 className="size-4.5" strokeWidth={1.9} />
              </span>
            </div>
            <div className="relative z-10 mt-3">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="font-heading font-mono text-3xl font-extrabold text-white tabular-nums">
                  {stats.terbit}
                </span>
                <span className="text-xs font-semibold text-white/80">slip</span>
              </div>
              <p className="mt-1.5 text-xs text-white/80">Terkunci permanen setelah terbit</p>
            </div>
          </div>

          {/* 4. Total Gaji Terbit (Bold Indigo) */}
          <div
            aria-label="Total Gaji Terbit"
            className="dash-indigo-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-sm"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-indigo-400/20 blur-xl"
            />
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-indigo-300" />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
                  Total Gaji Terbit
                </p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-indigo-200 ring-1 ring-inset ring-white/15 shadow-2xs">
                <DollarSign className="size-4.5" strokeWidth={1.9} />
              </span>
            </div>
            <div className="relative z-10 mt-3">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="font-heading font-mono text-xl sm:text-2xl font-extrabold text-white tabular-nums">
                  {formatRupiah(stats.totalGajiTerbit)}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-white/80">Akumulasi gaji bersih slip terbit</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar (Untuk HRD) */}
      {isHrd && (
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-3.5 flex flex-wrap items-center gap-3">
            {/* Periode Selector */}
            <div className="w-full sm:w-44">
              <label htmlFor="slip-periode" className="text-[11px] font-semibold text-muted-foreground block mb-1">
                Periode Gaji
              </label>
              <select
                id="slip-periode"
                value={selectedPeriode}
                onChange={(e) => setSelectedPeriode(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                {availablePeriods.map((p) => (
                  <option key={p} value={p}>
                    {formatPeriodeBulan(p)}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Divisi */}
            <div className="w-full sm:w-44">
              <label htmlFor="slip-divisi" className="text-[11px] font-semibold text-muted-foreground block mb-1">
                Divisi
              </label>
              <select
                id="slip-divisi"
                value={selectedDivisi}
                onChange={(e) => setSelectedDivisi(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                <option value="all">Semua Divisi</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Status */}
            <div className="w-full sm:w-36">
              <label htmlFor="slip-status" className="text-[11px] font-semibold text-muted-foreground block mb-1">
                Status
              </label>
              <select
                id="slip-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                <option value="all">Semua Status</option>
                <option value="draf">Draf</option>
                <option value="terbit">Terbit</option>
              </select>
            </div>

            {/* Search box */}
            <div className="w-full sm:ml-auto sm:w-64 pt-3 sm:pt-0">
              <label htmlFor="slip-search" className="text-[11px] font-semibold text-muted-foreground block mb-1">
                Pencarian
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="slip-search"
                  type="text"
                  placeholder="Nama, NIK, no slip..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Banner Karyawan yang Belum Ada Slip */}
      {isHrd && employeesWithoutSlip.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
                <AlertCircle className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                  {employeesWithoutSlip.length} Karyawan Belum Memiliki Slip pada Periode {formatPeriodeBulan(selectedPeriode)}
                </h3>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                  Klik nama karyawan di bawah untuk membuat draf secara instan:
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {employeesWithoutSlip.slice(0, 8).map((emp) => (
                    <Button
                      key={emp.id}
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => handleOpenCreateDraft(emp.id)}
                      className="gap-1 font-semibold text-xs border-amber-300 bg-background hover:bg-amber-100/50 dark:border-amber-800"
                    >
                      <Plus className="size-3 text-primary" />
                      <span>{emp.nama_lengkap}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">({emp.nik_karyawan})</span>
                    </Button>
                  ))}
                  {employeesWithoutSlip.length > 8 && (
                    <span className="self-center text-xs font-semibold text-amber-800 dark:text-amber-300 pl-1">
                      +{employeesWithoutSlip.length - 8} lainnya
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabel Slip Gaji */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                {isHrd
                  ? `Daftar Slip Gaji Periode ${formatPeriodeBulan(selectedPeriode)}`
                  : 'Daftar Slip Gaji'}
              </CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-xs self-start sm:self-auto">
              {filteredSlips.length} Data
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredSlips.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Receipt className="size-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-semibold text-foreground">Tidak ada slip gaji yang sesuai</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                {isHrd
                  ? 'Gunakan tombol "+ Buat Draf Slip" atau "Salin Semua dari Bulan Lalu" untuk membuat slip gaji.'
                  : 'Slip gaji resmi Anda akan tampil di sini begitu resmi diterbitkan oleh HRD.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    {isHrd && <TableHead className="font-semibold text-xs">Karyawan</TableHead>}
                    <TableHead className="font-semibold text-xs">Periode</TableHead>
                    <TableHead className="font-semibold text-xs">Nomor Slip</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Gaji Pokok</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Tunjangan</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Potongan</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Total Diterima</TableHead>
                    <TableHead className="font-semibold text-xs">Status</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSlips.map((s) => {
                    const isTerbit = s.status === 'terbit';
                    return (
                      <TableRow key={s.id}>
                        {/* Kolom Karyawan (Khusus HRD) */}
                        {isHrd && (
                          <TableCell className="align-middle py-3">
                            <div className="font-bold text-xs text-foreground">
                              {s.karyawan?.nama_lengkap || '-'}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                              <span className="font-mono tabular-nums">{s.karyawan?.nik_karyawan}</span>
                              <span>·</span>
                              <span>{s.karyawan?.jabatan}</span>
                              {s.karyawan?.divisi && (
                                <>
                                  <span>·</span>
                                  <span className="font-semibold text-primary">{s.karyawan.divisi.nama}</span>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}

                        {/* Periode */}
                        <TableCell className="whitespace-nowrap font-medium text-xs text-foreground">
                          {formatPeriodeBulan(s.periode)}
                        </TableCell>

                        {/* Nomor Slip Resmi (SG-TTTTBB-NNN) */}
                        <TableCell className="whitespace-nowrap">
                          {s.nomor_slip ? (
                            <Badge variant="outline" className="font-mono text-xs font-bold text-primary bg-primary/5 border-primary/20">
                              {s.nomor_slip}
                            </Badge>
                          ) : (
                            <span className="text-[11px] italic text-muted-foreground">Belum terbit</span>
                          )}
                        </TableCell>

                        {/* Komponen Finansial */}
                        <TableCell className="whitespace-nowrap text-right font-mono text-xs tabular-nums text-foreground/80">
                          {formatRupiah(s.gaji_pokok)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono text-xs tabular-nums text-foreground/80">
                          {formatRupiah(s.tunjangan)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono text-xs tabular-nums text-destructive">
                          {formatRupiah(s.potongan)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono text-xs font-bold tabular-nums text-foreground">
                          {formatRupiah(s.total_diterima)}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="whitespace-nowrap">
                          {isTerbit ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase gap-1">
                              <CheckCircle2 className="size-3" />
                              <span>Terbit</span>
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase gap-1">
                              <Clock className="size-3" />
                              <span>Draf</span>
                            </Badge>
                          )}
                        </TableCell>

                        {/* Aksi */}
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isTerbit ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  onClick={() => setPreviewSlip(s)}
                                  className="gap-1 font-semibold text-xs"
                                >
                                  <Printer className="size-3 text-muted-foreground" />
                                  <span>Cetak / Lihat</span>
                                </Button>

                                {isHrd && (
                                  <span
                                    title="Slip yang sudah terbit terkunci permanen"
                                    className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground"
                                  >
                                    <Lock className="size-3" />
                                  </span>
                                )}
                              </>
                            ) : (
                              isHrd && (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => handleOpenEditDraft(s)}
                                    className="gap-1 text-xs"
                                  >
                                    <Edit className="size-3" />
                                    <span>Edit</span>
                                  </Button>

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => handleDeleteDraft(s.id)}
                                    disabled={deletingId === s.id}
                                    className="gap-1 text-xs text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="size-3" />
                                    <span>Hapus</span>
                                  </Button>

                                  <Button
                                    type="button"
                                    size="xs"
                                    onClick={() => setPublishModalSlip(s)}
                                    className="gap-1 text-xs font-semibold"
                                  >
                                    <CheckCircle2 className="size-3" />
                                    <span>Terbitkan</span>
                                  </Button>
                                </>
                              )
                            )}
                          </div>
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

      {/* ========================================================================= */}
      {/* MODAL 1: FORM BUAT / EDIT DRAF SLIP GAJI (HRD)                            */}
      {/* ========================================================================= */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg border-border/80 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Receipt className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      {draftForm.id ? 'Edit Draf Slip Gaji' : 'Buat Draf Slip Gaji'}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Status draf dapat diperiksa sebelum resmi diterbitkan.
                    </CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowDraftModal(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <form onSubmit={handleSubmitDraft}>
              <CardContent className="space-y-4 pt-4">
                {/* Pilihan Karyawan */}
                <FormField label="Karyawan Penerima Gaji" htmlFor="draft-karyawan" required>
                  <select
                    id="draft-karyawan"
                    disabled={Boolean(draftForm.id)}
                    value={draftForm.karyawan_id}
                    onChange={(e) =>
                      setDraftForm({ ...draftForm, karyawan_id: e.target.value })
                    }
                    required
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:bg-muted disabled:opacity-60"
                  >
                    <option value="" disabled>
                      -- Pilih Karyawan --
                    </option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nama_lengkap} ({emp.nik_karyawan}) - {emp.jabatan}
                      </option>
                    ))}
                  </select>
                </FormField>

                {/* Periode & Salin Cepat */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    label="Periode Gaji (Tgl 1)"
                    htmlFor="draft-periode"
                    required
                    hint="Wajib tanggal 1 (e.g. 2026-10-01)"
                  >
                    <Input
                      id="draft-periode"
                      type="date"
                      disabled={Boolean(draftForm.id)}
                      value={draftForm.periode}
                      onChange={(e) =>
                        setDraftForm({ ...draftForm, periode: e.target.value })
                      }
                      required
                      className="font-mono text-xs tabular-nums"
                    />
                  </FormField>

                  <div className="flex flex-col justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyFromPrevious}
                      disabled={copyingPrevious || !draftForm.karyawan_id}
                      className="gap-1.5 font-semibold text-xs h-9"
                    >
                      <Sparkles className="size-3.5 text-primary" />
                      <span>{copyingPrevious ? 'Menyalin...' : '⚡ Salin Periode Lalu'}</span>
                    </Button>
                    <p className="mt-1 text-[11px] text-muted-foreground text-center">
                      Auto-isi data dari bulan sebelumnya
                    </p>
                  </div>
                </div>

                {/* Komponen Finansial */}
                <div className="space-y-3 border-t border-border/60 pt-3">
                  <FormField label="Gaji Pokok (IDR)" htmlFor="draft-gaji-pokok" required>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                        Rp
                      </span>
                      <Input
                        id="draft-gaji-pokok"
                        type="number"
                        min="0"
                        step="1000"
                        required
                        placeholder="Contoh: 8500000"
                        value={draftForm.gaji_pokok}
                        onChange={(e) =>
                          setDraftForm({ ...draftForm, gaji_pokok: e.target.value })
                        }
                        className="pl-9 font-mono text-xs tabular-nums"
                      />
                    </div>
                  </FormField>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Tunjangan (IDR)" htmlFor="draft-tunjangan">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                          Rp
                        </span>
                        <Input
                          id="draft-tunjangan"
                          type="number"
                          min="0"
                          step="1000"
                          value={draftForm.tunjangan}
                          onChange={(e) =>
                            setDraftForm({ ...draftForm, tunjangan: e.target.value })
                          }
                          className="pl-9 font-mono text-xs tabular-nums"
                        />
                      </div>
                    </FormField>

                    <FormField label="Potongan (IDR)" htmlFor="draft-potongan">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                          Rp
                        </span>
                        <Input
                          id="draft-potongan"
                          type="number"
                          min="0"
                          step="1000"
                          value={draftForm.potongan}
                          onChange={(e) =>
                            setDraftForm({ ...draftForm, potongan: e.target.value })
                          }
                          className="pl-9 font-mono text-xs tabular-nums text-destructive"
                        />
                      </div>
                    </FormField>
                  </div>

                  {/* Perhitungan Total Diterima */}
                  <div
                    className={cn(
                      'flex items-center justify-between rounded-xl border p-3',
                      currentTotalDiterima >= 0
                        ? 'border-primary/25 bg-primary/5 text-foreground'
                        : 'border-destructive/30 bg-destructive/5 text-destructive'
                    )}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Total Diterima (Otomatis):
                    </span>
                    <span className="font-mono text-base font-extrabold tabular-nums">
                      {formatRupiah(currentTotalDiterima)}
                    </span>
                  </div>
                  {currentTotalDiterima < 0 && (
                    <p className="text-xs font-medium text-destructive">
                      ⚠️ Total gaji tidak boleh bernilai negatif.
                    </p>
                  )}
                </div>

                {/* Catatan Tambahan */}
                <FormField label="Catatan / Rincian Slip (Opsional)" htmlFor="draft-catatan">
                  <Textarea
                    id="draft-catatan"
                    rows={2}
                    placeholder="Rincian tunjangan makan, transport, atau potongan BPJS..."
                    value={draftForm.catatan}
                    onChange={(e) => setDraftForm({ ...draftForm, catatan: e.target.value })}
                    className="text-xs resize-none"
                  />
                </FormField>
              </CardContent>

              <CardFooter className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 p-4 rounded-b-xl">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDraftModal(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={submittingDraft || currentTotalDiterima < 0}
                  className="gap-1.5 font-semibold text-xs"
                >
                  {submittingDraft ? 'Menyimpan...' : 'Simpan Draf'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: KONFIRMASI PENERBITAN SLIP GAJI (BR-12)                          */}
      {/* ========================================================================= */}
      {publishModalSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-border/80 shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      Terbitkan Slip Gaji?
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Slip akan terkunci permanen dan dapat diakses karyawan.
                    </CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setPublishModalSlip(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-4 text-xs">
              <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 p-3.5 space-y-1.5">
                <p className="flex items-center gap-1.5 font-bold">
                  <Lock className="size-3.5" />
                  Ketentuan Penguncian:
                </p>
                <p className="text-[11px] leading-relaxed">
                  1. Slip berstatus <strong>&apos;terbit&apos;</strong> dan <strong>TIDAK DAPAT DIUBAH ATAU DIHAPUS</strong> kembali oleh siapa pun.
                </p>
                <p className="text-[11px] leading-relaxed">
                  2. Sistem membuat nomor slip resmi unik berformat <strong className="font-mono">SG-TTTTBB-NNN</strong> secara berurutan.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Karyawan:</span>
                  <span className="font-bold text-foreground">
                    {publishModalSlip.karyawan?.nama_lengkap}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Periode:</span>
                  <span className="font-medium text-foreground">
                    {formatPeriodeBulan(publishModalSlip.periode)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-1.5">
                  <span className="text-muted-foreground font-semibold">Total Diterima:</span>
                  <span className="font-mono text-sm font-extrabold text-primary tabular-nums">
                    {formatRupiah(publishModalSlip.total_diterima)}
                  </span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 p-4 rounded-b-xl">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPublishModalSlip(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handlePublishSlip}
                disabled={publishing}
                className="gap-1.5 font-semibold text-xs"
              >
                {publishing ? 'Menerbitkan...' : 'Ya, Terbitkan Resmi'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PREVIEW & CETAK SLIP GAJI                                        */}
      {/* ========================================================================= */}
      {previewSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200">
          <Card className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden border-border/80 shadow-2xl">
            {/* Toolbar Modal */}
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    Pratinjau Slip Gaji · {previewSlip.nomor_slip || 'Draf'}
                  </CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground">
                    Karyawan: {previewSlip.karyawan?.nama_lengkap} ({formatPeriodeBulan(previewSlip.periode)})
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/slip-gaji/${previewSlip.id}/print`}
                  target="_blank"
                  className={cn(buttonVariants({ variant: 'outline', size: 'xs' }), 'gap-1 font-semibold')}
                >
                  <ExternalLink className="size-3 text-muted-foreground" />
                  <span>Buka Lembar Cetak</span>
                </Link>

                <Button
                  type="button"
                  size="xs"
                  onClick={() => {
                    const printUrl = `/slip-gaji/${previewSlip.id}/print`;
                    window.open(printUrl, '_blank');
                  }}
                  className="gap-1 font-semibold"
                >
                  <Printer className="size-3" />
                  <span>Cetak / PDF</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setPreviewSlip(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>

            {/* Document Body */}
            <div className="overflow-y-auto bg-muted/30 p-3 sm:p-6">
              <div className="mx-auto max-w-3xl rounded-xl border border-border/70 bg-card p-3 shadow-2xs sm:p-4">
                <PayslipDocument slip={previewSlip} isPrintMode={false} />
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
