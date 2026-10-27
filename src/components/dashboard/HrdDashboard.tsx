import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { UserProfile } from '@/utils/auth';
import type { WeeklyAttendanceStat } from '@/utils/analytics';
import AttendanceStackedBarChart from '@/components/charts/AttendanceStackedBarChart';
import BentoCard from '@/components/dashboard/BentoCard';
import HrdApprovalQueue from '@/components/dashboard/HrdApprovalQueue';
import AttendanceWidget from '@/components/AttendanceWidget';
import type { HrdDivisionStat, HrdQueueItem } from '@/components/dashboard/types';
import { cn } from '@/lib/utils';

interface HrdDashboardProps {
  profile: UserProfile;
  greeting: string;
  firstName: string;
  dateLabel: string;
  initialTime: string;
  currentYear: number;
  totalActiveEmployees: number;
  presentToday: number;
  onTimeToday: number;
  lateToday: number;
  onLeaveToday: number;
  absentToday: number;
  pendingApprovals: number;
  queue: HrdQueueItem[];
  weeklyChartStats: WeeklyAttendanceStat[];
  avgRemainingQuota: number;
  totalQuotaDays: number;
  usedQuotaDays: number;
  remainingQuotaDays: number;
  employeesWithQuota: number;
  divisionStats: HrdDivisionStat[];
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('id-ID').format(value);
}

