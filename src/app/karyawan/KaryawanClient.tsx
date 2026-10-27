'use client';

import React, { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit3,
  UserX,
  UserCheck,
  Eye,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  CalendarDays,
  Briefcase,
  ShieldCheck,
  Info,
  BadgeCheck,
  Ban,
  RotateCcw,
} from 'lucide-react';
import { PageHeader, MetaDot } from '@/components/app/PageHeader';
import { SectionCard, EmptyState } from '@/components/app/SectionCard';
import { StatCard, Meter } from '@/components/app/StatCard';
import { FormField } from '@/components/app/FormField';

export interface DivisiOption {
  id: string;
  nama: string;
  manajer_id: string | null;
  manajer_nama: string | null;
}

export interface EmployeeItem {
  id: string;
  nik_karyawan: string;
  nama_lengkap: string;
  email: string;
  nomor_hp: string | null;
  peran: 'karyawan' | 'atasan' | 'hrd';
  jabatan: string;
  status_kerja: string;
  tanggal_masuk: string;
  aktif: boolean;
  divisi_id: string | null;
  divisi: { id: string; nama: string } | null;
  kuota: { jatah_hari: number; terpakai_hari: number } | null;
}

interface DetailData {
  profile: EmployeeItem;
  quota: { id: string; tahun: number; jatah_hari: number; terpakai_hari: number } | null;
  pengajuan: Array<{
    id: string;
    jenis: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    jumlah_hari: number;
    status: string;
    alasan: string;
    dibuat_pada: string;
  }>;
  absensi: Array<{
    id: string;
    tanggal: string;
    jam_masuk: string | null;
    jam_pulang: string | null;
    status: string;
    alasan_koreksi: string | null;
  }>;
  tahun: number;
}

interface KaryawanClientProps {
  initialEmployees: EmployeeItem[];
  divisions: DivisiOption[];
  currentUserId: string;
  currentUserRole: 'karyawan' | 'atasan' | 'hrd';
  currentYear: number;
  nextNik: string;
}

interface FormState {
  email: string;
  password: string;
  nik_karyawan: string;
  nama_lengkap: string;
  nomor_hp: string;
  peran: 'karyawan' | 'atasan' | 'hrd';
  divisi_id: string;
  jabatan: string;
  status_kerja: string;
  tanggal_masuk: string;
  aktif: boolean;
  jatah_hari: number;
}

const emptyForm = (nextNik: string): FormState => ({
  email: '',
  password: '',
  nik_karyawan: nextNik,
  nama_lengkap: '',
  nomor_hp: '',
  peran: 'karyawan',
  divisi_id: '',
  jabatan: '',
  status_kerja: 'kontrak',
  tanggal_masuk: new Date().toISOString().slice(0, 10),
  aktif: true,
  jatah_hari: 12,
});

const roleLabel: Record<EmployeeItem['peran'], string> = {
  karyawan: 'Karyawan',
  atasan: 'Atasan',
  hrd: 'HRD',
};

const roleClass: Record<EmployeeItem['peran'], string> = {
  karyawan: 'bg-muted text-muted-foreground border-border/70',
  atasan: 'bg-chart-2/15 text-chart-5 border-chart-2/40',
  hrd: 'bg-primary/10 text-primary border-primary/25',
};

const controlClass =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50';

const selectClass = `${controlClass} cursor-pointer`;

