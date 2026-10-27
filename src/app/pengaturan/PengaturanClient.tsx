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
  Eye,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/app/PageHeader';
import { EmptyState } from '@/components/app/SectionCard';
import { Meter } from '@/components/app/StatCard';
import { FormField } from '@/components/app/FormField';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nilai_sebelum: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

const controlClass =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50';

const selectClass = `${controlClass} cursor-pointer`;

const holidayTypeStyles: Record<HolidayItem['jenis'], { pill: string; dot: string }> = {
  nasional: { pill: 'border-destructive/25 bg-destructive/10 text-destructive', dot: 'bg-destructive' },
  cuti_bersama: { pill: 'border-chart-2/40 bg-chart-2/15 text-chart-5', dot: 'bg-chart-2' },
  perusahaan: { pill: 'border-primary/25 bg-primary/10 text-primary', dot: 'bg-primary' },
};

function formatHolidayDate(value: string) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function formatHolidayWeekday(value: string) {
  try {
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date(`${value}T00:00:00`));
  } catch {
    return '';
  }
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
  const [auditLogs] = useState<AuditLogItem[]>(initialAuditLogs);

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
    const base =
      'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase';
    if (aksi.includes('slip') || aksi.includes('penerbitan')) {
      return (
        <span className={`${base} border-primary/25 bg-primary/10 text-primary`}>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          {aksi}
        </span>
      );
    }
    if (aksi.includes('koreksi') || aksi.includes('hapus')) {
      return (
        <span className={`${base} border-destructive/25 bg-destructive/10 text-destructive`}>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
          {aksi}
        </span>
      );
    }
    if (aksi.includes('setuju') || aksi.includes('tambah')) {
      return (
        <span className={`${base} border-primary/25 bg-primary/10 text-primary`}>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          {aksi}
        </span>
      );
    }
    return (
      <span className={`${base} border-border/70 bg-muted text-muted-foreground`}>
        <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground/50" />
        {aksi}
      </span>
    );
  };

  // Ringkasan konfigurasi untuk 4 kartu metrik atas
  const divisionsWithManager = divisions.filter((d) => d.manajer_id).length;
  const nationalHolidaysCount = holidays.filter((h) => h.jenis === 'nasional').length;
  const totalEmployeesWithQuota = quotas.length;

  return (
    <div className="space-y-6">
      <PageHeader
        accent="neutral"
        title="Pengaturan Sistem"
        icon={Settings}
      />

      {/* Toast Notification */}
      {notification && (
        <div
          role={notification.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
            notification.type === 'error'
              ? 'border-destructive/25 bg-destructive/5 text-destructive'
              : 'border-primary/25 bg-primary/10 text-primary'
          }`}
        >
          <div className="flex items-start gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            ) : notification.type === 'error' ? (
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            ) : (
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            aria-label="Tutup notifikasi"
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-current transition-colors duration-150 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4 KARTU RINGKASAN KONFIGURASI SISTEM (WARNA SOFT HARMONIS)                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Divisi & Atasan (Bold Blue) */}
        <button
          type="button"
          onClick={() => setActiveTab('divisi')}
          className={`dash-blue-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5 text-left text-white transition-all duration-200 hover:scale-[1.015] focus-visible:outline-2 focus-visible:outline-blue-400 ${
            activeTab === 'divisi' ? 'ring-2 ring-white/60 shadow-lg' : 'shadow-sm'
          }`}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full border border-white/10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 top-8 size-20 rounded-full bg-[#73b4ff]/20 blur-xl"
          />
          <div>
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-[#73b4ff]" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                  Divisi & Atasan
                </p>
              </div>
              <span className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-[#73b4ff] ring-1 ring-inset ring-white/15">
                <Building2 aria-hidden="true" className="size-4" strokeWidth={1.9} />
              </span>
            </div>

            <div className="relative z-10 mt-3 flex items-baseline gap-1.5">
              <span className="font-heading font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                {divisions.length}
              </span>
              <span className="text-xs font-semibold text-white/80">divisi</span>
            </div>
            <p className="relative z-10 text-[11px] text-white/70 mt-1">
              {divisionsWithManager} dari {divisions.length} divisi memiliki atasan
            </p>
          </div>

          <div className="relative z-10 mt-3 border-t border-white/15 pt-2.5 flex items-center justify-between text-[11px] text-white/80">
            <span>Rasio Terisi</span>
            <span className="font-mono font-bold text-white">
              {divisions.length > 0 ? Math.round((divisionsWithManager / divisions.length) * 100) : 0}%
            </span>
          </div>
        </button>

        {/* Card 2: Master Hari Libur (Bold Amber) */}
        <button
          type="button"
          onClick={() => setActiveTab('libur')}
          className={`dash-amber-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5 text-left text-white transition-all duration-200 hover:scale-[1.015] focus-visible:outline-2 focus-visible:outline-amber-400 ${
            activeTab === 'libur' ? 'ring-2 ring-white/60 shadow-lg' : 'shadow-sm'
          }`}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full border border-white/10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 top-8 size-20 rounded-full bg-[#ffb64d]/20 blur-xl"
          />
          <div>
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-[#ffb64d]" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                  Master Hari Libur
                </p>
              </div>
              <span className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-[#ffd085] ring-1 ring-inset ring-white/15">
                <Calendar aria-hidden="true" className="size-4" strokeWidth={1.9} />
              </span>
            </div>

            <div className="relative z-10 mt-3 flex items-baseline gap-1.5">
              <span className="font-heading font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                {holidays.length}
              </span>
              <span className="text-xs font-semibold text-white/80">hari terdaftar</span>
            </div>
            <p className="relative z-10 text-[11px] text-white/70 mt-1">
              {nationalHolidaysCount} libur nasional resmi
            </p>
          </div>

          <div className="relative z-10 mt-3 border-t border-white/15 pt-2.5 flex items-center justify-between text-[11px] text-white/80">
            <span>Status Validasi</span>
            <span className="font-bold text-amber-200">Aktif Otomatis</span>
          </div>
        </button>

        {/* Card 3: Jatah Cuti Tahunan (Bold Emerald) */}
        <button
          type="button"
          onClick={() => setActiveTab('kuota')}
          className={`dash-emerald-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5 text-left text-white transition-all duration-200 hover:scale-[1.015] focus-visible:outline-2 focus-visible:outline-emerald-400 ${
            activeTab === 'kuota' ? 'ring-2 ring-white/60 shadow-lg' : 'shadow-sm'
          }`}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full border border-white/10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 top-8 size-20 rounded-full bg-[#2ed8b6]/20 blur-xl"
          />
          <div>
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-[#2ed8b6]" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                  Jatah Cuti Tahunan
                </p>
              </div>
              <span className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-[#8df1d8] ring-1 ring-inset ring-white/15">
                <CalendarDays aria-hidden="true" className="size-4" strokeWidth={1.9} />
              </span>
            </div>

            <div className="relative z-10 mt-3 flex items-baseline gap-1.5">
              <span className="font-heading font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                {totalEmployeesWithQuota}
              </span>
              <span className="text-xs font-semibold text-white/80">karyawan</span>
            </div>
            <p className="relative z-10 text-[11px] text-white/70 mt-1">
              Tahun kalender {currentYear} (BR-04)
            </p>
          </div>

          <div className="relative z-10 mt-3 border-t border-white/15 pt-2.5 flex items-center justify-between text-[11px] text-white/80">
            <span>Plafon Maksimal</span>
            <span className="font-mono font-bold text-emerald-200">12 Hari / Thn</span>
          </div>
        </button>

        {/* Card 4: Audit Log Viewer (Bold Indigo) */}
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`dash-indigo-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5 text-left text-white transition-all duration-200 hover:scale-[1.015] focus-visible:outline-2 focus-visible:outline-indigo-400 ${
            activeTab === 'audit' ? 'ring-2 ring-white/60 shadow-lg' : 'shadow-sm'
          }`}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full border border-white/10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 top-8 size-20 rounded-full bg-[#a99ff0]/20 blur-xl"
          />
          <div>
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-[#a99ff0]" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                  Audit Log
                </p>
              </div>
              <span className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-[#c5bfff] ring-1 ring-inset ring-white/15">
                <ShieldCheck aria-hidden="true" className="size-4" strokeWidth={1.9} />
              </span>
            </div>

            <div className="relative z-10 mt-3 flex items-baseline gap-1.5">
              <span className="font-heading font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                {auditLogs.length}
              </span>
              <span className="text-xs font-semibold text-white/80">aktivitas</span>
            </div>
            <p className="relative z-10 text-[11px] text-white/70 mt-1">
              Catatan sistem permanen (BR-12)
            </p>
          </div>

          <div className="relative z-10 mt-3 border-t border-white/15 pt-2.5 flex items-center justify-between text-[11px] text-white/80">
            <span>Integritas</span>
            <span className="font-bold text-indigo-200">Read-Only</span>
          </div>
        </button>
      </div>

      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Bagian pengaturan"
        className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-xs p-1.5 shadow-xs"
      >
        <button
          type="button"
          role="tab"
          id="pengaturan-tab-divisi"
          aria-selected={activeTab === 'divisi'}
          aria-controls="pengaturan-panel-divisi"
          onClick={() => setActiveTab('divisi')}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
            activeTab === 'divisi'
              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/25 shadow-2xs'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Building2 aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          <span>Divisi & Atasan</span>
          <span
            className={`inline-flex min-w-4 items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
              activeTab === 'divisi'
                ? 'bg-blue-500/20 text-blue-800 dark:text-blue-200'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {divisions.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          id="pengaturan-tab-libur"
          aria-selected={activeTab === 'libur'}
          aria-controls="pengaturan-panel-libur"
          onClick={() => setActiveTab('libur')}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
            activeTab === 'libur'
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/25 shadow-2xs'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Calendar aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          <span>Master Hari Libur</span>
          <span
            className={`inline-flex min-w-4 items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
              activeTab === 'libur'
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {holidays.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          id="pengaturan-tab-kuota"
          aria-selected={activeTab === 'kuota'}
          aria-controls="pengaturan-panel-kuota"
          onClick={() => setActiveTab('kuota')}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
            activeTab === 'kuota'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/25 shadow-2xs'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <CalendarDays aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          <span>Jatah Cuti Tahunan</span>
          <span
            className={`inline-flex min-w-4 items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
              activeTab === 'kuota'
                ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {quotas.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          id="pengaturan-tab-audit"
          aria-selected={activeTab === 'audit'}
          aria-controls="pengaturan-panel-audit"
          onClick={() => setActiveTab('audit')}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
            activeTab === 'audit'
              ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/25 shadow-2xs'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <ShieldCheck aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          <span>Audit Log</span>
          <span
            className={`inline-flex min-w-4 items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
              activeTab === 'audit'
                ? 'bg-indigo-500/20 text-indigo-800 dark:text-indigo-200'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MANAJEMEN DIVISI & PENUNJUKAN ATASAN (BR-01)                       */}
      {/* ========================================================================= */}
      {activeTab === 'divisi' && (
        <div role="tabpanel" id="pengaturan-panel-divisi" aria-labelledby="pengaturan-tab-divisi">
          <section
            aria-label="Manajemen Divisi & Penunjukan Manajer (Atasan)"
            className="dash-soft-blue-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 sm:p-6 shadow-xs space-y-5"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-blue-400/10 blur-2xl"
            />
            <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-blue-100 dark:border-blue-900/30 pb-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-2xs">
                  <Building2 className="size-4.5" strokeWidth={1.9} />
                </span>
                <div>
                  <h2 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
                    Manajemen Divisi & Penunjukan Manajer (Atasan)
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Setiap divisi dipimpin paling banyak satu Atasan, dan satu Atasan hanya memimpin satu divisi (Aturan BR-01).
                  </p>
                </div>
              </div>
            </div>

            {divisions.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="Belum ada divisi"
                description="Tambahkan master divisi terlebih dahulu sebelum menunjuk atasan."
              />
            ) : (
              <div className="relative z-10 grid grid-cols-1 gap-4 md:grid-cols-2">
                {divisions.map((div) => (
                  <article
                    key={div.id}
                    className="flex flex-col justify-between rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-background/80 backdrop-blur-xs p-4 transition-all duration-150 hover:border-blue-400/60 hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 border-b border-blue-100 dark:border-blue-900/30 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Building2 className="size-3.5" />
                          </span>
                          <h3 className="font-heading text-sm font-bold tracking-tight text-foreground">
                            {div.nama}
                          </h3>
                        </div>
                        <span className="shrink-0 rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          ID: {div.id.slice(0, 8)}...
                        </span>
                      </div>

                      <div className="mt-3 space-y-2">
                        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                          Manajer / Atasan Saat Ini:
                        </p>
                        {div.manajer ? (
                          <div className="rounded-lg border border-blue-200/50 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-900/40 p-3">
                            <div className="text-sm font-bold text-foreground">
                              {div.manajer.nama_lengkap}
                            </div>
                            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                              {div.manajer.nik_karyawan} · {div.manajer.jabatan}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 rounded-lg border border-dashed border-amber-300/80 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-900/40 p-3 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300 font-medium">
                            <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
                            <span>Belum ada atasan yang ditunjuk untuk divisi ini.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end border-t border-blue-100 dark:border-blue-900/30 pt-3">
                      <button
                        type="button"
                        onClick={() => handleOpenAssignManager(div)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <UserCheck aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                        <span>{div.manajer ? 'Ganti Atasan' : 'Tunjuk Atasan'}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MASTER HARI LIBUR                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'libur' && (
        <div role="tabpanel" id="pengaturan-panel-libur" aria-labelledby="pengaturan-tab-libur">
          <section
            aria-label="Master Hari Libur Resmi"
            className="dash-soft-amber-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-amber-400/10 blur-2xl"
            />
            <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-amber-200/50 dark:border-amber-900/30 pb-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-2xs">
                  <Calendar className="size-4.5" strokeWidth={1.9} />
                </span>
                <div>
                  <h2 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
                    Master Hari Libur Resmi ({holidays.length} Hari Terdaftar)
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Digunakan untuk validasi presensi dan penghitungan hari kerja pengajuan cuti.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenAddHoliday}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Plus aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                <span>Tambah Hari Libur</span>
              </button>
            </div>

            <div className="relative z-10 overflow-x-auto rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-background/80 backdrop-blur-xs shadow-2xs">
              <table className="w-full min-w-[720px] text-left text-xs">
                <caption className="sr-only">
                  Daftar hari libur resmi beserta tanggal, keterangan, dan jenis libur
                </caption>
                <thead className="border-b border-amber-200/60 dark:border-amber-900/40 bg-amber-100/50 dark:bg-amber-950/40 text-[10px] tracking-[0.08em] text-amber-950 dark:text-amber-200 uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Tanggal</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Keterangan</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Jenis Libur</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/60 dark:divide-amber-950/40">
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8">
                        <EmptyState
                          icon={Calendar}
                          title="Belum ada hari libur terdaftar"
                          description="Tambahkan hari libur nasional, cuti bersama, atau libur perusahaan."
                        />
                      </td>
                    </tr>
                  ) : (
                    holidays.map((h) => {
                      const style = holidayTypeStyles[h.jenis] ?? holidayTypeStyles.perusahaan;
                      return (
                        <tr key={h.tanggal} className="transition-colors duration-150 hover:bg-amber-50/40 dark:hover:bg-amber-950/20">
                          <td className="px-4 py-3 align-middle">
                            <time
                              dateTime={h.tanggal}
                              className="block text-xs font-semibold text-foreground tabular-nums"
                            >
                              {formatHolidayDate(h.tanggal)}
                            </time>
                            <span className="block text-[11px] text-muted-foreground">
                              {formatHolidayWeekday(h.tanggal)}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle text-xs font-medium text-foreground">
                            {h.keterangan}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${style.pill}`}
                            >
                              <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
                              {h.jenis.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditHoliday(h)}
                                aria-label={`Edit hari libur ${h.keterangan}`}
                                title="Edit hari libur"
                                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              >
                                <Edit aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteHoliday(h.tanggal)}
                                aria-label={`Hapus hari libur ${h.keterangan}`}
                                title="Hapus hari libur"
                                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-destructive/25 bg-destructive/5 text-destructive transition-colors duration-150 hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              >
                                <Trash2 aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PENETAPAN JATAH CUTI TAHUNAN (BR-04: 0 - 12 HARI)                  */}
      {/* ========================================================================= */}
      {activeTab === 'kuota' && (
        <div role="tabpanel" id="pengaturan-panel-kuota" aria-labelledby="pengaturan-tab-kuota">
          <section
            aria-label="Penetapan Kuota Cuti Tahunan"
            className="dash-soft-emerald-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-emerald-400/10 blur-2xl"
            />
            <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-100 dark:border-emerald-900/30 pb-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-2xs">
                  <CalendarDays className="size-4.5" strokeWidth={1.9} />
                </span>
                <div>
                  <h2 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
                    Penetapan Kuota Cuti Tahunan (Tahun {currentYear})
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Jatah cuti tahunan paling banyak 12 hari kerja per tahun kalender, ditetapkan oleh HRD untuk masing-masing karyawan (Aturan BR-04).
                  </p>
                </div>
              </div>
              <div className="relative w-56 sm:w-64">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <input
                  type="text"
                  placeholder="Cari karyawan / NIK..."
                  value={searchQuota}
                  onChange={(e) => setSearchQuota(e.target.value)}
                  aria-label="Cari kuota karyawan"
                  className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-xs text-foreground transition-colors duration-150 placeholder:text-muted-foreground/70 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20"
                />
              </div>
            </div>

            <div className="relative z-10 overflow-x-auto rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-background/80 backdrop-blur-xs shadow-2xs">
              <table className="w-full min-w-[820px] text-left text-xs">
                <caption className="sr-only">
                  Kuota cuti tahunan karyawan tahun {currentYear} beserta jatah, pemakaian, dan sisa hari
                </caption>
                <thead className="border-b border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-100/50 dark:bg-emerald-950/40 text-[10px] tracking-[0.08em] text-emerald-950 dark:text-emerald-200 uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Karyawan</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Divisi</th>
                    <th scope="col" className="px-4 py-2.5 text-center font-semibold">Jatah Hari (Maks 12)</th>
                    <th scope="col" className="px-4 py-2.5 text-center font-semibold">Terpakai</th>
                    <th scope="col" className="px-4 py-2.5 text-center font-semibold">Sisa Hari</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100/60 dark:divide-emerald-950/40">
                  {filteredQuotas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8">
                        <EmptyState
                          icon={CalendarDays}
                          title="Belum ada kuota cuti yang cocok"
                          description="Ubah kata kunci pencarian atau pastikan HRD sudah menetapkan kuota tahun ini."
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredQuotas.map((q) => {
                      const sisa = Math.max(0, q.jatah_hari - q.terpakai_hari);
                      return (
                        <tr key={q.id} className="transition-colors duration-150 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20">
                          <td className="px-4 py-3 align-middle">
                            <p className="text-xs font-semibold text-foreground">
                              {q.karyawan?.nama_lengkap || 'Karyawan'}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              <span className="font-mono tabular-nums">{q.karyawan?.nik_karyawan}</span>
                              {q.karyawan?.jabatan ? ` · ${q.karyawan.jabatan}` : ''}
                            </p>
                          </td>
                          <td className="px-4 py-3 align-middle text-xs text-muted-foreground">
                            {q.karyawan?.divisi?.nama || '-'}
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            <span className="text-xs font-semibold text-foreground tabular-nums">
                              {q.jatah_hari} <span className="font-normal text-muted-foreground">hari</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {q.terpakai_hari} <span className="text-[11px]">hari</span>
                            </span>
                            <div className="mx-auto mt-1.5 w-20">
                              <Meter
                                value={q.terpakai_hari}
                                max={q.jatah_hari}
                                label={`Pemakaian kuota cuti ${q.karyawan?.nama_lengkap ?? 'karyawan'}`}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                              {sisa} <span className="font-normal text-muted-foreground">hari</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleOpenEditQuota(q)}
                                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              >
                                <Edit aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                                <span>Ubah Jatah</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="relative z-10 border-t border-emerald-100 dark:border-emerald-900/30 pt-3 text-xs text-muted-foreground tabular-nums">
              Menampilkan {filteredQuotas.length} dari {quotas.length} karyawan
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AUDIT LOG VIEWER (READ-ONLY - BR-12)                               */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div role="tabpanel" id="pengaturan-panel-audit" aria-labelledby="pengaturan-tab-audit">
          <section
            aria-label="Audit Log Viewer"
            className="dash-soft-indigo-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-indigo-400/10 blur-2xl"
            />
            <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-indigo-100 dark:border-indigo-900/30 pb-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shadow-2xs">
                  <ShieldCheck className="size-4.5" strokeWidth={1.9} />
                </span>
                <div>
                  <h2 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
                    Audit Log Viewer (Tabel Rekaman Permanen & Read-Only)
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Audit log bersifat permanen dan tidak dapat diubah atau dihapus oleh siapa pun lewat aplikasi (Aturan BR-12).
                  </p>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex flex-col gap-2 border-b border-indigo-100 dark:border-indigo-900/30 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                aria-label="Filter aksi audit"
                className="h-9 w-full cursor-pointer rounded-lg border border-input bg-background px-2.5 text-xs font-semibold text-foreground transition-colors duration-150 hover:border-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 sm:w-auto"
              >
                <option value="all">Semua Aksi</option>
                {uniqueActions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>

              <div className="relative w-full sm:w-64">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <input
                  type="text"
                  placeholder="Cari aksi, tabel, data ID..."
                  value={searchAudit}
                  onChange={(e) => setSearchAudit(e.target.value)}
                  aria-label="Cari audit log"
                  className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-xs text-foreground transition-colors duration-150 placeholder:text-muted-foreground/70 hover:border-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="relative z-10 overflow-x-auto rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 bg-background/80 backdrop-blur-xs shadow-2xs">
              <table className="w-full min-w-[820px] text-left text-xs">
                <caption className="sr-only">
                  Rekaman audit log: waktu, pelaku, aksi, tabel, ID data, dan rincian nilai
                </caption>
                <thead className="border-b border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/70 dark:bg-indigo-950/40 text-[10px] tracking-[0.08em] text-indigo-950 dark:text-indigo-200 uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Waktu (WIB)</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Pelaku</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Aksi</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Tabel</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">ID Data</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Rincian Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-100/60 dark:divide-indigo-950/40">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8">
                        <EmptyState
                          icon={ShieldCheck}
                          title="Tidak ada rekaman audit log yang sesuai"
                          description="Sesuaikan kata kunci pencarian atau filter aksi untuk melihat rekaman lain."
                        />
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
                        <tr key={log.id} className="transition-colors duration-150 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20">
                          <td className="px-4 py-3 align-middle font-mono text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
                            {timeStr}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <p className="text-xs font-semibold text-foreground">
                              {log.pelaku?.nama_lengkap || 'System'}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{log.pelaku?.email || '-'}</p>
                          </td>
                          <td className="px-4 py-3 align-middle whitespace-nowrap">{getActionBadge(log.aksi)}</td>
                          <td className="px-4 py-3 align-middle font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                            {log.nama_tabel}
                          </td>
                          <td className="px-4 py-3 align-middle font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                            {log.data_id ? `${log.data_id.slice(0, 8)}...` : '-'}
                          </td>
                          <td className="px-4 py-3 align-middle whitespace-nowrap">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => setSelectedAuditLog(log)}
                                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              >
                                <Eye aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                                <span>Lihat Diff</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FORM ASSIGN MANAGER DIVISI (BR-01)                               */}
      {/* ========================================================================= */}
      {managerModalDivisi && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manager-modal-title"
            className="my-4 w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <h2
                  id="manager-modal-title"
                  className="font-heading text-sm font-semibold tracking-tight text-foreground"
                >
                  Tunjuk Manajer Divisi {managerModalDivisi.nama}
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Satu atasan hanya memimpin satu divisi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManagerModalDivisi(null)}
                aria-label="Tutup penunjukan manajer"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={handleSaveManager}>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Aturan BR-01: </span>
                  Satu Atasan hanya memimpin satu divisi. Jika karyawan sudah memimpin divisi lain, penunjukan akan ditolak.
                </div>

                <FormField label="Pilih Karyawan Calon Atasan" htmlFor="manager-candidate">
                  <select
                    id="manager-candidate"
                    value={selectedManagerId}
                    onChange={(e) => setSelectedManagerId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">-- Kosongkan Manajer --</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nama_lengkap} ({c.nik_karyawan}) - {c.jabatan}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-card px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setManagerModalDivisi(null)}
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-card px-3.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingManager}
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="holiday-modal-title"
            className="my-4 w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <h2
                  id="holiday-modal-title"
                  className="font-heading text-sm font-semibold tracking-tight text-foreground"
                >
                  {holidayModal.old_tanggal ? 'Edit Hari Libur' : 'Tambah Hari Libur'}
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Tanggal libur dipakai untuk validasi check-in dan hitungan hari kerja cuti.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHolidayModal({ ...holidayModal, show: false })}
                aria-label="Tutup formulir hari libur"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday}>
              <div className="space-y-4 px-5 py-5">
                <FormField label="Tanggal Libur" htmlFor="holiday-date" required>
                  <input
                    id="holiday-date"
                    type="date"
                    required
                    value={holidayModal.tanggal}
                    onChange={(e) => setHolidayModal({ ...holidayModal, tanggal: e.target.value })}
                    className={`${controlClass} font-mono`}
                  />
                </FormField>

                <FormField label="Keterangan Hari Libur" htmlFor="holiday-description" required>
                  <input
                    id="holiday-description"
                    type="text"
                    required
                    placeholder="Contoh: Hari Kemerdekaan RI"
                    value={holidayModal.keterangan}
                    onChange={(e) => setHolidayModal({ ...holidayModal, keterangan: e.target.value })}
                    className={controlClass}
                  />
                </FormField>

                <FormField label="Jenis Libur" htmlFor="holiday-type" required>
                  <select
                    id="holiday-type"
                    value={holidayModal.jenis}
                    onChange={(e) =>
                      setHolidayModal({
                        ...holidayModal,
                        jenis: e.target.value as HolidayItem['jenis'],
                      })
                    }
                    className={selectClass}
                  >
                    <option value="nasional">Hari Libur Nasional</option>
                    <option value="cuti_bersama">Cuti Bersama</option>
                    <option value="perusahaan">Libur Khusus Perusahaan</option>
                  </select>
                </FormField>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-card px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setHolidayModal({ ...holidayModal, show: false })}
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-card px-3.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingHoliday}
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quota-modal-title"
            className="my-4 w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <h2
                  id="quota-modal-title"
                  className="font-heading text-sm font-semibold tracking-tight text-foreground"
                >
                  Tetapkan Jatah Cuti Tahunan ({quotaModal.tahun})
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Jatah dihitung per tahun kalender dan dipakai untuk seluruh pengajuan cuti.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuotaModal(null)}
                aria-label="Tutup formulir kuota cuti"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={handleSaveQuota}>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
                  <p className="font-semibold text-foreground">{quotaModal.nama_lengkap}</p>
                  <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {quotaModal.nik_karyawan}
                  </p>
                </div>

                <FormField
                  label="Jatah Cuti Tahunan (0 s/d 12 Hari Kerja)"
                  htmlFor="quota-days"
                  required
                  hint="Aturan BR-04: Setiap karyawan mendapat jatah cuti paling banyak 12 hari per tahun kalender."
                >
                  <input
                    id="quota-days"
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
                    className={`${controlClass} font-mono tabular-nums`}
                  />
                </FormField>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-card px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setQuotaModal(null)}
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-card px-3.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingQuota}
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-modal-title"
            className="my-4 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                >
                  <ShieldCheck className="size-4" strokeWidth={1.75} />
                </span>
                <div>
                  <h2
                    id="audit-modal-title"
                    className="font-heading text-sm font-semibold tracking-tight text-foreground"
                  >
                    Rincian Log Audit · {selectedAuditLog.aksi}
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Rekaman permanen dan tidak dapat diubah melalui aplikasi.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                aria-label="Tutup rincian audit log"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-5 text-xs">
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Tabel:</span>{' '}
                  <span className="font-mono font-semibold text-foreground">{selectedAuditLog.nama_tabel}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pelaku:</span>{' '}
                  <span className="font-semibold text-foreground">{selectedAuditLog.pelaku?.nama_lengkap || 'System'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Data ID:</span>{' '}
                  <span className="font-mono text-foreground">{selectedAuditLog.data_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Waktu:</span>{' '}
                  <span className="font-mono text-foreground tabular-nums">
                    {new Date(selectedAuditLog.dibuat_pada).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* JSON Diff */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
                    <span>Nilai Sebelum (Old Value)</span>
                  </div>
                  <pre className="max-h-60 overflow-x-auto rounded-xl border border-border/70 bg-muted/40 p-3.5 font-mono text-[11px] leading-relaxed text-foreground">
                    {selectedAuditLog.nilai_sebelum
                      ? JSON.stringify(selectedAuditLog.nilai_sebelum, null, 2)
                      : '(null / Data Baru)'}
                  </pre>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                    <span>Nilai Sesudah (New Value)</span>
                  </div>
                  <pre className="max-h-60 overflow-x-auto rounded-xl border border-border/70 bg-muted/40 p-3.5 font-mono text-[11px] leading-relaxed text-foreground">
                    {selectedAuditLog.nilai_sesudah
                      ? JSON.stringify(selectedAuditLog.nilai_sesudah, null, 2)
                      : '(null / Data Dihapus)'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-border/70 bg-card px-5 py-3.5">
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-card px-3.5 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
