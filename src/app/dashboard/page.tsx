import { getCurrentProfile } from '@/utils/auth';
import { createClient } from '@/utils/supabase/server';
import AppLayout from '@/components/AppLayout';
import AttendanceWidget from '@/components/AttendanceWidget';
import Link from 'next/link';
import {
  UserCheck,
  ShieldAlert,
  Clock,
  CalendarDays,
  FileCheck,
  ArrowRight,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  CheckSquare,
  Shield,
  Layers,
} from 'lucide-react';
import { getServerTimeWIB } from '@/utils/time';
import { getFourWeeksAttendanceStats, WeeklyAttendanceStat } from '@/utils/analytics';
import AttendanceStackedBarChart from '@/components/charts/AttendanceStackedBarChart';

export const dynamic = 'force-dynamic';

interface DashboardProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage(props: DashboardProps) {
  const searchParams = await props.searchParams;
  const isForbidden = searchParams.forbidden === '1';
  const forbiddenTarget = (searchParams.target as string) || '';

  const { profile } = await getCurrentProfile();
  const supabase = await createClient();
  const serverTime = getServerTimeWIB();
  const rawDivisi = profile.divisi;
  const role = profile.peran;
  const todayStr = serverTime.dateStr; // 'YYYY-MM-DD'

  // =========================================================================
  // 1. DATA PRIBADI KARYAWAN (BASELINE UNTUK SEMUA PERAN - WIREFRAME HAL. 1)
  // =========================================================================

  // 1.1 Lima riwayat absensi terakhir
  const { data: recentAttendance } = await supabase
    .from('absensi')
    .select('id, tanggal, jam_masuk, jam_pulang, status')
    .eq('karyawan_id', profile.id)
    .order('tanggal', { ascending: false })
    .limit(5);

  // 1.2 Kuota cuti tahunan berjalan
  const currentYear = parseInt(todayStr.slice(0, 4), 10);
  const { data: kuotaCuti } = await supabase
    .from('kuota_cuti')
    .select('jatah_hari, terpakai_hari')
    .eq('karyawan_id', profile.id)
    .eq('tahun', currentYear)
    .maybeSingle();

  const jatahHari = kuotaCuti?.jatah_hari ?? 12;
  const terpakaiHari = kuotaCuti?.terpakai_hari ?? 0;
  const sisaCuti = Math.max(0, jatahHari - terpakaiHari);

  // 1.3 Kehadiran bulan ini
  const currentMonthPrefix = todayStr.slice(0, 7);
  const { data: monthAttendance } = await supabase
    .from('absensi')
    .select('status')
    .eq('karyawan_id', profile.id)
    .gte('tanggal', `${currentMonthPrefix}-01`)
    .lte('tanggal', `${currentMonthPrefix}-31`);

  let countTepatWaktu = 0;
  let countTerlambat = 0;
  (monthAttendance || []).forEach((item) => {
    if (item.status === 'hadir') countTepatWaktu++;
    else if (item.status === 'terlambat') countTerlambat++;
  });

  // 1.4 Status pengajuan cuti/izin terakhir
  const { data: latestLeave } = await supabase
    .from('pengajuan_cuti')
    .select('id, jenis, tanggal_mulai, tanggal_selesai, jumlah_hari, status, dibuat_pada')
    .eq('karyawan_id', profile.id)
    .order('dibuat_pada', { ascending: false })
    .limit(1)
    .maybeSingle();

  // =========================================================================
  // 2. DATA KHUSUS ATASAN: TIM DIVISI & PENGAJUAN MENUNGGU
  // =========================================================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let teamMembers: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let teamAttendanceToday: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let teamLeavesToday: any[] = [];
  let atasanPendingCount = 0;

  if (role === 'atasan' && profile.divisi?.id) {
    // Anggota tim divisi yang aktif (kecuali diri sendiri)
    const { data: members } = await supabase
      .from('profiles')
      .select('id, nik_karyawan, nama_lengkap, jabatan, email')
      .eq('divisi_id', profile.divisi.id)
      .eq('aktif', true)
      .neq('id', profile.id);

    teamMembers = members || [];
    const memberIds = teamMembers.map((m) => m.id);

    if (memberIds.length > 0) {
      // Absensi anggota tim hari ini
      const { data: attToday } = await supabase
        .from('absensi')
        .select('karyawan_id, jam_masuk, jam_pulang, status')
        .in('karyawan_id', memberIds)
        .eq('tanggal', todayStr);

      teamAttendanceToday = attToday || [];

      // Cuti tim yang aktif hari ini
      const { data: leavesToday } = await supabase
        .from('pengajuan_cuti')
        .select('karyawan_id, jenis, tanggal_mulai, tanggal_selesai')
        .in('karyawan_id', memberIds)
        .eq('status', 'disetujui')
        .lte('tanggal_mulai', todayStr)
        .gte('tanggal_selesai', todayStr);

      teamLeavesToday = leavesToday || [];

      // Pengajuan cuti tim yang menunggu persetujuan tahap 1 Atasan
      const { count } = await supabase
        .from('pengajuan_cuti')
        .select('id', { count: 'exact', head: true })
        .in('karyawan_id', memberIds)
        .eq('status', 'diajukan')
        .eq('perlu_atasan', true);

      atasanPendingCount = count || 0;
    }
  }

