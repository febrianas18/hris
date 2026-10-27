'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AttendanceWidget from '@/components/AttendanceWidget';
import { PageHeader, MetaDot } from '@/components/app/PageHeader';
import { StatCard, Meter } from '@/components/app/StatCard';
import { StatusPill } from '@/components/app/StatusPill';
import { FormField } from '@/components/app/FormField';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  Calendar,
  Clock,
  Filter,
  Download,
  Users,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Edit3,
  X,
  AlertTriangle,
  Loader2,
  ClipboardList,
  Search,
} from 'lucide-react';

export interface AbsensiRecord {
  id: string;
  karyawan_id: string;
  tanggal: string;
  jam_masuk: string;
  jam_pulang: string | null;
  status: 'hadir' | 'terlambat';
  dikoreksi_oleh: string | null;
  alasan_koreksi: string | null;
  karyawan?: {
    id: string;
    nik_karyawan: string;
    nama_lengkap: string;
    jabatan: string;
    divisi?: { id: string; nama: string } | null;
  };
}

export interface DivisionItem {
  id: string;
  nama: string;
}

interface AbsensiClientProps {
  currentUserRole: 'karyawan' | 'atasan' | 'hrd';
  currentUserId: string;
  initialRecords: AbsensiRecord[];
  divisions: DivisionItem[];
  allProfiles: Array<{
    id: string;
    nik_karyawan: string;
    nama_lengkap: string;
    jabatan: string;
    divisi_id: string | null;
    divisi?: { id: string; nama: string } | null;
  }>;
  approvedLeaves: Array<{
    karyawan_id: string;
    jenis: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
  }>;
  todayStr: string;
}

/**
 * Helper pill untuk status kehadiran harian
 */
function DailyAttendancePill({
  statusType,
  statusText,
}: {
  statusType: 'hadir' | 'terlambat' | 'cuti' | 'absen';
  statusText: string;
}) {
  if (statusType === 'hadir' || statusType === 'terlambat') {
    return <StatusPill kind="attendance" status={statusType} />;
  }

  const normalized = statusText.toLowerCase();
  if (normalized === 'izin' || normalized === 'cuti' || normalized === 'sakit') {
    return <StatusPill kind="attendance" status={normalized} />;
  }

  if (statusType === 'absen' || normalized.includes('absen') || normalized.includes('alpa') || normalized.includes('belum')) {
    return <StatusPill kind="attendance" status="alpa" />;
  }

  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground font-medium">
      {statusText}
    </Badge>
  );
}

