'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  DollarSign,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Filter,
  UserCheck,
} from 'lucide-react';
import { formatRupiah, formatPeriodeBulan } from '@/utils/formatters';
import { downloadCSV } from '@/utils/csvExport';
import { downloadExcel } from '@/utils/excelExport';
import ExportMenu from '@/components/app/ExportMenu';
import {
  WeeklyAttendanceStat,
  DivisionPayrollStat,
  LateEmployeeStat,
} from '@/utils/analytics';
import AttendanceStackedBarChart from '@/components/charts/AttendanceStackedBarChart';
import DivisionLeaveBarChart, {
  DivisionLeaveDataPoint,
} from '@/components/charts/DivisionLeaveBarChart';
import { PageHeader, MetaDot } from '@/components/app/PageHeader';
import { StatCard, Meter } from '@/components/app/StatCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
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

interface MonthlyLeaveData {
  periodeBulan: string; // e.g. '2026-10', '2026-09', '2026-08'
  labelBulan: string; // e.g. 'Oktober 2026', ...
  divisions: DivisionLeaveDataPoint[];
}

interface PublishedPayrollItem {
  id: string;
  periode: string;
  gaji_pokok: number;
  tunjangan: number;
  potongan: number;
  total_diterima: number;
  karyawan?: {
    id: string;
    nama_lengkap: string;
    nik_karyawan: string;
    divisi_id?: string;
    divisi?: {
      id: string;
      nama: string;
    } | null;
  } | null;
}

interface LaporanClientProps {
  weeklyStats: WeeklyAttendanceStat[];
  monthlyLeaveStats: MonthlyLeaveData[];
  topLateEmployees: LateEmployeeStat[];
  publishedSlips: PublishedPayrollItem[];
  divisions: { id: string; nama: string }[];
  currentMonthName: string;
}

type ExportFormat = 'csv' | 'excel';

