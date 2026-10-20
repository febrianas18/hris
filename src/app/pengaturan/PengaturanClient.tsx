'use client';

import React, { useState, useMemo } from 'react';
import {
  Settings,
  Building2,
  Calendar,
  CalendarDays,
  ShieldCheck,
  Search,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  Lock,
  Eye,
  Info,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';

export interface DivisiItem {
  id: string;
  nama: string;
  manajer_id: string | null;
  manajer?: {
    id: string;
    nama_lengkap: string;
    nik_karyawan: string;
    jabatan: string;
    email: string;
  } | null;
}

export interface HolidayItem {
  tanggal: string;
  keterangan: string;
  jenis: 'nasional' | 'cuti_bersama' | 'perusahaan';
}

export interface QuotaItem {
  id: string;
  karyawan_id: string;
  tahun: number;
  jatah_hari: number;
  terpakai_hari: number;
  karyawan?: {
    id: string;
    nama_lengkap: string;
    nik_karyawan: string;
    jabatan: string;
    divisi?: {
      nama: string;
    } | null;
  } | null;
}

export interface AuditLogItem {
  id: string;
  pelaku_id: string;
  aksi: string;
  nama_tabel: string;
  data_id: string;
  nilai_sebelum: any;
  nilai_sesudah: any;
  dibuat_pada: string;
  pelaku?: {
    nama_lengkap: string;
    email: string;
  } | null;
}

export interface CandidateEmployee {
  id: string;
  nik_karyawan: string;
  nama_lengkap: string;
  jabatan: string;
  divisi_id: string;
  peran: string;
}

interface PengaturanClientProps {
  initialDivisions: DivisiItem[];
  initialHolidays: HolidayItem[];
  initialQuotas: QuotaItem[];
  initialAuditLogs: AuditLogItem[];
  candidates: CandidateEmployee[];
  currentYear: number;
}

export default function PengaturanClient({
  initialDivisions,
  initialHolidays,
  initialQuotas,
  initialAuditLogs,
  candidates,
  currentYear,
}: PengaturanClientProps) {
  const [activeTab, setActiveTab] = useState<'divisi' | 'libur' | 'kuota' | 'audit'>('divisi');

  // Data states
  const [divisions, setDivisions] = useState<DivisiItem[]>(initialDivisions);
  const [holidays, setHolidays] = useState<HolidayItem[]>(initialHolidays);
  const [quotas, setQuotas] = useState<QuotaItem[]>(initialQuotas);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(initialAuditLogs);

  // Notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // =========================================================================
  // TAB 1: MODAL ASSIGN MANAGER DIVISI (BR-01)
  // =========================================================================
  const [managerModalDivisi, setManagerModalDivisi] = useState<DivisiItem | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [submittingManager, setSubmittingManager] = useState<boolean>(false);

  const handleOpenAssignManager = (div: DivisiItem) => {
    setManagerModalDivisi(div);
    setSelectedManagerId(div.manajer_id || '');
  };

  const handleSaveManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerModalDivisi) return;

    try {
      setSubmittingManager(true);
      const res = await fetch('/api/settings/divisi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          divisi_id: managerModalDivisi.id,
          manajer_id: selectedManagerId || null,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setNotification({ type: 'error', message: json.error });
        return;
      }

      setNotification({ type: 'success', message: json.message });
      setManagerModalDivisi(null);

      // Refresh list divisi
      setDivisions((prev) =>
        prev.map((d) => {
          if (d.id === managerModalDivisi.id) {
            const cand = candidates.find((c) => c.id === selectedManagerId);
            return {
              ...d,
              manajer_id: selectedManagerId || null,
              manajer: cand
                ? {
                    id: cand.id,
                    nama_lengkap: cand.nama_lengkap,
                    nik_karyawan: cand.nik_karyawan,
                    jabatan: cand.jabatan,
                    email: '',
                  }
                : null,
            };
          }
          return d;
        })
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah manajer divisi.';
      setNotification({ type: 'error', message: msg });
    } finally {
      setSubmittingManager(false);
    }
  };

  // =========================================================================
  // TAB 2: MODAL HARI LIBUR (TAMBAH / EDIT / HAPUS)
  // =========================================================================
  const [holidayModal, setHolidayModal] = useState<{
    show: boolean;
    old_tanggal: string | null;
    tanggal: string;
    keterangan: string;
    jenis: 'nasional' | 'cuti_bersama' | 'perusahaan';
  }>({
    show: false,
    old_tanggal: null,
    tanggal: '',
    keterangan: '',
    jenis: 'nasional',
  });
  const [submittingHoliday, setSubmittingHoliday] = useState<boolean>(false);

  const handleOpenAddHoliday = () => {
    setHolidayModal({
      show: true,
      old_tanggal: null,
      tanggal: '',
      keterangan: '',
      jenis: 'nasional',
    });
  };

  const handleOpenEditHoliday = (h: HolidayItem) => {
    setHolidayModal({
      show: true,
      old_tanggal: h.tanggal,
      tanggal: h.tanggal,
      keterangan: h.keterangan,
      jenis: h.jenis,
    });
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingHoliday(true);
      const res = await fetch('/api/settings/holiday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_tanggal: holidayModal.old_tanggal || undefined,
          tanggal: holidayModal.tanggal,
          keterangan: holidayModal.keterangan,
          jenis: holidayModal.jenis,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setNotification({ type: 'error', message: json.error });
        return;
      }

      setNotification({ type: 'success', message: json.message });
      setHolidayModal({ show: false, old_tanggal: null, tanggal: '', keterangan: '', jenis: 'nasional' });

      // Perbarui list lokal
      setHolidays((prev) => {
        const filtered = prev.filter(
          (h) => h.tanggal !== holidayModal.old_tanggal && h.tanggal !== holidayModal.tanggal
        );
        return [...filtered, json.data].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan hari libur.';
      setNotification({ type: 'error', message: msg });
    } finally {
      setSubmittingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (tanggal: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data hari libur tanggal ${tanggal}?`)) return;
    try {
      const res = await fetch(`/api/settings/holiday?tanggal=${tanggal}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) {
        setNotification({ type: 'error', message: json.error });
        return;
      }
      setNotification({ type: 'success', message: json.message });
      setHolidays((prev) => prev.filter((h) => h.tanggal !== tanggal));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus hari libur.';
      setNotification({ type: 'error', message: msg });
    }
  };

  // =========================================================================
  // TAB 3: MODAL KUOTA CUTI (BR-04: 0 - 12 HARI)
  // =========================================================================
  const [quotaModal, setQuotaModal] = useState<{
    show: boolean;
    karyawan_id: string;
    nama_lengkap: string;
    nik_karyawan: string;
    tahun: number;
    jatah_hari: number;
  } | null>(null);
  const [submittingQuota, setSubmittingQuota] = useState<boolean>(false);
  const [searchQuota, setSearchQuota] = useState<string>('');

  const handleOpenEditQuota = (q: QuotaItem) => {
    setQuotaModal({
      show: true,
      karyawan_id: q.karyawan_id,
      nama_lengkap: q.karyawan?.nama_lengkap || '',
      nik_karyawan: q.karyawan?.nik_karyawan || '',
      tahun: q.tahun,
      jatah_hari: q.jatah_hari,
    });
  };

  const handleSaveQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotaModal) return;

    try {
      setSubmittingQuota(true);
      const res = await fetch('/api/settings/quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          karyawan_id: quotaModal.karyawan_id,
          tahun: quotaModal.tahun,
          jatah_hari: quotaModal.jatah_hari,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setNotification({ type: 'error', message: json.error });
        return;
      }

      setNotification({ type: 'success', message: json.message });
      setQuotas((prev) =>
        prev.map((q) =>
          q.karyawan_id === quotaModal.karyawan_id && q.tahun === quotaModal.tahun
            ? { ...q, jatah_hari: quotaModal.jatah_hari }
            : q
        )
      );
      setQuotaModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui jatah cuti.';
      setNotification({ type: 'error', message: msg });
    } finally {
      setSubmittingQuota(false);
    }
  };

  const filteredQuotas = useMemo(() => {
    if (!searchQuota.trim()) return quotas;
    const q = searchQuota.toLowerCase();
    return quotas.filter(
      (item) =>
        item.karyawan?.nama_lengkap.toLowerCase().includes(q) ||
        item.karyawan?.nik_karyawan.toLowerCase().includes(q)
    );
  }, [quotas, searchQuota]);

  // =========================================================================
  // TAB 4: AUDIT LOG VIEWER (READ-ONLY - BR-12)
  // =========================================================================
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogItem | null>(null);
  const [searchAudit, setSearchAudit] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('all');

  const uniqueActions = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => set.add(l.aksi));
    return Array.from(set).sort();
  }, [auditLogs]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (filterAction !== 'all' && log.aksi !== filterAction) return false;
      if (searchAudit.trim()) {
        const q = searchAudit.toLowerCase();
        const matchAction = log.aksi.toLowerCase().includes(q);
        const matchTable = log.nama_tabel.toLowerCase().includes(q);
        const matchDataId = log.data_id?.toLowerCase().includes(q);
        const matchPelaku = log.pelaku?.nama_lengkap.toLowerCase().includes(q);
        if (!matchAction && !matchTable && !matchDataId && !matchPelaku) return false;
      }
      return true;
    });
  }, [auditLogs, filterAction, searchAudit]);

  const getActionBadge = (aksi: string) => {
    if (aksi.includes('slip') || aksi.includes('penerbitan')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
          {aksi}
        </span>
      );
    }
    if (aksi.includes('koreksi') || aksi.includes('hapus')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200">
          {aksi}
        </span>
      );
    }
    if (aksi.includes('setuju') || aksi.includes('tambah')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
          {aksi}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
        {aksi}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in duration-200 ${
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
        <div className="flex items-center gap-3.5 pb-6 border-b border-slate-100">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Pengaturan Sistem & Master Data HRIS
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Khusus HRD: Manajemen Divisi & Atasan, Hari Libur, Kuota Cuti Tahunan, dan Audit Log (BR-01, BR-04, BR-12).
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 pt-6">
          <button
            onClick={() => setActiveTab('divisi')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'divisi'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Divisi & Atasan (BR-01)</span>
          </button>

          <button
            onClick={() => setActiveTab('libur')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'libur'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Master Hari Libur</span>
          </button>

          <button
            onClick={() => setActiveTab('kuota')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'kuota'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Jatah Cuti Tahunan (BR-04)</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Audit Log (BR-12)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MANAJEMEN DIVISI & PENUNJUKAN ATASAN (BR-01)                       */}
      {/* ========================================================================= */}
      {activeTab === 'divisi' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <span>Manajemen Divisi & Penunjukan Manajer (Atasan)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aturan BR-01: Setiap divisi dipimpin paling banyak satu Atasan, dan satu Atasan hanya memimpin satu divisi.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {divisions.map((div) => (
              <div
                key={div.id}
                className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
                    <span className="font-bold text-slate-900 text-base">{div.nama}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      ID: {div.id.slice(0, 8)}...
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="text-xs text-slate-500 font-medium">Manajer / Atasan Saat Ini:</div>
                    {div.manajer ? (
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <div className="font-bold text-sm text-slate-900">{div.manajer.nama_lengkap}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {div.manajer.nik_karyawan} · {div.manajer.jabatan}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Belum ada atasan yang ditunjuk untuk divisi ini.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-200/70 flex justify-end">
                  <button
                    onClick={() => handleOpenAssignManager(div)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{div.manajer ? 'Ganti Atasan' : 'Tunjuk Atasan'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MASTER HARI LIBUR                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'libur' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <span>Master Hari Libur Resmi ({holidays.length} Hari Terdaftar)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Digunakan untuk validasi check-in (BR-02) dan penghitungan hari kerja pengajuan cuti (BR-05).
              </p>
            </div>

            <button
              onClick={handleOpenAddHoliday}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-2xs transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Hari Libur</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4">Jenis Libur</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {holidays.map((h) => (
                  <tr key={h.tanggal} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {h.tanggal}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{h.keterangan}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          h.jenis === 'nasional'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : h.jenis === 'cuti_bersama'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        }`}
                      >
                        {h.jenis.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditHoliday(h)}
                        className="text-slate-600 hover:text-indigo-600 p-1 font-medium"
                      >
                        <Edit className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => handleDeleteHoliday(h.tanggal)}
                        className="text-rose-600 hover:text-rose-800 p-1 font-medium"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PENETAPAN JATAH CUTI TAHUNAN (BR-04: 0 - 12 HARI)                  */}
      {/* ========================================================================= */}
      {activeTab === 'kuota' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-600" />
                <span>Penetapan Kuota Cuti Tahunan (Tahun {currentYear})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aturan BR-04: Jatah cuti tahunan paling banyak 12 hari kerja per tahun kalender, ditetapkan HRD per karyawan.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari karyawan / NIK..."
                value={searchQuota}
                onChange={(e) => setSearchQuota(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Karyawan</th>
                  <th className="py-3 px-4">Divisi</th>
                  <th className="py-3 px-4 text-center">Jatah Hari (Maks 12)</th>
                  <th className="py-3 px-4 text-center">Terpakai</th>
                  <th className="py-3 px-4 text-center">Sisa Hari</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotas.map((q) => {
                  const sisa = Math.max(0, q.jatah_hari - q.terpakai_hari);
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <p>{q.karyawan?.nama_lengkap || 'Karyawan'}</p>
                        <p className="text-[10px] text-slate-400 font-mono font-normal">
                          {q.karyawan?.nik_karyawan} · {q.karyawan?.jabatan}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {q.karyawan?.divisi?.nama || '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {q.jatah_hari} hari
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        {q.terpakai_hari} hari
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                        {sisa} hari
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditQuota(q)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5 text-slate-500" />
                          <span>Ubah Jatah</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AUDIT LOG VIEWER (READ-ONLY - BR-12)                               */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>Audit Log Viewer (Tabel Rekaman Permanen & Read-Only)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aturan BR-12: Audit log tidak bisa diubah atau dihapus oleh siapa pun lewat aplikasi.
              </p>
            </div>

            {/* Filter Aksi & Pencarian */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Semua Aksi</option>
                {uniqueActions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>

              <div className="relative w-48 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari aksi, tabel, data ID..."
                  value={searchAudit}
                  onChange={(e) => setSearchAudit(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Waktu (WIB)</th>
                  <th className="py-3 px-3">Pelaku</th>
                  <th className="py-3 px-3">Aksi</th>
                  <th className="py-3 px-3">Tabel</th>
                  <th className="py-3 px-3">ID Data</th>
                  <th className="py-3 px-3 text-right">Rincian Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Tidak ada rekaman audit log yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => {
                    const timeStr = new Intl.DateTimeFormat('id-ID', {
                      timeZone: 'Asia/Jakarta',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    }).format(new Date(log.dibuat_pada));

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {timeStr}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{log.pelaku?.nama_lengkap || 'System'}</p>
                          <p className="text-[10px] text-slate-400">{log.pelaku?.email || '-'}</p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getActionBadge(log.aksi)}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {log.nama_tabel}
                        </td>
                        <td className="py-3 px-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                          {log.data_id ? `${log.data_id.slice(0, 8)}...` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedAuditLog(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>Lihat Diff</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FORM ASSIGN MANAGER DIVISI (BR-01)                               */}
      {/* ========================================================================= */}
      {managerModalDivisi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Tunjuk Manajer Divisi {managerModalDivisi.nama}
              </h3>
              <button
                onClick={() => setManagerModalDivisi(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManager} className="mt-4 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600">
                <span className="font-bold text-slate-900">Aturan BR-01: </span>
                Satu Atasan hanya memimpin satu divisi. Jika karyawan sudah memimpin divisi lain, penunjukan akan ditolak.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pilih Karyawan Calon Atasan
                </label>
                <select
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Kosongkan Manajer --</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama_lengkap} ({c.nik_karyawan}) - {c.jabatan}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setManagerModalDivisi(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingManager}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submittingManager ? 'Menyimpan...' : 'Simpan Penunjukan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FORM HARI LIBUR (TAMBAH / EDIT)                                  */}
      {/* ========================================================================= */}
      {holidayModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {holidayModal.old_tanggal ? 'Edit Hari Libur' : 'Tambah Hari Libur'}
              </h3>
              <button
                onClick={() => setHolidayModal({ ...holidayModal, show: false })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tanggal Libur *
                </label>
                <input
                  type="date"
                  required
                  value={holidayModal.tanggal}
                  onChange={(e) => setHolidayModal({ ...holidayModal, tanggal: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Keterangan Hari Libur *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Hari Kemerdekaan RI"
                  value={holidayModal.keterangan}
                  onChange={(e) => setHolidayModal({ ...holidayModal, keterangan: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Jenis Libur *
                </label>
                <select
                  value={holidayModal.jenis}
                  onChange={(e) =>
                    setHolidayModal({
                      ...holidayModal,
                      jenis: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="nasional">Hari Libur Nasional</option>
                  <option value="cuti_bersama">Cuti Bersama</option>
                  <option value="perusahaan">Libur Khusus Perusahaan</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setHolidayModal({ ...holidayModal, show: false })}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingHoliday}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submittingHoliday ? 'Menyimpan...' : 'Simpan Hari Libur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: FORM JATAH CUTI (BR-04: 0 - 12 HARI)                             */}
      {/* ========================================================================= */}
      {quotaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Tetapkan Jatah Cuti Tahunan ({quotaModal.tahun})
              </h3>
              <button onClick={() => setQuotaModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuota} className="mt-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <p className="font-bold text-slate-900">{quotaModal.nama_lengkap}</p>
                <p className="text-slate-500 font-mono">{quotaModal.nik_karyawan}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Jatah Cuti Tahunan (0 s/d 12 Hari Kerja) *
                </label>
                <input
                  type="number"
                  min="0"
                  max="12"
                  required
                  value={quotaModal.jatah_hari}
                  onChange={(e) =>
                    setQuotaModal({
                      ...quotaModal,
                      jatah_hari: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Aturan BR-04: Setiap karyawan mendapat jatah cuti paling banyak 12 hari per tahun kalender.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuotaModal(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingQuota}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submittingQuota ? 'Menyimpan...' : 'Simpan Jatah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: AUDIT LOG DIFF / JSON VIEWER (READ-ONLY)                         */}
      {/* ========================================================================= */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Rincian Log Audit · {selectedAuditLog.aksi}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4 my-2 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500">Tabel:</span>{' '}
                  <span className="font-mono font-bold text-slate-800">{selectedAuditLog.nama_tabel}</span>
                </div>
                <div>
                  <span className="text-slate-500">Pelaku:</span>{' '}
                  <span className="font-bold text-slate-800">{selectedAuditLog.pelaku?.nama_lengkap || 'System'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Data ID:</span>{' '}
                  <span className="font-mono text-slate-800">{selectedAuditLog.data_id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Waktu:</span>{' '}
                  <span className="font-mono text-slate-800">{new Date(selectedAuditLog.dibuat_pada).toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* JSON Diff */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Nilai Sebelum (Old Value)</span>
                  </div>
                  <pre className="bg-slate-900 text-slate-200 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60">
                    {selectedAuditLog.nilai_sebelum
                      ? JSON.stringify(selectedAuditLog.nilai_sebelum, null, 2)
                      : '(null / Data Baru)'}
                  </pre>
                </div>

                <div>
                  <div className="font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Nilai Sesudah (New Value)</span>
                  </div>
                  <pre className="bg-slate-900 text-slate-200 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60">
                    {selectedAuditLog.nilai_sesudah
                      ? JSON.stringify(selectedAuditLog.nilai_sesudah, null, 2)
                      : '(null / Data Dihapus)'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
