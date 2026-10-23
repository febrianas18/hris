import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';
import { getServerTimeWIB } from '@/utils/time';
import { buildMockTimePayload } from '@/utils/devMock';

export const dynamic = 'force-dynamic';

/**
 * POST /api/attendance/check-out
 * Melakukan check-out mandiri dengan waktu server WIB (BR-02).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(req, supabase);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sesi login tidak valid. Silakan login kembali.' },
        { status: 401 }
      );
    }

    // 1. Cek profil pengguna dan keaktifan (BR-01)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, peran, aktif')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profil karyawan tidak ditemukan.' },
        { status: 404 }
      );
    }

    if (!profile.aktif) {
      return NextResponse.json(
        { success: false, error: 'Akun Anda dinonaktifkan. Silakan hubungi HRD.' },
        { status: 403 }
      );
    }

    // 2. Ambil waktu server zona WIB (Asia/Jakarta)
    const mockTimeHeader =
      process.env.NODE_ENV !== 'production'
        ? req.headers.get('x-mock-server-time')
        : null;
    const serverTime = getServerTimeWIB(mockTimeHeader || undefined);

    // 3. Validasi Aturan BR-02:
    // a. Check-out hanya bisa dilakukan setelah check-in pada hari yang sama
    const { data: existingAttendance, error: findError } = await supabase
      .from('absensi')
      .select('*')
      .eq('karyawan_id', user.id)
      .eq('tanggal', serverTime.dateStr)
      .maybeSingle();

    if (findError) {
      return NextResponse.json(
        { success: false, error: `Gagal membaca data absensi: ${findError.message}` },
        { status: 500 }
      );
    }

    if (!existingAttendance) {
      return NextResponse.json(
        {
          success: false,
          error: 'Check-out gagal. Anda belum melakukan check-in pada hari ini.',
        },
        { status: 400 }
      );
    }

    // b. Cek apakah sudah pernah check-out sebelumnya hari ini
    if (existingAttendance.jam_pulang) {
      const existingOutTime = getServerTimeWIB(existingAttendance.jam_pulang).timeStr.slice(0, 5);
      return NextResponse.json(
        {
          success: false,
          error: `Anda sudah melakukan check-out hari ini pada pukul ${existingOutTime} WIB. Check-out tidak dapat diulang.`,
          data: existingAttendance,
        },
        { status: 400 }
      );
    }

    // c. Pastikan jam pulang lebih besar dari jam masuk
    const jamMasukDate = new Date(existingAttendance.jam_masuk);
    const jamPulangDate = new Date(serverTime.timestamptzStr);

    if (jamPulangDate <= jamMasukDate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Waktu check-out harus lebih besar dari waktu check-in.',
        },
        { status: 400 }
      );
    }

    // 4. Catat check-out lewat RPC server-side (BR-02).
    // Waktu check-out dihitung ulang di database, bukan dari body/request browser.
    const { p_mock_time_str, p_mock_sig } = buildMockTimePayload(mockTimeHeader);
    const { data: updatedAttendance, error: updateError } = await supabase.rpc('fn_check_out', {
      p_mock_time_str,
      p_mock_sig,
    });

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          error: updateError.message,
        },
        { status: updateError.code === 'P0001' ? 400 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Check-out berhasil dicatat pada pukul ${serverTime.timeStr} WIB. Selamat beristirahat!`,
      data: updatedAttendance,
      serverTime,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
