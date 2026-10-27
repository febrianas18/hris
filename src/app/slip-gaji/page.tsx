import { getCurrentProfile } from '@/utils/auth';
import { createClient } from '@/utils/supabase/server';
import AppLayout from '@/components/AppLayout';
import SlipGajiClient, {
  EmployeeProfileSummary,
  DivisionItem,
} from './SlipGajiClient';
import { PayslipData } from '@/components/PayslipDocument';
import { getServerTimeWIB } from '@/utils/time';

export const dynamic = 'force-dynamic';

export default async function SlipGajiPage() {
  const { profile } = await getCurrentProfile();
  const supabase = await createClient();
  const serverTime = getServerTimeWIB();

  // Periode default: tanggal 1 pada bulan berjalan server (contoh: '2026-10-01')
  const defaultPeriode = `${serverTime.dateStr.slice(0, 7)}-01`;

  let initialSlips: PayslipData[] = [];
  let employees: EmployeeProfileSummary[] = [];
  let divisions: DivisionItem[] = [];

  if (profile.peran === 'hrd') {
    // Ambil data slip gaji, profil karyawan aktif, dan divisi secara paralel untuk HRD (BR-11)
    const [
      { data: slipsData },
      { data: empData },
      { data: divData },
    ] = await Promise.all([
      supabase
        .from('slip_gaji')
        .select(`
          id,
          nomor_slip,
          karyawan_id,
          periode,
          gaji_pokok,
          tunjangan,
          potongan,
          total_diterima,
          catatan,
          status,
          dibuat_pada,
          diterbitkan_pada,
          diterbitkan_oleh,
          karyawan:karyawan_id (
            id,
            nik_karyawan,
            nama_lengkap,
            email,
            jabatan,
            divisi_id,
            divisi:divisi_id (
              id,
              nama
            )
          ),
          publisher:diterbitkan_oleh (
            id,
            nama_lengkap
          )
        `)
        .order('periode', { ascending: false })
        .order('dibuat_pada', { ascending: false }),
      supabase
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
        .order('nama_lengkap'),
      supabase
        .from('divisi')
        .select('id, nama')
        .order('nama'),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialSlips = (slipsData || []).map((s: any) => ({
      id: s.id,
      nomor_slip: s.nomor_slip,
      periode: s.periode,
      gaji_pokok: Number(s.gaji_pokok),
      tunjangan: Number(s.tunjangan),
      potongan: Number(s.potongan),
      total_diterima: Number(s.total_diterima),
      catatan: s.catatan,
      status: s.status,
      dibuat_pada: s.dibuat_pada,
      diterbitkan_pada: s.diterbitkan_pada,
      diterbitkan_oleh: s.diterbitkan_oleh,
      karyawan: s.karyawan,
      publisher: s.publisher,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    employees = (empData || []).map((e: any) => ({
      id: e.id,
      nik_karyawan: e.nik_karyawan,
      nama_lengkap: e.nama_lengkap,
      jabatan: e.jabatan,
      divisi_id: e.divisi_id,
      divisi: e.divisi,
    }));

    divisions = divData || [];
  } else {
    // 4. Karyawan & Atasan: HANYA berhak melihat slip miliknya sendiri dan berstatus 'terbit' (BR-11)
    // Atasan DILARANG KERAS melihat slip anggota divisinya.
    const { data: slipsData } = await supabase
      .from('slip_gaji')
      .select(`
        id,
        nomor_slip,
        karyawan_id,
        periode,
        gaji_pokok,
        tunjangan,
        potongan,
        total_diterima,
        catatan,
        status,
        dibuat_pada,
        diterbitkan_pada,
        diterbitkan_oleh,
        karyawan:karyawan_id (
          id,
          nik_karyawan,
          nama_lengkap,
          email,
          jabatan,
          divisi_id,
          divisi:divisi_id (
            id,
            nama
          )
        ),
        publisher:diterbitkan_oleh (
          id,
          nama_lengkap
        )
      `)
      .eq('karyawan_id', profile.id)
      .eq('status', 'terbit')
      .order('periode', { ascending: false });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialSlips = (slipsData || []).map((s: any) => ({
      id: s.id,
      nomor_slip: s.nomor_slip,
      periode: s.periode,
      gaji_pokok: Number(s.gaji_pokok),
      tunjangan: Number(s.tunjangan),
      potongan: Number(s.potongan),
      total_diterima: Number(s.total_diterima),
      catatan: s.catatan,
      status: s.status,
      dibuat_pada: s.dibuat_pada,
      diterbitkan_pada: s.diterbitkan_pada,
      diterbitkan_oleh: s.diterbitkan_oleh,
      karyawan: s.karyawan,
      publisher: s.publisher,
    }));
  }

  return (
    <AppLayout profile={profile}>
      <SlipGajiClient
        userRole={profile.peran}
        userId={profile.id}
        userName={profile.nama_lengkap}
        initialSlips={initialSlips}
        employees={employees}
        divisions={divisions}
        defaultPeriode={defaultPeriode}
      />
    </AppLayout>
  );
}
