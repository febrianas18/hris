'use client';

import React, { useState, useMemo } from 'react';
import AttendanceWidget from '@/components/AttendanceWidget';
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
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
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

export default function AbsensiClient({
  currentUserRole,
  currentUserId,
  initialRecords,
  divisions,
  allProfiles,
  approvedLeaves,
  todayStr,
}: AbsensiClientProps) {
  const [activeTab, setActiveTab] = useState<'pribadi' | 'tim' | 'semua'>(
    currentUserRole === 'hrd' ? 'semua' : 'pribadi'
  );

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.slice(0, 7)); // 'YYYY-MM'
  const [selectedDivisi, setSelectedDivisi] = useState<string>('semua');
  const [selectedStatus, setSelectedStatus] = useState<string>('semua');
  const [records, setRecords] = useState<AbsensiRecord[]>(initialRecords);

  // Modal Koreksi Absensi (Khusus HRD - BR-03)
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
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
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
    // Tentukan pool profil yang relevan
    const pool =
      currentUserRole === 'atasan'
        ? allProfiles // Atasan hanya untuk divisinya (disaring di backend atau lewat divisi)
        : allProfiles;

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

      if (att) {
        computedStatus = att.status === 'hadir' ? 'Hadir' : 'Terlambat';
        statusType = att.status;
      } else if (leave) {
        const j = leave.jenis.toLowerCase();
        computedStatus = j === 'sakit' ? 'Sakit' : j === 'izin' ? 'Izin' : 'Cuti';
        statusType = 'cuti';
      }

      return {
        id: emp.id,
        nik: emp.nik_karyawan,
        nama: emp.nama_lengkap,
        divisi: emp.divisi?.nama || '-',
        divisi_id: emp.divisi_id,
        masuk: att ? formatTimeOnly(att.jam_masuk) : '-',
        pulang: att?.jam_pulang ? formatTimeOnly(att.jam_pulang) : '-',
        statusText: computedStatus,
        statusType,
        attRecord: att,
        catatan:
          att && !att.jam_pulang
            ? 'Belum check-out'
            : att?.dikoreksi_oleh
            ? 'Terkoreksi'
            : leave
            ? 'Disetujui'
            : '-',
      };
    });
  }, [allProfiles, records, approvedLeaves, selectedDate, currentUserRole]);

  // Filter berdasarkan Divisi dan Status untuk tampilan tabel harian
  const filteredDailyData = useMemo(() => {
    return dailyEmployeesData.filter((item) => {
      const matchDivisi =
        selectedDivisi === 'semua' || item.divisi_id === selectedDivisi;

      let matchStatus = true;
      if (selectedStatus === 'hadir') matchStatus = item.statusType === 'hadir';
      else if (selectedStatus === 'terlambat') matchStatus = item.statusType === 'terlambat';
      else if (selectedStatus === 'cuti') matchStatus = item.statusType === 'cuti';
      else if (selectedStatus === 'absen') matchStatus = item.statusType === 'absen';

      return matchDivisi && matchStatus;
    });
  }, [dailyEmployeesData, selectedDivisi, selectedStatus]);

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
      // Susun ISO string WIB
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
        // Perbarui state lokal
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

  return (
    <div className="space-y-6">
      {/* Notifikasi Koreksi Sukses */}
      {koreksiSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{koreksiSuccessMsg}</span>
        </div>
      )}

      {/* Baris Widget Absensi & Navigasi Tab */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <AttendanceWidget />
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Modul Absensi PT Karsa Lintas Nusantara
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pencatatan waktu server WIB (Asia/Jakarta) · Aturan BR-02 & BR-03
                </p>
              </div>

              {/* Tab Selector */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('pribadi')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'pribadi'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Riwayat Pribadi
                </button>

                {currentUserRole === 'atasan' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('tim')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'tim'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tim Divisi
                  </button>
                )}

                {currentUserRole === 'hrd' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('semua')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'semua'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua Karyawan (HRD)
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium">Batas Masuk</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">08.15.00 WIB</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium">Jendela Check-in</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">06.00 - 12.00 WIB</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium">Hak Koreksi</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">Khusus HRD</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium">Alasan Koreksi</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">Min. 10 Karakter</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Konten Tab: Pribadi */}
      {activeTab === 'pribadi' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                <span>Riwayat Absensi Pribadi per Bulan</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Catatan kehadiran kerja mandiri Anda zona WIB
              </p>
            </div>

            {/* Filter Bulan & Download CSV Pribadi */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  Periode Bulan:
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  const headers = ['Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status', 'Catatan'];
                  const rows = personalRecords.map((r) => [
                    `"${r.tanggal}"`,
                    `"${formatTimeOnly(r.jam_masuk)}"`,
                    `"${r.jam_pulang ? formatTimeOnly(r.jam_pulang) : '-'}"`,
                    `"${r.status === 'hadir' ? 'Hadir' : 'Terlambat'}"`,
                    `"${r.dikoreksi_oleh ? 'Dikoreksi HRD: ' + (r.alasan_koreksi || '') : '-'}"`,
                  ]);
                  const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
                  const link = document.createElement('a');
                  link.href = encodeURI(csv);
                  link.download = `Absensi_Pribadi_${selectedMonth}.csv`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Unduh CSV</span>
              </button>
            </div>
          </div>

          {/* Kotak Ringkasan Kehadiran Bulan Ini */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Total Hari Hadir
                </div>
                <div className="text-xl font-black text-slate-900 mt-0.5">
                  {personalStats.total} <span className="text-xs font-normal text-slate-500">hari kerja</span>
                </div>
              </div>
              <Calendar className="w-7 h-7 text-indigo-400 opacity-60" />
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Hadir Tepat Waktu
                </div>
                <div className="text-xl font-black text-emerald-900 mt-0.5">
                  {personalStats.hadir} <span className="text-xs font-normal text-emerald-700">hari</span>
                </div>
              </div>
              <CheckCircle2 className="w-7 h-7 text-emerald-500 opacity-60" />
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Terlambat
                </div>
                <div className="text-xl font-black text-amber-900 mt-0.5">
                  {personalStats.terlambat} <span className="text-xs font-normal text-amber-700">hari</span>
                </div>
              </div>
              <Clock className="w-7 h-7 text-amber-500 opacity-60" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Masuk (WIB)</th>
                  <th className="py-3 px-4">Pulang (WIB)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Keterangan / Koreksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {personalRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada catatan absensi untuk akun Anda.
                    </td>
                  </tr>
                ) : (
                  personalRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {formatDateDisplay(r.tanggal)}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        {formatTimeOnly(r.jam_masuk)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {r.jam_pulang ? formatTimeOnly(r.jam_pulang) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                            r.status === 'hadir'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {r.status === 'hadir' ? 'Hadir' : 'Terlambat'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {r.dikoreksi_oleh ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100"
                            title={`Alasan: ${r.alasan_koreksi}`}
                          >
                            Dikoreksi HRD
                          </span>
                        ) : !r.jam_pulang ? (
                          <span className="text-slate-400 text-[11px]">Belum check-out</span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Konten Tab: Tim Divisi (Atasan) & Semua Karyawan (HRD) */}
      {(activeTab === 'tim' || activeTab === 'semua') && (
        <div className="space-y-6">
          {/* Header Kontrol & Filter (Wireframe Hal. 2) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span>
                    {activeTab === 'tim'
                      ? 'Pemantauan Kehadiran Tim Divisi'
                      : 'Absensi Harian Seluruh Karyawan'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Semua karyawan aktif · data dari server zona WIB
                </p>
              </div>

              {/* Tombol Unduh CSV */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Unduh CSV</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Tanggal:
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              {currentUserRole === 'hrd' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Divisi:
                  </label>
                  <select
                    value={selectedDivisi}
                    onChange={(e) => setSelectedDivisi(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
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
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Status:
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                >
                  <option value="semua">Semua Status</option>
                  <option value="hadir">Hadir Tepat Waktu</option>
                  <option value="terlambat">Terlambat</option>
                  <option value="cuti">Cuti / Sakit / Izin</option>
                  <option value="absen">Tanpa Keterangan / Belum Hadir</option>
                </select>
              </div>
            </div>

            {/* 4 Kotak Ringkasan (Wireframe Hal. 2) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Hadir Tepat Waktu
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {summaryCounts.tepatWaktu}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Terlambat
                </div>
                <div className="text-2xl font-black text-amber-900 mt-1">
                  {summaryCounts.terlambat}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  Cuti, Sakit, Izin
                </div>
                <div className="text-2xl font-black text-blue-900 mt-1">
                  {summaryCounts.cutiSakitIzin}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-100/70 border border-slate-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tanpa Keterangan
                </div>
                <div className="text-2xl font-black text-slate-700 mt-1">
                  {summaryCounts.tanpaKeterangan}
                </div>
              </div>
            </div>
          </div>

          {/* Tabel Absensi Harian */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-3">NIK</th>
                    <th className="py-3 px-3">Nama</th>
                    <th className="py-3 px-3">Divisi</th>
                    <th className="py-3 px-3">Masuk</th>
                    <th className="py-3 px-3">Pulang</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Catatan</th>
                    {currentUserRole === 'hrd' && (
                      <th className="py-3 px-3 text-right">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDailyData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={currentUserRole === 'hrd' ? 8 : 7}
                        className="py-8 text-center text-slate-400"
                      >
                        Tidak ada data karyawan yang cocok dengan filter yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    filteredDailyData.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                          {item.nik}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900">
                          {item.nama}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {item.divisi}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {item.masuk}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {item.pulang}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                              item.statusType === 'hadir'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.statusType === 'terlambat'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : item.statusType === 'cuti'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {item.statusText}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {item.catatan}
                        </td>
                        {currentUserRole === 'hrd' && (
                          <td className="py-3 px-3 text-right">
                            {item.attRecord ? (
                              <button
                                type="button"
                                onClick={() => openKoreksiModal(item.attRecord!)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Koreksi</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KOREKSI ABSENSI OLEH HRD (BR-03 & BR-12) */}
      {koreksiModalOpen && selectedRecordForKoreksi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Koreksi Absensi Karyawan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Khusus HRD · Tercatat di Audit Log (BR-03 & BR-12)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKoreksiModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKoreksi} className="mt-4 space-y-4 text-xs">
              {koreksiError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{koreksiError}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-semibold text-slate-800">
                  Tanggal: {formatDateDisplay(selectedRecordForKoreksi.tanggal)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  ID Absensi: <span className="font-mono">{selectedRecordForKoreksi.id}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Jam Masuk (HH:MM WIB) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={koreksiJamMasuk}
                    onChange={(e) => setKoreksiJamMasuk(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 font-mono font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Jam Pulang (HH:MM WIB)
                  </label>
                  <input
                    type="time"
                    value={koreksiJamPulang}
                    onChange={(e) => setKoreksiJamPulang(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 font-mono font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Status Kehadiran <span className="text-rose-500">*</span>
                </label>
                <select
                  value={koreksiStatus}
                  onChange={(e) => setKoreksiStatus(e.target.value as 'hadir' | 'terlambat')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                >
                  <option value="hadir">Hadir (Tepat Waktu)</option>
                  <option value="terlambat">Terlambat</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Alasan Koreksi <span className="text-rose-500">* (Min. 10 karakter - BR-03)</span>
                  </label>
                  <span
                    className={`text-[10px] font-semibold ${
                      koreksiAlasan.trim().length >= 10 ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {koreksiAlasan.trim().length}/10 karakter
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  value={koreksiAlasan}
                  onChange={(e) => setKoreksiAlasan(e.target.value)}
                  placeholder="Contoh: Karyawan hadir tepat waktu namun terkendala pada pemindai fingerprint gerbang utama."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setKoreksiModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={koreksiSubmitting || koreksiAlasan.trim().length < 10}
                  className={`px-4 py-2 rounded-xl text-white font-semibold flex items-center gap-1.5 transition-all ${
                    koreksiAlasan.trim().length >= 10 && !koreksiSubmitting
                      ? 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-sm'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  {koreksiSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Koreksi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
