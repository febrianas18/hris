import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';
import { getServerTimeWIB } from '@/utils/time';
import { buildMockTimePayload } from '@/utils/devMock';

export const dynamic = 'force-dynamic';

/**
 * GET /api/attendance/check-in
 * Mengambil status check-in hari ini dan informasi server time WIB.
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

    // Ambil header simulasi waktu hanya jika dalam mode non-production
    const mockTimeHeader =
      process.env.NODE_ENV !== 'production'
        ? req.headers.get('x-mock-server-time')
        : null;
    const serverTime = getServerTimeWIB(mockTimeHeader || undefined);

    // Ambil profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, nik_karyawan, peran, aktif, divisi_id')
      .eq('id', user.id)
      .single();

    if (!profile?.aktif) {
      return NextResponse.json(
        {
          success: false,
          error: 'Akun Anda dinonaktifkan. Silakan hubungi HRD.',
          canCheckIn: false,
          canCheckOut: false,
        },
        { status: 403 }
      );
    }

    // Cek apakah hari ini hari libur
    const { data: holiday } = await supabase
      .from('hari_libur')
      .select('tanggal, keterangan, jenis')
      .eq('tanggal', serverTime.dateStr)
      .maybeSingle();

    // Cek apakah ada cuti/sakit/izin yang sudah disetujui hari ini (BR-02)
    const { data: activeLeave } = await supabase
      .from('pengajuan_cuti')
      .select('id, jenis, tanggal_mulai, tanggal_selesai, status')
      .eq('karyawan_id', user.id)
      .eq('status', 'disetujui')
      .lte('tanggal_mulai', serverTime.dateStr)
      .gte('tanggal_selesai', serverTime.dateStr)
      .maybeSingle();

    // Cek data absensi hari ini
    const { data: attendance } = await supabase
      .from('absensi')
      .select('*')
      .eq('karyawan_id', user.id)
      .eq('tanggal', serverTime.dateStr)
      .maybeSingle();

    // Evaluasi aturan BR-02
    let canCheckIn = true;
    let blockReason: string | null = null;

    if (attendance) {
      canCheckIn = false;
      blockReason = 'Anda sudah melakukan check-in hari ini.';
    } else if (serverTime.isWeekend) {
      canCheckIn = false;
      blockReason = 'Check-in hanya dapat dilakukan pada hari kerja (Senin sampai Jumat).';
    } else if (holiday) {
      canCheckIn = false;
      blockReason = `Hari ini adalah hari libur: ${holiday.keterangan}. Check-in tidak diizinkan.`;
    } else if (activeLeave) {
      canCheckIn = false;
      const jenisText = activeLeave.jenis.replace('_', ' ');
      blockReason = `Anda memiliki pengajuan ${jenisText} yang telah disetujui untuk hari ini.`;
    } else if (!serverTime.isBetween06And12) {
      canCheckIn = false;
      blockReason = 'Check-in hanya dapat dilakukan antara pukul 06.00 dan 12.00 WIB.';
    }

    const canCheckOut = Boolean(attendance && !attendance.jam_pulang);

    return NextResponse.json({
      success: true,
      serverTime,
      attendance,
      holiday: holiday || null,
      activeLeave: activeLeave || null,
      canCheckIn,
      canCheckOut,
      blockReason,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan internal.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

/**
 * POST /api/attendance/check-in
 * Melakukan check-in mandiri dengan waktu server WIB (BR-02 & BR-03).
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

    // 1. Cek profil pengguna dan status keaktifan (BR-01)
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
    // Dilarang mengambil jam lokal dari browser pengguna
    const mockTimeHeader =
      process.env.NODE_ENV !== 'production'
        ? req.headers.get('x-mock-server-time')
        : null;
    const serverTime = getServerTimeWIB(mockTimeHeader || undefined);

    // 3. Validasi Aturan BR-02:
    // a. Hanya hari kerja (Senin s/d Jumat)
    if (serverTime.isWeekend) {
      return NextResponse.json(
        {
          success: false,
          error: `Hari ini adalah hari ${serverTime.weekdayStr}. Check-in hanya dapat dilakukan pada hari kerja (Senin sampai Jumat).`,
        },
        { status: 400 }
      );
    }

    // b. Bukan hari libur di tabel hari_libur
    const { data: holiday } = await supabase
      .from('hari_libur')
      .select('tanggal, keterangan, jenis')
      .eq('tanggal', serverTime.dateStr)
      .maybeSingle();

    if (holiday) {
      return NextResponse.json(
        {
          success: false,
          error: `Hari ini adalah hari libur perusahaan (${holiday.keterangan}). Check-in tidak diizinkan.`,
        },
        { status: 400 }
      );
    }

    // c. Antara pukul 06.00 dan 12.00 WIB
    if (!serverTime.isBetween06And12) {
      return NextResponse.json(
        {
          success: false,
          error: `Check-in hanya dapat dilakukan antara pukul 06.00 dan 12.00 WIB (Waktu server saat ini: ${serverTime.timeStr} WIB).`,
        },
        { status: 400 }
      );
    }

    // d. Check-in ditolak pada hari karyawan sedang cuti, sakit, atau izin yang sudah disetujui
    const { data: activeLeave } = await supabase
      .from('pengajuan_cuti')
      .select('id, jenis, tanggal_mulai, tanggal_selesai, status')
      .eq('karyawan_id', user.id)
      .eq('status', 'disetujui')
      .lte('tanggal_mulai', serverTime.dateStr)
      .gte('tanggal_selesai', serverTime.dateStr)
      .maybeSingle();

    if (activeLeave) {
      const jenisNama =
        activeLeave.jenis === 'cuti_tahunan'
          ? 'Cuti Tahunan'
          : activeLeave.jenis === 'sakit'
          ? 'Sakit'
          : 'Izin';
      return NextResponse.json(
        {
          success: false,
          error: `Check-in ditolak. Anda memiliki pengajuan ${jenisNama} yang telah disetujui untuk hari ini (${serverTime.dateStr}).`,
        },
        { status: 400 }
      );
    }

    // e. Hanya satu kali check-in per hari
    const { data: existingAttendance } = await supabase
      .from('absensi')
      .select('id, tanggal, jam_masuk, jam_pulang, status')
      .eq('karyawan_id', user.id)
      .eq('tanggal', serverTime.dateStr)
      .maybeSingle();

    if (existingAttendance) {
      const existingTime = getServerTimeWIB(existingAttendance.jam_masuk).timeStr.slice(0, 5);
      return NextResponse.json(
        {
          success: false,
          error: `Anda sudah melakukan check-in untuk hari ini pada pukul ${existingTime} WIB.`,
          data: existingAttendance,
        },
        { status: 400 }
      );
    }

    // 4. Catat check-in lewat RPC server-side (BR-02/BR-03).
    // Tanggal, jam, dan status dihitung ulang di database sehingga tidak bisa
    // dipalsukan lewat request langsung ke REST API.
    const { p_mock_time_str, p_mock_sig } = buildMockTimePayload(mockTimeHeader);
    const { data: newAttendance, error: insertError } = await supabase.rpc('fn_check_in', {
      p_mock_time_str,
      p_mock_sig,
    });

    if (insertError) {
      // Tangani potensi unique constraint violation jika race condition
      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Anda sudah melakukan check-in untuk hari ini.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: insertError.code === 'P0001' ? 400 : 500 }
      );
    }

    const finalStatus = (newAttendance as { status?: string } | null)?.status;

    return NextResponse.json(
      {
        success: true,
        message: `Check-in berhasil tercatat pukul ${serverTime.timeStr} WIB dengan status ${
          finalStatus === 'terlambat' ? 'Terlambat' : 'Hadir (Tepat Waktu)'
        }.`,
        data: newAttendance,
        serverTime,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
