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
  ChevronDown,
  Building2,
  DollarSign,
  FileText,
  User,
  Trash2,
  Edit,
  ExternalLink,
  X,
  Sparkles,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { formatRupiah, formatPeriodeBulan } from '@/utils/formatters';
import PayslipDocument, { PayslipData } from '@/components/PayslipDocument';

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      alert('Slip gaji yang sudah terbit terkunci dan tidak dapat diedit (BR-12).');
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
      alert('Gaji pokok wajib diisi dan tidak boleh negatif.');
      return;
    }
    if (tunj < 0 || pot < 0) {
      alert('Tunjangan dan potongan tidak boleh bernilai negatif.');
      return;
    }
    if (gPokok + tunj - pot < 0) {
      alert('Total diterima tidak boleh di bawah 0 (BR-12).');
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
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-300 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Halaman */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {isHrd ? 'Manajemen Slip Gaji Karyawan' : 'Slip Gaji Pribadi'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {isHrd
                  ? 'Kelola, buat draf, salin, dan terbitkan slip gaji bulanan karyawan (BR-11 & BR-12)'
                  : 'Daftar slip gaji resmi PT Karsa Lintas Nusantara yang telah diterbitkan (BR-11)'}
              </p>
            </div>
          </div>

          {/* Action HRD */}
          {isHrd && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleBatchCopyPrevious}
                disabled={loading}
                title="Salin otomatis komponen gaji bulan lalu untuk karyawan yang belum memiliki draf"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-all active:scale-95"
              >
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Salin Semua dari Bulan Lalu</span>
              </button>

              <button
                onClick={() => handleOpenCreateDraft()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Buat Draf Slip</span>
              </button>
            </div>
          )}
        </div>

        {/* Security Alert: Kerahasiaan Gaji (BR-11) */}
        <div className="mt-6 bg-slate-50 border border-slate-200/90 rounded-xl p-4 flex items-start gap-3 text-xs sm:text-sm text-slate-600">
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900">
              Keamanan & Kerahasiaan Gaji Terproteksi (Aturan BR-11):
            </span>{' '}
            {isHrd
              ? 'Data gaji bersifat rahasia. Hanya HRD dan karyawan pemilik yang memiliki izin akses data slip. Atasan dilarang keras melihat gaji anggota divisinya pada level API & PostgreSQL RLS.'
              : 'Gaji bersifat rahasia. Atasan divisi dilarang melihat slip gaji Anda. Anda hanya dapat melihat slip resmi yang sudah berstatus Terbit.'}
          </div>
        </div>

        {/* HRD Statistics Overview */}
        {isHrd && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Slip ({formatPeriodeBulan(selectedPeriode)})
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-4">
              <div className="text-xs font-medium text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Draf (Belum Terbit)
              </div>
              <div className="text-2xl font-bold text-amber-800 mt-1">{stats.draf}</div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-xl p-4">
              <div className="text-xs font-medium text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Terbit & Terkunci
              </div>
              <div className="text-2xl font-bold text-emerald-800 mt-1">{stats.terbit}</div>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-200/70 rounded-xl p-4">
              <div className="text-xs font-medium text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Total Gaji Terbit
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-indigo-900 mt-1 truncate">
                {formatRupiah(stats.totalGajiTerbit)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar (Untuk HRD) */}
      {isHrd && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <div className="flex flex-wrap items-center gap-3">
            {/* Periode Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Periode:</span>
              <select
                value={selectedPeriode}
                onChange={(e) => setSelectedPeriode(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {availablePeriods.map((p) => (
                  <option key={p} value={p}>
                    {formatPeriodeBulan(p)}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Divisi */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Divisi:</span>
              <select
                value={selectedDivisi}
                onChange={(e) => setSelectedDivisi(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Semua Status</option>
                <option value="draf">Draf</option>
                <option value="terbit">Terbit</option>
              </select>
            </div>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, NIK, no slip..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Banner Karyawan yang Belum Ada Slip (Khusus HRD jika periode dipilih) */}
      {isHrd && employeesWithoutSlip.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-amber-900">
                  {employeesWithoutSlip.length} Karyawan Aktif Belum Memiliki Slip pada Periode {formatPeriodeBulan(selectedPeriode)}
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Klik nama karyawan di bawah untuk membuat draf secara instan:
                </p>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {employeesWithoutSlip.slice(0, 8).map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => handleOpenCreateDraft(emp.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-200 hover:border-amber-400 text-amber-900 text-xs font-medium shadow-2xs hover:bg-amber-50 transition-colors"
                    >
                      <Plus className="w-3 h-3 text-amber-600" />
                      <span>{emp.nama_lengkap}</span>
                      <span className="text-[10px] text-amber-500">({emp.nik_karyawan})</span>
                    </button>
                  ))}
                  {employeesWithoutSlip.length > 8 && (
                    <span className="text-xs text-amber-600 self-center">
                      +{employeesWithoutSlip.length - 8} lainnya
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabel Slip Gaji */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>
              {isHrd
                ? `Daftar Slip Gaji (${filteredSlips.length} data)`
                : 'Daftar Slip Gaji Resmi'}
            </span>
          </h3>
          <span className="text-xs text-slate-500">
            {isHrd
              ? `Menampilkan periode ${formatPeriodeBulan(selectedPeriode)}`
              : `Pengguna: ${userName}`}
          </span>
        </div>

        {filteredSlips.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">
              Tidak ada data slip gaji yang sesuai kriteria.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {isHrd
                ? 'Gunakan tombol "+ Buat Draf Slip" atau "Salin Semua dari Bulan Lalu" untuk mulai membuat slip.'
                : 'Slip gaji Anda akan tampil di sini begitu resmi diterbitkan oleh HRD.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200/80">
                <tr>
                  {isHrd && <th className="px-4 py-3.5">Karyawan</th>}
                  <th className="px-4 py-3.5">Periode</th>
                  <th className="px-4 py-3.5">Nomor Slip</th>
                  <th className="px-4 py-3.5">Gaji Pokok</th>
                  <th className="px-4 py-3.5">Tunjangan</th>
                  <th className="px-4 py-3.5">Potongan</th>
                  <th className="px-4 py-3.5">Total Diterima</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSlips.map((s) => {
                  const isTerbit = s.status === 'terbit';
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50/75 transition-colors group"
                    >
                      {/* Kolom Karyawan (Khusus HRD) */}
                      {isHrd && (
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">
                            {s.karyawan?.nama_lengkap || '-'}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono">{s.karyawan?.nik_karyawan}</span>
                            <span>·</span>
                            <span>{s.karyawan?.jabatan}</span>
                            {s.karyawan?.divisi && (
                              <>
                                <span>·</span>
                                <span className="text-indigo-600 font-medium">
                                  {s.karyawan.divisi.nama}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Periode */}
                      <td className="px-4 py-3.5 font-medium text-slate-800 whitespace-nowrap">
                        {formatPeriodeBulan(s.periode)}
                      </td>

                      {/* Nomor Slip */}
                      <td className="px-4 py-3.5 font-mono text-xs whitespace-nowrap">
                        {s.nomor_slip ? (
                          <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {s.nomor_slip}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Belum terbit</span>
                        )}
                      </td>

                      {/* Komponen Finansial */}
                      <td className="px-4 py-3.5 font-mono text-slate-700 whitespace-nowrap">
                        {formatRupiah(s.gaji_pokok)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700 whitespace-nowrap">
                        {formatRupiah(s.tunjangan)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-rose-600 whitespace-nowrap">
                        {formatRupiah(s.potongan)}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatRupiah(s.total_diterima)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isTerbit ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Terbit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-full uppercase tracking-wider">
                            <Clock className="w-3.5 h-3.5" />
                            Draf
                          </span>
                        )}
                      </td>

                      {/* Kolom Aksi */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {isTerbit ? (
                            <>
                              <button
                                onClick={() => setPreviewSlip(s)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5 text-slate-500" />
                                <span>Cetak / Lihat</span>
                              </button>

                              {isHrd && (
                                <span
                                  title="Slip yang sudah terbit terkunci permanen (BR-12)"
                                  className="text-slate-400 p-1"
                                >
                                  <Lock className="w-4 h-4" />
                                </span>
                              )}
                            </>
                          ) : (
                            /* Aksi untuk Draf (Hanya HRD) */
                            isHrd && (
                              <>
                                <button
                                  onClick={() => handleOpenEditDraft(s)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>

                                <button
                                  onClick={() => handleDeleteDraft(s.id)}
                                  disabled={deletingId === s.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-medium transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Hapus</span>
                                </button>

                                <button
                                  onClick={() => setPublishModalSlip(s)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Terbitkan</span>
                                </button>
                              </>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: FORM BUAT / EDIT DRAF SLIP GAJI (HRD)                            */}
      {/* ========================================================================= */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                    {draftForm.id ? 'Edit Draf Slip Gaji' : 'Buat Draf Slip Gaji'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Slip pertama kali dibuat dengan status draf (BR-12).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDraftModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDraft} className="mt-5 space-y-4">
              {/* Pilihan Karyawan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Karyawan Penerima Gaji *
                </label>
                <select
                  disabled={Boolean(draftForm.id)}
                  value={draftForm.karyawan_id}
                  onChange={(e) =>
                    setDraftForm({ ...draftForm, karyawan_id: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
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
              </div>

              {/* Periode Bulan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Periode Gaji (Tgl 1) *
                  </label>
                  <input
                    type="date"
                    disabled={Boolean(draftForm.id)}
                    value={draftForm.periode}
                    onChange={(e) =>
                      setDraftForm({ ...draftForm, periode: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Wajib tanggal 1 (contoh: 2026-10-01)
                  </p>
                </div>

                {/* Tombol Salin dari Periode Sebelumnya (BR-12) */}
                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={handleCopyFromPrevious}
                    disabled={copyingPrevious || !draftForm.karyawan_id}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      {copyingPrevious ? 'Menyalin...' : '⚡ Salin Periode Lalu'}
                    </span>
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1 text-center">
                    Auto-isi nilai dari bulan kemarin
                  </p>
                </div>
              </div>

              {/* Input Komponen Finansial */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Gaji Pokok (IDR) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      required
                      placeholder="Contoh: 8500000"
                      value={draftForm.gaji_pokok}
                      onChange={(e) =>
                        setDraftForm({
                          ...draftForm,
                          gaji_pokok: e.target.value,
                        })
                      }
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Tunjangan (IDR)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                        Rp
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={draftForm.tunjangan}
                        onChange={(e) =>
                          setDraftForm({
                            ...draftForm,
                            tunjangan: e.target.value,
                          })
                        }
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Potongan (IDR)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                        Rp
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={draftForm.potongan}
                        onChange={(e) =>
                          setDraftForm({
                            ...draftForm,
                            potongan: e.target.value,
                          })
                        }
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-mono text-rose-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Perhitungan Total Diterima */}
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    currentTotalDiterima >= 0
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Total Diterima (Otomatis):
                  </span>
                  <span className="font-mono text-base font-extrabold">
                    {formatRupiah(currentTotalDiterima)}
                  </span>
                </div>
                {currentTotalDiterima < 0 && (
                  <p className="text-xs text-rose-600 font-medium">
                    ⚠️ Total gaji diterima tidak boleh di bawah 0 (Aturan BR-12).
                  </p>
                )}
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Catatan / Rincian Slip (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Rincian tunjangan makan/transport atau potongan BPJS..."
                  value={draftForm.catatan}
                  onChange={(e) =>
                    setDraftForm({ ...draftForm, catatan: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDraftModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingDraft || currentTotalDiterima < 0}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submittingDraft ? 'Menyimpan...' : 'Simpan Draf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: KONFIRMASI PENERBITAN SLIP GAJI (BR-12)                          */}
      {/* ========================================================================= */}
      {publishModalSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-center text-slate-900">
              Terbitkan Slip Gaji?
            </h3>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 my-4 text-xs text-amber-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Aturan Penguncian Mutlak (BR-12):
              </p>
              <p>
                1. Begitu diterbitkan, slip gaji berstatus <strong>'terbit'</strong> dan{' '}
                <strong>TIDAK DAPAT DIUBAH ATAU DIHAPUS</strong> oleh siapa pun.
              </p>
              <p>
                2. Sistem akan membuat nomor slip resmi unik berformat{' '}
                <span className="font-mono font-bold">SG-TTTTBB-NNN</span> secara berurutan.
              </p>
              <p>3. Karyawan penerima akan langsung dapat melihat dan mencetak slip ini.</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-500">Karyawan:</span>
                <span className="font-bold text-slate-900">
                  {publishModalSlip.karyawan?.nama_lengkap}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Periode:</span>
                <span>{formatPeriodeBulan(publishModalSlip.periode)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200">
                <span className="text-slate-500">Total Diterima:</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {formatRupiah(publishModalSlip.total_diterima)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setPublishModalSlip(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handlePublishSlip}
                disabled={publishing}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {publishing ? 'Menerbitkan...' : 'Ya, Terbitkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PREVIEW & CETAK SLIP GAJI                                        */}
      {/* ========================================================================= */}
      {previewSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Pratinjau Slip Gaji · {previewSlip.nomor_slip || 'Draf'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/slip-gaji/${previewSlip.id}/print`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Lembar Cetak</span>
                </Link>

                <button
                  onClick={() => {
                    const printUrl = `/slip-gaji/${previewSlip.id}/print`;
                    window.open(printUrl, '_blank');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / PDF</span>
                </button>

                <button
                  onClick={() => setPreviewSlip(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Document Body */}
            <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100/50">
              <PayslipDocument slip={previewSlip} isPrintMode={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