export default function HrdDashboard({
  profile,
  greeting,
  firstName,
  dateLabel,
  initialTime,
  currentYear,
  totalActiveEmployees,
  presentToday,
  onTimeToday,
  lateToday,
  onLeaveToday,
  absentToday,
  pendingApprovals,
  queue,
  weeklyChartStats,
  avgRemainingQuota,
  totalQuotaDays,
  usedQuotaDays,
  remainingQuotaDays,
  employeesWithQuota,
  divisionStats,
}: HrdDashboardProps) {
  const presentPercent = percent(presentToday, totalActiveEmployees);
  const onTimePercent = percent(onTimeToday, totalActiveEmployees);
  const latePercent = percent(lateToday, totalActiveEmployees);
  const leavePercent = percent(onLeaveToday, totalActiveEmployees);
  const absentPercent = percent(absentToday, totalActiveEmployees);
  const quotaUsagePercent = percent(usedQuotaDays, totalQuotaDays);

  const totalHadirFourWeeks = weeklyChartStats.reduce((total, week) => total + week.hadir, 0);
  const totalLateFourWeeks = weeklyChartStats.reduce((total, week) => total + week.terlambat, 0);
  const bestWeek = weeklyChartStats.reduce<WeeklyAttendanceStat | null>((best, week) => {
    if (!best || week.hadir > best.hadir) return week;
    return best;
  }, null);

  const pulseItems = [
    {
      label: 'Tepat waktu',
      value: onTimeToday,
      percentage: onTimePercent,
      color: '#10b981',
      gradient: 'linear-gradient(90deg,#059669,#10b981)',
    },
    {
      label: 'Terlambat',
      value: lateToday,
      percentage: latePercent,
      color: '#f59e0b',
      gradient: 'linear-gradient(90deg,#d97706,#f59e0b)',
    },
    {
      label: 'Cuti / izin',
      value: onLeaveToday,
      percentage: leavePercent,
      color: '#3b82f6',
      gradient: 'linear-gradient(90deg,#2563eb,#3b82f6)',
    },
    {
      label: 'Belum absen',
      value: absentToday,
      percentage: absentPercent,
      color: '#ef4444',
      gradient: 'linear-gradient(90deg,#dc2626,#ef4444)',
    },
  ];

  return (
    <div className="gradient-dashboard space-y-6 sm:space-y-8">
      {/* =================================================================== */}
      {/* GRID HERO HRD: CARD SAPAAN (KIRI) & PRESENSI MANDIRI (KANAN)        */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-stretch">
        <section
          id="kontainer-hrd-1-hero"
          aria-label="Sapaan dan Metrik HRD"
          className="dash-hero relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-6"
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

          <div className="relative z-10 space-y-1.5">
            <p className="dash-hero-eyebrow">
              <span aria-hidden="true" className="live-dot" />
              {dateLabel}
            </p>
            <h1 className="dash-hero-title mt-2">
              {greeting}, {firstName}
            </h1>
          </div>

          <div className="relative z-10 mt-5 flex flex-wrap gap-2">
            <div className="dash-hero-metric">
              <strong>{formatNumber(totalActiveEmployees)}</strong>
              <span>karyawan aktif</span>
            </div>
            <div className="dash-hero-metric">
              <strong>{formatNumber(presentToday)}</strong>
              <span>sudah hadir</span>
            </div>
            <div className="dash-hero-metric">
              <strong>{formatNumber(pendingApprovals)}</strong>
              <span>menunggu keputusan</span>
            </div>
          </div>
        </section>

        <section
          id="kontainer-hrd-presensi-mandiri"
          aria-label="Presensi Mandiri HRD"
          className="w-full flex flex-col"
        >
          <AttendanceWidget className="h-full" />
        </section>
      </div>

      {/* =================================================================== */}
      {/* GRID: ANTREAN PERSETUJUAN (KIRI) & DETAK KEHADIRAN (KANAN)          */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
        {/* =================================================================== */}
        {/* KONTAINER 3: ANTREAN PERSETUJUAN CUTI & IZIN (TAHAP 2 HRD)           */}
        {/* =================================================================== */}
        <div id="kontainer-hrd-3-queue" className="w-full flex flex-col">
          <HrdApprovalQueue
            key={`${pendingApprovals}-${queue.map((item) => item.id).join('-')}`}
            initialItems={queue}
            initialPendingCount={pendingApprovals}
            className="w-full h-full flex flex-col justify-between"
          />
        </div>

        {/* =================================================================== */}
        {/* KONTAINER 2: DETAK KEHADIRAN PERUSAHAAN HARI INI                    */}
        {/* =================================================================== */}
        <div id="kontainer-hrd-2-pulse" className="w-full flex flex-col">
          <BentoCard
            title="Detak Kehadiran Hari Ini"
            icon={Activity}
            accent="blue"
            className="w-full h-full flex flex-col justify-between"
            bodyClassName="flex flex-col justify-between flex-1"
          >
            <div>
              <p className="dash-kpi text-foreground">
                {presentPercent}
                <span className="ml-0.5 text-base font-extrabold text-muted-foreground">%</span>
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                <span className="font-bold text-foreground">{formatNumber(presentToday)}</span> dari{' '}
                {formatNumber(totalActiveEmployees)} karyawan sudah hadir
              </p>
            </div>

            <div
              className="mt-5 flex h-3 overflow-hidden rounded-full bg-blue-100/80 dark:bg-slate-800"
              role="img"
              aria-label={`Komposisi kehadiran: ${onTimeToday} tepat waktu, ${lateToday} terlambat, ${onLeaveToday} cuti atau izin, ${absentToday} belum absen`}
            >
              {pulseItems.map((item) =>
                item.value > 0 ? (
                  <span
                    key={item.label}
                    className="h-full border-r-2 border-background/80 last:border-r-0"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  />
                ) : null
              )}
            </div>

            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pulseItems.map((item) => {
                const itemStyles: Record<string, string> = {
                  'Tepat waktu': 'border-emerald-500/25 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200',
                  'Terlambat': 'border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-200',
                  'Cuti / izin': 'border-blue-500/25 bg-blue-500/10 text-blue-950 dark:text-blue-200',
                  'Belum absen': 'border-rose-500/25 bg-rose-500/10 text-rose-950 dark:text-rose-200',
                };
                const style = itemStyles[item.label] || 'border-border/60 bg-background/80 text-foreground';

                return (
                  <li key={item.label} className={cn('rounded-xl border backdrop-blur-xs p-3 shadow-2xs', style)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <span
                          aria-hidden="true"
                          className="size-2 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                      </span>
                      <span className="text-xs font-extrabold tabular-nums text-foreground">
                        {formatNumber(item.value)}
                        <span className="ml-1 font-semibold text-muted-foreground">({item.percentage}%)</span>
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-background/60 dark:bg-slate-800/80"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={Math.max(totalActiveEmployees, 1)}
                      aria-valuenow={item.value}
                      aria-label={`${item.label}: ${item.value} dari ${totalActiveEmployees} karyawan`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${item.percentage}%`, background: item.gradient }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </BentoCard>
        </div>
      </div>

      {/* =================================================================== */}
      {/* KONTAINER 4: TREN KEHADIRAN 4 MINGGU TERAKHIR                       */}
      {/* =================================================================== */}
      <div id="kontainer-hrd-4-tren" className="w-full">
        <BentoCard
          title="Tren Kehadiran 4 Minggu"
          icon={TrendingUp}
          accent="blue"
          className="w-full"
          action={
            <Link href="/laporan" className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200">
              Laporan
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          }
        >
          <AttendanceStackedBarChart data={weeklyChartStats} height={250} />

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-background/80 backdrop-blur-xs p-2.5">
              <p className="font-heading text-base font-extrabold text-foreground tabular-nums">
                {formatNumber(totalHadirFourWeeks)}
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground">Hadir tepat waktu, orang-hari</p>
            </div>
            <div className="rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-background/80 backdrop-blur-xs p-2.5">
              <p className="font-heading text-base font-extrabold text-foreground tabular-nums">
                {formatNumber(totalLateFourWeeks)}
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground">Terlambat, orang-hari</p>
            </div>
            <div className="rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-background/80 backdrop-blur-xs p-2.5">
              <p className="font-heading text-base font-extrabold text-foreground tabular-nums">
                {bestWeek?.minggu || '-'}
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground">Kehadiran tertinggi</p>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* =================================================================== */}
      {/* GRID: REKAPITULASI CUTI (KIRI) & KEHADIRAN PER DIVISI (KANAN)       */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
        {/* =================================================================== */}
        {/* KONTAINER 5: REKAPITULASI SISA KUOTA CUTI TAHUNAN                   */}
        {/* =================================================================== */}
        <section
          id="kontainer-hrd-5-cuti"
          aria-labelledby="leave-recap-title"
          className="dash-leave-card relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-[1.5rem] p-4 sm:p-6 text-white shadow-sm w-full h-full"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full border border-white/10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 top-10 size-24 rounded-full bg-[#2ed8b6]/10 blur-xl"
          />

          <div>
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div>
                <h2 id="leave-recap-title" className="font-heading text-base sm:text-lg font-extrabold tracking-tight text-white">
                  Rekapitulasi Sisa Kuota Cuti
                </h2>
              </div>
              <span className="dash-icon-tile bg-white/10 text-[#8df1d8] ring-1 ring-inset ring-white/10">
                <CalendarDays aria-hidden="true" className="size-4" strokeWidth={1.9} />
              </span>
            </div>

            <div className="relative z-10 mt-3 sm:mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="font-heading text-3xl sm:text-[2.6rem] font-extrabold leading-none tracking-tight text-white">
                  {avgRemainingQuota}
                  <span className="ml-1.5 align-middle text-sm font-bold text-white/90">hari</span>
                </p>
                <p className="mt-1 text-xs text-white/90">rata-rata sisa per karyawan</p>
              </div>

              <div className="rounded-xl bg-white/10 p-3 ring-1 ring-inset ring-white/10">
                <p className="font-heading text-lg font-extrabold leading-none text-white tabular-nums">
                  {formatNumber(remainingQuotaDays)}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-white/90">Total sisa hari cuti</p>
              </div>

              <div className="rounded-xl bg-white/10 p-3 ring-1 ring-inset ring-white/10">
                <p className="font-heading text-lg font-extrabold leading-none text-white tabular-nums">
                  {formatNumber(employeesWithQuota)}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-white/90">Karyawan dengan jatah cuti</p>
              </div>
            </div>

            <div className="relative z-10 mt-5">
              <div className="flex items-center justify-between text-[11px] text-white/90">
                <span>Pemakaian kuota perusahaan</span>
                <span className="font-bold text-white tabular-nums">{quotaUsagePercent}%</span>
              </div>
              <div
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={Math.max(totalQuotaDays, 1)}
                aria-valuenow={usedQuotaDays}
                aria-label={`Pemakaian kuota cuti: ${usedQuotaDays} dari ${totalQuotaDays} hari`}
              >
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#2ed8b6,#8df1d8)]"
                  style={{ width: `${quotaUsagePercent}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] font-medium text-white/90 tabular-nums">
                <span>{formatNumber(usedQuotaDays)} hari terpakai</span>
                <span>{formatNumber(totalQuotaDays)} hari total kuota</span>
              </div>
            </div>
          </div>

          <Link
            href="/cuti-izin"
            className="relative z-10 mt-6 inline-flex items-center gap-1.5 border-t border-white/10 pt-4 text-xs font-bold text-[#b9f9e8] transition-colors hover:text-white"
          >
            Lihat seluruh pengajuan cuti
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        </section>

        {/* =================================================================== */}
        {/* KONTAINER 6: STATUS KEHADIRAN BERDASARKAN DIVISI                    */}
        {/* =================================================================== */}
        <div id="kontainer-hrd-6-divisi" className="w-full flex flex-col">
          <BentoCard
            title="Status Kehadiran per Divisi"
            icon={Users}
            accent="violet"
            className="w-full h-full flex flex-col justify-between"
            bodyClassName="flex flex-col justify-between flex-1"
            action={
              <span className="dash-soft-chip bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-500/25">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-indigo-500" />
                {divisionStats.length} divisi
              </span>
            }
          >
            {divisionStats.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-indigo-200/60 dark:border-indigo-900/40 bg-background/60 px-5 py-8 text-center my-auto">
                <p className="text-sm font-bold text-foreground">Data divisi belum tersedia</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Statistik akan tampil setelah profil karyawan terhubung ke divisi.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {divisionStats.map((division) => {
                  const divisionPresent = division.hadir + division.terlambat;
                  const divisionPercent = percent(divisionPresent, division.total);

                  const segments = [
                    { label: 'Hadir tepat waktu', value: division.hadir, color: '#10b981' },
                    { label: 'Terlambat', value: division.terlambat, color: '#f59e0b' },
                    { label: 'Cuti', value: division.cuti, color: '#3b82f6' },
                    { label: 'Tidak absen', value: division.alpa, color: '#ef4444' },
                  ];

                  return (
                    <article
                      key={division.id}
                      className="rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 bg-background/80 backdrop-blur-xs p-4 shadow-2xs hover:bg-background/95 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-[13px] font-extrabold leading-5 text-foreground">
                            {division.nama}
                          </h3>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {division.total} karyawan
                          </p>
                        </div>
                        <span className="shrink-0 font-heading text-xl font-extrabold leading-none text-indigo-600 dark:text-indigo-400 tabular-nums">
                          {divisionPercent}%
                        </span>
                      </div>

                      <div
                        className="mt-3 flex h-2 overflow-hidden rounded-full bg-indigo-100/80 dark:bg-slate-800"
                        role="img"
                        aria-label={`${division.nama}: ${divisionPresent} hadir dari ${division.total} karyawan`}
                      >
                        {segments.map((segment) =>
                          segment.value > 0 ? (
                            <span
                              key={segment.label}
                              className="h-full border-r border-background last:border-r-0"
                              style={{
                                width: `${percent(segment.value, division.total)}%`,
                                backgroundColor: segment.color,
                              }}
                            />
                          ) : null
                        )}
                      </div>

                      {/* Node status warna */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-indigo-200/50 dark:border-indigo-900/30 pt-2.5">
                        <span
                          title="Hadir tepat waktu"
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/25"
                        >
                          <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
                          <span>{division.hadir}</span>
                        </span>

                        <span
                          title="Terlambat"
                          className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/25"
                        >
                          <span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />
                          <span>{division.terlambat}</span>
                        </span>

                        <span
                          title="Cuti"
                          className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-500/25"
                        >
                          <span aria-hidden="true" className="size-2 rounded-full bg-blue-500" />
                          <span>{division.cuti}</span>
                        </span>

                        <span
                          title="Tidak absen"
                          className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-400 ring-1 ring-inset ring-rose-500/25"
                        >
                          <span aria-hidden="true" className="size-2 rounded-full bg-rose-500" />
                          <span>{division.alpa}</span>
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-indigo-200/50 dark:border-indigo-900/30 pt-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
                  Hadir tepat waktu
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />
                  Terlambat
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full bg-blue-500" />
                  Cuti
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full bg-rose-500" />
                  Tidak absen
                </span>
              </div>
              <Link
                href="/laporan"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200"
              >
                Lihat laporan kehadiran
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            </div>
          </BentoCard>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] font-medium text-[#64748b]">
        <span>
          Data kehadiran dan cuti mengikuti waktu server WIB. Keputusan tetap mengikuti aturan
          persetujuan yang berlaku.
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 aria-hidden="true" className="size-3" />
          {profile.divisi?.nama || 'HRD'} · {dateLabel}
        </span>
      </div>
    </div>
  );
}