const statusLabel: Record<string, string> = {
  tetap: 'Tetap',
  kontrak: 'Kontrak',
  magang: 'Magang',
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

function formatDate(value: string | null) {
  if (!value) return '-';
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

function formatDateTime(value: string | null) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusPengajuanLabel(status: string) {
  const map: Record<string, string> = {
    diajukan: 'Diajukan',
    disetujui_atasan: 'Disetujui Atasan',
    disetujui: 'Disetujui',
    ditolak: 'Ditolak',
    dibatalkan: 'Dibatalkan',
  };
  return map[status] ?? status;
}

/** Warna titik status; teks status selalu ditampilkan agar tidak bergantung pada warna. */
function statusDotClass(status: string) {
  const normalized = status.toLowerCase();
  if (['disetujui', 'hadir', 'aktif'].includes(normalized)) return 'bg-primary';
  if (['disetujui_atasan', 'terlambat'].includes(normalized)) return 'bg-chart-2';
  if (['ditolak', 'dibatalkan', 'alpa'].includes(normalized)) return 'bg-destructive';
  return 'bg-muted-foreground/50';
}

export default function KaryawanClient({
  initialEmployees,
  divisions,
  currentUserId,
  currentUserRole,
  currentYear,
  nextNik,
}: KaryawanClientProps) {
  const isHrd = currentUserRole === 'hrd';

  const [employees, setEmployees] = useState<EmployeeItem[]>(initialEmployees);
  const [search, setSearch] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<EmployeeItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(nextNik));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (divisionFilter !== 'all' && e.divisi_id !== divisionFilter) return false;
      if (roleFilter !== 'all' && e.peran !== roleFilter) return false;
      if (statusFilter === 'active' && !e.aktif) return false;
      if (statusFilter === 'inactive' && e.aktif) return false;
      if (!q) return true;
      return [e.nama_lengkap, e.nik_karyawan, e.email, e.jabatan, e.divisi?.nama ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [employees, search, divisionFilter, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.aktif).length;
    const inactive = total - active;
    const atasan = employees.filter((e) => e.peran === 'atasan' && e.aktif).length;
    return { total, active, inactive, atasan };
  }, [employees]);

  const selectedDivision = divisions.find((d) => d.id === form.divisi_id);
  const divisionHasOtherManager =
    form.peran === 'atasan' &&
    selectedDivision?.manajer_id &&
    selectedDivision.manajer_id !== editing?.id;
  const editingSelf = editing?.id === currentUserId;

  const activeFilterCount = [divisionFilter !== 'all', roleFilter !== 'all', statusFilter !== 'all'].filter(
    Boolean
  ).length;
  const hasActiveFilter = activeFilterCount > 0 || search.trim().length > 0;

  function resetFilters() {
    setSearch('');
    setDivisionFilter('all');
    setRoleFilter('all');
    setStatusFilter('all');
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(nextNik));
    setFormError(null);
    setModalMode('create');
  }

  function openEdit(employee: EmployeeItem) {
    setEditing(employee);
    setForm({
      email: employee.email,
      password: '',
      nik_karyawan: employee.nik_karyawan,
      nama_lengkap: employee.nama_lengkap,
      nomor_hp: employee.nomor_hp ?? '',
      peran: employee.peran,
      divisi_id: employee.divisi_id ?? '',
      jabatan: employee.jabatan,
      status_kerja: employee.status_kerja,
      tanggal_masuk: employee.tanggal_masuk,
      aktif: employee.aktif,
      jatah_hari: employee.kuota?.jatah_hari ?? 12,
    });
    setFormError(null);
    setModalMode('edit');
  }

  function closeModal() {
    if (saving) return;
    setModalMode(null);
    setEditing(null);
    setFormError(null);
  }

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 5000);
  }

  function validateForm(): string | null {
    if (!form.email.trim()) return 'Email wajib diisi.';
    if (modalMode === 'create' && form.password.length < 8) {
      return 'Kata sandi awal minimal 8 karakter.';
    }
    if (!/^KLN-\d{4}$/.test(form.nik_karyawan.trim().toUpperCase())) {
      return 'NIK harus berformat KLN-0000.';
    }
    if (form.nama_lengkap.trim().length < 3) return 'Nama lengkap minimal 3 karakter.';
    if (!form.jabatan.trim()) return 'Jabatan wajib diisi.';
    if (!form.divisi_id) return 'Divisi wajib dipilih.';
    if (!form.tanggal_masuk) return 'Tanggal masuk wajib diisi.';
    if (form.peran === 'atasan' && divisionHasOtherManager) {
      return `Divisi ${selectedDivision?.nama} sudah dipimpin ${selectedDivision?.manajer_nama ?? 'Atasan lain'}. Kosongkan manajer lama melalui Pengaturan terlebih dahulu.`;
    }
    return null;
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateForm();
    if (validation) {
      setFormError(validation);
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        nik_karyawan: form.nik_karyawan.trim().toUpperCase(),
        nama_lengkap: form.nama_lengkap.trim(),
        nomor_hp: form.nomor_hp.trim() || null,
        peran: form.peran,
        divisi_id: form.divisi_id,
        jabatan: form.jabatan.trim(),
        status_kerja: form.status_kerja,
        tanggal_masuk: form.tanggal_masuk,
        aktif: form.aktif,
        jatah_hari: form.jatah_hari,
        tahun: currentYear,
      };

      const res = await fetch(
        modalMode === 'create' ? '/api/karyawan' : `/api/karyawan/${editing?.id}`,
        {
          method: modalMode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        setFormError(json.error || 'Gagal menyimpan data karyawan.');
        return;
      }

      const divisi = divisions.find((d) => d.id === form.divisi_id);
      const savedProfile = json.data?.profile ?? json.data;
      const quota = json.data?.quota;

      if (modalMode === 'create') {
        const newEmployee: EmployeeItem = {
          id: savedProfile.id,
          nik_karyawan: savedProfile.nik_karyawan,
          nama_lengkap: savedProfile.nama_lengkap,
          email: savedProfile.email,
          nomor_hp: savedProfile.nomor_hp,
          peran: savedProfile.peran,
          jabatan: savedProfile.jabatan,
          status_kerja: savedProfile.status_kerja,
          tanggal_masuk: savedProfile.tanggal_masuk,
          aktif: savedProfile.aktif,
          divisi_id: savedProfile.divisi_id,
          divisi: divisi ? { id: divisi.id, nama: divisi.nama } : null,
          kuota: quota
            ? { jatah_hari: quota.jatah_hari, terpakai_hari: quota.terpakai_hari }
            : { jatah_hari: form.jatah_hari, terpakai_hari: 0 },
        };
        setEmployees((prev) =>
          [...prev, newEmployee].sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
        );
        showToast('success', json.message || 'Karyawan berhasil ditambahkan.');
      } else {
        setEmployees((prev) =>
          prev
            .map((item) =>
              item.id === editing?.id
                ? {
                    ...item,
                    nik_karyawan: savedProfile.nik_karyawan,
                    nama_lengkap: savedProfile.nama_lengkap,
                    nomor_hp: savedProfile.nomor_hp,
                    peran: savedProfile.peran,
                    jabatan: savedProfile.jabatan,
                    status_kerja: savedProfile.status_kerja,
                    tanggal_masuk: savedProfile.tanggal_masuk,
                    aktif: savedProfile.aktif,
                    divisi_id: savedProfile.divisi_id,
                    divisi: divisi ? { id: divisi.id, nama: divisi.nama } : null,
                  }
                : item
            )
            .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
        );
        showToast('success', json.message || 'Data karyawan berhasil diperbarui.');
      }

      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(employee: EmployeeItem) {
    if (!isHrd || employee.id === currentUserId) return;
    const nextActive = !employee.aktif;
    const verb = nextActive ? 'mengaktifkan' : 'menonaktifkan';
    if (!window.confirm(`Yakin ingin ${verb} akun ${employee.nama_lengkap}?`)) return;

    try {
      const res = await fetch(`/api/karyawan/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nik_karyawan: employee.nik_karyawan,
          nama_lengkap: employee.nama_lengkap,
          nomor_hp: employee.nomor_hp,
          peran: employee.peran,
          divisi_id: employee.divisi_id,
          jabatan: employee.jabatan,
          status_kerja: employee.status_kerja,
          tanggal_masuk: employee.tanggal_masuk,
          aktif: nextActive,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showToast('error', json.error || `Gagal ${verb} karyawan.`);
        return;
      }

      setEmployees((prev) =>
        prev.map((item) =>
          item.id === employee.id ? { ...item, aktif: nextActive } : item
        )
      );
      showToast('success', `Akun ${employee.nama_lengkap} berhasil ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    }
  }

  async function openDetail(employee: EmployeeItem) {
    setDetailId(employee.id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/karyawan/${employee.id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setDetailError(json.error || 'Gagal memuat detail karyawan.');
        return;
      }
      setDetail(json.data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        accent="info"
        title="Data Karyawan"
        icon={Users}
        actions={
          isHrd ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Plus aria-hidden="true" className="size-4" strokeWidth={1.75} />
              Tambah Karyawan
            </button>
          ) : null
        }
      />

      {/* Ringkasan */}
      <section aria-label="Ringkasan karyawan" className="mb-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* 1. Total Karyawan (Bold Blue) */}
          <div
            aria-label="Total Karyawan"
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
                  Total Karyawan
                </p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-200 ring-1 ring-inset ring-white/15 shadow-2xs">
                <Users className="size-4.5" strokeWidth={1.9} />
              </span>
            </div>
            <div className="relative z-10 mt-3">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="font-heading font-mono text-3xl font-extrabold text-white tabular-nums">
                  {stats.total}
                </span>
                <span className="text-xs font-semibold text-white/80">orang</span>
              </div>
              <p className="mt-1.5 text-xs text-white/80">Seluruh akun terdaftar</p>
            </div>
          </div>

          {/* 2. Aktif (Bold Emerald) */}
          <div
            aria-label="Karyawan Aktif"
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
                  Aktif
                </p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#8df1d8] ring-1 ring-inset ring-white/15 shadow-2xs">
                <BadgeCheck className="size-4.5" strokeWidth={1.9} />
              </span>
            </div>
            <div className="relative z-10 mt-3">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="font-heading font-mono text-3xl font-extrabold text-white tabular-nums">
                  {stats.active}
                </span>
                <span className="text-xs font-semibold text-white/80">orang</span>
              </div>
              <p className="mt-1.5 text-xs text-white/80">Dapat login dan beraktivitas</p>
            </div>
          </div>

          {/* 3. Nonaktif (Bold Rose) */}
          <div
            aria-label="Karyawan Nonaktif"
            className="dash-rose-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-sm"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-rose-400/20 blur-xl"
            />
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-rose-300" />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
                  Nonaktif
                </p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-rose-200 ring-1 ring-inset ring-white/15 shadow-2xs">
                <Ban className="size-4.5" strokeWidth={1.9} />
              </span>
            </div>
            <div className="relative z-10 mt-3">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="font-heading font-mono text-3xl font-extrabold text-white tabular-nums">
                  {stats.inactive}
                </span>
                <span className="text-xs font-semibold text-white/80">orang</span>
              </div>
              <p className="mt-1.5 text-xs text-white/80">Akun dinonaktifkan sementara</p>
            </div>
          </div>

          {/* 4. Atasan Aktif (Bold Amber) */}
          <div
            aria-label="Atasan Aktif"
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
                  Atasan Aktif
                </p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-amber-200 ring-1 ring-inset ring-white/15 shadow-2xs">
                <ShieldCheck className="size-4.5" strokeWidth={1.9} />
              </span>
            </div>
            <div className="relative z-10 mt-3">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="font-heading font-mono text-3xl font-extrabold text-white tabular-nums">
                  {stats.atasan}
                </span>
                <span className="text-xs font-semibold text-white/80">orang</span>
              </div>
              <p className="mt-1.5 text-xs text-white/80">Manajer divisi yang aktif</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pencarian & filter */}
      <section aria-label="Pencarian dan filter karyawan" className="mb-6">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card p-3 shadow-xs">
          <div className="relative min-w-[200px] flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NIK, email, atau jabatan..."
              aria-label="Cari karyawan"
              className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              Filter
            </span>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              aria-label="Filter divisi"
              className="h-9 cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm text-foreground transition-colors duration-150 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <option value="all">Semua Divisi</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nama}
                </option>
              ))}
            </select>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter peran"
              className="h-9 cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm text-foreground transition-colors duration-150 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <option value="all">Semua Peran</option>
              <option value="karyawan">Karyawan</option>
              <option value="atasan">Atasan</option>
              <option value="hrd">HRD</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter status"
              className="h-9 cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm text-foreground transition-colors duration-150 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>

            {activeFilterCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
                {activeFilterCount} filter
              </span>
            ) : null}

            {hasActiveFilter ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* Table */}
      <SectionCard
        title="Daftar karyawan"
        description="Data akun, peran, dan status kepegawaian."
        icon={Users}
        accent="info"
        bodyClassName="p-0"
        action={
          <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
            {filtered.length} tampil
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <caption className="sr-only">
              Daftar karyawan beserta NIK, jabatan, divisi, peran, status, dan sisa kuota cuti {currentYear}
            </caption>
            <thead className="border-b border-border/70 text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-2.5 py-2.5 font-semibold">Karyawan</th>
                <th scope="col" className="px-2.5 py-2.5 font-semibold">NIK</th>
                <th scope="col" className="px-2.5 py-2.5 font-semibold">Jabatan / Divisi</th>
                <th scope="col" className="px-2.5 py-2.5 font-semibold">Peran</th>
                <th scope="col" className="px-2.5 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-2.5 py-2.5 font-semibold">Kuota {currentYear}</th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8">
                    <EmptyState
                      icon={Users}
                      title={hasActiveFilter ? 'Tidak ada karyawan yang cocok dengan filter' : 'Belum ada karyawan'}
                      description={
                        hasActiveFilter
                          ? 'Ubah kata kunci pencarian atau reset filter untuk melihat seluruh data.'
                          : isHrd
                            ? 'Belum ada karyawan terdaftar. Tambahkan akun karyawan pertama melalui tombol di bawah.'
                            : 'Belum ada data karyawan pada divisi Anda.'
                      }
                    />
                    <div className="mt-3 flex justify-center">
                      {hasActiveFilter ? (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <RotateCcw aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                          Reset filter
                        </button>
                      ) : isHrd ? (
                        <button
                          type="button"
                          onClick={openCreate}
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <Plus aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                          Tambah Karyawan
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )}

              {filtered.map((e) => {
                const sisa = e.kuota ? Math.max(0, e.kuota.jatah_hari - e.kuota.terpakai_hari) : null;
                return (
                  <tr key={e.id} className="transition-colors duration-150 hover:bg-muted/40">
                    <td className="px-2.5 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
                        >
                          {initials(e.nama_lengkap)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                            {e.nama_lengkap}
                            {e.id === currentUserId && (
                              <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {e.email}
                            {e.nomor_hp ? ` · ${e.nomor_hp}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-3 align-middle">
                      <span className="whitespace-nowrap font-mono text-[11px] text-foreground/80 tabular-nums">
                        {e.nik_karyawan}
                      </span>
                    </td>
                    <td className="px-2.5 py-3 align-middle">
                      <div className="text-xs font-medium text-foreground">{e.jabatan}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Building2 aria-hidden="true" className="size-3" strokeWidth={1.75} />
                        {e.divisi?.nama ?? '-'}
                      </div>
                    </td>
                    <td className="px-2.5 py-3 align-middle">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${roleClass[e.peran]}`}
                      >
                        {roleLabel[e.peran]}
                      </span>
                    </td>
                    <td className="px-2.5 py-3 align-middle">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                            e.aktif
                              ? 'border-primary/25 bg-primary/10 text-primary'
                              : 'border-destructive/25 bg-destructive/10 text-destructive'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`size-1.5 rounded-full ${e.aktif ? 'bg-primary' : 'bg-destructive'}`}
                          />
                          {e.aktif ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <div className="text-[11px] text-muted-foreground">
                          {statusLabel[e.status_kerja] ?? e.status_kerja}
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-3 align-middle">
                      {e.kuota ? (
                        <div className="min-w-[96px]">
                          <div className="text-xs font-semibold text-foreground tabular-nums">
                            {sisa}{' '}
                            <span className="font-normal text-muted-foreground">hari tersisa</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground tabular-nums">
                            {e.kuota.terpakai_hari}/{e.kuota.jatah_hari} terpakai
                          </div>
                          <div className="mt-1.5 w-24">
                            <Meter
                              value={e.kuota.terpakai_hari}
                              max={e.kuota.jatah_hari}
                              label={`Pemakaian kuota cuti ${e.nama_lengkap}`}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Belum ditetapkan</span>
                      )}
                    </td>
                    <td className="px-2.5 py-3 align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetail(e)}
                          title="Lihat detail"
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <Eye aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                          Detail
                        </button>
                        {isHrd && (
                          <button
                            type="button"
                            onClick={() => openEdit(e)}
                            title="Edit karyawan"
                            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors duration-150 hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <Edit3 aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                            Edit
                          </button>
                        )}
                        {isHrd && e.id !== currentUserId && (
                          <button
                            type="button"
                            onClick={() => toggleActive(e)}
                            title={e.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                              e.aktif
                                ? 'border-destructive/25 bg-destructive/5 text-destructive hover:bg-destructive/10'
                                : 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15'
                            }`}
                          >
                            {e.aktif ? (
                              <UserX aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                            ) : (
                              <UserCheck aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                            )}
                            {e.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            Menampilkan {filtered.length} dari {employees.length} karyawan
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Info aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
            Gaji tidak ditampilkan di modul ini (BR-11).
          </span>
        </div>
      </SectionCard>

      {/* Create / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-modal-title"
            className="my-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
              <div>
                <h2
                  id="employee-modal-title"
                  className="font-heading text-base font-semibold tracking-tight text-foreground"
                >
                  {modalMode === 'create' ? 'Tambah Karyawan' : 'Edit Data Karyawan'}
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {modalMode === 'create'
                    ? 'Akun login, profil, dan kuota cuti dibuat sekaligus.'
                    : 'Perubahan peran/divisi otomatis menjaga aturan satu Atasan per divisi.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Tutup formulir"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={submitForm} className="max-h-[70vh] overflow-y-auto">
              <div className="space-y-4 px-5 py-5 sm:px-6">
                {formError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-xs text-destructive"
                  >
                    <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    label="Email Login"
                    htmlFor="karyawan-email"
                    required
                    hint={modalMode === 'edit' ? 'Email login tidak dapat diubah dari modul ini.' : undefined}
                  >
                    <input
                      id="karyawan-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      disabled={modalMode === 'edit'}
                      placeholder="nama@karsalintas.test"
                      className={controlClass}
                      required
                    />
                  </FormField>

                  {modalMode === 'create' && (
                    <FormField label="Kata Sandi Awal" htmlFor="karyawan-password" required>
                      <input
                        id="karyawan-password"
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="Minimal 8 karakter"
                        className={controlClass}
                        required
                        minLength={8}
                      />
                    </FormField>
                  )}

                  <FormField label="NIK Karyawan" htmlFor="karyawan-nik" required>
                    <input
                      id="karyawan-nik"
                      value={form.nik_karyawan}
                      onChange={(e) => setForm({ ...form, nik_karyawan: e.target.value.toUpperCase() })}
                      placeholder="KLN-0000"
                      className={`${controlClass} font-mono`}
                      required
                    />
                  </FormField>

                  <FormField label="Nama Lengkap" htmlFor="karyawan-nama" required>
                    <input
                      id="karyawan-nama"
                      value={form.nama_lengkap}
                      onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
                      placeholder="Nama sesuai dokumen"
                      className={controlClass}
                      required
                    />
                  </FormField>

                  <FormField label="Nomor HP" htmlFor="karyawan-hp">
                    <input
                      id="karyawan-hp"
                      value={form.nomor_hp}
                      onChange={(e) => setForm({ ...form, nomor_hp: e.target.value })}
                      placeholder="08xxxxxxxxxx"
                      className={controlClass}
                    />
                  </FormField>

                  <FormField label="Jabatan" htmlFor="karyawan-jabatan" required>
                    <input
                      id="karyawan-jabatan"
                      value={form.jabatan}
                      onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
                      placeholder="Contoh: Staf Administrasi"
                      className={controlClass}
                      required
                    />
                  </FormField>

                  <FormField
                    label="Peran"
                    htmlFor="karyawan-peran"
                    hint={editingSelf ? 'Anda tidak dapat mengubah peran akun sendiri (BR-01).' : undefined}
                  >
                    <select
                      id="karyawan-peran"
                      value={form.peran}
                      onChange={(e) =>
                        setForm({ ...form, peran: e.target.value as FormState['peran'] })
                      }
                      disabled={editingSelf}
                      className={selectClass}
                    >
                      <option value="karyawan">Karyawan</option>
                      <option value="atasan">Atasan (Manajer Divisi)</option>
                      <option value="hrd">HRD</option>
                    </select>
                  </FormField>

                  <FormField
                    label="Divisi"
                    htmlFor="karyawan-divisi"
                    required
                    hint={
                      divisionHasOtherManager
                        ? 'Divisi ini sudah memiliki manajer. Kosongkan manajer lama di Pengaturan terlebih dahulu.'
                        : undefined
                    }
                  >
                    <select
                      id="karyawan-divisi"
                      value={form.divisi_id}
                      onChange={(e) => setForm({ ...form, divisi_id: e.target.value })}
                      className={selectClass}
                      required
                    >
                      <option value="">Pilih divisi</option>
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nama}
                          {d.manajer_nama ? ` — manajer: ${d.manajer_nama}` : ''}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Status Kerja" htmlFor="karyawan-status-kerja">
                    <select
                      id="karyawan-status-kerja"
                      value={form.status_kerja}
                      onChange={(e) => setForm({ ...form, status_kerja: e.target.value })}
                      className={selectClass}
                    >
                      <option value="tetap">Tetap</option>
                      <option value="kontrak">Kontrak</option>
                      <option value="magang">Magang</option>
                    </select>
                  </FormField>

                  <FormField label="Tanggal Masuk" htmlFor="karyawan-tanggal-masuk" required>
                    <input
                      id="karyawan-tanggal-masuk"
                      type="date"
                      value={form.tanggal_masuk}
                      onChange={(e) => setForm({ ...form, tanggal_masuk: e.target.value })}
                      className={controlClass}
                      required
                    />
                  </FormField>

                  {modalMode === 'create' && (
                    <FormField label={`Jatah Cuti ${currentYear}`} htmlFor="karyawan-jatah-cuti">
                      <input
                        id="karyawan-jatah-cuti"
                        type="number"
                        min={0}
                        max={12}
                        value={form.jatah_hari}
                        onChange={(e) => setForm({ ...form, jatah_hari: Number(e.target.value) })}
                        className={`${controlClass} tabular-nums`}
                      />
                    </FormField>
                  )}
                </div>

                <label className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3">
                  <input
                    type="checkbox"
                    checked={form.aktif}
                    onChange={(e) => setForm({ ...form, aktif: e.target.checked })}
                    disabled={editingSelf}
                    className="size-4 rounded border-input text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span className="text-sm text-foreground">
                    Akun aktif (dapat login dan melakukan aksi)
                  </span>
                  {editingSelf && (
                    <span className="ml-auto text-[11px] text-destructive">
                      Tidak dapat menonaktifkan diri sendiri
                    </span>
                  )}
                </label>
              </div>

              <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-card px-5 py-3.5 sm:px-6">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-card px-3.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && <Loader2 aria-hidden="true" className="size-4 animate-spin" strokeWidth={1.75} />}
                  {saving ? 'Menyimpan...' : modalMode === 'create' ? 'Buat Akun' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-detail-title"
            className="my-4 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
              <div>
                <h2
                  id="employee-detail-title"
                  className="font-heading text-base font-semibold tracking-tight text-foreground"
                >
                  Detail Karyawan
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Data kepegawaian, kuota cuti, dan aktivitas terbaru.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailId(null);
                  setDetail(null);
                  setDetailError(null);
                }}
                aria-label="Tutup detail karyawan"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              {detailLoading && (
                <div
                  aria-busy="true"
                  className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted/20 py-10 text-xs text-muted-foreground"
                >
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" strokeWidth={1.75} />
                  Memuat detail...
                </div>
              )}

              {detailError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-xs text-destructive"
                >
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                  <span>{detailError}</span>
                </div>
              )}

              {detail && (
                <>
                  <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center">
                    <div
                      aria-hidden="true"
                      className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary"
                    >
                      {initials(detail.profile.nama_lengkap)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                          {detail.profile.nama_lengkap}
                        </h3>
                        <RolePill peran={detail.profile.peran} />
                        <ActivePill active={detail.profile.aktif} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {detail.profile.jabatan} · {detail.profile.divisi?.nama ?? '-'}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="font-mono tabular-nums">{detail.profile.nik_karyawan}</span>
                        <span>{detail.profile.email}</span>
                        {detail.profile.nomor_hp && <span>{detail.profile.nomor_hp}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <InfoBox label="Status Kerja" value={statusLabel[detail.profile.status_kerja] ?? detail.profile.status_kerja} />
                    <InfoBox label="Tanggal Masuk" value={formatDate(detail.profile.tanggal_masuk)} />
                    <InfoBox
                      label={`Kuota Cuti ${detail.tahun}`}
                      value={
                        detail.quota
                          ? `${Math.max(0, detail.quota.jatah_hari - detail.quota.terpakai_hari)} / ${detail.quota.jatah_hari} hari`
                          : 'Belum ditetapkan'
                      }
                    />
                  </div>

                  <section>
                    <h3 className="mb-2 flex items-center gap-1.5 font-heading text-xs font-semibold tracking-tight text-foreground">
                      <CalendarDays aria-hidden="true" className="size-3.5 text-primary" strokeWidth={1.75} />
                      Riwayat Pengajuan Terbaru
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-border/70">
                      <table className="w-full min-w-[480px] text-left text-xs">
                        <caption className="sr-only">Riwayat pengajuan cuti dan izin terbaru</caption>
                        <thead className="border-b border-border/70 bg-muted/20 text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                          <tr>
                            <th scope="col" className="px-3 py-2 font-semibold">Jenis</th>
                            <th scope="col" className="px-3 py-2 font-semibold">Tanggal</th>
                            <th scope="col" className="px-3 py-2 font-semibold">Hari</th>
                            <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {detail.pengajuan.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-3 py-5 text-center text-[11px] text-muted-foreground">
                                Belum ada pengajuan.
                              </td>
                            </tr>
                          )}
                          {detail.pengajuan.map((p) => (
                            <tr key={p.id} className="transition-colors duration-150 hover:bg-muted/40">
                              <td className="px-3 py-2 capitalize">{p.jenis.replace('_', ' ')}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {formatDate(p.tanggal_mulai)} – {formatDate(p.tanggal_selesai)}
                              </td>
                              <td className="px-3 py-2 tabular-nums">{p.jumlah_hari}</td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">
                                  <span
                                    aria-hidden="true"
                                    className={`size-1.5 rounded-full ${statusDotClass(p.status)}`}
                                  />
                                  {statusPengajuanLabel(p.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 flex items-center gap-1.5 font-heading text-xs font-semibold tracking-tight text-foreground">
                      <Briefcase aria-hidden="true" className="size-3.5 text-primary" strokeWidth={1.75} />
                      Absensi Terbaru
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-border/70">
                      <table className="w-full min-w-[420px] text-left text-xs">
                        <caption className="sr-only">Absensi terbaru karyawan</caption>
                        <thead className="border-b border-border/70 bg-muted/20 text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                          <tr>
                            <th scope="col" className="px-3 py-2 font-semibold">Tanggal</th>
                            <th scope="col" className="px-3 py-2 font-semibold">Masuk</th>
                            <th scope="col" className="px-3 py-2 font-semibold">Pulang</th>
                            <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {detail.absensi.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-3 py-5 text-center text-[11px] text-muted-foreground">
                                Belum ada data absensi.
                              </td>
                            </tr>
                          )}
                          {detail.absensi.map((a) => (
                            <tr key={a.id} className="transition-colors duration-150 hover:bg-muted/40">
                              <td className="px-3 py-2 text-muted-foreground">{formatDate(a.tanggal)}</td>
                              <td className="px-3 py-2 tabular-nums">{a.jam_masuk ?? '-'}</td>
                              <td className="px-3 py-2 tabular-nums">{a.jam_pulang ?? '-'}</td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">
                                  <span
                                    aria-hidden="true"
                                    className={`size-1.5 rounded-full ${statusDotClass(a.status)}`}
                                  />
                                  <span className="capitalize">{a.status}</span>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <p className="text-[11px] text-muted-foreground">
                    Terakhir diperbarui: {formatDateTime(detail.pengajuan[0]?.dibuat_pada ?? null)}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 bottom-4 z-[60] flex max-w-sm items-start gap-2 rounded-xl border px-4 py-3 text-xs shadow-lg ${
            toast.type === 'success'
              ? 'border-primary/25 bg-primary/10 text-primary'
              : 'border-destructive/25 bg-destructive/10 text-destructive'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          ) : (
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}

function RolePill({ peran }: { peran: EmployeeItem['peran'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${roleClass[peran]}`}
    >
      {roleLabel[peran]}
    </span>
  );
}

function ActivePill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
        active
          ? 'border-primary/25 bg-primary/10 text-primary'
          : 'border-destructive/25 bg-destructive/10 text-destructive'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${active ? 'bg-primary' : 'bg-destructive'}`}
      />
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  );
}
