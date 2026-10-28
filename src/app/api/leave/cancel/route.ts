import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';
import { notifyPemohonLeaveStatus } from '@/utils/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leave/cancel
 * Membatalkan pengajuan cuti/izin/sakit:
 * - Karyawan pemohon: hanya boleh saat status 'diajukan' atau 'disetujui_atasan' (BR-10).
 * - HRD: boleh membatalkan pengajuan 'disetujui' hanya sebelum tanggal mulai (BR-10).
 * - Kuota cuti tahunan otomatis dikembalikan ke saldo pemohon (BR-06).
 * - Jejak dicatat ke audit_log (BR-12).
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

    const body = await req.json();
    const { pengajuan_id } = body;

    if (!pengajuan_id) {
      return NextResponse.json(
        { success: false, error: 'Parameter pengajuan_id wajib disertakan.' },
        { status: 400 }
      );
    }

    // Ambil data pengajuan sebelum pembatalan
    const { data: pengajuanInfo } = await supabase
      .from('pengajuan_cuti')
      .select('karyawan_id, jenis, tanggal_mulai, tanggal_selesai, jumlah_hari, karyawan:karyawan_id(email, nama_lengkap)')
      .eq('id', pengajuan_id)
      .maybeSingle();

    // Eksekusi fungsi pembatalan di PostgreSQL
    const { data: updated, error: rpcErr } = await supabase.rpc(
      'fn_cancel_pengajuan',
      {
        p_pengajuan_id: pengajuan_id,
        p_pelaku_id: user.id,
      }
    );

    if (rpcErr) {
      return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
    }

    // Notifikasi Email & In-App ke Pemohon jika dibatalkan oleh HRD (PRD Bab 11)
    try {
      const rawPemohon = (pengajuanInfo as any)?.karyawan;
      const pemohon = Array.isArray(rawPemohon) ? rawPemohon[0] : rawPemohon;
      // Hanya kirim notifikasi jika dibatalkan oleh HRD (bukan dibatalkan oleh pemohon sendiri)
      if (profile.peran === 'hrd' && pengajuanInfo?.karyawan_id !== user.id && pemohon?.email && pengajuanInfo) {
        await notifyPemohonLeaveStatus({
          pemohonEmail: pemohon.email,
          pemohonNama: pemohon.nama_lengkap,
          jenis: pengajuanInfo.jenis,
          status: 'dibatalkan',
          tanggalMulai: pengajuanInfo.tanggal_mulai,
          tanggalSelesai: pengajuanInfo.tanggal_selesai,
          jumlahHari: pengajuanInfo.jumlah_hari,
          diprosesOlehNama: profile.nama_lengkap || 'Tim HRD',
        });
      }
    } catch (emailErr) {
      console.warn('[EMAIL NOTIFICATION CANCEL DISPATCH FAILED]', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Pengajuan berhasil dibatalkan dan kuota cuti (jika cuti tahunan) telah dikembalikan.',
      data: updated,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
