import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';
import { getServerTimeWIB } from '@/utils/time';
import { calculateWorkingDaysWithDB } from '@/utils/workingDays';

export const dynamic = 'force-dynamic';

/**
 * Menghitung selisih bulan penuh antara dua tanggal
 */
function calculateTenureMonths(tanggalMasukStr: string, tanggalMulaiStr: string): number {
  const [yM, mM, dM] = tanggalMasukStr.split('-').map(Number);
  const [yL, mL, dL] = tanggalMulaiStr.split('-').map(Number);

  let months = (yL - yM) * 12 + (mL - mM);
  if (dL < dM) {
    months -= 1;
  }
  return months;
}

/**
 * POST /api/leave/request
 * Mengajukan Cuti Tahunan, Izin, atau Sakit (BR-04, BR-05, BR-06, BR-07, BR-08, BR-09).
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

    // 1. Ambil profil pemohon
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, peran, aktif, tanggal_masuk, divisi_id')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
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

    const body = await req.json();
    const { jenis, tanggal_mulai, tanggal_selesai, alasan, lampiran_path } = body;

    // 2. Validasi input dasar
    if (!jenis || !['cuti_tahunan', 'izin', 'sakit'].includes(jenis)) {
      return NextResponse.json(
        { success: false, error: 'Jenis pengajuan tidak valid. Pilih: cuti_tahunan, izin, atau sakit.' },
        { status: 400 }
      );
    }

    if (!tanggal_mulai || !tanggal_selesai) {
      return NextResponse.json(
        { success: false, error: 'Tanggal mulai dan tanggal selesai wajib diisi.' },
        { status: 400 }
      );
    }

    const trimmedAlasan = (alasan || '').trim();
    if (trimmedAlasan.length < 5) {
      return NextResponse.json(
        { success: false, error: 'Alasan pengajuan wajib diisi minimal 5 karakter.' },
        { status: 400 }
      );
    }

    // 3. Waktu Server WIB
    const mockTimeHeader =
      process.env.NODE_ENV !== 'production'
        ? req.headers.get('x-mock-server-time')
        : null;
    const serverTime = getServerTimeWIB(mockTimeHeader || undefined);

    // 4. Hitung Hari Kerja (BR-05)
    const workingDaysResult = await calculateWorkingDaysWithDB(supabase, tanggal_mulai, tanggal_selesai);
    if (!workingDaysResult.isValid) {
      return NextResponse.json(
        { success: false, error: workingDaysResult.error },
        { status: 400 }
      );
    }
    const jumlahHari = workingDaysResult.workingDays;

    // 5. Validasi Aturan Khusus Tiap Jenis Pengajuan:
    // a. Cuti Tahunan (BR-04 & BR-05)
    if (jenis === 'cuti_tahunan') {
      // Masa kerja minimal 12 bulan sejak tanggal_masuk (BR-04)
      const tenureMonths = calculateTenureMonths(profile.tanggal_masuk, tanggal_mulai);
      if (tenureMonths < 12) {
        return NextResponse.json(
          {
            success: false,
            error: `Cuti tahunan baru boleh diambil setelah masa kerja genap 12 bulan sejak tanggal masuk (${profile.tanggal_masuk}). Masa kerja Anda saat tanggal mulai cuti adalah ${tenureMonths} bulan. Aturan BR-04.`,
          },
          { status: 400 }
        );
      }

      // Batas waktu pengajuan: paling lambat H-3 kalender (BR-05)
      const [sY, sM, sD] = serverTime.dateStr.split('-').map(Number);
      const [lY, lM, lD] = tanggal_mulai.split('-').map(Number);
      const serverDayUtc = Date.UTC(sY, sM - 1, sD);
      const leaveDayUtc = Date.UTC(lY, lM - 1, lD);
      const diffCalendarDays = Math.round((leaveDayUtc - serverDayUtc) / (24 * 3600 * 1000));

      if (diffCalendarDays < 3) {
        return NextResponse.json(
          {
            success: false,
            error: `Pengajuan cuti tahunan harus dilakukan paling lambat 3 hari kalender sebelum tanggal mulai (H-3). Tanggal server saat ini: ${serverTime.dateStr}. Aturan BR-05.`,
          },
          { status: 400 }
        );
      }
    }

    // b. Izin (BR-05 & BR-08)
    if (jenis === 'izin') {
      // Maksimal 2 hari kerja (BR-08)
      if (jumlahHari > 2) {
        return NextResponse.json(
          {
            success: false,
            error: `Pengajuan izin maksimal 2 hari kerja per pengajuan (pengajuan ini memuat ${jumlahHari} hari kerja). Aturan BR-08.`,
          },
          { status: 400 }
        );
      }

      // Batas waktu pengajuan: paling lambat H-1 kalender (BR-05)
      const [sY, sM, sD] = serverTime.dateStr.split('-').map(Number);
      const [lY, lM, lD] = tanggal_mulai.split('-').map(Number);
      const diffCalendarDays = Math.round((Date.UTC(lY, lM - 1, lD) - Date.UTC(sY, sM - 1, sD)) / (24 * 3600 * 1000));

      if (diffCalendarDays < 1) {
        return NextResponse.json(
          {
            success: false,
            error: `Pengajuan izin harus dilakukan paling lambat H-1 kalender sebelum tanggal mulai. Tanggal server saat ini: ${serverTime.dateStr}. Aturan BR-05.`,
          },
          { status: 400 }
        );
      }
    }

    // c. Sakit (BR-05 & BR-08)
    if (jenis === 'sakit') {
      // Batas waktu: Hari H s/d H+3 kalender setelah mulai sakit (BR-05)
      const [sY, sM, sD] = serverTime.dateStr.split('-').map(Number);
      const [lY, lM, lD] = tanggal_mulai.split('-').map(Number);
      const diffCalendarDays = Math.round((Date.UTC(lY, lM - 1, lD) - Date.UTC(sY, sM - 1, sD)) / (24 * 3600 * 1000));

      // diffCalendarDays < -3 artinya server sudah melewati 3 hari setelah tanggal_mulai
      if (diffCalendarDays < -3) {
        return NextResponse.json(
          {
            success: false,
            error: `Pengajuan sakit harus dilakukan pada hari mulai sakit sampai paling lambat 3 hari kalender setelahnya (H+3). Tanggal server: ${serverTime.dateStr}. Aturan BR-05.`,
          },
          { status: 400 }
        );
      }

      // Sakit > 1 hari kerja wajib melampirkan surat dokter (BR-08)
      if (jumlahHari > 1 && (!lampiran_path || lampiran_path.trim() === '')) {
        return NextResponse.json(
          {
            success: false,
            error: `Pengajuan sakit lebih dari 1 hari kerja (${jumlahHari} hari) wajib melampirkan surat dokter. Aturan BR-08.`,
          },
          { status: 400 }
        );
      }
    }

    // 6. Validasi Bentrok (BR-07)
    // a. Cek apakah beririsan dengan pengajuan aktif lain
    const { data: overlappingLeaves, error: overlapErr } = await supabase
      .from('pengajuan_cuti')
      .select('id, jenis, tanggal_mulai, tanggal_selesai, status')
      .eq('karyawan_id', user.id)
      .in('status', ['diajukan', 'disetujui_atasan', 'disetujui'])
      .lte('tanggal_mulai', tanggal_selesai)
      .gte('tanggal_selesai', tanggal_mulai);

    if (overlapErr) {
      return NextResponse.json(
        { success: false, error: `Gagal memeriksa bentrok pengajuan: ${overlapErr.message}` },
        { status: 500 }
      );
    }

    if (overlappingLeaves && overlappingLeaves.length > 0) {
      const bentrok = overlappingLeaves[0];
      return NextResponse.json(
        {
          success: false,
          error: `Tanggal pengajuan beririsan dengan pengajuan ${bentrok.jenis.replace('_', ' ')} Anda yang lain yang masih aktif (${bentrok.tanggal_mulai} s/d ${bentrok.tanggal_selesai}, status: ${bentrok.status}). Aturan BR-07.`,
        },
        { status: 400 }
      );
    }

    // b. Cek apakah sudah ada rekaman absensi pada rentang tanggal tersebut
    const { data: overlappingAttendance, error: attErr } = await supabase
      .from('absensi')
      .select('tanggal, jam_masuk')
      .eq('karyawan_id', user.id)
      .gte('tanggal', tanggal_mulai)
      .lte('tanggal', tanggal_selesai);

    if (attErr) {
      return NextResponse.json(
        { success: false, error: `Gagal memeriksa rekaman absensi: ${attErr.message}` },
        { status: 500 }
      );
    }

    if (overlappingAttendance && overlappingAttendance.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Pengajuan ditolak karena sudah terdapat rekaman absensi Anda pada tanggal ${overlappingAttendance[0].tanggal} dalam rentang pengajuan tersebut (Aturan BR-07).`,
        },
        { status: 400 }
      );
    }

    // 7. Penentuan Alur Persetujuan (BR-09)
    // Pemohon adalah Atasan atau HRD -> Tahap 1 dilewati, perlu_atasan = false
    let perluAtasan = true;
    if (profile.peran === 'atasan' || profile.peran === 'hrd') {
      perluAtasan = false;
    } else {
      // Jika pemohon karyawan biasa, cek apakah divisinya memiliki Atasan aktif
      if (profile.divisi_id) {
        const { count: atasanCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('divisi_id', profile.divisi_id)
          .eq('peran', 'atasan')
          .eq('aktif', true);

        if (!atasanCount || atasanCount === 0) {
          perluAtasan = false; // Divisi tidak punya Atasan -> langsung ke HRD (BR-09)
        }
      } else {
        perluAtasan = false;
      }
    }

    // 8. Eksekusi Stored Function Atomik (BR-06)
    // Menjamin row-level lock (FOR UPDATE) pada kuota_cuti sehingga bebas dari race condition
    const { data: newPengajuan, error: submitErr } = await supabase.rpc(
      'fn_submit_pengajuan',
      {
        p_karyawan_id: user.id,
        p_jenis: jenis,
        p_tanggal_mulai: tanggal_mulai,
        p_tanggal_selesai: tanggal_selesai,
        p_jumlah_hari: jumlahHari,
        p_alasan: trimmedAlasan,
        p_lampiran_path: lampiran_path || null,
        p_perlu_atasan: perluAtasan,
      }
    );

    if (submitErr) {
      return NextResponse.json(
        { success: false, error: submitErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Pengajuan ${jenis.replace('_', ' ')} sebanyak ${jumlahHari} hari kerja berhasil dikirim.`,
        data: newPengajuan,
        workingDaysResult,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
