import { getCurrentProfile } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import AppLayout from '@/components/AppLayout';
import PersetujuanClient, { PendingLeaveItem } from './PersetujuanClient';
import { getServerTimeWIB } from '@/utils/time';

export const dynamic = 'force-dynamic';

export default async function PersetujuanPage() {
  const { profile } = await getCurrentProfile();
  const supabase = await createClient();
  const serverTime = getServerTimeWIB();
  const currentYear = parseInt(serverTime.dateStr.slice(0, 4), 10);

  // Defense-in-depth: Hanya Atasan dan HRD yang berhak mengakses halaman ini
  if (profile.peran === 'karyawan') {
    redirect('/dashboard?forbidden=1&target=/persetujuan');
  }

  // 1. Ambil antrean pengajuan yang menunggu keputusan sesuai peran (BR-09)
  let query = supabase
    .from('pengajuan_cuti')
    .select(`
      id,
      karyawan_id,
      jenis,
      tanggal_mulai,
      tanggal_selesai,
      jumlah_hari,
      alasan,
      lampiran_path,
      status,
      perlu_atasan,
      dibuat_pada,
      pemohon:karyawan_id (
        id,
        nik_karyawan,
        nama_lengkap,
        jabatan,
        status_kerja,
        tanggal_masuk,
        divisi_id,
        divisi:divisi_id (
          id,
          nama
        )
      )
    `)
    .neq('karyawan_id', profile.id) // Tidak boleh memutuskan pengajuannya sendiri (BR-09)
    .order('dibuat_pada', { ascending: true });

  if (profile.peran === 'atasan') {
    // Atasan: hanya pengajuan berstatus 'diajukan' yang membutuhkan persetujuan atasan
    query = query.eq('status', 'diajukan').eq('perlu_atasan', true);
  } else if (profile.peran === 'hrd') {
    // HRD: pengajuan yang sudah disetujui atasan (tahap 2) ATAU yang tidak butuh atasan (langsung HRD)
    query = query.or('status.eq.disetujui_atasan,and(status.eq.diajukan,perlu_atasan.eq.false)');
  }

  const { data: rawItems } = await query;

  // Filter jika atasan: pastikan hanya anggota divisinya
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filteredRawItems = (rawItems || []) as any[];
  if (profile.peran === 'atasan' && profile.divisi?.id) {
    filteredRawItems = filteredRawItems.filter(
      (item) => item.pemohon?.divisi_id === profile.divisi?.id
    );
  }

  // Ambil kuota cuti pemohon untuk ditampilkan di rincian
  const pemohonIds = filteredRawItems.map((i) => i.karyawan_id);
  const { data: kuotaList } = await supabase
    .from('kuota_cuti')
    .select('karyawan_id, jatah_hari, terpakai_hari')
    .in('karyawan_id', pemohonIds.length > 0 ? pemohonIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('tahun', currentYear);

  const kuotaMap = new Map<string, { jatah_hari: number; terpakai_hari: number }>();
  (kuotaList || []).forEach((k) => {
    kuotaMap.set(k.karyawan_id, { jatah_hari: k.jatah_hari, terpakai_hari: k.terpakai_hari });
  });

  const initialItems: PendingLeaveItem[] = filteredRawItems.map((item) => ({
    id: item.id,
    karyawan_id: item.karyawan_id,
    jenis: item.jenis,
    tanggal_mulai: item.tanggal_mulai,
    tanggal_selesai: item.tanggal_selesai,
    jumlah_hari: item.jumlah_hari,
    alasan: item.alasan,
    lampiran_path: item.lampiran_path,
    status: item.status,
    perlu_atasan: item.perlu_atasan,
    dibuat_pada: item.dibuat_pada,
    pemohon: {
      id: item.pemohon.id,
      nik_karyawan: item.pemohon.nik_karyawan,
      nama_lengkap: item.pemohon.nama_lengkap,
      jabatan: item.pemohon.jabatan,
      status_kerja: item.pemohon.status_kerja,
      tanggal_masuk: item.pemohon.tanggal_masuk,
      divisi: item.pemohon.divisi
        ? { id: item.pemohon.divisi.id, nama: item.pemohon.divisi.nama }
        : null,
    },
    kuota: kuotaMap.get(item.karyawan_id) || null,
  }));

  // Ambil data staf yang sedang/akan cuti di sekitar tanggal ini (Wireframe Hal. 3)
  const { data: allActiveLeaves } = await supabase
    .from('pengajuan_cuti')
    .select(`
      id,
      karyawan_id,
      tanggal_mulai,
      tanggal_selesai,
      status,
      pemohon:karyawan_id (
        nama_lengkap,
        divisi_id
      )
    `)
    .in('status', ['diajukan', 'disetujui_atasan', 'disetujui'])
    .order('tanggal_mulai', { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allActiveLeavesAroundDate = (allActiveLeaves || []).map((l: any) => ({
    id: l.id,
    karyawan_id: l.karyawan_id,
    nama: l.pemohon?.nama_lengkap || 'Karyawan',
    tanggal_mulai: l.tanggal_mulai,
    tanggal_selesai: l.tanggal_selesai,
    status: l.status === 'disetujui' ? 'Disetujui' : 'Menunggu',
  }));

  return (
    <AppLayout profile={profile}>
      <PersetujuanClient
        currentUserRole={profile.peran as 'atasan' | 'hrd'}
        currentUserId={profile.id}
        currentUserDivisiId={profile.divisi?.id}
        initialItems={initialItems}
        allActiveLeavesAroundDate={allActiveLeavesAroundDate}
      />
    </AppLayout>
  );
}