export default function AbsensiClient({
  currentUserRole,
  currentUserId,
  initialRecords,
  divisions,
  allProfiles,
  approvedLeaves,
  todayStr,
}: AbsensiClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pribadi' | 'tim' | 'semua'>(
    currentUserRole === 'hrd' ? 'semua' : 'pribadi'
  );

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.slice(0, 7)); // 'YYYY-MM'
  const [selectedDivisi, setSelectedDivisi] = useState<string>('semua');
  const [selectedStatus, setSelectedStatus] = useState<string>('semua');
  const [searchDaily, setSearchDaily] = useState<string>('');
  const [records, setRecords] = useState<AbsensiRecord[]>(initialRecords);

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  // Modal Koreksi Absensi (Khusus HRD - BR-03 & BR-12)
  const [koreksiModalOpen, setKoreksiModalOpen] = useState(false);
  const [selectedRecordForKoreksi, setSelectedRecordForKoreksi] = useState<AbsensiRecord | null>(null);
  const [koreksiJamMasuk, setKoreksiJamMasuk] = useState('');
  const [koreksiJamPulang, setKoreksiJamPulang] = useState('');
  const [koreksiStatus, setKoreksiStatus] = useState<'hadir' | 'terlambat'>('hadir');
  const [koreksiAlasan, setKoreksiAlasan] = useState('');
  const [koreksiError, setKoreksiError] = useState<string | null>(null);
  const [koreksiSubmitting, setKoreksiSubmitting] = useState(false);
  const [koreksiSuccessMsg, setKoreksiSuccessMsg] = useState<string | null>(null);

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

  const formatDateDisplay = (dateString: string) => {
    try {
      const parts = dateString.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return dateString;
    }
  };

  // Filter data untuk tab Pribadi per bulan (BR-02 & BR-03)
  const personalRecords = useMemo(() => {
    return records
      .filter(
        (r) =>
          r.karyawan_id === currentUserId &&
          (!selectedMonth || r.tanggal.startsWith(selectedMonth))
      )
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [records, currentUserId, selectedMonth]);

  // Statistik Bulanan Pribadi
  const personalStats = useMemo(() => {
    let hadir = 0;
    let terlambat = 0;
    personalRecords.forEach((r) => {
      if (r.status === 'hadir') hadir++;
      else if (r.status === 'terlambat') terlambat++;
    });
    return { hadir, terlambat, total: personalRecords.length };
  }, [personalRecords]);

  // Data gabungan seluruh karyawan pada tanggal yang dipilih (Wireframe Hal. 2)
  const dailyEmployeesData = useMemo(() => {
    const pool = allProfiles;

    return pool.map((emp) => {
      const att = records.find(
        (r) => r.karyawan_id === emp.id && r.tanggal === selectedDate
      );
      const leave = approvedLeaves.find(
        (l) =>
          l.karyawan_id === emp.id &&
          selectedDate >= l.tanggal_mulai &&
          selectedDate <= l.tanggal_selesai
      );

      let computedStatus: string = 'Belum Hadir';
      let statusType: 'hadir' | 'terlambat' | 'cuti' | 'absen' = 'absen';

      if (leave) {
        const j = leave.jenis.toLowerCase();
        computedStatus = j === 'sakit' ? 'Sakit' : j === 'izin' ? 'Izin' : 'Cuti';
        statusType = 'cuti';
      } else if (att) {
        computedStatus = att.status === 'hadir' ? 'Hadir' : 'Terlambat';
        statusType = att.status;
      }

      return {
        id: emp.id,
        nik: emp.nik_karyawan,
        nama: emp.nama_lengkap,
        divisi: emp.divisi?.nama || '-',
        divisi_id: emp.divisi_id,
        masuk: leave ? '-' : att ? formatTimeOnly(att.jam_masuk) : '-',
        pulang: leave ? '-' : att?.jam_pulang ? formatTimeOnly(att.jam_pulang) : '-',
        statusText: computedStatus,
        statusType,
        attRecord: leave ? undefined : att,
        catatan: leave
          ? leave.jenis.toLowerCase() === 'sakit'
            ? 'Sakit Resmi'
            : leave.jenis.toLowerCase() === 'izin'
            ? 'Izin Resmi'
            : 'Cuti Resmi'
          : att && !att.jam_pulang
          ? 'Belum check-out'
          : att?.dikoreksi_oleh
          ? 'Terkoreksi HRD'
          : '-',
      };
    });
  }, [allProfiles, records, approvedLeaves, selectedDate]);

  // Filter berdasarkan Divisi, Status, dan Pencarian
  const filteredDailyData = useMemo(() => {
    return dailyEmployeesData.filter((item) => {
      const matchDivisi =
        selectedDivisi === 'semua' || item.divisi_id === selectedDivisi;

      let matchStatus = true;
      if (selectedStatus === 'hadir') matchStatus = item.statusType === 'hadir';
      else if (selectedStatus === 'terlambat') matchStatus = item.statusType === 'terlambat';
      else if (selectedStatus === 'cuti') matchStatus = item.statusType === 'cuti';
      else if (selectedStatus === 'absen') matchStatus = item.statusType === 'absen';

      let matchSearch = true;
      if (searchDaily.trim()) {
        const q = searchDaily.toLowerCase();
        matchSearch =
          item.nama.toLowerCase().includes(q) ||
          item.nik.toLowerCase().includes(q) ||
          item.divisi.toLowerCase().includes(q);
      }

      return matchDivisi && matchStatus && matchSearch;
    });
  }, [dailyEmployeesData, selectedDivisi, selectedStatus, searchDaily]);

  // Statistik Ringkasan Harian (Wireframe Hal. 2)
  const summaryCounts = useMemo(() => {
    let tepatWaktu = 0;
    let terlambat = 0;
    let cutiSakitIzin = 0;
    let tanpaKeterangan = 0;

    dailyEmployeesData.forEach((item) => {
      if (item.statusType === 'hadir') tepatWaktu++;
      else if (item.statusType === 'terlambat') terlambat++;
      else if (item.statusType === 'cuti') cutiSakitIzin++;
      else tanpaKeterangan++;
    });

    return { tepatWaktu, terlambat, cutiSakitIzin, tanpaKeterangan };
  }, [dailyEmployeesData]);

  const roleLabel =
    currentUserRole === 'hrd' ? 'HRD' : currentUserRole === 'atasan' ? 'Atasan' : 'Karyawan';

  // Buka Modal Koreksi untuk HRD (BR-03)
  const openKoreksiModal = (record: AbsensiRecord) => {
    setSelectedRecordForKoreksi(record);
    setKoreksiJamMasuk(formatTimeOnly(record.jam_masuk));
    setKoreksiJamPulang(record.jam_pulang ? formatTimeOnly(record.jam_pulang) : '');
    setKoreksiStatus(record.status);
    setKoreksiAlasan(record.alasan_koreksi || '');
    setKoreksiError(null);
    setKoreksiModalOpen(true);
  };

  // Simpan Koreksi Absensi (POST /api/attendance/koreksi)
  const handleSaveKoreksi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordForKoreksi) return;

    if (koreksiAlasan.trim().length < 10) {
      setKoreksiError('Alasan koreksi wajib diisi minimal 10 karakter (Aturan BR-03).');
      return;
    }

    setKoreksiSubmitting(true);
    setKoreksiError(null);

    try {
      const datePart = selectedRecordForKoreksi.tanggal;
      const isoMasuk = `${datePart}T${koreksiJamMasuk}:00+07:00`;
      const isoPulang = koreksiJamPulang
        ? `${datePart}T${koreksiJamPulang}:00+07:00`
        : null;

      const res = await fetch('/api/attendance/koreksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          absensi_id: selectedRecordForKoreksi.id,
          jam_masuk: isoMasuk,
          jam_pulang: isoPulang,
          status: koreksiStatus,
          alasan_koreksi: koreksiAlasan.trim(),
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        setRecords((prev) =>
          prev.map((r) => (r.id === selectedRecordForKoreksi.id ? resData.data : r))
        );
        setKoreksiSuccessMsg('Koreksi absensi berhasil disimpan dan dicatat di audit log.');
        setTimeout(() => setKoreksiSuccessMsg(null), 4000);
        setKoreksiModalOpen(false);
      } else {
        setKoreksiError(resData.error || 'Gagal menyimpan koreksi absensi.');
      }
    } catch {
      setKoreksiError('Terjadi kesalahan jaringan.');
    } finally {
      setKoreksiSubmitting(false);
    }
  };

  // Ekspor CSV
  const handleExportCSV = () => {
    const headers = ['NIK', 'Nama Lengkap', 'Divisi', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status', 'Catatan'];
    const rows = filteredDailyData.map((item) => [
      `"${item.nik}"`,
      `"${item.nama}"`,
      `"${item.divisi}"`,
      `"${selectedDate}"`,
      `"${item.masuk}"`,
      `"${item.pulang}"`,
      `"${item.statusText}"`,
      `"${item.catatan}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Absensi_KLN_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPersonalCSV = () => {
    const headers = ['Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status', 'Catatan'];
    const rows = personalRecords.map((r) => [
      `"${r.tanggal}"`,
      `"${formatTimeOnly(r.jam_masuk)}"`,
      `"${r.jam_pulang ? formatTimeOnly(r.jam_pulang) : '-'}"`,
      `"${r.status === 'hadir' ? 'Hadir' : 'Terlambat'}"`,
      `"${r.dikoreksi_oleh ? 'Dikoreksi HRD: ' + (r.alasan_koreksi || '') : '-'}"`,
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `Absensi_Pribadi_${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        accent="primary"
        title="Pencatatan & Riwayat Absensi"
        icon={Calendar}
        meta={
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
            <Calendar className="size-3.5 text-primary" />
            <span>{formatDateDisplay(todayStr)}</span>
          </span>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={activeTab === 'pribadi' ? handleExportPersonalCSV : handleExportCSV}
            className="gap-2 font-semibold shadow-2xs"
          >
            <Download className="size-4 text-muted-foreground" />
            <span>Unduh CSV</span>
          </Button>
        }
      />

      {/* Notifikasi Koreksi Sukses */}
      {koreksiSuccessMsg && (
        <Alert className="border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-xs font-bold">Koreksi Berhasil</AlertTitle>
          <AlertDescription className="text-xs">{koreksiSuccessMsg}</AlertDescription>
        </Alert>
      )}

      {/* Tab Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/70">
          <button
            type="button"
            onClick={() => setActiveTab('pribadi')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              activeTab === 'pribadi'
                ? 'bg-card text-primary shadow-xs font-bold border border-border/70 ring-1 ring-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            )}
          >
            Riwayat Pribadi
          </button>

          {currentUserRole === 'atasan' && (
            <button
              type="button"
              onClick={() => setActiveTab('tim')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                activeTab === 'tim'
                  ? 'bg-card text-primary shadow-xs font-bold border border-border/70 ring-1 ring-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              Tim Divisi
            </button>
          )}

          {currentUserRole === 'hrd' && (
            <button
              type="button"
              onClick={() => setActiveTab('semua')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                activeTab === 'semua'
                  ? 'bg-card text-primary shadow-xs font-bold border border-border/70 ring-1 ring-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              Semua Karyawan (HRD)
            </button>
          )}
        </div>
      </div>

      {/* Widget Check-in/Check-out & Ketentuan Aturan */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-stretch">
        <div className="w-full flex flex-col">
          <AttendanceWidget className="h-full" onStatusChange={() => router.refresh()} />
        </div>

        <Card className="border-border/80 shadow-2xs flex flex-col justify-between h-full">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4.5 text-primary" />
              <div>
                <CardTitle className="text-sm font-bold text-foreground">
                  Ketentuan Jam Kerja & Presensi
                </CardTitle>
              </div>
            </div>
          </CardHeader>

          {/* Susunan 2x2 dengan warna informatif */}
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            {/* 1. Tepat Waktu (Emerald) */}
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 dark:border-emerald-800/60 dark:bg-emerald-950/25">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Batas Tepat Waktu
                </p>
                <p className="font-mono text-sm font-extrabold text-emerald-950 dark:text-emerald-100 tabular-nums">
                  08.15.00 WIB
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                  Toleransi check-in sebelum terlambat
                </p>
              </div>
            </div>

            {/* 2. Jendela Masuk (Blue) */}
            <div className="flex items-start gap-3 rounded-xl border border-blue-200/80 bg-blue-50/60 p-3.5 dark:border-blue-800/60 dark:bg-blue-950/25">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <Clock className="size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                  Jendela Presensi Masuk
                </p>
                <p className="font-mono text-sm font-extrabold text-blue-950 dark:text-blue-100 tabular-nums">
                  06.00 – 12.00 WIB
                </p>
                <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                  Sesi presensi masuk dibuka pagi
                </p>
              </div>
            </div>

            {/* 3. Hak Koreksi (Amber) */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 dark:border-amber-800/60 dark:bg-amber-950/25">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <UserCheck className="size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Hak Koreksi Data
                </p>
                <p className="text-sm font-extrabold text-amber-950 dark:text-amber-100">
                  Khusus HRD
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                  Wewenang penyesuaian catatan absensi
                </p>
              </div>
            </div>

            {/* 4. Alasan Koreksi (Indigo) */}
            <div className="flex items-start gap-3 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-3.5 dark:border-indigo-800/60 dark:bg-indigo-950/25">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                <ClipboardList className="size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                  Alasan Koreksi
                </p>
                <p className="font-mono text-sm font-extrabold text-indigo-950 dark:text-indigo-100 tabular-nums">
                  Minimal 10 Karakter
                </p>
                <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                  Wajib dicatat untuk audit log sistem
                </p>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-1">
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] font-medium text-primary w-full">
              <AlertCircle className="size-4 shrink-0" />
              <span>
                Pencatatan berbasis jam server resmi WIB. Seluruh penyesuaian oleh HRD otomatis masuk audit log.
              </span>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* TAB 1: RIWAYAT ABSENSI PRIBADI */}
      {activeTab === 'pribadi' && (
        <div className="space-y-4">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Riwayat Kehadiran Pribadi
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Catatan kehadiran kerja mandiri Anda pada periode bulan terpilih.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="filter-bulan" className="text-xs font-semibold text-muted-foreground">
                    Periode Bulan:
                  </label>
                  <Input
                    id="filter-bulan"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="h-8 w-40 font-mono text-xs tabular-nums"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-4">
              {/* 3 Kartu Ringkasan Bulanan */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  label="Total Hari Hadir"
                  value={personalStats.total}
                  unit="hari kerja"
                  hint={`Seluruh catatan presensi bulan ${selectedMonth}`}
                  icon={Calendar}
                  accent="neutral"
                />
                <StatCard
                  label="Hadir Tepat Waktu"
                  value={personalStats.hadir}
                  unit="hari"
                  hint="Presensi masuk tepat waktu"
                  icon={CheckCircle2}
                  accent="primary"
                  footer={
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Ketepatan Waktu</span>
                        <span className="font-mono tabular-nums font-bold text-foreground">
                          {personalStats.total > 0
                            ? Math.round((personalStats.hadir / personalStats.total) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                      <Meter
                        value={personalStats.hadir}
                        max={personalStats.total}
                        label="Proporsi kehadiran tepat waktu"
                      />
                    </div>
                  }
                />
                <StatCard
                  label="Terlambat"
                  value={personalStats.terlambat}
                  unit="hari"
                  hint="Presensi masuk melewati toleransi"
                  icon={Clock}
                  accent="warning"
                  footer={
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Tingkat Keterlambatan</span>
                        <span className="font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                          {personalStats.total > 0
                            ? Math.round((personalStats.terlambat / personalStats.total) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                      <Meter
                        value={personalStats.terlambat}
                        max={personalStats.total}
                        label="Proporsi keterlambatan"
                        tone="warning"
                      />
                    </div>
                  }
                />
              </div>

              {/* Tabel Riwayat Pribadi */}
              {personalRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground border rounded-xl border-dashed">
                  <Calendar className="size-8 text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-semibold text-foreground">Belum ada catatan presensi</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tidak ditemukan data check-in Anda pada periode bulan {selectedMonth}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/80">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="font-semibold text-xs">Tanggal</TableHead>
                        <TableHead className="font-semibold text-xs">Masuk (WIB)</TableHead>
                        <TableHead className="font-semibold text-xs">Pulang (WIB)</TableHead>
                        <TableHead className="font-semibold text-xs">Status</TableHead>
                        <TableHead className="font-semibold text-xs">Keterangan / Audit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {personalRecords.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-xs text-foreground">
                            {formatDateDisplay(r.tanggal)}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-foreground tabular-nums">
                            {formatTimeOnly(r.jam_masuk)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                            {r.jam_pulang ? formatTimeOnly(r.jam_pulang) : '—'}
                          </TableCell>
                          <TableCell>
                            <StatusPill kind="attendance" status={r.status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.dikoreksi_oleh ? (
                              <Badge
                                variant="outline"
                                className="bg-primary/5 text-primary border-primary/20 text-[10px]"
                                title={`Alasan: ${r.alasan_koreksi}`}
                              >
                                Dikoreksi HRD
                              </Badge>
                            ) : !r.jam_pulang ? (
                              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                Belum check-out
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2 & 3: TIM DIVISI (ATASAN) & SEMUA KARYAWAN (HRD) */}
      {(activeTab === 'tim' || activeTab === 'semua') && (
        <div className="space-y-5">
          {/* 4 Kartu Metrik Ringkasan Harian dengan Warna Informatif */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20 shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Hadir Tepat
                  </p>
                  <p className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {summaryCounts.tepatWaktu}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    dari {dailyEmployeesData.length} staf
                  </p>
                </div>
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <UserCheck className="size-4.5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20 shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Terlambat
                  </p>
                  <p className="font-mono text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {summaryCounts.terlambat}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Melewati jam masuk</p>
                </div>
                <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Clock className="size-4.5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200/80 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/20 shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                    Cuti / Izin
                  </p>
                  <p className="font-mono text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {summaryCounts.cutiSakitIzin}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Izin resmi disetujui</p>
                </div>
                <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <Calendar className="size-4.5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-rose-200/80 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20 shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                    Belum Hadir
                  </p>
                  <p className="font-mono text-2xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                    {summaryCounts.tanpaKeterangan}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Tanpa catatan presensi</p>
                </div>
                <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="size-4.5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabel Harian dengan Filter Tanggal & Divisi */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    {activeTab === 'tim'
                      ? 'Pemantauan Presensi Tim Divisi'
                      : 'Presensi Harian Seluruh Karyawan'}
                  </CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-xs self-start sm:self-auto">
                  {filteredDailyData.length} Karyawan Terdata
                </Badge>
              </div>

              {/* Baris Filter: Tanggal, Divisi, Status, dan Search */}
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor="filter-tanggal" className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Tanggal Presensi:
                  </label>
                  <Input
                    id="filter-tanggal"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-8 text-xs font-mono tabular-nums"
                  />
                </div>

                {currentUserRole === 'hrd' && (
                  <div>
                    <label htmlFor="filter-divisi" className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Divisi:
                    </label>
                    <select
                      id="filter-divisi"
                      value={selectedDivisi}
                      onChange={(e) => setSelectedDivisi(e.target.value)}
                      className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                    >
                      <option value="semua">Semua Divisi</option>
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="filter-status" className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Status Presensi:
                  </label>
                  <select
                    id="filter-status"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  >
                    <option value="semua">Semua Status</option>
                    <option value="hadir">Hadir Tepat Waktu</option>
                    <option value="terlambat">Terlambat</option>
                    <option value="cuti">Cuti / Sakit / Izin</option>
                    <option value="absen">Belum Hadir / Alpa</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-search" className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Pencarian Karyawan:
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="filter-search"
                      type="text"
                      placeholder="Cari nama atau NIK..."
                      value={searchDaily}
                      onChange={(e) => setSearchDaily(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredDailyData.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <Users className="size-8 text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-semibold text-foreground">Tidak ada data karyawan</p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                    Tidak ditemukan data yang cocok dengan kriteria filter tanggal dan status yang dipilih.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="font-semibold text-xs">NIK</TableHead>
                        <TableHead className="font-semibold text-xs">Nama Karyawan</TableHead>
                        <TableHead className="font-semibold text-xs">Divisi</TableHead>
                        <TableHead className="font-semibold text-xs">Masuk (WIB)</TableHead>
                        <TableHead className="font-semibold text-xs">Pulang (WIB)</TableHead>
                        <TableHead className="font-semibold text-xs">Status</TableHead>
                        <TableHead className="font-semibold text-xs">Catatan</TableHead>
                        {currentUserRole === 'hrd' && (
                          <TableHead className="font-semibold text-xs text-right">Aksi</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDailyData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs font-bold text-foreground tabular-nums">
                            {item.nik}
                          </TableCell>
                          <TableCell className="font-medium text-xs text-foreground">
                            {item.nama}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.divisi}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-foreground tabular-nums">
                            {item.masuk}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                            {item.pulang}
                          </TableCell>
                          <TableCell>
                            <DailyAttendancePill
                              statusType={item.statusType}
                              statusText={item.statusText}
                            />
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            {item.catatan}
                          </TableCell>
                          {currentUserRole === 'hrd' && (
                            <TableCell className="text-right">
                              {item.attRecord ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  onClick={() => openKoreksiModal(item.attRecord!)}
                                  className="gap-1 font-semibold text-primary hover:text-primary hover:border-primary/40 text-xs"
                                >
                                  <Edit3 className="size-3" />
                                  <span>Koreksi</span>
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground/40">—</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL KOREKSI ABSENSI OLEH HRD (BR-03 & BR-12) */}
      {koreksiModalOpen && selectedRecordForKoreksi && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="koreksi-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <Card className="w-full max-w-lg border-border/80 shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Edit3 className="size-5" />
                  </div>
                  <div>
                    <CardTitle id="koreksi-title" className="text-base font-bold text-foreground">
                      Koreksi Absensi Karyawan
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Kewenangan Khusus HRD · Tercatat Resmi di Audit Log (BR-03 & BR-12)
                    </CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setKoreksiModalOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <form onSubmit={handleSaveKoreksi}>
              <CardContent className="space-y-4 pt-4">
                {koreksiError && (
                  <Alert variant="destructive" className="py-2.5 px-3">
                    <AlertCircle className="size-4" />
                    <AlertDescription className="text-xs">{koreksiError}</AlertDescription>
                  </Alert>
                )}

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tanggal Presensi:</span>
                    <span className="font-semibold text-foreground">
                      {formatDateDisplay(selectedRecordForKoreksi.tanggal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID Catatan:</span>
                    <span className="font-mono text-muted-foreground">
                      {selectedRecordForKoreksi.id}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Jam Masuk (HH:MM WIB)" htmlFor="koreksi-jam-masuk" required>
                    <Input
                      id="koreksi-jam-masuk"
                      type="time"
                      required
                      value={koreksiJamMasuk}
                      onChange={(e) => setKoreksiJamMasuk(e.target.value)}
                      className="font-mono text-xs tabular-nums"
                    />
                  </FormField>

                  <FormField label="Jam Pulang (HH:MM WIB)" htmlFor="koreksi-jam-pulang">
                    <Input
                      id="koreksi-jam-pulang"
                      type="time"
                      value={koreksiJamPulang}
                      onChange={(e) => setKoreksiJamPulang(e.target.value)}
                      className="font-mono text-xs tabular-nums"
                    />
                  </FormField>
                </div>

                <FormField label="Status Kehadiran" htmlFor="koreksi-status" required>
                  <select
                    id="koreksi-status"
                    value={koreksiStatus}
                    onChange={(e) => setKoreksiStatus(e.target.value as 'hadir' | 'terlambat')}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  >
                    <option value="hadir">Hadir Tepat Waktu</option>
                    <option value="terlambat">Terlambat</option>
                  </select>
                </FormField>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="koreksi-alasan" className="text-xs font-semibold text-foreground">
                      Alasan Koreksi <span className="text-destructive">*</span>
                    </label>
                    <span
                      className={cn(
                        'text-[11px] font-mono font-semibold tabular-nums',
                        koreksiAlasan.trim().length >= 10
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground'
                      )}
                    >
                      {koreksiAlasan.trim().length} / min. 10 karakter
                    </span>
                  </div>

                  <Textarea
                    id="koreksi-alasan"
                    rows={3}
                    required
                    value={koreksiAlasan}
                    onChange={(e) => setKoreksiAlasan(e.target.value)}
                    placeholder="Contoh: Karyawan hadir tepat waktu namun mesin fingerprint gerbang utama sedang perbaikan jaringan."
                    className="text-xs resize-none"
                  />

                  <p className="text-[11px] text-muted-foreground">
                    Aturan <strong>BR-03</strong>: Alasan koreksi wajib diisi minimal 10 karakter dan tersimpan di audit trail.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 p-4 rounded-b-xl">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setKoreksiModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={koreksiSubmitting || koreksiAlasan.trim().length < 10}
                  className="gap-1.5 font-semibold text-xs"
                >
                  {koreksiSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Simpan Koreksi Absensi</span>
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
