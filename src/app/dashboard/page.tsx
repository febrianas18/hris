import { getCurrentProfile } from '@/utils/auth';
import { createClient } from '@/utils/supabase/server';
import AppLayout from '@/components/AppLayout';
import AttendanceWidget from '@/components/AttendanceWidget';
import HrdDashboard from '@/components/dashboard/HrdDashboard';
import type { HrdDivisionStat, HrdQueueItem } from '@/components/dashboard/types';
import Link from 'next/link';
import {
  ShieldAlert,
  Clock,
  CalendarDays,
  CalendarPlus,
  ArrowRight,
  ArrowUpRight,
  TrendingUp,
  Users,
  CheckSquare,
  CheckCircle2,
  Receipt,
  Inbox,
  CalendarOff,
  Plus,
} from 'lucide-react';
import { getServerTimeWIB } from '@/utils/time';
import { getFourWeeksAttendanceStats, WeeklyAttendanceStat } from '@/utils/analytics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { StatusPill } from '@/components/app/StatusPill';
import { cn } from '@/lib/utils';

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
  const currentYear = parseInt(todayStr.slice(0, 4), 10);
  const currentMonthPrefix = todayStr.slice(0, 7);

  // Kueri database baseline secara paralel untuk kecepatan loading maksimal
  const [
    { data: recentAttendance },
    { data: kuotaCuti },
    { data: monthAttendance },
    { data: latestLeave },
  ] = await Promise.all([
    supabase
      .from('absensi')
      .select('id, tanggal, jam_masuk, jam_pulang, status')
      .eq('karyawan_id', profile.id)
      .order('tanggal', { ascending: false })
      .limit(5),
    supabase
      .from('kuota_cuti')
      .select('jatah_hari, terpakai_hari')
      .eq('karyawan_id', profile.id)
      .eq('tahun', currentYear)
      .maybeSingle(),
    supabase
      .from('absensi')
      .select('status')
      .eq('karyawan_id', profile.id)
      .gte('tanggal', `${currentMonthPrefix}-01`)
      .lte('tanggal', `${currentMonthPrefix}-31`),
    supabase
      .from('pengajuan_cuti')
      .select('id, jenis, tanggal_mulai, tanggal_selesai, jumlah_hari, status, dibuat_pada')
      .eq('karyawan_id', profile.id)
      .order('dibuat_pada', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const jatahHari = kuotaCuti?.jatah_hari ?? 12;
  const terpakaiHari = kuotaCuti?.terpakai_hari ?? 0;
  const sisaCuti = Math.max(0, jatahHari - terpakaiHari);

  let countTepatWaktu = 0;
  let countTerlambat = 0;
  (monthAttendance || []).forEach((item) => {
    if (item.status === 'hadir') countTepatWaktu++;
    else if (item.status === 'terlambat') countTerlambat++;
  });
  const totalHariHadir = countTepatWaktu + countTerlambat;

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
      // Absensi anggota tim hari ini, Cuti tim yang aktif hari ini, dan Pengajuan cuti tim menunggu Atasan
      const [
        { data: attToday },
        { data: leavesToday },
        { count },
      ] = await Promise.all([
        supabase
          .from('absensi')
          .select('karyawan_id, jam_masuk, jam_pulang, status')
          .in('karyawan_id', memberIds)
          .eq('tanggal', todayStr),
        supabase
          .from('pengajuan_cuti')
          .select('karyawan_id, jenis, tanggal_mulai, tanggal_selesai')
          .in('karyawan_id', memberIds)
          .eq('status', 'disetujui')
          .lte('tanggal_mulai', todayStr)
          .gte('tanggal_selesai', todayStr),
        supabase
          .from('pengajuan_cuti')
          .select('id', { count: 'exact', head: true })
          .in('karyawan_id', memberIds)
          .eq('status', 'diajukan')
          .eq('perlu_atasan', true),
      ]);

      teamAttendanceToday = attToday || [];
      teamLeavesToday = leavesToday || [];
      atasanPendingCount = count || 0;
    }
  }

  const teamHadirCount = teamAttendanceToday.filter((a) => a.status === 'hadir').length;
  const teamTerlambatCount = teamAttendanceToday.filter((a) => a.status === 'terlambat').length;
  const teamLeaveCount = teamLeavesToday.length;
  const teamBelumHadirCount = Math.max(0, teamMembers.length - teamAttendanceToday.length - teamLeaveCount);

  // =========================================================================
  // 3. DATA KHUSUS HRD: METRIK PERUSAHAAN & ANTREAN KEPUTUSAN AKHIR
  // =========================================================================
  let totalActiveEmployees = 0;
  let companyHadirToday = 0;
  let companyTerlambatToday = 0;
  let hrdOnLeaveToday = 0;
  let hrdAbsentToday = 0;
  let hrdPendingApprovals = 0;
  let avgRemainingQuota = 0;
  let totalQuotaDays = 0;
  let usedQuotaDays = 0;
  let remainingQuotaDays = 0;
  let employeesWithQuota = 0;
  let hrdPendingQueue: HrdQueueItem[] = [];
  let hrdDivisionStats: HrdDivisionStat[] = [];
  let weeklyChartStats: WeeklyAttendanceStat[] = [];

  if (role === 'hrd') {
    // Kueri seluruh kebutuhan data HRD sekaligus secara paralel untuk performa maksimal
    const [
      { count: empCount },
      { data: activeProfiles },
      { data: todayAtt },
      { data: todayLeaves },
      { count: hrdCount, data: pendingQueue },
      { data: allQuotas },
      fourWeeksStats,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('aktif', true),
      supabase
        .from('profiles')
        .select('id, divisi_id, divisi:divisi_id (id, nama)')
        .eq('aktif', true),
      supabase
        .from('absensi')
        .select('karyawan_id, status')
        .eq('tanggal', todayStr),
      supabase
        .from('pengajuan_cuti')
        .select('karyawan_id, jenis')
        .eq('status', 'disetujui')
        .lte('tanggal_mulai', todayStr)
        .gte('tanggal_selesai', todayStr),
      supabase
        .from('pengajuan_cuti')
        .select(`
          id,
          jenis,
          tanggal_mulai,
          tanggal_selesai,
          jumlah_hari,
          status,
          dibuat_pada,
          alasan,
          profiles:karyawan_id (
            id,
            nik_karyawan,
            nama_lengkap,
            divisi:divisi_id (
              nama
            )
          )
        `, { count: 'exact' })
        .or('status.eq.disetujui_atasan,and(status.eq.diajukan,perlu_atasan.eq.false)')
        .order('dibuat_pada', { ascending: false })
        .limit(5),
      supabase
        .from('kuota_cuti')
        .select('karyawan_id, jatah_hari, terpakai_hari')
        .eq('tahun', currentYear),
      getFourWeeksAttendanceStats(supabase, todayStr),
    ]);

    totalActiveEmployees = empCount || 0;
    weeklyChartStats = fourWeeksStats;

    const activeProfileRows = activeProfiles || [];
    const attendanceByEmployee = new Map<string, string>();
    (todayAtt || []).forEach((attendance) => {
      attendanceByEmployee.set(attendance.karyawan_id, attendance.status);
    });

    const leaveEmployeeIds = new Set(
      (todayLeaves || []).map((leave) => leave.karyawan_id)
    );

    if (activeProfileRows.length > 0) {
      const divisionMap = new Map<string, HrdDivisionStat>();

      for (const person of activeProfileRows) {
        const rawDivisi = Array.isArray(person.divisi) ? person.divisi[0] : person.divisi;
        const divisionKey = person.divisi_id || 'tanpa-divisi';
        const divisionName = rawDivisi?.nama || 'Tanpa divisi';

        if (!divisionMap.has(divisionKey)) {
          divisionMap.set(divisionKey, {
            id: divisionKey,
            nama: divisionName,
            total: 0,
            hadir: 0,
            terlambat: 0,
            cuti: 0,
            alpa: 0,
          });
        }

        const division = divisionMap.get(divisionKey);
        if (!division) continue;
        division.total += 1;

        const attendanceStatus = attendanceByEmployee.get(person.id);
        if (leaveEmployeeIds.has(person.id)) {
          division.cuti += 1;
          hrdOnLeaveToday += 1;
        } else if (attendanceStatus === 'hadir') {
          division.hadir += 1;
          companyHadirToday += 1;
        } else if (attendanceStatus === 'terlambat') {
          division.terlambat += 1;
          companyTerlambatToday += 1;
        } else {
          division.alpa += 1;
          hrdAbsentToday += 1;
        }
      }

      hrdDivisionStats = Array.from(divisionMap.values()).sort((a, b) =>
        a.nama.localeCompare(b.nama, 'id')
      );
    } else {
      // Fallback bila daftar profil tidak terbaca: tetap tampilkan angka absensi.
      (todayAtt || []).forEach((attendance) => {
        if (!leaveEmployeeIds.has(attendance.karyawan_id)) {
          if (attendance.status === 'hadir') companyHadirToday += 1;
          else if (attendance.status === 'terlambat') companyTerlambatToday += 1;
        }
      });
      hrdOnLeaveToday = leaveEmployeeIds.size;
      hrdAbsentToday = Math.max(
        0,
        totalActiveEmployees - companyHadirToday - companyTerlambatToday - hrdOnLeaveToday
      );
    }

    hrdPendingApprovals = hrdCount || 0;
    hrdPendingQueue = (pendingQueue || []).map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = item as any;
      const rawProfile = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;
      const rawDivisi = rawProfile?.divisi
        ? Array.isArray(rawProfile.divisi)
        ? rawProfile.divisi[0]
        : rawProfile.divisi
      : null;

      return {
        id: raw.id,
        jenis: raw.jenis,
        tanggal_mulai: raw.tanggal_mulai,
        tanggal_selesai: raw.tanggal_selesai,
        jumlah_hari: raw.jumlah_hari,
        status: raw.status,
        dibuat_pada: raw.dibuat_pada,
        alasan: raw.alasan || '',
        karyawan_nama: rawProfile?.nama_lengkap || 'Karyawan',
        karyawan_nik: rawProfile?.nik_karyawan || '-',
        divisi_nama: rawDivisi?.nama || 'Tanpa divisi',
      } satisfies HrdQueueItem;
    });

    const activeEmployeeIds = new Set(activeProfileRows.map((person) => person.id));
    const relevantQuotas =
      activeEmployeeIds.size > 0 && allQuotas
        ? allQuotas.filter((quota) => activeEmployeeIds.has(quota.karyawan_id))
        : allQuotas || [];

    if (relevantQuotas.length > 0) {
      totalQuotaDays = relevantQuotas.reduce((total, quota) => total + quota.jatah_hari, 0);
      usedQuotaDays = relevantQuotas.reduce((total, quota) => total + quota.terpakai_hari, 0);
      remainingQuotaDays = relevantQuotas.reduce(
        (total, quota) => total + Math.max(0, quota.jatah_hari - quota.terpakai_hari),
        0
      );
      employeesWithQuota = relevantQuotas.length;
      avgRemainingQuota =
        Math.round((remainingQuotaDays / relevantQuotas.length) * 10) / 10;
    }
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

  const formatShortDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const parts = dateString.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
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

  // Sapaan & aksi cepat sesuai konteks waktu dan peran
  const greeting =
    serverTime.hour < 11
      ? 'Selamat pagi'
      : serverTime.hour < 15
        ? 'Selamat siang'
        : serverTime.hour < 19
          ? 'Selamat sore'
          : 'Selamat malam';
  const firstName = (profile?.nama_lengkap || '').split(' ')[0];
  const roleLabel = { karyawan: 'Karyawan', atasan: 'Atasan', hrd: 'HRD' }[role] ?? role;

  const quickActions = [
    { href: '/absensi', label: 'Absensi', icon: Clock },
    { href: '/cuti-izin', label: 'Ajukan cuti', icon: CalendarPlus },
    { href: '/slip-gaji', label: 'Slip gaji', icon: Receipt },
    ...(role !== 'karyawan'
      ? [{ href: '/persetujuan', label: 'Persetujuan', icon: CheckSquare }]
      : []),
  ];

  const punctualityPercent =
    totalHariHadir > 0 ? Math.round((countTepatWaktu / totalHariHadir) * 100) : 0;
  const presentToday = companyHadirToday + companyTerlambatToday;
  const dateLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(serverTime.serverDate);

  const forbiddenAlert = isForbidden ? (
    <Alert
      id="rbac-forbidden-alert"
      variant="destructive"
      className="mb-5 border-rose-300/80 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
    >
      <ShieldAlert className="size-4 text-rose-600 dark:text-rose-400" />
      <div>
        <AlertTitle className="text-sm font-bold text-rose-800 dark:text-rose-300">
          Akses Ditolak (403 Forbidden)
        </AlertTitle>
        <AlertDescription className="text-xs text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
          Peran <span className="font-semibold uppercase">{role}</span> tidak memiliki izin untuk membuka{' '}
          <code className="rounded bg-rose-200/50 dark:bg-rose-900/50 px-1 py-0.5 font-mono text-[11px] font-semibold">
            {forbiddenTarget || 'halaman tersebut'}
          </code>
          . Sistem telah mengalihkan Anda kembali ke dasbor sesuai aturan RBAC.
        </AlertDescription>
      </div>
    </Alert>
  ) : null;

  if (role === 'hrd') {
    return (
      <AppLayout profile={profile}>
        {forbiddenAlert}
        <HrdDashboard
          profile={profile}
          greeting={greeting}
          firstName={firstName}
          dateLabel={dateLabel}
          initialTime={serverTime.timeStr}
          currentYear={currentYear}
          totalActiveEmployees={totalActiveEmployees}
          presentToday={presentToday}
          onTimeToday={companyHadirToday}
          lateToday={companyTerlambatToday}
          onLeaveToday={hrdOnLeaveToday}
          absentToday={hrdAbsentToday}
          pendingApprovals={hrdPendingApprovals}
          queue={hrdPendingQueue}
          weeklyChartStats={weeklyChartStats}
          avgRemainingQuota={avgRemainingQuota}
          totalQuotaDays={totalQuotaDays}
          usedQuotaDays={usedQuotaDays}
          remainingQuotaDays={remainingQuotaDays}
          employeesWithQuota={employeesWithQuota}
          divisionStats={hrdDivisionStats}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout profile={profile}>
      <div className="space-y-6 sm:space-y-8">
        {forbiddenAlert}

        {/* =================================================================== */}
        {/* GRID HERO: CARD SAPAAN (KIRI) & PRESENSI MANDIRI (KANAN)            */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-stretch">
          <section
            id="kontainer-1-hero"
            aria-label="Sapaan dan Status Akun"
            className="dash-hero relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-6 text-white shadow-sm"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-[#73b4ff]/20 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full border border-white/10"
            />
            <div aria-hidden="true" className="dash-hero-grid pointer-events-none absolute inset-0" />

            <div className="relative z-10 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-white/15 text-white hover:bg-white/20 border-white/20 text-xs font-semibold backdrop-blur-xs">
                  {rawDivisi?.nama || 'Tanpa Divisi'}
                </Badge>
                <Badge className="bg-white/10 text-white/90 hover:bg-white/15 border-white/15 text-xs font-mono backdrop-blur-xs">
                  NIK: {profile?.nik_karyawan}
                </Badge>
              </div>

              <div>
                <p className="dash-hero-eyebrow text-white/80">
                  <span aria-hidden="true" className="live-dot" />
                  {dateLabel}
                </p>
                <h1 className="dash-hero-title mt-1.5 text-white">
                  {greeting}, {firstName}
                </h1>
              </div>
            </div>

            <div className="relative z-10 pt-4 mt-4 border-t border-white/15">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/80 mb-2">
                Aksi Cepat
              </p>
              <nav aria-label="Aksi cepat" className="flex flex-wrap gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'h-8 gap-1.5 text-xs font-semibold border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white hover:border-white/30 backdrop-blur-xs shadow-2xs'
                      )}
                    >
                      <Icon aria-hidden="true" className="size-3.5" />
                      <span>{action.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </section>

          <section
            id="kontainer-presensi-mandiri"
            aria-label="Presensi Mandiri"
            className="w-full flex flex-col"
          >
            <AttendanceWidget className="h-full" />
          </section>
        </div>

        {/* =================================================================== */}
        {/* KONTAINER TIM (KHUSUS ATASAN): RINGKASAN TIM DIVISI & APPROVAL      */}
        {/* =================================================================== */}
        {role === 'atasan' && (
          <section
            id="kontainer-2-tim"
            aria-label="Ringkasan Tim Divisi"
            className="dash-soft-indigo-card relative flex flex-col overflow-hidden rounded-2xl p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5 text-foreground"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-indigo-500/10 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full border border-indigo-500/10"
            />
            <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-indigo-200/60 dark:border-indigo-900/40 pb-3">
              <div>
                <h2 className="font-heading text-sm sm:text-base font-bold tracking-tight text-foreground">
                  Ringkasan Tim Divisi {rawDivisi?.nama || '-'}
                </h2>
              </div>
              <Badge className="self-start sm:self-auto text-[11px] sm:text-xs bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60 font-medium">
                {dateLabel}
              </Badge>
            </div>

            {atasanPendingCount > 0 && (
              <Alert className="relative z-10 border-amber-300/80 bg-amber-50/80 dark:border-amber-800/60 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 sm:p-4">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400">
                    <CheckSquare className="size-4 sm:size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <AlertTitle className="text-xs sm:text-sm font-bold text-foreground">
                        Pengajuan Menunggu Persetujuan Anda
                      </AlertTitle>
                      <Badge className="bg-amber-600 text-white font-bold text-[10px] sm:text-xs px-1.5 py-0.5">
                        {atasanPendingCount}
                      </Badge>
                    </div>
                    <AlertDescription className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Ada {atasanPendingCount} pengajuan cuti/izin dari anggota divisi {rawDivisi?.nama || '-'} yang memerlukan verifikasi Anda.
                    </AlertDescription>
                  </div>
                </div>
                <Link
                  href="/persetujuan"
                  className={cn(
                    buttonVariants({ size: 'sm' }),
                    'bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-bold gap-1.5 w-full sm:w-auto justify-center shadow-xs border-0'
                  )}
                >
                  <span>Buka Persetujuan</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </Alert>
            )}

            {/* 4 Kartu Metrik Tim Hari Ini */}
            <div className="relative z-10 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
              <Card className="border-indigo-200/70 bg-background/80 dark:border-indigo-900/40 dark:bg-card/70 shadow-2xs">
                <CardContent className="p-3 sm:p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">Total Anggota</p>
                    <p className="font-mono text-xl sm:text-2xl font-bold text-foreground mt-0.5">{teamMembers.length}</p>
                  </div>
                  <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <Users className="size-4 sm:size-4.5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/25 shadow-2xs">
                <CardContent className="p-3 sm:p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 truncate">Hadir Tepat</p>
                    <p className="font-mono text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{teamHadirCount}</p>
                  </div>
                  <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4 sm:size-4.5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-200/80 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/25 shadow-2xs">
                <CardContent className="p-3 sm:p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 truncate">Terlambat</p>
                    <p className="font-mono text-xl sm:text-2xl font-bold text-amber-700 dark:text-amber-400 mt-0.5">{teamTerlambatCount}</p>
                  </div>
                  <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Clock className="size-4 sm:size-4.5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200/80 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/25 shadow-2xs">
                <CardContent className="p-3 sm:p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 truncate">Cuti / Izin</p>
                    <p className="font-mono text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-400 mt-0.5">{teamLeaveCount}</p>
                  </div>
                  <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    <CalendarDays className="size-4 sm:size-4.5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Daftar Anggota Tim Divisi */}
            <div className="relative z-10 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 bg-background/70 backdrop-blur-xs p-3.5 sm:p-4">
              <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground">
                    Daftar Kehadiran Anggota Tim
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground">
                    Status absensi real-time seluruh bawahan langsung Anda ({dateLabel})
                  </p>
                </div>
                <Badge className="self-start sm:self-auto text-[11px] sm:text-xs font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/40 font-semibold">
                  {teamMembers.length} Personel
                </Badge>
              </div>

              {teamMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                  <Users className="size-8 text-muted-foreground/60 mb-2" />
                  <p className="text-xs font-semibold text-foreground">Belum ada anggota tim</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Anggota divisi aktif akan muncul di sini.</p>
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {teamMembers.map((member) => {
                    const att = teamAttendanceToday.find((a) => a.karyawan_id === member.id);
                    const onLeave = teamLeavesToday.find((l) => l.karyawan_id === member.id);
                    const initials = (member.nama_lengkap || '?')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((word: string) => word[0])
                      .join('')
                      .toUpperCase();

                    return (
                      <li
                        key={member.id}
                        className="flex items-center justify-between gap-2.5 sm:gap-3 rounded-xl border border-border/80 bg-card/90 backdrop-blur-xs p-2.5 sm:p-3 shadow-2xs transition-colors hover:bg-card text-foreground"
                      >
                        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                          <span
                            aria-hidden="true"
                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-[10px] sm:text-[11px] font-bold text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-500/20"
                          >
                            {initials}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {member.nama_lengkap}
                            </p>
                            <p className="truncate text-[10px] sm:text-[11px] text-muted-foreground">
                              {member.jabatan || 'Anggota tim'}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {att ? (
                            <>
                              <StatusPill kind="attendance" status={att.status} />
                              <p className="mt-0.5 text-[9px] sm:text-[10px] font-mono text-muted-foreground tabular-nums">
                                {formatTimeOnly(att.jam_masuk)}
                              </p>
                            </>
                          ) : onLeave ? (
                            <StatusPill kind="attendance" status={onLeave.jenis === 'sakit' ? 'izin' : 'cuti'} />
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-500/20 whitespace-nowrap">
                              <span aria-hidden="true" className="size-1.5 rounded-full bg-rose-500" />
                              Belum hadir
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* KONTAINER RINGKASAN: KUOTA CUTI & PERFORMA KEHADIRAN                */}
        {/* =================================================================== */}
        <div
          id="kontainer-aktivitas-mandiri"
          aria-label="Ringkasan Cuti dan Performa Kehadiran"
          className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-stretch"
        >
          {/* Widget: Kuota Cuti (BR-04, BR-06) */}
          <section
            aria-label="Sisa Kuota Cuti"
            className="dash-leave-card relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-[1.5rem] p-4 sm:p-6 text-white shadow-sm w-full h-full"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full border border-white/10"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-4 top-10 size-24 rounded-full bg-[#2ed8b6]/15 blur-xl"
            />

            <div>
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                    Kuota Cuti Tahunan ({currentYear})
                  </p>
                  <h3 className="font-heading text-base sm:text-lg font-extrabold tracking-tight text-white mt-0.5">
                    Sisa Kuota Cuti
                  </h3>
                </div>
                <span className="dash-icon-tile bg-white/10 text-[#8df1d8] ring-1 ring-inset ring-white/10">
                  <CalendarDays aria-hidden="true" className="size-4" strokeWidth={1.9} />
                </span>
              </div>

              <div className="relative z-10 mt-3 sm:mt-4">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-heading text-3xl sm:text-[2.6rem] font-extrabold leading-none tracking-tight text-white tabular-nums">
                    {sisaCuti}
                  </span>
                  <span className="text-xs font-bold text-white/90">
                    hari tersisa dari {jatahHari} hari (Maks. 12 hari/tahun)
                  </span>
                </div>

                <div className="mt-4 sm:mt-5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-white/90">
                    <span>Pemakaian Kuota</span>
                    <span className="font-bold text-white tabular-nums">
                      {terpakaiHari} / {jatahHari} hari ({jatahHari > 0 ? Math.round((terpakaiHari / jatahHari) * 100) : 0}%)
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-white/15"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={Math.max(jatahHari, 1)}
                    aria-valuenow={terpakaiHari}
                  >
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#2ed8b6,#8df1d8)] transition-all duration-300"
                      style={{
                        width: `${jatahHari > 0 ? Math.min(100, Math.round((terpakaiHari / jatahHari) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-white/80 leading-relaxed">
                    {terpakaiHari} hari terpakai atau dalam proses pengajuan cuti.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/cuti-izin"
              className="relative z-10 mt-5 sm:mt-6 inline-flex items-center gap-1.5 border-t border-white/10 pt-3.5 sm:pt-4 text-xs font-bold text-[#b9f9e8] transition-colors hover:text-white"
            >
              <span>Kelola pengajuan cuti</span>
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </section>

          {/* Widget 3: Kehadiran Bulan Ini */}
          <section
            aria-label="Performa Kehadiran Bulan Ini"
            className="dash-soft-blue-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-6 shadow-xs w-full h-full text-foreground"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full border border-blue-500/10"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-4 top-10 size-24 rounded-full bg-blue-500/10 blur-xl"
            />

            <div>
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    Performa Bulan Ini
                  </p>
                  <h3 className="font-heading text-base sm:text-lg font-extrabold tracking-tight text-foreground mt-0.5">
                    Ketepatan Waktu
                  </h3>
                </div>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/25">
                  <TrendingUp aria-hidden="true" className="size-4.5" strokeWidth={1.9} />
                </span>
              </div>

              <div className="relative z-10 mt-3 sm:mt-4">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-heading text-3xl sm:text-[2.6rem] font-extrabold leading-none tracking-tight text-foreground tabular-nums">
                    {countTepatWaktu}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    hari tepat waktu dari {totalHariHadir} hari kerja
                  </span>
                </div>

                <div className="mt-4 sm:mt-5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Tingkat Ketepatan</span>
                    <span className="font-bold text-foreground tabular-nums font-mono">
                      {punctualityPercent}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/60">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        punctualityPercent >= 80
                          ? 'bg-[linear-gradient(90deg,#10b981,#34d399)]'
                          : 'bg-[linear-gradient(90deg,#f59e0b,#fbbf24)]'
                      )}
                      style={{ width: `${punctualityPercent}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {countTerlambat > 0
                      ? `${countTerlambat} kali terlambat · batas toleransi jam masuk 08.15 WIB`
                      : 'Disiplin sempurna! Tidak ada keterlambatan tercatat bulan ini.'}
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/absensi"
              className="relative z-10 mt-5 sm:mt-6 inline-flex items-center gap-1.5 border-t border-blue-200/60 dark:border-blue-900/40 pt-3.5 sm:pt-4 text-xs font-bold text-blue-700 dark:text-blue-400 transition-colors hover:underline"
            >
              <span>Lihat riwayat absensi lengkap</span>
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </section>
        </div>

        {/* =================================================================== */}
        {/* KONTAINER 4 (ATAU 3): RIWAYAT ABSENSI & PENGAJUAN TERAKHIR          */}
        {/* =================================================================== */}
        {/* =================================================================== */}
        {/* KONTAINER 4 (ATAU 3): RIWAYAT ABSENSI & PENGAJUAN TERAKHIR          */}
        {/* =================================================================== */}
        <section
          id="kontainer-riwayat-pengajuan"
          aria-label="Riwayat Kehadiran dan Pengajuan"
          className="dash-soft-blue-card relative flex flex-col overflow-hidden rounded-2xl p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5 text-foreground"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-blue-500/10 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full border border-blue-500/10"
          />
          <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-blue-200/60 dark:border-blue-900/40 pb-3">
            <div>
              <h2 className="font-heading text-sm sm:text-base font-bold tracking-tight text-foreground">
                Riwayat Kehadiran & Pengajuan Terbaru
              </h2>
            </div>
            <Link
              href="/absensi"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'text-xs font-semibold shadow-2xs w-full sm:w-auto justify-center border-border/80'
              )}
            >
              <span>Buka Menu Absensi</span>
              <ArrowRight aria-hidden="true" className="size-3.5 ml-1" />
            </Link>
          </div>

          <div className="relative z-10 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3">
            {/* Tabel Absensi 5 Hari Terakhir */}
            <Card className="lg:col-span-2 border-border/80 bg-background/90 backdrop-blur-xs text-foreground shadow-2xs flex flex-col justify-between overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-5 pb-3 sm:pb-3 border-b border-border/60">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                    Absensi 5 Hari Terakhir
                  </CardTitle>
                </div>
                <Link
                  href="/absensi"
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    'text-xs font-semibold text-muted-foreground hover:text-foreground h-8 px-2'
                  )}
                >
                  <span>Selengkapnya</span>
                  <ArrowRight aria-hidden="true" className="size-3.5 ml-1" />
                </Link>
              </CardHeader>

              <CardContent className="p-0 flex-1">
                {!recentAttendance || recentAttendance.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 sm:p-8 text-center text-muted-foreground">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 mb-3 text-muted-foreground">
                      <Inbox className="size-6" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Belum ada riwayat absensi</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Catatan kehadiran akan tampil setelah Anda melakukan check-in.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-0">
                    <Table className="min-w-[380px] sm:min-w-[420px]">
                      <TableHeader>
                        <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                          <TableHead className="font-semibold text-xs text-muted-foreground whitespace-nowrap px-3 sm:px-4 py-2.5 sm:py-3">Tanggal</TableHead>
                          <TableHead className="font-semibold text-xs text-muted-foreground whitespace-nowrap px-3 sm:px-4 py-2.5 sm:py-3">Masuk (WIB)</TableHead>
                          <TableHead className="font-semibold text-xs text-muted-foreground whitespace-nowrap px-3 sm:px-4 py-2.5 sm:py-3">Pulang (WIB)</TableHead>
                          <TableHead className="font-semibold text-xs text-right text-muted-foreground whitespace-nowrap px-3 sm:px-4 py-2.5 sm:py-3">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentAttendance.map((row) => (
                          <TableRow key={row.id} className="border-b border-border/40 hover:bg-muted/20">
                            <TableCell className="font-medium text-xs text-foreground whitespace-nowrap px-3 sm:px-4 py-2.5 sm:py-3">
                              {formatDateDisplay(row.tanggal)}
                            </TableCell>
                            <TableCell className="font-mono text-xs tabular-nums text-foreground whitespace-nowrap px-3 sm:px-4 py-2.5 sm:py-3">
                              {formatTimeOnly(row.jam_masuk)}
                            </TableCell>
                            <TableCell className={cn('font-mono text-xs tabular-nums whitespace-nowrap px-3 sm:px-4 py-2.5 sm:py-3', row.jam_pulang ? 'text-foreground' : 'text-muted-foreground/50')}>
                              {row.jam_pulang ? formatTimeOnly(row.jam_pulang) : '—'}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap px-3 sm:px-4 py-2.5 sm:py-3">
                              <StatusPill kind="attendance" status={row.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card Pengajuan Terakhir */}
            <Card className="border-border/80 bg-background/90 backdrop-blur-xs text-foreground shadow-2xs flex flex-col justify-between">
              <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-5 pb-3 sm:pb-3 border-b border-border/60">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                    Pengajuan Terakhir
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Status cuti atau izin terbaru Anda
                  </CardDescription>
                </div>
                <Link
                  href="/cuti-izin"
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    'text-xs font-semibold text-muted-foreground hover:text-foreground h-8 px-2'
                  )}
                >
                  Lihat semua
                </Link>
              </CardHeader>

              <CardContent className="space-y-3 sm:space-y-4 flex-1 p-4 sm:p-5 pt-3 sm:pt-4">
                {latestLeave ? (
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-heading text-sm font-bold text-foreground">
                        {formatLeaveType(latestLeave.jenis)}
                      </p>
                      <StatusPill status={latestLeave.status} />
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Rentang Tanggal</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatShortDate(latestLeave.tanggal_mulai)} – {formatShortDate(latestLeave.tanggal_selesai)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Durasi</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {latestLeave.jumlah_hari} hari kerja
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Diajukan Pada</span>
                        <span className="font-medium text-foreground">
                          {new Date(latestLeave.dibuat_pada).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted/60 mb-2 text-muted-foreground">
                      <CalendarOff className="size-5" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">Belum ada pengajuan</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Pengajuan cuti/izin aktif akan tampil di sini.</p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="p-4 sm:p-5 pt-0">
                <Link
                  href="/cuti-izin"
                  className={cn(
                    buttonVariants({ variant: 'default' }),
                    'w-full font-bold shadow-xs'
                  )}
                >
                  <Plus aria-hidden="true" className="size-4 mr-1.5" />
                  <span>Buat Pengajuan Baru</span>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
