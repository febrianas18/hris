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
import AttendanceTrendAreaChart from '@/components/charts/AttendanceTrendAreaChart';
import BentoCard from '@/components/dashboard/BentoCard';
import HrdApprovalQueue from '@/components/dashboard/HrdApprovalQueue';
import SelfAttendanceHeader from '@/components/dashboard/SelfAttendanceHeader';
import type { HrdDivisionStat, HrdQueueItem } from '@/components/dashboard/types';

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
  const onTimeShare = percent(onTimeToday, presentToday);
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
      color: '#1f6fd0',
      gradient: 'linear-gradient(90deg,#1f6fd0,#73b4ff)',
    },
    {
      label: 'Terlambat',
      value: lateToday,
      percentage: latePercent,
      color: '#ffb64d',
      gradient: 'linear-gradient(90deg,#d97706,#ffb64d)',
    },
    {
      label: 'Cuti / izin',
      value: onLeaveToday,
      percentage: leavePercent,
      color: '#5b46b8',
      gradient: 'linear-gradient(90deg,#5b46b8,#a99ff0)',
    },
    {
      label: 'Belum absen',
      value: absentToday,
      percentage: absentPercent,
      color: '#b4233c',
      gradient: 'linear-gradient(90deg,#b4233c,#ff8ba0)',
    },
  ];

  return (
    <div className="gradient-dashboard">
      <section className="dash-hero relative overflow-hidden p-5 sm:p-6 xl:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-[#73b4ff]/20 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full border border-white/10"
        />
        <div aria-hidden="true" className="dash-hero-grid pointer-events-none absolute inset-0" />

        <div className="relative z-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-center">
          <div className="min-w-0">
            <p className="dash-hero-eyebrow">
              <span aria-hidden="true" className="live-dot" />
              HRD workspace · {dateLabel}
            </p>
            <h1 className="dash-hero-title mt-3">
              {greeting}, {firstName}
            </h1>
            <p className="mt-2 max-w-[58ch] text-sm leading-6 text-white/90">
              Ritme kerja perusahaan hari ini, keputusan yang menunggu, dan gambaran cuti tim
              dalam satu layar.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
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
          </div>

          <SelfAttendanceHeader initialTime={initialTime} dateLabel={dateLabel} />
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <BentoCard
          title="Detak kehadiran hari ini"
          description="Snapshot seluruh karyawan aktif PT Karsa Lintas Nusantara"
          eyebrow="Live attendance pulse"
          icon={Activity}
          accent="blue"
          className="xl:col-span-7"
          bodyClassName="flex flex-col"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="dash-kpi">
                {presentPercent}
                <span className="ml-0.5 text-base font-extrabold text-[#64748b]">%</span>
              </p>
              <p className="mt-1 text-xs font-medium text-[#64748b]">
                <span className="font-bold text-[#162033]">{formatNumber(presentToday)}</span> dari{' '}
                {formatNumber(totalActiveEmployees)} karyawan sudah hadir
              </p>
            </div>
            <span className="dash-live-chip">
              <span aria-hidden="true" className="live-dot live-dot-dark" />
              Live · {initialTime} WIB
            </span>
          </div>

          <div
            className="mt-5 flex h-3 overflow-hidden rounded-full bg-[#eef4fb]"
            role="img"
            aria-label={`Komposisi kehadiran: ${onTimeToday} tepat waktu, ${lateToday} terlambat, ${onLeaveToday} cuti atau izin, ${absentToday} belum absen`}
          >
            {pulseItems.map((item) =>
              item.value > 0 ? (
                <span
                  key={item.label}
                  className="h-full border-r-2 border-white/80 last:border-r-0"
                  style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                />
              ) : null
            )}
          </div>

          <ul className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
            {pulseItems.map((item) => (
              <li key={item.label}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#475569]">
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                  <span className="text-xs font-extrabold text-[#162033] tabular-nums">
                    {formatNumber(item.value)}
                    <span className="ml-1 font-semibold text-[#64748b]">({item.percentage}%)</span>
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#eef4fb]"
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
            ))}
          </ul>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[#edf3fa] pt-3 text-[11px] text-[#64748b]">
            <span>
              <span className="font-bold text-[#0b6b53]">{onTimeShare}%</span> dari yang hadir
              datang tepat waktu
            </span>
            <span className="tabular-nums">Data per {initialTime} WIB</span>
          </div>
        </BentoCard>

        <HrdApprovalQueue
          key={`${pendingApprovals}-${queue.map((item) => item.id).join('-')}`}
          initialItems={queue}
          initialPendingCount={pendingApprovals}
        />

        <BentoCard
          title="Tren kehadiran 4 minggu"
          description="Orang-hari hadir dan terlambat seluruh perusahaan"
          eyebrow="Analitik"
          icon={TrendingUp}
          accent="blue"
          className="xl:col-span-7"
          action={
            <Link href="/laporan" className="dash-inline-link flex items-center gap-1 text-[11px] font-bold">
              Laporan
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          }
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748b]">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-[#1f6fd0]" />
              Hadir tepat waktu
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748b]">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-[#d97706]" />
              Terlambat
            </span>
          </div>

          <div className="mt-1">
            <AttendanceTrendAreaChart data={weeklyChartStats} height={250} />
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="dash-mini-stat">
              <p className="dash-mini-stat-value">{formatNumber(totalHadirFourWeeks)}</p>
              <p className="dash-mini-stat-label">Hadir, orang-hari</p>
            </div>
            <div className="dash-mini-stat">
              <p className="dash-mini-stat-value">{formatNumber(totalLateFourWeeks)}</p>
              <p className="dash-mini-stat-label">Terlambat, orang-hari</p>
            </div>
            <div className="dash-mini-stat">
              <p className="dash-mini-stat-value">{bestWeek?.minggu || '-'}</p>
              <p className="dash-mini-stat-label">Kehadiran tertinggi</p>
            </div>
          </div>
        </BentoCard>

        <section
          aria-labelledby="leave-recap-title"
          className="dash-leave-card relative flex flex-col overflow-hidden rounded-[1.5rem] p-5 text-white shadow-[0_24px_48px_-30px_rgba(8,63,50,0.75)] sm:p-6 xl:col-span-5"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full border border-white/10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 top-10 size-24 rounded-full bg-[#2ed8b6]/10 blur-xl"
          />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#b9f9e8]">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[#2ed8b6]" />
                Cuti tahunan
              </p>
              <h2 id="leave-recap-title" className="mt-1 font-heading text-[15px] font-extrabold tracking-tight text-white">
                Rekap sisa cuti
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-white/90">
                Ringkasan kuota seluruh karyawan terdata
              </p>
            </div>
            <span className="dash-icon-tile bg-white/10 text-[#8df1d8] ring-1 ring-inset ring-white/10">
              <CalendarDays aria-hidden="true" className="size-4" strokeWidth={1.9} />
            </span>
          </div>

          <div className="relative z-10 mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-heading text-[2.6rem] font-extrabold leading-none tracking-tight text-white">
                {avgRemainingQuota}
                <span className="ml-1.5 align-middle text-sm font-bold text-white/90">hari</span>
              </p>
              <p className="mt-1 text-xs text-white/90">rata-rata sisa per karyawan</p>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-[#b9f9e8] ring-1 ring-inset ring-white/15">
              Tahun {currentYear}
            </span>
          </div>

          <div className="relative z-10 mt-5">
            <div className="flex items-center justify-between text-[11px] text-white/90">
              <span>Pemakaian kuota</span>
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
              <span>{formatNumber(totalQuotaDays)} hari</span>
            </div>
          </div>

          <div className="relative z-10 mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/10 p-3 ring-1 ring-inset ring-white/10">
              <p className="font-heading text-lg font-extrabold leading-none text-white tabular-nums">
                {formatNumber(remainingQuotaDays)}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-white/90">Total sisa hari</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 ring-1 ring-inset ring-white/10">
              <p className="font-heading text-lg font-extrabold leading-none text-white tabular-nums">
                {formatNumber(employeesWithQuota)}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-white/90">Karyawan terdata</p>
            </div>
          </div>

          <Link
            href="/cuti-izin"
            className="relative z-10 mt-auto inline-flex items-center gap-1.5 border-t border-white/10 pt-4 text-xs font-bold text-[#b9f9e8] transition-colors hover:text-white"
          >
            Lihat pengajuan cuti
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        </section>

        <BentoCard
          title="Status kehadiran per divisi"
          description="Kehadiran tim hari ini, dipecah per unit kerja"
          eyebrow="Tim"
          icon={Users}
          accent="violet"
          className="xl:col-span-12"
          action={
            <span className="dash-soft-chip">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-[#1f6fd0]" />
              {divisionStats.length} divisi
            </span>
          }
        >
          {divisionStats.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#dbe7f4] bg-[#fbfdff] px-5 py-8 text-center">
              <p className="text-sm font-bold text-[#162033]">Data divisi belum tersedia</p>
              <p className="mt-1 text-xs text-[#64748b]">
                Statistik akan tampil setelah profil karyawan terhubung ke divisi.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {divisionStats.map((division) => {
                const divisionPresent = division.hadir + division.terlambat;
                const divisionPercent = percent(divisionPresent, division.total);

                const segments = [
                  { label: 'Tepat waktu', value: division.hadir, color: '#1f6fd0' },
                  { label: 'Terlambat', value: division.terlambat, color: '#ffb64d' },
                  { label: 'Cuti / izin', value: division.cuti, color: '#5b46b8' },
                  { label: 'Belum absen', value: division.alpa, color: '#b4233c' },
                ];

                return (
                  <article
                    key={division.id}
                    className="rounded-2xl border border-[#e5edf7] bg-[linear-gradient(180deg,#fbfdff_0%,#ffffff_100%)] p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-[13px] font-extrabold leading-5 text-[#162033]">
                          {division.nama}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-[#64748b]">
                          {division.total} karyawan
                        </p>
                      </div>
                      <span className="shrink-0 font-heading text-xl font-extrabold leading-none text-[#1f6fd0] tabular-nums">
                        {divisionPercent}%
                      </span>
                    </div>

                    <div
                      className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#eef4fb]"
                      role="img"
                      aria-label={`${division.nama}: ${divisionPresent} hadir dari ${division.total} karyawan`}
                    >
                      {segments.map((segment) =>
                        segment.value > 0 ? (
                          <span
                            key={segment.label}
                            className="h-full border-r border-white last:border-r-0"
                            style={{
                              width: `${percent(segment.value, division.total)}%`,
                              backgroundColor: segment.color,
                            }}
                          />
                        ) : null
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {segments.map((segment) => (
                        <div
                          key={segment.label}
                          className="flex items-center justify-between gap-1.5 text-[10px]"
                        >
                          <span className="flex min-w-0 items-center gap-1.5 font-semibold text-[#64748b]">
                            <span
                              aria-hidden="true"
                              className="size-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: segment.color }}
                            />
                            <span className="truncate">{segment.label}</span>
                          </span>
                          <span className="shrink-0 font-extrabold text-[#334155] tabular-nums">
                            {segment.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="mt-3 border-t border-[#edf3fa] pt-2 text-[10px] font-medium text-[#64748b]">
                      {divisionPresent} hadir dari {division.total} karyawan
                    </p>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf3fa] pt-3">
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] font-semibold text-[#64748b]">
              <span className="flex items-center gap-1">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[#1f6fd0]" />
                Tepat waktu
              </span>
              <span className="flex items-center gap-1">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[#ffb64d]" />
                Terlambat
              </span>
              <span className="flex items-center gap-1">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[#5b46b8]" />
                Cuti / izin
              </span>
              <span className="flex items-center gap-1">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[#b4233c]" />
                Belum absen
              </span>
            </div>
            <Link
              href="/laporan"
              className="dash-inline-link inline-flex items-center gap-1.5 text-[11px] font-bold"
            >
              Lihat laporan kehadiran
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </BentoCard>
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

