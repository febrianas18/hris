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
  TrendingUp,
  Users,
  CheckSquare,
  Receipt,
  Inbox,
  CalendarOff,
  Plus,
} from 'lucide-react';
import { getServerTimeWIB } from '@/utils/time';
import { getFourWeeksAttendanceStats, WeeklyAttendanceStat } from '@/utils/analytics';
import { StatCard, Meter } from '@/components/app/StatCard';
import { SectionCard, EmptyState } from '@/components/app/SectionCard';
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
  const totalHariHadir = countTepatWaktu + countTerlambat;

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
    // Data inti perusahaan: karyawan aktif, absensi hari ini, dan cuti yang aktif.
    const [
      { count: empCount },
      { data: activeProfiles },
      { data: todayAtt },
      { data: todayLeaves },
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
    ]);

    totalActiveEmployees = empCount || 0;

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
        if (attendanceStatus === 'hadir') {
          division.hadir += 1;
          companyHadirToday += 1;
        } else if (attendanceStatus === 'terlambat') {
          division.terlambat += 1;
          companyTerlambatToday += 1;
        } else if (leaveEmployeeIds.has(person.id)) {
          division.cuti += 1;
          hrdOnLeaveToday += 1;
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
        if (attendance.status === 'hadir') companyHadirToday += 1;
        else if (attendance.status === 'terlambat') companyTerlambatToday += 1;
      });
      hrdOnLeaveToday = leaveEmployeeIds.size;
      hrdAbsentToday = Math.max(
        0,
        totalActiveEmployees - companyHadirToday - companyTerlambatToday - hrdOnLeaveToday
      );
    }

    // Pengajuan cuti menunggu keputusan akhir HRD.
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
      .limit(5);

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

    // Rekap kuota cuti tahun berjalan untuk karyawan aktif.
    const { data: allQuotas } = await supabase
      .from('kuota_cuti')
      .select('karyawan_id, jatah_hari, terpakai_hari')
      .eq('tahun', currentYear);

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

    // Statistik grafik 4 minggu terakhir untuk HRD.
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
    <div
      id="rbac-forbidden-alert"
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 animate-in fade-in duration-200 motion-reduce:animate-none"
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
      >
        <ShieldAlert className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-destructive">Akses ditolak (403 Forbidden)</p>
        <p className="mt-1 text-xs leading-relaxed text-destructive/90">
          Peran <span className="font-semibold uppercase">{role}</span> tidak memiliki izin untuk
          membuka{' '}
          <code className="rounded bg-destructive/10 px-1 py-0.5 font-mono text-[11px] font-semibold">
            {forbiddenTarget || 'halaman tersebut'}
          </code>
          . Sistem telah mengalihkan Anda kembali ke dasbor sesuai aturan RBAC.
        </p>
      </div>
    </div>
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
      {forbiddenAlert}

      {/* =================================================================== */}
      {/* HEADER HALAMAN                                                      */}
      {/* =================================================================== */}
      <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="clay-chip inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary ring-1 ring-inset ring-primary/20">
              <span aria-hidden="true" className="size-1 rounded-full bg-primary" />
              Dasbor
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              {roleLabel}
            </span>
            <span aria-hidden="true" className="size-1 rounded-full bg-border" />
            <span className="text-[11px] font-medium text-muted-foreground">
              {rawDivisi?.nama || 'Tanpa divisi'}
            </span>
          </div>

          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            {greeting}, {firstName}
          </h1>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{serverTime.fullDisplayStr}</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-border" />
            <span>
              NIK{' '}
              <span className="font-mono font-medium text-foreground/80">{profile?.nik_karyawan}</span>
            </span>
          </p>
        </div>

        <nav aria-label="Aksi cepat" className="flex flex-wrap gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 text-xs font-semibold text-foreground shadow-xs transition-colors duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                {action.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* =================================================================== */}
      {/* RINGKASAN TIM DIVISI & APPROVAL ATASAN                              */}
      {/* =================================================================== */}
      {role === 'atasan' && (
        <section aria-label="Ringkasan tim divisi dan persetujuan" className="mb-6">
          {atasanPendingCount > 0 && (
            <div className="clay-card mb-4 flex flex-col gap-3 bg-gradient-to-r from-chart-2/15 via-chart-2/[0.07] to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="clay-tile flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-chart-2/30 to-chart-2/10 text-chart-5 ring-1 ring-chart-2/30"
                >
                  <CheckSquare className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {atasanPendingCount} pengajuan menunggu persetujuan Anda
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pengajuan cuti/izin dari anggota divisi {rawDivisi?.nama || '-'} (tahap 1 Atasan).
                  </p>
                </div>
              </div>
              <Link
                href="/persetujuan"
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-foreground px-3.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Buka persetujuan
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </div>
          )}

          <SectionCard
            title={`Kehadiran tim divisi ${rawDivisi?.nama || '-'} hari ini`}
            description={`Total ${teamMembers.length} anggota aktif di divisi Anda`}
            icon={Users}
            accent="info"
            bodyClassName="px-5 py-4"
          >
            {teamMembers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Belum ada anggota tim"
                description="Anggota divisi yang aktif akan muncul di sini."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
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
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary"
                        >
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {member.nama_lengkap}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {member.jabatan || 'Anggota tim'}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {att ? (
                          <>
                            <StatusPill kind="attendance" status={att.status} />
                            <p className="mt-1 text-[10px] font-medium text-muted-foreground tabular-nums">
                              {formatTimeOnly(att.jam_masuk)}
                            </p>
                          </>
                        ) : onLeave ? (
                          <StatusPill status={onLeave.jenis === 'sakit' ? 'izin' : 'cuti'} />
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-inset ring-border">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground/40" />
                            Belum hadir
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </section>
      )}

      {/* =================================================================== */}
      {/* AKTIVITAS SAYA HARI INI                                             */}
      {/* =================================================================== */}
      <section aria-labelledby="personal-heading" className="mb-6">
        <div className="mb-3">
          <h2
            id="personal-heading"
            className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight text-foreground"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-info" />
            Aktivitas Saya
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Absensi, kuota cuti, dan rekap kehadiran bulan berjalan
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AttendanceWidget />

          <StatCard
            className="h-full"
            label={`Sisa cuti ${currentYear}`}
            value={sisaCuti}
            unit={`dari ${jatahHari} hari`}
            hint={`${terpakaiHari} hari terpakai atau sedang diajukan`}
            icon={CalendarDays}
            accent="info"
            footer={
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                  <span>Pemakaian kuota</span>
                  <span className="tabular-nums">
                    {jatahHari > 0 ? Math.round((terpakaiHari / jatahHari) * 100) : 0}%
                  </span>
                </div>
                <Meter
                  value={terpakaiHari}
                  max={jatahHari}
                  label="Pemakaian kuota cuti tahunan"
                  tone="info"
                />
              </div>
            }
            action={{ href: '/cuti-izin', label: 'Kelola pengajuan cuti' }}
          />

          <StatCard
            className="h-full"
            label="Kehadiran bulan ini"
            value={countTepatWaktu}
            unit="hari tepat waktu"
            hint={`${countTerlambat} kali terlambat · batas jam masuk 08.15 WIB`}
            icon={TrendingUp}
            accent={countTerlambat > 0 ? 'warning' : 'primary'}
            footer={
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                  <span>Tingkat ketepatan waktu</span>
                  <span className="tabular-nums">{punctualityPercent}%</span>
                </div>
                <Meter
                  value={countTepatWaktu}
                  max={totalHariHadir}
                  label="Tingkat ketepatan waktu bulan ini"
                />
              </div>
            }
            action={{ href: '/absensi', label: 'Lihat riwayat absensi' }}
          />
        </div>
      </section>

      {/* =================================================================== */}
      {/* RIWAYAT ABSENSI & PENGAJUAN TERAKHIR                                */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Absensi 5 hari terakhir"
          description="Pencatatan resmi langsung dari server WIB"
          icon={Clock}
          bodyClassName="pt-0 pb-0"
          action={
            <Link
              href="/absensi"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Selengkapnya
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          }
        >
          {!recentAttendance || recentAttendance.length === 0 ? (
            <div className="px-5 py-6">
              <EmptyState
                icon={Inbox}
                title="Belum ada riwayat absensi"
                description="Catatan kehadiran akan tampil setelah Anda melakukan check-in."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-left text-xs">
                <caption className="sr-only">
                  Lima riwayat absensi terakhir beserta jam masuk, jam pulang, dan status kehadiran
                </caption>
                <thead>
                  <tr className="border-b border-border/70 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Tanggal</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Masuk (WIB)</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Pulang (WIB)</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {recentAttendance.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {formatDateDisplay(row.tanggal)}
                      </td>
                      <td className="px-3 py-3 font-mono tabular-nums text-foreground/80">
                        {formatTimeOnly(row.jam_masuk)}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-3 font-mono tabular-nums',
                          row.jam_pulang ? 'text-foreground/80' : 'text-muted-foreground/60'
                        )}
                      >
                        {row.jam_pulang ? formatTimeOnly(row.jam_pulang) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <StatusPill kind="attendance" status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Pengajuan terakhir"
          description="Status cuti atau izin terbaru Anda"
          icon={CalendarDays}
          accent="info"
          bodyClassName="px-5 py-4"
          action={
            <Link
              href="/cuti-izin"
              className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Lihat semua
            </Link>
          }
        >
          {latestLeave ? (
            <div className="rounded-xl border border-border/70 bg-gradient-to-br from-info/[0.06] via-card to-card p-4 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading text-sm font-semibold text-foreground">
                  {formatLeaveType(latestLeave.jenis)}
                </p>
                <StatusPill status={latestLeave.status} />
              </div>

              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Rentang</dt>
                  <dd className="text-right font-medium text-foreground tabular-nums">
                    {formatShortDate(latestLeave.tanggal_mulai)} –{' '}
                    {formatShortDate(latestLeave.tanggal_selesai)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Durasi</dt>
                  <dd className="font-medium text-foreground tabular-nums">
                    {latestLeave.jumlah_hari} hari kerja
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Diajukan</dt>
                  <dd className="font-medium text-foreground">
                    {new Date(latestLeave.dibuat_pada).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <EmptyState
              icon={CalendarOff}
              title="Belum ada pengajuan"
              description="Ajukan cuti atau izin, statusnya akan tampil di sini."
            />
          )}

          <Link
            href="/cuti-izin"
            className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Buat pengajuan baru
          </Link>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
