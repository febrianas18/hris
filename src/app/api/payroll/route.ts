import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payroll
 * Mengambil daftar slip gaji sesuai peran pengguna (BR-11):
 * - HRD: Dapat melihat semua slip gaji karyawan (draf & terbit) dengan opsi filter periode & divisi.
 * - Karyawan & Atasan: HANYA berhak melihat slip gaji miliknya sendiri yang sudah berstatus 'terbit'.
 *   Atasan DILARANG KERAS melihat slip gaji anggota divisinya.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(req, supabase);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sesi login tidak valid.' },
        { status: 401 }
      );
    }

    // 1. Ambil profil pengguna pemohon
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, peran, aktif, divisi_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.aktif === false) {
      return NextResponse.json(
        { success: false, error: 'Akun Anda dinonaktifkan. Silakan hubungi HRD.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const periodeFilter = searchParams.get('periode'); // e.g. '2026-10-01'
    const karyawanIdFilter = searchParams.get('karyawan_id');

    // 2. Jika HRD: Akses penuh ke seluruh slip karyawan (BR-11)
    if (profile.peran === 'hrd') {
      let query = supabase
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
          dibuat_oleh,
          diterbitkan_oleh,
          profiles:karyawan_id (
            id,
            nik_karyawan,
            nama_lengkap,
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
        .order('dibuat_pada', { ascending: false });

      if (periodeFilter) {
        query = query.eq('periode', periodeFilter);
      }

      if (karyawanIdFilter) {
        query = query.eq('karyawan_id', karyawanIdFilter);
      }

      const { data: slips, error } = await query;

      if (error) {
        return NextResponse.json(
          { success: false, error: `Gagal memuat data slip gaji: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: slips,
        isHrd: true,
      });
    }

    // 3. Jika Karyawan atau Atasan:
    // WAJIB TERBATAS HANYA PADA DIRI SENDIRI DAN STATUS 'terbit' (BR-11)
    // Atasan DILARANG KERAS melihat slip bawahan/anggota divisinya.
    let query = supabase
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
        profiles:karyawan_id (
          id,
          nik_karyawan,
          nama_lengkap,
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
      .eq('karyawan_id', user.id) // Hanya miliknya sendiri
      .eq('status', 'terbit') // Karyawan tidak boleh melihat slip yang masih 'draf'
      .order('periode', { ascending: false });

    if (periodeFilter) {
      query = query.eq('periode', periodeFilter);
    }

    const { data: slips, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: `Gagal memuat slip gaji: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: slips,
      isHrd: false,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