export default function LaporanClient({
  weeklyStats,
  monthlyLeaveStats,
  topLateEmployees,
  publishedSlips,
  divisions,
  currentMonthName,
}: LaporanClientProps) {
  // State Filter
  const [selectedDivisi, setSelectedDivisi] = useState<string>('all');
  const [selectedLeaveMonth, setSelectedLeaveMonth] = useState<string>(
    monthlyLeaveStats[0]?.periodeBulan || '2026-10'
  );

  // Ambil daftar unik periode slip gaji yang tersedia
  const availablePayrollPeriods = useMemo(() => {
    const set = new Set<string>();
    publishedSlips.forEach((s) => set.add(s.periode));
    if (set.size === 0) set.add('2026-10-01');
    return Array.from(set).sort().reverse();
  }, [publishedSlips]);

  const [selectedPayrollPeriod, setSelectedPayrollPeriod] = useState<string>(
    availablePayrollPeriods[0] || '2026-10-01'
  );

  // Data grafik cuti per divisi untuk bulan yang dipilih
  const activeLeaveData = useMemo(() => {
    const found = monthlyLeaveStats.find((m) => m.periodeBulan === selectedLeaveMonth);
    let list = found ? found.divisions : [];
    if (selectedDivisi !== 'all') {
      const divObj = divisions.find((d) => d.id === selectedDivisi);
      if (divObj) {
        list = list.filter((item) => item.divisi === divObj.nama);
      }
    }
    return list;
  }, [monthlyLeaveStats, selectedLeaveMonth, selectedDivisi, divisions]);

  // Hitung rekap gaji per divisi untuk periode slip yang dipilih (HANYA SLIP TERBIT)
  const payrollByDivision = useMemo(() => {
    const filteredSlips = publishedSlips.filter(
      (s) => s.periode === selectedPayrollPeriod
    );

    const map = new Map<string, DivisionPayrollStat>();
    divisions.forEach((d) => {
      map.set(d.id, {
        divisi_id: d.id,
        divisi_nama: d.nama,
        jumlah_karyawan: 0,
        total_gaji_pokok: 0,
        total_tunjangan: 0,
        total_potongan: 0,
        total_diterima: 0,
      });
    });

    filteredSlips.forEach((slip) => {
      const divId = slip.karyawan?.divisi_id || slip.karyawan?.divisi?.id;
      if (divId && map.has(divId)) {
        const item = map.get(divId)!;
        item.jumlah_karyawan += 1;
        item.total_gaji_pokok += Number(slip.gaji_pokok || 0);
        item.total_tunjangan += Number(slip.tunjangan || 0);
        item.total_potongan += Number(slip.potongan || 0);
        item.total_diterima += Number(slip.total_diterima || 0);
      }
    });

    let list = Array.from(map.values());
    if (selectedDivisi !== 'all') {
      list = list.filter((item) => item.divisi_id === selectedDivisi);
    }
    return list;
  }, [publishedSlips, selectedPayrollPeriod, divisions, selectedDivisi]);

  // Grand Total Rekap Gaji
  const grandTotalPayroll = useMemo(() => {
    return payrollByDivision.reduce(
      (acc, curr) => ({
        jumlah_karyawan: acc.jumlah_karyawan + curr.jumlah_karyawan,
        total_gaji_pokok: acc.total_gaji_pokok + curr.total_gaji_pokok,
        total_tunjangan: acc.total_tunjangan + curr.total_tunjangan,
        total_potongan: acc.total_potongan + curr.total_potongan,
        total_diterima: acc.total_diterima + curr.total_diterima,
      }),
      {
        jumlah_karyawan: 0,
        total_gaji_pokok: 0,
        total_tunjangan: 0,
        total_potongan: 0,
        total_diterima: 0,
      }
    );
  }, [payrollByDivision]);

  // Filter Karyawan Sering Terlambat
  const filteredLateEmployees = useMemo(() => {
    if (selectedDivisi === 'all') return topLateEmployees;
    const divObj = divisions.find((d) => d.id === selectedDivisi);
    if (!divObj) return topLateEmployees;
    return topLateEmployees.filter((e) => e.divisi_nama === divObj.nama);
  }, [topLateEmployees, selectedDivisi, divisions]);

  // Handlers Unduh Laporan (CSV & Excel)
  const downloadReport = (
    format: ExportFormat,
    baseFilename: string,
    headers: string[],
    rows: (string | number)[][],
    sheetName: string
  ) => {
    if (format === 'excel') {
      downloadExcel(`${baseFilename}.xlsx`, headers, rows, sheetName);
      return;
    }
    downloadCSV(`${baseFilename}.csv`, headers, rows);
  };

  // 1. Kehadiran 4 Minggu
  const exportAttendance = (format: ExportFormat) => {
    const headers = [
      'Minggu',
      'Rentang Tanggal',
      'Hadir Tepat Waktu (Orang)',
      'Terlambat (Orang)',
      'Cuti / Sakit / Izin (Orang)',
      'Tanpa Keterangan / Alpa (Orang)',
    ];
    const rows = weeklyStats.map((w) => [
      w.minggu,
      w.rentang,
      w.hadir,
      w.terlambat,
      w.cuti_izin,
      w.tanpa_keterangan,
    ]);
    downloadReport(format, 'rekap-kehadiran-4-minggu', headers, rows, 'Kehadiran 4 Minggu');
  };

  // 2. Keterlambatan
  const exportLate = (format: ExportFormat) => {
    const headers = [
      'Peringkat',
      'Nama Karyawan',
      'NIK',
      'Jabatan',
      'Divisi',
      'Jumlah Keterlambatan (Bulan Berjalan)',
    ];
    const rows = filteredLateEmployees.map((e, idx) => [
      idx + 1,
      e.nama_lengkap,
      e.nik_karyawan,
      e.jabatan,
      e.divisi_nama,
      `${e.jumlah_terlambat} kali`,
    ]);
    downloadReport(
      format,
      `karyawan-terbanyak-terlambat-${selectedPayrollPeriod.slice(0, 7)}`,
      headers,
      rows,
      'Keterlambatan'
    );
  };

  // 3. Rekap Gaji per Divisi
  const exportPayroll = (format: ExportFormat) => {
    const headers = [
      'Divisi',
      'Jumlah Karyawan Bergaji Terbit',
      'Total Gaji Pokok (IDR)',
      'Total Tunjangan (IDR)',
      'Total Potongan (IDR)',
      'Total Gaji Diterima (IDR)',
    ];
    const rows = payrollByDivision.map((p) => [
      p.divisi_nama,
      p.jumlah_karyawan,
      p.total_gaji_pokok,
      p.total_tunjangan,
      p.total_potongan,
      p.total_diterima,
    ]);
    rows.push([
      'TOTAL KESELURUHAN',
      grandTotalPayroll.jumlah_karyawan,
      grandTotalPayroll.total_gaji_pokok,
      grandTotalPayroll.total_tunjangan,
      grandTotalPayroll.total_potongan,
      grandTotalPayroll.total_diterima,
    ]);
    downloadReport(
      format,
      `rekap-gaji-divisi-${selectedPayrollPeriod}`,
      headers,
      rows,
      'Rekap Gaji Divisi'
    );
  };

  // Ringkasan angka kehadiran
  const totalHadir = weeklyStats.reduce((acc, curr) => acc + curr.hadir, 0);
  const totalTerlambat = weeklyStats.reduce((acc, curr) => acc + curr.terlambat, 0);
  const totalCutiIzin = weeklyStats.reduce((acc, curr) => acc + curr.cuti_izin, 0);
  const totalAlpa = weeklyStats.reduce((acc, curr) => acc + curr.tanpa_keterangan, 0);
  const totalKehadiran = totalHadir + totalTerlambat + totalCutiIzin + totalAlpa;

  const activeDivisionName =
    selectedDivisi === 'all'
      ? 'Semua divisi'
      : divisions.find((d) => d.id === selectedDivisi)?.nama || 'Semua divisi';

  const activeLeaveLabel =
    monthlyLeaveStats.find((m) => m.periodeBulan === selectedLeaveMonth)?.labelBulan || '-';

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <PageHeader
        accent="primary"
        title="Laporan Eksekutif Kepegawaian"
        icon={BarChart3}
        meta={
          <span>
            Periode Gaji:{' '}
            <span className="font-bold text-foreground">
              {formatPeriodeBulan(selectedPayrollPeriod)}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu
              label="Unduh Kehadiran"
              onExportCSV={() => exportAttendance('csv')}
              onExportExcel={() => exportAttendance('excel')}
            />

            <ExportMenu
              label="Unduh Gaji Divisi"
              variant="primary"
              onExportCSV={() => exportPayroll('csv')}
              onExportExcel={() => exportPayroll('excel')}
            />
          </div>
        }
      />

      {/* Toolbar Filter Terpadu */}
      <Card className="border-border/80 shadow-2xs">
        <CardContent className="p-3.5 flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-64">
            <label htmlFor="filter-divisi" className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Filter Divisi Kerja
            </label>
            <select
              id="filter-divisi"
              value={selectedDivisi}
              onChange={(e) => setSelectedDivisi(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            >
              <option value="all">Semua Divisi ({divisions.length} Divisi)</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nama}
                </option>
              ))}
            </select>
          </div>

          <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 text-xs self-end mb-0.5">
            <Filter className="size-3 text-muted-foreground" />
            <span>Terapkan: <strong className="text-foreground">{activeDivisionName}</strong></span>
          </Badge>

          <p className="ml-auto hidden text-xs text-muted-foreground lg:block self-end mb-1">
            Filter membatasi data grafik cuti, peringkat keterlambatan, dan rekapitulasi gaji divisi.
          </p>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* 1. RINGKASAN KEHADIRAN 4 MINGGU TERAKHIR                                   */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 1. RINGKASAN KEHADIRAN 4 MINGGU TERAKHIR                                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Hadir Tepat Waktu (Emerald) */}
        <div
          aria-label="Hadir Tepat Waktu"
          className="dash-emerald-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5 shadow-sm"
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
                  Hadir Tepat Waktu
                </p>
              </div>
              <span className="dash-icon-tile bg-white/10 text-[#8df1d8] ring-1 ring-inset ring-white/15">
                <UserCheck aria-hidden="true" className="size-4" strokeWidth={1.9} />
              </span>
            </div>

            <div className="relative z-10 mt-3 flex items-baseline gap-1.5">
              <span className="font-heading font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                {totalHadir}
              </span>
              <span className="text-xs font-semibold text-white/80">orang</span>
            </div>
            <p className="relative z-10 text-[11px] text-white/70 mt-1">Check-in ≤ 08.15.00 WIB</p>
          </div>

          <div className="relative z-10 mt-3 space-y-1 border-t border-white/10 pt-2.5">
            <div className="flex justify-between text-[11px] text-white/80">
              <span>Rasio Ketepatan</span>
              <span className="font-mono font-bold text-white">
                {totalKehadiran > 0 ? Math.round((totalHadir / totalKehadiran) * 100) : 0}%
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalKehadiran}
              aria-valuenow={totalHadir}
              aria-label="Proporsi kehadiran tepat waktu"
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#2ed8b6,#8df1d8)] transition-all duration-300"
                style={{
                  width: `${totalKehadiran > 0 ? Math.min(100, Math.round((totalHadir / totalKehadiran) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Terlambat Masuk (Amber) */}
        <div
          aria-label="Terlambat Masuk"
          className="dash-amber-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5 shadow-sm"
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
                  Terlambat Masuk
                </p>
              </div>
              <span className="dash-icon-tile bg-white/10 text-[#ffd085] ring-1 ring-inset ring-white/15">
                <Clock aria-hidden="true" className="size-4" strokeWidth={1.9} />
              </span>
            </div>

            <div className="relative z-10 mt-3 flex items-baseline gap-1.5">
              <span className="font-heading font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                {totalTerlambat}
              </span>
              <span className="text-xs font-semibold text-white/80">kejadian</span>
            </div>
            <p className="relative z-10 text-[11px] text-white/70 mt-1">Check-in &gt; 08.15.00 WIB</p>
          </div>

          <div className="relative z-10 mt-3 space-y-1 border-t border-white/10 pt-2.5">
            <div className="flex justify-between text-[11px] text-white/80">
              <span>Rasio Terlambat</span>
              <span className="font-mono font-bold text-white">
                {totalKehadiran > 0 ? Math.round((totalTerlambat / totalKehadiran) * 100) : 0}%
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalKehadiran}
              aria-valuenow={totalTerlambat}
              aria-label="Proporsi keterlambatan"
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#fbbf24)] transition-all duration-300"
                style={{
                  width: `${totalKehadiran > 0 ? Math.min(100, Math.round((totalTerlambat / totalKehadiran) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Cuti / Sakit / Izin (Blue) */}
        <div
          aria-label="Cuti / Sakit / Izin"
          className="dash-blue-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5 shadow-sm"
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
                  Cuti / Sakit / Izin
                </p>
              </div>
              <span className="dash-icon-tile bg-white/10 text-[#73b4ff] ring-1 ring-inset ring-white/15">
                <Calendar aria-hidden="true" className="size-4" strokeWidth={1.9} />
              </span>
            </div>

            <div className="relative z-10 mt-3 flex items-baseline gap-1.5">
              <span className="font-heading font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                {totalCutiIzin}
              </span>
              <span className="text-xs font-semibold text-white/80">hari kerja</span>
            </div>
            <p className="relative z-10 text-[11px] text-white/70 mt-1">Pengajuan resmi disetujui</p>
          </div>

          <div className="relative z-10 mt-3 space-y-1 border-t border-white/10 pt-2.5">
            <div className="flex justify-between text-[11px] text-white/80">
              <span>Rasio Cuti & Izin</span>
              <span className="font-mono font-bold text-white">
                {totalKehadiran > 0 ? Math.round((totalCutiIzin / totalKehadiran) * 100) : 0}%
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalKehadiran}
              aria-valuenow={totalCutiIzin}
              aria-label="Proporsi cuti dan izin"
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#3b82f6,#60a5fa)] transition-all duration-300"
                style={{
                  width: `${totalKehadiran > 0 ? Math.min(100, Math.round((totalCutiIzin / totalKehadiran) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Tanpa Keterangan / Alpa (Rose) */}
        <div
          aria-label="Tanpa Keterangan"
          className="dash-rose-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5 shadow-sm"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full border border-white/10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 top-8 size-20 rounded-full bg-[#ff8ba0]/20 blur-xl"
          />
          <div>
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-[#ff8ba0]" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                  Tanpa Keterangan
                </p>
              </div>
              <span className="dash-icon-tile bg-white/10 text-[#ffa3b4] ring-1 ring-inset ring-white/15">
                <AlertTriangle aria-hidden="true" className="size-4" strokeWidth={1.9} />
              </span>
            </div>

            <div className="relative z-10 mt-3 flex items-baseline gap-1.5">
              <span className="font-heading font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                {totalAlpa}
              </span>
              <span className="text-xs font-semibold text-white/80">kejadian</span>
            </div>
            <p className="relative z-10 text-[11px] text-white/70 mt-1">Tanpa catatan presensi</p>
          </div>

          <div className="relative z-10 mt-3 space-y-1 border-t border-white/10 pt-2.5">
            <div className="flex justify-between text-[11px] text-white/80">
              <span>Rasio Alpa</span>
              <span className="font-mono font-bold text-white">
                {totalKehadiran > 0 ? Math.round((totalAlpa / totalKehadiran) * 100) : 0}%
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalKehadiran}
              aria-valuenow={totalAlpa}
              aria-label="Proporsi alpa"
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#ef4444,#f87171)] transition-all duration-300"
                style={{
                  width: `${totalKehadiran > 0 ? Math.min(100, Math.round((totalAlpa / totalKehadiran) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. GRAFIK KEHADIRAN 4 MINGGU TERAKHIR (STACKED BAR CHART)                  */}
      {/* ========================================================================= */}
      <section
        aria-label="Tren Kehadiran 4 Minggu Terakhir"
        className="dash-soft-blue-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-blue-400/10 blur-2xl"
        />

        <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-blue-100 dark:border-blue-900/30 pb-3">
          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
              Tren Kehadiran 4 Minggu Terakhir
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Komposisi kehadiran seluruh karyawan per minggu kerja berjalan
            </p>
          </div>
          <Badge
            variant="outline"
            className="font-semibold text-[10px] uppercase tracking-wider self-start sm:self-auto bg-blue-50/80 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60"
          >
            Senin – Jumat (Hari Kerja)
          </Badge>
        </div>

        <div className="relative z-10 pt-2">
          <AttendanceStackedBarChart data={weeklyStats} height={320} />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. GRAFIK CUTI PER DIVISI & TABEL TOP 5 KETERLAMBATAN                      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Grafik Rekap Cuti / Sakit / Izin per Divisi (Emerald Lembut) */}
        <section
          aria-label="Cuti, Sakit, & Izin per Divisi"
          className="dash-soft-emerald-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 sm:p-6 shadow-xs"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-emerald-400/10 blur-2xl"
          />

          <div>
            <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-100 dark:border-emerald-900/30 pb-3">
              <div>
                <h2 className="font-heading text-base font-bold tracking-tight text-foreground">
                  Cuti, Sakit, & Izin per Divisi
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Akumulasi hari kerja pengajuan yang telah disetujui.
                </p>
              </div>

              <select
                id="leave-month"
                value={selectedLeaveMonth}
                onChange={(e) => setSelectedLeaveMonth(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20"
              >
                {monthlyLeaveStats.map((m) => (
                  <option key={m.periodeBulan} value={m.periodeBulan} className="text-slate-900 bg-white">
                    {m.labelBulan}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative z-10 pt-4">
              <DivisionLeaveBarChart data={activeLeaveData} height={280} />
            </div>
          </div>

          <div className="relative z-10 mt-4 flex items-center justify-between border-t border-emerald-100 dark:border-emerald-900/30 pt-3 text-xs text-muted-foreground">
            <span>
              Data Periode: <strong className="text-foreground">{activeLeaveLabel}</strong>
            </span>
            <span>{activeLeaveData.length} Divisi Terdata</span>
          </div>
        </section>

        {/* Tabel 5 Karyawan Terbanyak Terlambat Bulan Ini (Amber Lembut) */}
        <section
          aria-label="5 Karyawan Paling Sering Terlambat"
          className="dash-soft-amber-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 sm:p-6 shadow-xs"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-amber-400/10 blur-2xl"
          />

          <div>
            <div className="relative z-10 flex items-center justify-between border-b border-amber-200/50 dark:border-amber-900/30 pb-3">
              <div>
                <h2 className="font-heading text-base font-bold tracking-tight text-foreground">
                  5 Karyawan Paling Sering Terlambat
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bulan {currentMonthName} (&gt; 08.15.00 WIB sesuai BR-03).
                </p>
              </div>

              <ExportMenu
                label="Unduh"
                variant="compact"
                onExportCSV={() => exportLate('csv')}
                onExportExcel={() => exportLate('excel')}
              />
            </div>

            <div className="relative z-10 pt-3">
              {filteredLateEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
                  <CheckCircle2 className="size-8 text-emerald-600 mb-2" />
                  <p className="text-sm font-semibold text-foreground">Kedisiplinan Sempurna</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tidak ada catatan keterlambatan pada periode {currentMonthName}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-background/60 shadow-2xs">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-amber-200/60 dark:border-amber-900/40 bg-amber-100/50 dark:bg-amber-950/40 hover:bg-amber-100/50">
                        <TableHead className="w-12 text-center font-semibold text-xs text-amber-950 dark:text-amber-200">#</TableHead>
                        <TableHead className="font-semibold text-xs text-amber-950 dark:text-amber-200">Karyawan</TableHead>
                        <TableHead className="font-semibold text-xs text-amber-950 dark:text-amber-200">Divisi</TableHead>
                        <TableHead className="font-semibold text-xs text-right text-amber-950 dark:text-amber-200">Frekuensi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLateEmployees.slice(0, 5).map((emp, index) => (
                        <TableRow key={emp.karyawan_id} className="border-b border-amber-100/70 dark:border-amber-950/40 hover:bg-amber-50/50 dark:hover:bg-amber-950/20">
                          <TableCell className="text-center font-mono font-bold text-xs">
                            {index === 0 ? (
                              <Badge className="size-5 p-0 flex items-center justify-center rounded-full bg-amber-500 text-slate-950 font-extrabold mx-auto">
                                1
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground font-semibold text-xs">{index + 1}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="font-bold text-xs text-foreground">{emp.nama_lengkap}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {emp.nik_karyawan} · {emp.jabatan}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {emp.divisi_nama}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-900 ring-1 ring-inset ring-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-700/50">
                              {emp.jumlah_terlambat}x
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          <div className="relative z-10 mt-3 p-2.5 rounded-xl border border-amber-200/70 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
            Batas toleransi kedatangan resmi: 08.15.00 WIB (Aturan BR-03)
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 4. TABEL REKAP TOTAL GAJI PER DIVISI (HANYA SLIP TERBIT - PRD BAB 9)       */}
      {/* ========================================================================= */}
      <section
        aria-label="Rekapitulasi Total Pengeluaran Gaji per Divisi"
        className="dash-soft-indigo-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-indigo-400/10 blur-2xl"
        />

        <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-indigo-100 dark:border-indigo-900/30 pb-3">
          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
              Rekapitulasi Total Pengeluaran Gaji per Divisi
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hanya menghitung slip gaji yang telah berstatus terbit resmi.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="payroll-period" className="text-xs font-semibold text-muted-foreground">
              Periode Gaji:
            </label>
            <select
              id="payroll-period"
              value={selectedPayrollPeriod}
              onChange={(e) => setSelectedPayrollPeriod(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20"
            >
              {availablePayrollPeriods.map((p) => (
                <option key={p} value={p} className="text-slate-900 bg-white">
                  {formatPeriodeBulan(p)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative z-10">
          {payrollByDivision.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
              <Building2 className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm font-semibold text-foreground">Belum ada data divisi pada periode ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-indigo-200/60 dark:border-indigo-900/50 bg-background/70 shadow-2xs">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-50/70">
                    <TableHead className="font-semibold text-xs text-indigo-950 dark:text-indigo-200">Nama Divisi</TableHead>
                    <TableHead className="font-semibold text-xs text-right text-indigo-950 dark:text-indigo-200">Karyawan Terbit</TableHead>
                    <TableHead className="font-semibold text-xs text-right text-indigo-950 dark:text-indigo-200">Total Gaji Pokok</TableHead>
                    <TableHead className="font-semibold text-xs text-right text-indigo-950 dark:text-indigo-200">Total Tunjangan</TableHead>
                    <TableHead className="font-semibold text-xs text-right text-indigo-950 dark:text-indigo-200">Total Potongan</TableHead>
                    <TableHead className="font-semibold text-xs text-right text-indigo-950 dark:text-indigo-200">Total Gaji Diterima</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollByDivision.map((item) => (
                    <TableRow key={item.divisi_id} className="border-b border-indigo-100/60 dark:border-indigo-950/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20">
                      <TableCell className="font-bold text-xs text-foreground">
                        <div className="flex items-center gap-2">
                          <Building2 className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>{item.divisi_nama}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {item.jumlah_karyawan} orang
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-foreground">
                        {formatRupiah(item.total_gaji_pokok)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-foreground">
                        {formatRupiah(item.total_tunjangan)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-rose-600 dark:text-rose-400 font-semibold">
                        ({formatRupiah(item.total_potongan)})
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(item.total_diterima)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot>
                  <TableRow className="border-t-2 border-indigo-300/80 bg-indigo-100/60 dark:bg-indigo-950/60 font-bold">
                    <TableCell className="text-xs uppercase tracking-wider text-indigo-950 dark:text-indigo-100">
                      Grand Total ({formatPeriodeBulan(selectedPayrollPeriod)})
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-foreground">
                      {grandTotalPayroll.jumlah_karyawan} orang
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-foreground">
                      {formatRupiah(grandTotalPayroll.total_gaji_pokok)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-foreground">
                      {formatRupiah(grandTotalPayroll.total_tunjangan)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-rose-600 dark:text-rose-400">
                      ({formatRupiah(grandTotalPayroll.total_potongan)})
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {formatRupiah(grandTotalPayroll.total_diterima)}
                    </TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
