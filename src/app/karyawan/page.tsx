import { getCurrentProfile } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import AppLayout from '@/components/AppLayout';
import KaryawanClient, {
  EmployeeItem,
  DivisiOption,
} from './KaryawanClient';
import { getServerTimeWIB } from '@/utils/time';

export const dynamic = 'force-dynamic';

export default async function DataKaryawanPage() {
  const { profile } = await getCurrentProfile();

  // Defense-in-depth authorization check (Atasan & HRD only)
  if (profile.peran === 'karyawan') {
    redirect('/dashboard?forbidden=1&target=/karyawan');
  }

  const supabase = await createClient();
  const currentYear = parseInt(getServerTimeWIB().dateStr.slice(0, 4), 10);

  // Ambil data divisi, seluruh data profil karyawan, dan kuota cuti secara paralel
  const [
    { data: rawDivisions },
    { data: rawProfiles, error: profileErr },
    { data: rawQuotas },
  ] = await Promise.all([
    supabase
      .from('divisi')
      .select(
        `
        id,
        nama,
        manajer_id,
        manajer:manajer_id (
          id,
          nama_lengkap
        )
      `
      )
      .order('nama', { ascending: true }),
    supabase
      .from('profiles')
      .select(
        `
        id,
        nik_karyawan,
        nama_lengkap,
        email,
        nomor_hp,
        peran,
        jabatan,
        status_kerja,
        tanggal_masuk,
        aktif,
        divisi_id,
        divisi:divisi_id (
          id,
          nama
        )
      `
      )
      .order('nama_lengkap', { ascending: true }),
    supabase
      .from('kuota_cuti')
      .select('karyawan_id, tahun, jatah_hari, terpakai_hari')
      .eq('tahun', currentYear),
  ]);

  if (profileErr) {
    throw new Error(`Gagal memuat data karyawan: ${profileErr.message}`);
  }

  type DivisiRow = {
    id: string;
    nama: string;
    manajer_id: string | null;
    manajer:
      | { id: string; nama_lengkap: string }
      | Array<{ id: string; nama_lengkap: string }>
      | null;
  };

  const divisions: DivisiOption[] = ((rawDivisions ?? []) as unknown as DivisiRow[]).map(
    (d) => ({
      id: d.id,
      nama: d.nama,
      manajer_id: d.manajer_id,
      manajer_nama:
        (Array.isArray(d.manajer)
          ? d.manajer[0]?.nama_lengkap
          : d.manajer?.nama_lengkap) ?? null,
    })
  );

  type ProfileRow = {
    id: string;
    nik_karyawan: string;
    nama_lengkap: string;
    email: string;
    nomor_hp: string | null;
    peran: 'karyawan' | 'atasan' | 'hrd';
    jabatan: string;
    status_kerja: string;
    tanggal_masuk: string;
    aktif: boolean;
    divisi_id: string | null;
    divisi:
      | { id: string; nama: string }
      | Array<{ id: string; nama: string }>
      | null;
  };

  const quotaByEmployee = new Map(
    (rawQuotas ?? []).map((q) => [
      q.karyawan_id,
      { jatah_hari: q.jatah_hari, terpakai_hari: q.terpakai_hari },
    ])
  );

  const employees: EmployeeItem[] = ((rawProfiles ?? []) as unknown as ProfileRow[]).map((p) => {
    const divisi = Array.isArray(p.divisi) ? p.divisi[0] : p.divisi;
    return {
      id: p.id,
      nik_karyawan: p.nik_karyawan,
      nama_lengkap: p.nama_lengkap,
      email: p.email,
      nomor_hp: p.nomor_hp,
      peran: p.peran,
      jabatan: p.jabatan,
      status_kerja: p.status_kerja,
      tanggal_masuk: p.tanggal_masuk,
      aktif: p.aktif,
      divisi_id: p.divisi_id,
      divisi: divisi ? { id: divisi.id, nama: divisi.nama } : null,
      kuota: quotaByEmployee.get(p.id) ?? null,
    };
  });

  // 3. Saran NIK berikutnya (KLN-0000).
  let maxNik = 0;
  for (const e of employees) {
    const match = /^KLN-(\d{4})$/.exec(e.nik_karyawan);
    if (match) maxNik = Math.max(maxNik, Number(match[1]));
  }
  const nextNik = `KLN-${String(maxNik + 1).padStart(4, '0')}`;

  return (
    <AppLayout profile={profile}>
      <KaryawanClient
        initialEmployees={employees}
        divisions={divisions}
        currentUserId={profile.id}
        currentUserRole={profile.peran}
        currentYear={currentYear}
        nextNik={nextNik}
      />
    </AppLayout>
  );
}
