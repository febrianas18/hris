import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payroll/[id]
 * Mengambil detail satu slip gaji dengan proteksi ketat BR-11:
 * - Karyawan dan Atasan HANYA berhak melihat slip miliknya sendiri dan sudah berstatus 'terbit'.
 * - Atasan DILARANG KERAS melihat slip anggota divisinya.
 * - HRD berhak melihat semua slip (draf maupun terbit).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await getAuthUser(req, supabase);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sesi login tidak valid.' },
        { status: 401 }
      );
    }

    // 1. Ambil profil pengguna
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, peran, aktif')
      .eq('id', user.id)
      .single();

    if (!profile || profile.aktif === false) {
      return NextResponse.json(
        { success: false, error: 'Akun Anda dinonaktifkan. Silakan hubungi HRD.' },
        { status: 403 }
      );
    }

    // 2. Ambil data slip gaji beserta relasi
    const { data: slip, error } = await supabase
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
        karyawan:karyawan_id (
          id,
          nik_karyawan,
          nama_lengkap,
          email,
          jabatan,
          status_kerja,
          tanggal_masuk,
          divisi_id,
          divisi:divisi_id (
            id,
            nama
          )
        ),
        publisher:diterbitkan_oleh (
          id,
          nama_lengkap,
          jabatan
        ),
        creator:dibuat_oleh (
          id,
          nama_lengkap
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !slip) {
      return NextResponse.json(
        { success: false, error: 'Slip gaji tidak ditemukan.' },
        { status: 404 }
      );
    }

    // 3. Validasi Hak Akses (BR-11)
    if (profile.peran !== 'hrd') {
      // Bukan HRD -> Wajib miliknya sendiri dan berstatus 'terbit'
      if (slip.karyawan_id !== user.id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Akses ditolak. Atasan dan Karyawan dilarang melihat slip gaji orang lain (Aturan BR-11).',
          },
          { status: 403 }
        );
      }

      if (slip.status !== 'terbit') {
        return NextResponse.json(
          {
            success: false,
            error: 'Akses ditolak. Slip gaji yang masih berstatus draf belum dapat dilihat oleh karyawan (Aturan BR-11).',
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: slip,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
