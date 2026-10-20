import { getCurrentProfile } from '@/utils/auth';
import { createClient } from '@/utils/supabase/server';
import AppLayout from '@/components/AppLayout';
import AbsensiClient, { AbsensiRecord } from './AbsensiClient';
import { getServerTimeWIB } from '@/utils/time';

export const dynamic = 'force-dynamic';

export default async function AbsensiPage() {
  const { profile } = await getCurrentProfile();
  const supabase = await createClient();
  const serverTime = getServerTimeWIB();

  // 1. Ambil data divisi untuk dropdown filter
  const { data: divisionsData } = await supabase
    .from('divisi')
    .select('id, nama')
    .order('nama');

  const divisions = (divisionsData || []).map((d) => ({
    id: d.id,
    nama: d.nama,
  }));

  // 2. Ambil pool profil karyawan sesuai peran
  let profilesQuery = supabase
    .from('profiles')
    .select(`
      id,
      nik_karyawan,
      nama_lengkap,
      jabatan,
      divisi_id,
      divisi:divisi_id (
        id,
        nama
      )
    `)
    .eq('aktif', true)
    .order('nik_karyawan');

  if (profile.peran === 'atasan' && profile.divisi?.id) {
    profilesQuery = profilesQuery.eq('divisi_id', profile.divisi.id);
  } else if (profile.peran === 'karyawan') {
    profilesQuery = profilesQuery.eq('id', profile.id);
  }

  const { data: profilesData } = await profilesQuery;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allProfiles = (profilesData || []).map((p: any) => ({
    id: p.id,
    nik_karyawan: p.nik_karyawan,
    nama_lengkap: p.nama_lengkap,
    jabatan: p.jabatan,
    divisi_id: p.divisi_id,
    divisi: p.divisi ? { id: p.divisi.id, nama: p.divisi.nama } : null,
  }));

  // 3. Ambil data absensi
  const { data: absensiData } = await supabase
    .from('absensi')
    .select(`
      id,
      karyawan_id,
      tanggal,
      jam_masuk,
      jam_pulang,
      status,
      dikoreksi_oleh,
      alasan_koreksi,
      karyawan:karyawan_id (
        id,
        nik_karyawan,
        nama_lengkap,
        jabatan,
        divisi:divisi_id (
          id,
          nama
        )
      )
    `)
    .order('tanggal', { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialRecords: AbsensiRecord[] = (absensiData || []).map((r: any) => ({
    id: r.id,
    karyawan_id: r.karyawan_id,
    tanggal: r.tanggal,
    jam_masuk: r.jam_masuk,
    jam_pulang: r.jam_pulang,
    status: r.status,
    dikoreksi_oleh: r.dikoreksi_oleh,
    alasan_koreksi: r.alasan_koreksi,
    karyawan: r.karyawan
      ? {
          id: r.karyawan.id,
          nik_karyawan: r.karyawan.nik_karyawan,
          nama_lengkap: r.karyawan.nama_lengkap,
          jabatan: r.karyawan.jabatan,
          divisi: r.karyawan.divisi
            ? { id: r.karyawan.divisi.id, nama: r.karyawan.divisi.nama }
            : null,
        }
      : undefined,
  }));

  // 4. Ambil data cuti/sakit/izin yang telah disetujui
  const { data: approvedLeavesData } = await supabase
    .from('pengajuan_cuti')
    .select('karyawan_id, jenis, tanggal_mulai, tanggal_selesai')
    .eq('status', 'disetujui');

  const approvedLeaves = approvedLeavesData || [];

  return (
    <AppLayout profile={profile}>
      <AbsensiClient
        currentUserRole={profile.peran}
        currentUserId={profile.id}
        initialRecords={initialRecords}
        divisions={divisions}
        allProfiles={allProfiles}
        approvedLeaves={approvedLeaves}
        todayStr={serverTime.dateStr}
      />
    </AppLayout>
  );
}
