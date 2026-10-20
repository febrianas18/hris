import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/quota
 * Menetapkan jatah cuti tahunan karyawan (0 - 12 hari) oleh HRD (Aturan BR-04 & BR-12).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(req, supabase);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sesi login tidak valid.' },
        { status: 401 }
      );
    }

    // 1. Validasi HRD
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, peran, aktif')
      .eq('id', user.id)
      .single();

    if (!profile?.aktif || profile.peran !== 'hrd') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Hanya HRD yang berhak menetapkan jatah cuti karyawan (BR-04).' },
        { status: 403 }
      );
    }

    // 2. Baca payload
    const body = await req.json();
    const { karyawan_id, tahun, jatah_hari } = body;

    if (!karyawan_id || !tahun || jatah_hari === undefined) {
      return NextResponse.json(
        { success: false, error: 'Parameter karyawan_id, tahun, dan jatah_hari wajib disertakan.' },
        { status: 400 }
      );
    }

    const jatahNum = parseInt(jatah_hari, 10);
    if (isNaN(jatahNum) || jatahNum < 0 || jatahNum > 12) {
      return NextResponse.json(
        { success: false, error: 'Jatah cuti tahunan harus berupa bilangan bulat antara 0 hingga 12 hari (Aturan BR-04).' },
        { status: 400 }
      );
    }

    // 3. Cek data kuota sebelum update
    const { data: existingQuota } = await supabase
      .from('kuota_cuti')
      .select('*, profiles:karyawan_id(nama_lengkap, nik_karyawan)')
      .eq('karyawan_id', karyawan_id)
      .eq('tahun', tahun)
      .maybeSingle();

    let updatedQuota;
    if (existingQuota) {
      const { data, error } = await supabase
        .from('kuota_cuti')
        .update({ jatah_hari: jatahNum })
        .eq('id', existingQuota.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      updatedQuota = data;

      // Catat ke audit_log
      await supabase.from('audit_log').insert({
        pelaku_id: user.id,
        aksi: 'perubahan_jatah_cuti',
        nama_tabel: 'kuota_cuti',
        data_id: existingQuota.id,
        nilai_sebelum: { jatah_hari: existingQuota.jatah_hari, terpakai_hari: existingQuota.terpakai_hari },
        nilai_sesudah: { jatah_hari: updatedQuota.jatah_hari, terpakai_hari: updatedQuota.terpakai_hari },
      });
    } else {
      const { data, error } = await supabase
        .from('kuota_cuti')
        .insert({
          karyawan_id,
          tahun,
          jatah_hari: jatahNum,
          terpakai_hari: 0,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      updatedQuota = data;

      // Catat ke audit_log
      await supabase.from('audit_log').insert({
        pelaku_id: user.id,
        aksi: 'penetapan_jatah_cuti_baru',
        nama_tabel: 'kuota_cuti',
        data_id: updatedQuota.id,
        nilai_sebelum: null,
        nilai_sesudah: updatedQuota,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Jatah cuti tahunan berhasil ditetapkan menjadi ${jatahNum} hari.`,
      data: updatedQuota,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