  // =========================================================================
  // 3. DATA KHUSUS HRD: METRIK PERUSAHAAN & ANTREAN KEPUTUSAN AKHIR
  // =========================================================================
  let totalActiveEmployees = 0;
  let companyHadirToday = 0;
  let companyTerlambatToday = 0;
  let hrdPendingApprovals = 0;
  let avgRemainingQuota = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let hrdPendingQueue: any[] = [];
  let weeklyChartStats: WeeklyAttendanceStat[] = [];

  if (role === 'hrd') {
    // Total karyawan aktif
    const { count: empCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('aktif', true);
    totalActiveEmployees = empCount || 0;

    // Kehadiran hari ini
    const { data: todayAtt } = await supabase
      .from('absensi')
      .select('status')
      .eq('tanggal', todayStr);

    (todayAtt || []).forEach((a) => {
      if (a.status === 'hadir') companyHadirToday++;
      else if (a.status === 'terlambat') companyTerlambatToday++;
    });

    // Pengajuan cuti menunggu keputusan akhir HRD
    const { count: hrdCount, data: pendingQueue } = await supabase
      .from('pengajuan_cuti')
      .select(`
        id,
        jenis,
        tanggal_mulai,
        tanggal_selesai,
        jumlah_hari,
        status,
        dibuat_pada,
        profiles:karyawan_id (
          id,
          nik_karyawan,
          nama_lengkap,
          divisi:divisi_id (
            nama
          )
        )
      `)
      .or('status.eq.disetujui_atasan,and(status.eq.diajukan,perlu_atasan.eq.false)')
      .order('dibuat_pada', { ascending: false })
      .limit(4);

    hrdPendingApprovals = hrdCount || 0;
    hrdPendingQueue = pendingQueue || [];

    // Rata-rata sisa cuti perusahaan
    const { data: allQuotas } = await supabase
      .from('kuota_cuti')
      .select('jatah_hari, terpakai_hari')
      .eq('tahun', currentYear);

    if (allQuotas && allQuotas.length > 0) {
      const totalSisa = allQuotas.reduce(
        (acc, q) => acc + Math.max(0, q.jatah_hari - q.terpakai_hari),
        0
      );
      avgRemainingQuota = Math.round((totalSisa / allQuotas.length) * 10) / 10;
    }

    // Hitung statistik grafik 4 minggu terakhir untuk HRD
    weeklyChartStats = await getFourWeeksAttendanceStats(supabase, todayStr);
  }

  // Format Helper
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

  const formatLeaveType = (type: string) => {
    switch (type) {
      case 'cuti_tahunan':
        return 'Cuti Tahunan';
      case 'sakit':
        return 'Sakit';
      case 'izin':
        return 'Izin';
      default:
        return type;
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'disetujui':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">Disetujui</span>;
      case 'disetujui_atasan':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">Tahap HRD</span>;
      case 'diajukan':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">Menunggu</span>;
      case 'ditolak':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200">Ditolak</span>;
      case 'dibatalkan':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">Dibatalkan</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">{st}</span>;
    }
  };

  return (
    <AppLayout profile={profile}>
      {/* 403 Forbidden Alert jika dialihkan karena mencoba akses URL terlarang */}
      {isForbidden && (
        <div
          id="rbac-forbidden-alert"
          className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm flex items-start gap-3.5 animate-in fade-in duration-200"
          role="alert"
        >
          <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-rose-900 flex items-center gap-2">
              <span>Akses Ditolak (403 Forbidden)</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-200 text-rose-800">
                RBAC Protection
              </span>
            </h2>
            <p className="text-xs text-rose-700 mt-1 leading-relaxed">
              Peran akun Anda (<span className="font-semibold uppercase">{role}</span>) tidak memiliki izin untuk mengakses halaman{' '}
              <code className="px-1.5 py-0.5 rounded bg-rose-100 font-mono text-rose-800 font-semibold">{forbiddenTarget || 'tersebut'}</code>.
              Sistem telah mengalihkan Anda kembali ke Dashboard sesuai aturan RBAC.
            </p>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> Akun Aktif Terverifikasi
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border uppercase bg-indigo-50 text-indigo-700 border-indigo-200">
                Peran: {role}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Selamat Datang, {profile?.nama_lengkap}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {serverTime.fullDisplayStr} · NIK:{' '}
              <span className="font-mono font-semibold text-slate-700">{profile?.nik_karyawan}</span> · Divisi:{' '}
              <span className="font-semibold text-slate-700">{rawDivisi?.nama || '-'}</span>
            </p>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RINGKASAN METRIK HRD (JIKA PERAN HRD)                             */}
        {/* ================================================================= */}
        {role === 'hrd' && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Ringkasan Metrik Perusahaan (PT Karsa Lintas Nusantara)</span>
              </h3>
              <Link
                href="/laporan"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>Lihat Laporan Lengkap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Total Karyawan Aktif
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-1.5">
                  {totalActiveEmployees}{' '}
                  <span className="text-xs font-normal text-slate-500">orang</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">4 Divisi Operasional</p>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Hadir Tepat Waktu Hari Ini
                </div>
                <div className="text-2xl font-black text-emerald-900 mt-1">
                  {companyHadirToday}{' '}
                  <span className="text-xs font-normal text-emerald-700">
                    ({totalActiveEmployees > 0 ? Math.round((companyHadirToday / totalActiveEmployees) * 100) : 0}%)
                  </span>
                </div>
                <p className="text-[10px] text-emerald-700 mt-1">
                  {companyTerlambatToday} terlambat hari ini
                </p>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Menunggu Keputusan HRD
                </div>
                <div className="text-2xl font-black text-amber-900 mt-1">
                  {hrdPendingApprovals}{' '}
                  <span className="text-xs font-normal text-amber-700">pengajuan</span>
                </div>
                <Link
                  href="/persetujuan"
                  className="text-[10px] font-bold text-amber-800 hover:underline mt-1 inline-block"
                >
                  Proses di Persetujuan →
                </Link>
              </div>

              <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                  Rata-rata Sisa Cuti
                </div>
                <div className="text-2xl font-black text-indigo-900 mt-1">
                  {avgRemainingQuota}{' '}
                  <span className="text-xs font-normal text-indigo-700">hari / orang</span>
                </div>
                <p className="text-[10px] text-indigo-700 mt-1">Tahun Kalender {currentYear}</p>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* RINGKASAN TIM DIVISI & APPROVAL ATASAN (JIKA PERAN ATASAN)        */}
        {/* ================================================================= */}
        {role === 'atasan' && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            {atasanPendingCount > 0 && (
              <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-amber-900">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>
                    Terdapat <strong>{atasanPendingCount} pengajuan cuti/izin</strong> dari anggota divisi {rawDivisi?.nama} yang menunggu persetujuan Tahap 1 Anda!
                  </span>
                </div>
                <Link
                  href="/persetujuan"
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-2xs transition-colors"
                >
                  Buka Persetujuan
                </Link>
              </div>
            )}

            <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Kehadiran Tim Divisi {rawDivisi?.nama} Hari Ini</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  Total {teamMembers.length} Anggota
                </span>
              </div>

              {teamMembers.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Belum ada anggota di divisi ini.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {teamMembers.map((member) => {
                    const att = teamAttendanceToday.find((a) => a.karyawan_id === member.id);
                    const onLeave = teamLeavesToday.find((l) => l.karyawan_id === member.id);

                    let statusBadge;
                    if (att) {
                      statusBadge = (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          att.status === 'hadir'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {att.status === 'hadir' ? 'Hadir' : 'Terlambat'} ({formatTimeOnly(att.jam_masuk)})
                        </span>
                      );
                    } else if (onLeave) {
                      statusBadge = (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          {formatLeaveType(onLeave.jenis)}
                        </span>
                      );
                    } else {
                      statusBadge = (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                          Belum Hadir
                        </span>
                      );
                    }

                    return (
                      <div
                        key={member.id}
                        className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {member.nama_lengkap}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">{member.jabatan}</p>
                        </div>
                        <div className="shrink-0">{statusBadge}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3 Kartu Baseline (Wireframe Halaman 1): Absensi Hari Ini, Sisa Cuti, Kehadiran Bulan Ini */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
          {/* Card 1: Widget Absensi Real-time */}
          <AttendanceWidget />

          {/* Card 2: Sisa Cuti Tahunan */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Sisa Cuti Tahunan {currentYear}
                </span>
                <CalendarDays className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-4">
                <div className="text-2xl sm:text-3xl font-black text-slate-900">
                  {sisaCuti} <span className="text-sm font-normal text-slate-500">dari {jatahHari} hari</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {terpakaiHari} hari terpakai atau sedang diajukan
                </p>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100">
              <Link
                href="/cuti-izin"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group"
              >
                <span>Kelola pengajuan cuti</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: Kehadiran Bulan Ini */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Kehadiran Bulan Ini
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-4">
                <div className="text-2xl sm:text-3xl font-black text-slate-900">
                  {countTepatWaktu}{' '}
                  <span className="text-sm font-normal text-emerald-600 font-semibold">tepat waktu</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {countTerlambat} kali terlambat · batas jam masuk 08.15 WIB
                </p>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100">
              <Link
                href="/absensi"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group"
              >
                <span>Lihat riwayat lengkap</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BAGIAN GRAFIK 4 MINGGU & ANTREAN KEPUTUSAN AKHIR (KHUSUS HRD)              */}
      {/* ========================================================================= */}
      {role === 'hrd' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Grafik Mini Kehadiran 4 Minggu Terakhir */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span>Tren Kehadiran 4 Minggu Terakhir</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distribusi kehadiran seluruh karyawan PT Karsa Lintas Nusantara
                </p>
              </div>
              <Link
                href="/laporan"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>Analitik Lengkap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <AttendanceStackedBarChart data={weeklyChartStats} height={280} />
          </div>

          {/* Antrean Keputusan Akhir HRD */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-amber-600" />
                  <span>Antrean Keputusan Akhir</span>
                </h3>
                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  {hrdPendingQueue.length} Pengajuan
                </span>
              </div>

              {hrdPendingQueue.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <span>Tidak ada pengajuan yang menunggu keputusan akhir.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {hrdPendingQueue.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100/60 transition-colors text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>{item.profiles?.nama_lengkap}</span>
                        <span className="text-[10px] text-indigo-600 font-bold uppercase">
                          {formatLeaveType(item.jenis)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 mt-1 text-[11px]">
                        <span>{item.jumlah_hari} hari kerja ({item.tanggal_mulai})</span>
                        <span className="text-amber-700 font-medium">Siap diputuskan</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100">
              <Link
                href="/persetujuan"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
              >
                <span>Buka Menu Persetujuan HRD</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TABEL: ABSENSI 5 HARI TERAKHIR & STATUS PENGAJUAN TERAKHIR (WIREFRAME 1)  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Kolom Kiri (2 Span): Riwayat 5 Absensi Terakhir */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Absensi 5 Hari Terakhir Saya</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pencatatan resmi langsung dari server WIB
              </p>
            </div>
            <Link
              href="/absensi"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>Selengkapnya</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Masuk (WIB)</th>
                  <th className="py-3 px-4">Pulang (WIB)</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!recentAttendance || recentAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      Belum ada riwayat absensi tercatat.
                    </td>
                  </tr>
                ) : (
                  recentAttendance.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {formatDateDisplay(row.tanggal)}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        {formatTimeOnly(row.jam_masuk)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {row.jam_pulang ? formatTimeOnly(row.jam_pulang) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                            row.status === 'hadir'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {row.status === 'hadir' ? 'Hadir' : 'Terlambat'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolom Kanan (1 Span): Status Pengajuan Cuti/Izin Terakhir (Wireframe Hal. 1) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-600" />
                <span>Pengajuan Terakhir</span>
              </h3>
              <Link
                href="/cuti-izin"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Lihat Semua
              </Link>
            </div>

            {latestLeave ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">
                    {formatLeaveType(latestLeave.jenis)}
                  </span>
                  {getStatusBadge(latestLeave.status)}
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rentang:</span>
                    <span className="font-medium text-slate-800">
                      {latestLeave.tanggal_mulai} s/d {latestLeave.tanggal_selesai}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Durasi:</span>
                    <span className="font-medium text-slate-800">{latestLeave.jumlah_hari} hari kerja</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/70 text-[11px] text-slate-400">
                  Diajukan pada: {new Date(latestLeave.dibuat_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <span>Belum ada pengajuan cuti atau izin.</span>
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <Link
              href="/cuti-izin"
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition-colors"
            >
              <span>+ Buat Pengajuan Baru</span>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
