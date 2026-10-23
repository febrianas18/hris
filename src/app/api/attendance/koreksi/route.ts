import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/attendance/koreksi
 * Koreksi data absensi oleh HRD (BR-03 & BR-12).
 * Wajib menyertakan alasan koreksi minimal 10 karakter dan dicatat ke audit_log.
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

    // 1. Validasi peran HRD (BR-03)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, peran, aktif')
      .eq('id', user.id)
      .single();

    if (!profile?.aktif) {
      return NextResponse.json(
        { success: false, error: 'Akun Anda dinonaktifkan. Silakan hubungi HRD.' },
        { status: 403 }
      );
    }

    if (profile.peran !== 'hrd') {
      return NextResponse.json(
        {
          success: false,
          error: 'Akses ditolak. Hanya HRD yang berhak melakukan koreksi absensi (BR-03).',
        },
        { status: 403 }
      );
    }

    // 2. Baca body payload
    const body = await req.json();
    const { absensi_id, jam_masuk, jam_pulang, status, alasan_koreksi } = body;

    if (!absensi_id) {
      return NextResponse.json(
        { success: false, error: 'Parameter absensi_id wajib disertakan.' },
        { status: 400 }
      );
    }

    // 3. Validasi alasan koreksi (minimal 10 karakter - BR-03)
    const alasanTrimmed = (alasan_koreksi || '').trim();
    if (!alasanTrimmed || alasanTrimmed.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: 'Alasan koreksi wajib diisi minimal 10 karakter (Aturan BR-03).',
        },
        { status: 400 }
      );
    }

    // 4. Cek record absensi sebelum perubahan
    const { data: existingAttendance, error: findError } = await supabase
      .from('absensi')
      .select('*, profiles:karyawan_id(nama_lengkap, nik_karyawan)')
      .eq('id', absensi_id)
      .single();

    if (findError || !existingAttendance) {
      return NextResponse.json(
        { success: false, error: 'Data absensi tidak ditemukan.' },
        { status: 404 }
      );
    }

    // 5. Validasi jam pulang setelah jam masuk jika jam_pulang terisi
    const finalJamMasuk = jam_masuk || existingAttendance.jam_masuk;
    const finalJamPulang = jam_pulang !== undefined ? jam_pulang : existingAttendance.jam_pulang;

    if (finalJamPulang && new Date(finalJamPulang) <= new Date(finalJamMasuk)) {
      return NextResponse.json(
        { success: false, error: 'Jam pulang harus lebih besar dari jam masuk.' },
        { status: 400 }
      );
    }

    // 6. Update record absensi dengan tanda koreksi
    const updatePayload: Record<string, unknown> = {
      dikoreksi_oleh: user.id,
      alasan_koreksi: alasanTrimmed,
    };

    if (jam_masuk) updatePayload.jam_masuk = jam_masuk;
    if (jam_pulang !== undefined) updatePayload.jam_pulang = jam_pulang || null;
    if (status && (status === 'hadir' || status === 'terlambat')) {
      updatePayload.status = status;
    }

    const { data: updatedAttendance, error: updateError } = await supabase
      .from('absensi')
      .update(updatePayload)
      .eq('id', absensi_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Gagal memperbarui data absensi: ${updateError.message}` },
        { status: 500 }
      );
    }

    // 7. Audit dicatat otomatis oleh trigger audit_log (BR-12).
    return NextResponse.json({
      success: true,
      message: 'Data absensi berhasil dikoreksi dan tercatat di audit log.',
      data: updatedAttendance,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
