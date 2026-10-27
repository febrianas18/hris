import { getCurrentProfile } from '@/utils/auth';
import { createClient } from '@/utils/supabase/server';
import AppLayout from '@/components/AppLayout';
import CutiIzinClient, { LeaveRequestRecord } from './CutiIzinClient';
import { getServerTimeWIB } from '@/utils/time';
import { HolidayItem } from '@/utils/workingDays';

export const dynamic = 'force-dynamic';

export default async function CutiIzinPage() {
  const { profile } = await getCurrentProfile();
  const supabase = await createClient();
  const serverTime = getServerTimeWIB();
  const currentYear = parseInt(serverTime.dateStr.slice(0, 4), 10);

  // Ambil kuota cuti tahunan, hari libur resmi, dan riwayat pengajuan secara paralel
  const [
    { data: kuotaData },
    { data: holidaysData },
    { data: leavesData },
  ] = await Promise.all([
    supabase
      .from('kuota_cuti')
      .select('tahun, jatah_hari, terpakai_hari')
      .eq('karyawan_id', profile.id)
      .eq('tahun', currentYear)
      .maybeSingle(),
    supabase
      .from('hari_libur')
      .select('tanggal, keterangan, jenis')
      .order('tanggal'),
    supabase
      .from('pengajuan_cuti')
      .select('*')
      .eq('karyawan_id', profile.id)
      .order('dibuat_pada', { ascending: false }),
  ]);

  const holidays: HolidayItem[] = (holidaysData || []).map((h) => ({
    tanggal: h.tanggal,
    keterangan: h.keterangan,
    jenis: h.jenis,
  }));

  const initialLeaves: LeaveRequestRecord[] = (leavesData || []).map((l) => ({
    id: l.id,
    karyawan_id: l.karyawan_id,
    jenis: l.jenis,
    tanggal_mulai: l.tanggal_mulai,
    tanggal_selesai: l.tanggal_selesai,
    jumlah_hari: l.jumlah_hari,
    alasan: l.alasan,
    lampiran_path: l.lampiran_path,
    status: l.status,
    perlu_atasan: l.perlu_atasan,
    disetujui_atasan_pada: l.disetujui_atasan_pada,
    diputuskan_hrd_pada: l.diputuskan_hrd_pada,
    alasan_penolakan: l.alasan_penolakan,
    dibatalkan_pada: l.dibatalkan_pada,
    dibuat_pada: l.dibuat_pada,
  }));

  return (
    <AppLayout profile={profile}>
      <CutiIzinClient
        currentUserId={profile.id}
        currentUserRole={profile.peran}
        tanggalMasuk={profile.tanggal_masuk}
        kuotaCuti={kuotaData || null}
        holidays={holidays}
        initialLeaves={initialLeaves}
        todayStr={serverTime.dateStr}
      />
    </AppLayout>
  );
}
