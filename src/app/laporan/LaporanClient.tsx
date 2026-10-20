'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Clock,
  DollarSign,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Filter,
  FileSpreadsheet,
  ChevronDown,
} from 'lucide-react';
import { formatRupiah, formatPeriodeBulan } from '@/utils/formatters';
import { downloadCSV } from '@/utils/csvExport';
import {
  WeeklyAttendanceStat,
  DivisionPayrollStat,
  LateEmployeeStat,
} from '@/utils/analytics';
import AttendanceStackedBarChart from '@/components/charts/AttendanceStackedBarChart';
import DivisionLeaveBarChart, {
  DivisionLeaveDataPoint,
} from '@/components/charts/DivisionLeaveBarChart';

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

  // =========================================================================
  // HANDLERS UNDUH CSV (PRD Bab 9)
  // =========================================================================

  // 1. Unduh CSV Kehadiran 4 Minggu
  const handleExportAttendanceCSV = () => {
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
    downloadCSV('rekap-kehadiran-4-minggu.csv', headers, rows);
  };

  // 2. Unduh CSV Keterlambatan
  const handleExportLateCSV = () => {
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
    downloadCSV(`karyawan-terbanyak-terlambat-${selectedPayrollPeriod.slice(0, 7)}.csv`, headers, rows);
  };

  // 3. Unduh CSV Rekap Gaji per Divisi
  const handleExportPayrollCSV = () => {
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
    // Baris Grand Total
    rows.push([
      'TOTAL KESELURUHAN',
      grandTotalPayroll.jumlah_karyawan,
      grandTotalPayroll.total_gaji_pokok,
      grandTotalPayroll.total_tunjangan,
      grandTotalPayroll.total_potongan,
      grandTotalPayroll.total_diterima,
    ]);
    downloadCSV(`rekap-gaji-divisi-${selectedPayrollPeriod}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Toolbar Ekspor */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Laporan & Analitik Kepegawaian (HRD)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Rekapitulasi kehadiran, cuti, keterlambatan, dan pengeluaran gaji resmi PT Karsa Lintas Nusantara (Bab 9 PRD).
              </p>
            </div>
          </div>

          {/* Tombol Ekspor CSV */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportAttendanceCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Unduh CSV Kehadiran</span>
            </button>

            <button
              onClick={handleExportPayrollCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-all active:scale-95"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span>Unduh CSV Gaji Divisi</span>
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Filter Divisi:
              </span>
            </div>
            <select
              value={selectedDivisi}
              onChange={(e) => setSelectedDivisi(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="all">Semua Divisi (4 Divisi)</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-400">
            Pembaruan analitik dihitung otomatis dari server (WIB)
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. GRAFIK 1: STACKED BAR CHART KEHADIRAN 4 MINGGU TERAKHIR (PRD BAB 9)   */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <span>Grafik Kehadiran 4 Minggu Terakhir (Stacked Bar Chart)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribusi kehadiran per minggu: Hadir tepat waktu, Terlambat, Cuti/Izin, dan Tanpa Keterangan (Alpa).
            </p>
          </div>
          <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            Senin - Jumat (Hari Kerja)
          </span>
        </div>

        {/* Recharts Stacked Bar Chart */}
        <AttendanceStackedBarChart data={weeklyStats} height={320} />

        {/* Ringkasan Angka di Bawah Grafik */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5">
            <span className="text-[11px] font-bold uppercase text-emerald-800">
              Total Hadir Tepat Waktu
            </span>
            <div className="text-2xl font-black text-emerald-900 mt-1">
              {weeklyStats.reduce((acc, curr) => acc + curr.hadir, 0)}
            </div>
            <p className="text-[10px] text-emerald-700 mt-0.5">Check-in ≤ 08.15 WIB</p>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5">
            <span className="text-[11px] font-bold uppercase text-amber-800">
              Total Terlambat
            </span>
            <div className="text-2xl font-black text-amber-900 mt-1">
              {weeklyStats.reduce((acc, curr) => acc + curr.terlambat, 0)}
            </div>
            <p className="text-[10px] text-amber-700 mt-0.5">Check-in &gt; 08.15 WIB</p>
          </div>

          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5">
            <span className="text-[11px] font-bold uppercase text-blue-800">
              Total Cuti / Izin / Sakit
            </span>
            <div className="text-2xl font-black text-blue-900 mt-1">
              {weeklyStats.reduce((acc, curr) => acc + curr.cuti_izin, 0)}
            </div>
            <p className="text-[10px] text-blue-700 mt-0.5">Pengajuan resmi disetujui</p>
          </div>

          <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3.5">
            <span className="text-[11px] font-bold uppercase text-rose-800">
              Tanpa Keterangan (Alpa)
            </span>
            <div className="text-2xl font-black text-rose-900 mt-1">
              {weeklyStats.reduce((acc, curr) => acc + curr.tanpa_keterangan, 0)}
            </div>
            <p className="text-[10px] text-rose-700 mt-0.5">Dihitung otomatis (PRD Bab 8)</p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. GRAFIK 2 & TABEL KETERLAMBATAN (GRID 2 KOLOM)                          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grafik 2: Hari Cuti, Sakit, & Izin per Divisi per Bulan */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>Cuti, Sakit, & Izin per Divisi</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Jumlah hari kerja pengajuan yang disetujui
                </p>
              </div>

              {/* Selector Bulan (Agustus, September, Oktober) */}
              <select
                value={selectedLeaveMonth}
                onChange={(e) => setSelectedLeaveMonth(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {monthlyLeaveStats.map((m) => (
                  <option key={m.periodeBulan} value={m.periodeBulan}>
                    {m.labelBulan}
                  </option>
                ))}
              </select>
            </div>

            {/* Recharts Grouped Bar Chart */}
            <DivisionLeaveBarChart data={activeLeaveData} height={280} />
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
            <span>Menampilkan data bulan: <strong>{monthlyLeaveStats.find(m => m.periodeBulan === selectedLeaveMonth)?.labelBulan}</strong></span>
            <span className="text-[11px] text-slate-400">Total 4 Divisi</span>
          </div>
        </div>

        {/* Tabel 5 Karyawan Paling Sering Terlambat */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>5 Karyawan Sering Terlambat ({currentMonthName})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rekapitulasi keterlambatan bulan berjalan (Check-in &gt; 08.15.00 WIB)
                </p>
              </div>

              <button
                onClick={handleExportLateCSV}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
              </button>
            </div>

            {filteredLateEmployees.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <span>Tidak ada karyawan yang terlambat pada periode ini.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Karyawan</th>
                      <th className="py-2.5 px-3">Divisi</th>
                      <th className="py-2.5 px-3 text-right">Frekuensi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLateEmployees.slice(0, 5).map((emp, index) => (
                      <tr key={emp.karyawan_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-500">
                          {index === 0 ? (
                            <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold">1</span>
                          ) : (
                            index + 1
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{emp.nama_lengkap}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{emp.nik_karyawan} · {emp.jabatan}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {emp.divisi_nama}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-rose-50 text-rose-700 border border-rose-200">
                            {emp.jumlah_terlambat}x
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            Batas toleransi kedatangan: 08.15.00 WIB (Aturan BR-03)
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TABEL REKAP TOTAL GAJI PER DIVISI (HANYA SLIP TERBIT - PRD BAB 9)      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span>Rekapitulasi Total Gaji per Divisi (Hanya Slip Berstatus Terbit)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sesuai aturan BR-11 & PRD Bab 9: Rekapitulasi pengeluaran gaji resmi PT Karsa Lintas Nusantara.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Pilih Periode:</span>
            <select
              value={selectedPayrollPeriod}
              onChange={(e) => setSelectedPayrollPeriod(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availablePayrollPeriods.map((p) => (
                <option key={p} value={p}>
                  {formatPeriodeBulan(p)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabel Rekap Gaji */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nama Divisi</th>
                <th className="py-3 px-4 text-center">Karyawan Bergaji Terbit</th>
                <th className="py-3 px-4 text-right">Total Gaji Pokok</th>
                <th className="py-3 px-4 text-right">Total Tunjangan</th>
                <th className="py-3 px-4 text-right">Total Potongan</th>
                <th className="py-3 px-4 text-right">Total Gaji Diterima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrollByDivision.map((item) => (
                <tr key={item.divisi_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span>{item.divisi_nama}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-slate-700">
                    {item.jumlah_karyawan} orang
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                    {formatRupiah(item.total_gaji_pokok)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                    {formatRupiah(item.total_tunjangan)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-rose-600">
                    ({formatRupiah(item.total_potongan)})
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                    {formatRupiah(item.total_diterima)}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Grand Total Footer */}
            <tfoot className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
              <tr>
                <td className="py-4 px-4 uppercase tracking-wider text-xs">
                  Grand Total ({formatPeriodeBulan(selectedPayrollPeriod)})
                </td>
                <td className="py-4 px-4 text-center font-mono">
                  {grandTotalPayroll.jumlah_karyawan} orang
                </td>
                <td className="py-4 px-4 text-right font-mono">
                  {formatRupiah(grandTotalPayroll.total_gaji_pokok)}
                </td>
                <td className="py-4 px-4 text-right font-mono">
                  {formatRupiah(grandTotalPayroll.total_tunjangan)}
                </td>
                <td className="py-4 px-4 text-right font-mono text-rose-600">
                  ({formatRupiah(grandTotalPayroll.total_potongan)})
                </td>
                <td className="py-4 px-4 text-right font-mono text-base text-emerald-800">
                  {formatRupiah(grandTotalPayroll.total_diterima)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
