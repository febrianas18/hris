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
  Mail,
  Phone,
  KeyRound,
  Info,
  UserRound,
  BadgeCheck,
  Ban,
} from 'lucide-react';

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
  karyawan: 'bg-slate-100 text-slate-700 border-slate-200',
  atasan: 'bg-amber-50 text-amber-700 border-amber-200',
  hrd: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

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
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Data Karyawan</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {isHrd
                  ? 'Kelola akun, peran, divisi, dan status kepegawaian (BR-01).'
                  : 'Lihat data dan kuota cuti anggota divisi Anda.'}
              </p>
            </div>
          </div>

          {isHrd && (
            <button
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tambah Karyawan
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Users className="w-4 h-4" />} label="Total Karyawan" value={stats.total} tone="slate" />
        <StatCard icon={<BadgeCheck className="w-4 h-4" />} label="Aktif" value={stats.active} tone="emerald" />
        <StatCard icon={<Ban className="w-4 h-4" />} label="Nonaktif" value={stats.inactive} tone="rose" />
        <StatCard icon={<ShieldCheck className="w-4 h-4" />} label="Atasan Aktif" value={stats.atasan} tone="amber" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NIK, email, atau jabatan..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </div>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
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
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="all">Semua Peran</option>
              <option value="karyawan">Karyawan</option>
              <option value="atasan">Atasan</option>
              <option value="hrd">HRD</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5 font-semibold">Karyawan</th>
                <th className="px-4 py-3.5 font-semibold">NIK</th>
                <th className="px-4 py-3.5 font-semibold">Jabatan / Divisi</th>
                <th className="px-4 py-3.5 font-semibold">Peran</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Kuota {currentYear}</th>
                <th className="px-4 py-3.5 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Tidak ada karyawan yang cocok dengan filter.
                  </td>
                </tr>
              )}

              {filtered.map((e) => {
                const sisa = e.kuota ? Math.max(0, e.kuota.jatah_hari - e.kuota.terpakai_hari) : null;
                return (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center text-xs font-bold shrink-0">
                          {initials(e.nama_lengkap)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                            {e.nama_lengkap}
                            {e.id === currentUserId && (
                              <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate">{e.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-600">{e.nik_karyawan}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-800">{e.jabatan}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        {e.divisi?.nama ?? '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${roleClass[e.peran]}`}>
                        {roleLabel[e.peran]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            e.aktif
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${e.aktif ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {e.aktif ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <div className="text-[11px] text-slate-500">{statusLabel[e.status_kerja] ?? e.status_kerja}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {e.kuota ? (
                        <div>
                          <div className="text-xs font-semibold text-slate-800">
                            {sisa} <span className="font-normal text-slate-500">hari tersisa</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {e.kuota.terpakai_hari}/{e.kuota.jatah_hari} terpakai
                          </div>
                          <div className="mt-1.5 h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{
                                width: `${Math.min(100, (e.kuota.terpakai_hari / Math.max(1, e.kuota.jatah_hari)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Belum ditetapkan</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openDetail(e)}
                          title="Lihat detail"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detail
                        </button>
                        {isHrd && (
                          <button
                            onClick={() => openEdit(e)}
                            title="Edit karyawan"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        )}
                        {isHrd && e.id !== currentUserId && (
                          <button
                            onClick={() => toggleActive(e)}
                            title={e.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                              e.aktif
                                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {e.aktif ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
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
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 flex items-center justify-between">
          <span>
            Menampilkan {filtered.length} dari {employees.length} karyawan
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Gaji tidak ditampilkan di modul ini (BR-11).
          </span>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-4">
            <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {modalMode === 'create' ? 'Tambah Karyawan' : 'Edit Data Karyawan'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {modalMode === 'create'
                    ? 'Akun login, profil, dan kuota cuti dibuat sekaligus.'
                    : 'Perubahan peran/divisi otomatis menjaga aturan satu Atasan per divisi.'}
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitForm} className="px-5 sm:px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Email Login" icon={<Mail className="w-3.5 h-3.5" />}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    disabled={modalMode === 'edit'}
                    placeholder="nama@karsalintas.test"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                    required
                  />
                  {modalMode === 'edit' && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Email login tidak dapat diubah dari modul ini.
                    </p>
                  )}
                </Field>

                {modalMode === 'create' && (
                  <Field label="Kata Sandi Awal" icon={<KeyRound className="w-3.5 h-3.5" />}>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Minimal 8 karakter"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                      required
                      minLength={8}
                    />
                  </Field>
                )}

                <Field label="NIK Karyawan" icon={<BadgeCheck className="w-3.5 h-3.5" />}>
                  <input
                    value={form.nik_karyawan}
                    onChange={(e) => setForm({ ...form, nik_karyawan: e.target.value.toUpperCase() })}
                    placeholder="KLN-0000"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                    required
                  />
                </Field>

                <Field label="Nama Lengkap" icon={<UserRound className="w-3.5 h-3.5" />}>
                  <input
                    value={form.nama_lengkap}
                    onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
                    placeholder="Nama sesuai dokumen"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                    required
                  />
                </Field>

                <Field label="Nomor HP" icon={<Phone className="w-3.5 h-3.5" />}>
                  <input
                    value={form.nomor_hp}
                    onChange={(e) => setForm({ ...form, nomor_hp: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                  />
                </Field>

                <Field label="Jabatan" icon={<Briefcase className="w-3.5 h-3.5" />}>
                  <input
                    value={form.jabatan}
                    onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
                    placeholder="Contoh: Staf Administrasi"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                    required
                  />
                </Field>

                <Field label="Peran" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                  <select
                    value={form.peran}
                    onChange={(e) =>
                      setForm({ ...form, peran: e.target.value as FormState['peran'] })
                    }
                    disabled={editingSelf}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="karyawan">Karyawan</option>
                    <option value="atasan">Atasan (Manajer Divisi)</option>
                    <option value="hrd">HRD</option>
                  </select>
                  {editingSelf && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      Anda tidak dapat mengubah peran akun sendiri (BR-01).
                    </p>
                  )}
                </Field>

                <Field label="Divisi" icon={<Building2 className="w-3.5 h-3.5" />}>
                  <select
                    value={form.divisi_id}
                    onChange={(e) => setForm({ ...form, divisi_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
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
                  {divisionHasOtherManager && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      Divisi ini sudah memiliki manajer. Kosongkan manajer lama di Pengaturan
                      terlebih dahulu.
                    </p>
                  )}
                </Field>

                <Field label="Status Kerja" icon={<BadgeCheck className="w-3.5 h-3.5" />}>
                  <select
                    value={form.status_kerja}
                    onChange={(e) => setForm({ ...form, status_kerja: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="tetap">Tetap</option>
                    <option value="kontrak">Kontrak</option>
                    <option value="magang">Magang</option>
                  </select>
                </Field>

                <Field label="Tanggal Masuk" icon={<CalendarDays className="w-3.5 h-3.5" />}>
                  <input
                    type="date"
                    value={form.tanggal_masuk}
                    onChange={(e) => setForm({ ...form, tanggal_masuk: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    required
                  />
                </Field>

                {modalMode === 'create' && (
                  <Field label={`Jatah Cuti ${currentYear}`} icon={<CalendarDays className="w-3.5 h-3.5" />}>
                    <input
                      type="number"
                      min={0}
                      max={12}
                      value={form.jatah_hari}
                      onChange={(e) => setForm({ ...form, jatah_hari: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </Field>
                )}
              </div>

              <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={form.aktif}
                  onChange={(e) => setForm({ ...form, aktif: e.target.checked })}
                  disabled={editingSelf}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">
                  Akun aktif (dapat login dan melakukan aksi)
                </span>
                {editingSelf && (
                  <span className="text-[11px] text-amber-600 ml-auto">
                    Tidak dapat menonaktifkan diri sendiri
                  </span>
                )}
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Menyimpan...' : modalMode === 'create' ? 'Buat Akun' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailId && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 my-4">
            <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Detail Karyawan</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Data kepegawaian, kuota cuti, dan aktivitas terbaru.
                </p>
              </div>
              <button
                onClick={() => {
                  setDetailId(null);
                  setDetail(null);
                  setDetailError(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 sm:px-6 py-5 max-h-[72vh] overflow-y-auto space-y-5">
              {detailLoading && (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Memuat detail...
                </div>
              )}

              {detailError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{detailError}</span>
                </div>
              )}

              {detail && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center text-lg font-bold">
                      {initials(detail.profile.nama_lengkap)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {detail.profile.nama_lengkap}
                        </h3>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${roleClass[detail.profile.peran]}`}>
                          {roleLabel[detail.profile.peran]}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          detail.profile.aktif
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {detail.profile.aktif ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {detail.profile.jabatan} · {detail.profile.divisi?.nama ?? '-'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                        <span>{detail.profile.nik_karyawan}</span>
                        <span>{detail.profile.email}</span>
                        {detail.profile.nomor_hp && <span>{detail.profile.nomor_hp}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-indigo-500" />
                      Riwayat Pengajuan Terbaru
                    </h4>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Jenis</th>
                            <th className="px-3 py-2 text-left font-semibold">Tanggal</th>
                            <th className="px-3 py-2 text-left font-semibold">Hari</th>
                            <th className="px-3 py-2 text-left font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detail.pengajuan.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-3 py-5 text-center text-slate-400">
                                Belum ada pengajuan.
                              </td>
                            </tr>
                          )}
                          {detail.pengajuan.map((p) => (
                            <tr key={p.id}>
                              <td className="px-3 py-2 capitalize">{p.jenis.replace('_', ' ')}</td>
                              <td className="px-3 py-2">
                                {formatDate(p.tanggal_mulai)} – {formatDate(p.tanggal_selesai)}
                              </td>
                              <td className="px-3 py-2">{p.jumlah_hari}</td>
                              <td className="px-3 py-2">
                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
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
                    <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-indigo-500" />
                      Absensi Terbaru
                    </h4>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Tanggal</th>
                            <th className="px-3 py-2 text-left font-semibold">Masuk</th>
                            <th className="px-3 py-2 text-left font-semibold">Pulang</th>
                            <th className="px-3 py-2 text-left font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detail.absensi.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-3 py-5 text-center text-slate-400">
                                Belum ada data absensi.
                              </td>
                            </tr>
                          )}
                          {detail.absensi.map((a) => (
                            <tr key={a.id}>
                              <td className="px-3 py-2">{formatDate(a.tanggal)}</td>
                              <td className="px-3 py-2">{a.jam_masuk ?? '-'}</td>
                              <td className="px-3 py-2">{a.jam_pulang ?? '-'}</td>
                              <td className="px-3 py-2 capitalize">{a.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <p className="text-[11px] text-slate-400">
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
          className={`fixed bottom-5 right-5 z-[60] flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg max-w-sm ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'slate' | 'emerald' | 'rose' | 'amber';
}) {
  const toneClass: Record<typeof tone, string> = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    rose: 'bg-rose-100 text-rose-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneClass[tone]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
