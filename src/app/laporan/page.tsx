import { getCurrentProfile } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import AppLayout from '@/components/AppLayout';
import LaporanClient from './LaporanClient';
import { getServerTimeWIB } from '@/utils/time';
import {
  getFourWeeksAttendanceStats,
  LateEmployeeStat,
} from '@/utils/analytics';
import { DivisionLeaveDataPoint } from '@/components/charts/DivisionLeaveBarChart';

export const dynamic = 'force-dynamic';

export default async function LaporanPage() {
  const { profile } = await getCurrentProfile();

  // Defense-in-depth: Proteksi khusus HRD (BR-11 & Middleware RBAC)
  if (profile.peran !== 'hrd') {
    redirect('/dashboard?forbidden=1&target=/laporan');
  }

  const supabase = await createClient();
  const serverTime = getServerTimeWIB();
  const todayStr = serverTime.dateStr; // e.g. '2026-10-20'
  const currentMonthPrefix = todayStr.slice(0, 7); // '2026-10'

  // 1. Ambil data divisi
  const { data: divisionsData } = await supabase
    .from('divisi')
    .select('id, nama')
    .order('nama');
  const divisions = divisionsData || [];

  // 2. Grafik 1: Statistik Kehadiran 4 Minggu Terakhir (PRD Bab 9)
  const weeklyStats = await getFourWeeksAttendanceStats(supabase, todayStr);

  // 3. Tabel: 5 Karyawan Paling Sering Terlambat Bulan Berjalan (Oktober 2026)
  const { data: lateAttendances } = await supabase
    .from('absensi')
    .select(`
      karyawan_id,
      profiles:karyawan_id (
        id,
        nama_lengkap,
        nik_karyawan,
        jabatan,
        divisi:divisi_id (
          id,
          nama
        )
      )
    `)
    .eq('status', 'terlambat')
    .gte('tanggal', `${currentMonthPrefix}-01`)
    .lte('tanggal', `${currentMonthPrefix}-31`);

  const lateCounts = new Map<string, { count: number; profile: any }>();
  (lateAttendances || []).forEach((item: any) => {
    const kId = item.karyawan_id;
    if (!lateCounts.has(kId)) {
      lateCounts.set(kId, { count: 1, profile: item.profiles });
    } else {
      lateCounts.get(kId)!.count += 1;
    }
  });

  const sortedLateList = Array.from(lateCounts.entries())
    .map(([kId, data]) => ({
      karyawan_id: kId,
      nama_lengkap: data.profile?.nama_lengkap || 'Karyawan',
      nik_karyawan: data.profile?.nik_karyawan || '-',
      jabatan: data.profile?.jabatan || '-',
      divisi_nama: data.profile?.divisi?.nama || 'Umum',
      jumlah_terlambat: data.count,
    }))
    .sort((a, b) => b.jumlah_terlambat - a.jumlah_terlambat);

  const topLateEmployees: LateEmployeeStat[] = sortedLateList.slice(0, 5);

  // 4. Grafik 2: Jumlah Hari Cuti, Sakit, & Izin yang Disetujui per Divisi per Bulan
  // Bulan: Agustus ('2026-08'), September ('2026-09'), Oktober ('2026-10')
  const { data: approvedLeavesData } = await supabase
    .from('pengajuan_cuti')
    .select(`
      id,
      jenis,
      tanggal_mulai,
      jumlah_hari,
      status,
      profiles:karyawan_id (
        divisi_id,
        divisi:divisi_id (
          id,
          nama
        )
      )
    `)
    .eq('status', 'disetujui')
    .gte('tanggal_mulai', '2026-08-01')
    .lte('tanggal_mulai', '2026-10-31');

  const monthsTarget = [
    { prefix: '2026-10', labelBulan: 'Oktober 2026' },
    { prefix: '2026-09', labelBulan: 'September 2026' },
    { prefix: '2026-08', labelBulan: 'Agustus 2026' },
  ];

  const monthlyLeaveStats = monthsTarget.map((m) => {
    // Inisialisasi setiap divisi dengan 0
    const divMap = new Map<string, DivisionLeaveDataPoint>();
    divisions.forEach((d) => {
      divMap.set(d.nama, {
        divisi: d.nama,
        cuti_tahunan: 0,
        sakit: 0,
        izin: 0,
      });
    });

    (approvedLeavesData || []).forEach((leave: any) => {
      const leaveMonth = (leave.tanggal_mulai || '').slice(0, 7);
      if (leaveMonth === m.prefix) {
        const divName = leave.profiles?.divisi?.nama;
        if (divName && divMap.has(divName)) {
          const stat = divMap.get(divName)!;
          const days = Number(leave.jumlah_hari || 0);
          if (leave.jenis === 'cuti_tahunan') stat.cuti_tahunan += days;
          else if (leave.jenis === 'sakit') stat.sakit += days;
          else if (leave.jenis === 'izin') stat.izin += days;
        }
      }
    });

    return {
      periodeBulan: m.prefix,
      labelBulan: m.labelBulan,
      divisions: Array.from(divMap.values()),
    };
  });

  // 5. Rekap Total Gaji per Divisi (HANYA MENGHITUNG SLIP TERBIT - PRD Bab 9 & BR-11)
  const { data: publishedSlipsData } = await supabase
    .from('slip_gaji')
    .select(`
      id,
      periode,
      gaji_pokok,
      tunjangan,
      potongan,
      total_diterima,
      status,
      karyawan:karyawan_id (
        id,
        nama_lengkap,
        nik_karyawan,
        divisi_id,
        divisi:divisi_id (
          id,
          nama
        )
      )
    `)
    .eq('status', 'terbit');

  const publishedSlips = (publishedSlipsData || []).map((s: any) => ({
    id: s.id,
    periode: s.periode,
    gaji_pokok: Number(s.gaji_pokok),
    tunjangan: Number(s.tunjangan),
    potongan: Number(s.potongan),
    total_diterima: Number(s.total_diterima),
    karyawan: s.karyawan,
  }));

  const currentMonthName = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(todayStr));

  return (
    <AppLayout profile={profile}>
      <LaporanClient
        weeklyStats={weeklyStats}
        monthlyLeaveStats={monthlyLeaveStats}
        topLateEmployees={topLateEmployees}
        publishedSlips={publishedSlips}
        divisions={divisions}
        currentMonthName={currentMonthName}
      />
    </AppLayout>
  );
}
