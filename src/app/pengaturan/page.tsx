import { getCurrentProfile } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import AppLayout from '@/components/AppLayout';
import PengaturanClient from './PengaturanClient';
import { getServerTimeWIB } from '@/utils/time';

export const dynamic = 'force-dynamic';

export default async function PengaturanPage() {
  const { profile } = await getCurrentProfile();

  // Defense-in-depth: Proteksi khusus HRD (BR-01, BR-04, BR-12 & Middleware RBAC)
  if (profile.peran !== 'hrd') {
    redirect('/dashboard?forbidden=1&target=/pengaturan');
  }

  const supabase = await createClient();
  const serverTime = getServerTimeWIB();
  const currentYear = parseInt(serverTime.dateStr.slice(0, 4), 10);

  // 1. Ambil seluruh divisi beserta data manajer saat ini (BR-01)
  const { data: rawDivisions } = await supabase
    .from('divisi')
    .select(`
      id,
      nama,
      manajer_id,
      manajer:manajer_id (
        id,
        nama_lengkap,
        nik_karyawan,
        jabatan,
        email
      )
    `)
    .order('nama');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const divisions = (rawDivisions || []).map((d: any) => ({
    id: d.id,
    nama: d.nama,
    manajer_id: d.manajer_id,
    manajer: d.manajer,
  }));

  // 2. Ambil master hari libur
  const { data: holidaysData } = await supabase
    .from('hari_libur')
    .select('tanggal, keterangan, jenis')
    .order('tanggal');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holidays = (holidaysData || []).map((h: any) => ({
    tanggal: h.tanggal,
    keterangan: h.keterangan,
    jenis: h.jenis,
  }));

  // 3. Ambil jatah cuti seluruh karyawan untuk tahun berjalan (BR-04)
  const { data: quotasData } = await supabase
    .from('kuota_cuti')
    .select(`
      id,
      karyawan_id,
      tahun,
      jatah_hari,
      terpakai_hari,
      karyawan:karyawan_id (
        id,
        nama_lengkap,
        nik_karyawan,
        jabatan,
        divisi:divisi_id (
          nama
        )
      )
    `)
    .eq('tahun', currentYear)
    .order('jatah_hari', { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotas = (quotasData || []).map((q: any) => ({
    id: q.id,
    karyawan_id: q.karyawan_id,
    tahun: q.tahun,
    jatah_hari: q.jatah_hari,
    terpakai_hari: q.terpakai_hari,
    karyawan: q.karyawan,
  }));

  // 4. Ambil seluruh audit log (Read-Only - BR-12)
  const { data: auditLogsData } = await supabase
    .from('audit_log')
    .select(`
      id,
      pelaku_id,
      aksi,
      nama_tabel,
      data_id,
      nilai_sebelum,
      nilai_sesudah,
      dibuat_pada,
      pelaku:pelaku_id (
        nama_lengkap,
        email
      )
    `)
    .order('dibuat_pada', { ascending: false })
    .limit(100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auditLogs = (auditLogsData || []).map((l: any) => ({
    id: l.id,
    pelaku_id: l.pelaku_id,
    aksi: l.aksi,
    nama_tabel: l.nama_tabel,
    data_id: l.data_id,
    nilai_sebelum: l.nilai_sebelum,
    nilai_sesudah: l.nilai_sesudah,
    dibuat_pada: l.dibuat_pada,
    pelaku: l.pelaku,
  }));

  // 5. Ambil kandidat seluruh karyawan aktif (untuk penunjukan atasan)
  const { data: candidatesData } = await supabase
    .from('profiles')
    .select('id, nik_karyawan, nama_lengkap, jabatan, divisi_id, peran')
    .eq('aktif', true)
    .order('nama_lengkap');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (candidatesData || []).map((c: any) => ({
    id: c.id,
    nik_karyawan: c.nik_karyawan,
    nama_lengkap: c.nama_lengkap,
    jabatan: c.jabatan,
    divisi_id: c.divisi_id,
    peran: c.peran,
  }));

  return (
    <AppLayout profile={profile}>
      <PengaturanClient
        initialDivisions={divisions}
        initialHolidays={holidays}
        initialQuotas={quotas}
        initialAuditLogs={auditLogs}
        candidates={candidates}
        currentYear={currentYear}
      />
    </AppLayout>
  );
}
