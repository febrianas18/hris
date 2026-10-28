import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';
import { notifyHrdFinalLeaveDecision, notifyPemohonLeaveStatus } from '@/utils/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leave/approve
 * Menyetujui pengajuan cuti/izin/sakit:
 * - Tahap 1 oleh Atasan Divisi pemohon (status 'diajukan' -> 'disetujui_atasan')
 * - Tahap 2 (Akhir) oleh HRD (status 'disetujui_atasan' / 'diajukan' -> 'disetujui')
 * Mengikuti aturan BR-09 & BR-12.
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
      .select('id, nama_lengkap, peran, aktif, divisi_id')
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

    // Ambil data pengajuan
    const { data: pengajuan, error: findErr } = await supabase
      .from('pengajuan_cuti')
      .select('*, pemohon:karyawan_id(id, nama_lengkap, divisi_id)')
      .eq('id', pengajuan_id)
      .single();

    if (findErr || !pengajuan) {
      return NextResponse.json(
        { success: false, error: 'Data pengajuan cuti/izin/sakit tidak ditemukan.' },
        { status: 404 }
      );
    }

    // 1. Larangan memutuskan pengajuan sendiri (BR-09)
    if (pengajuan.karyawan_id === user.id) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak boleh menyetujui pengajuan Anda sendiri (Aturan BR-09).' },
        { status: 403 }
      );
    }

    // 2. Persetujuan Tahap 1 oleh Atasan
    if (pengajuan.perlu_atasan && pengajuan.status === 'diajukan') {
      if (profile.peran !== 'atasan') {
        return NextResponse.json(
          {
            success: false,
            error: 'Pengajuan ini memerlukan persetujuan Tahap 1 oleh Atasan divisinya terlebih dahulu. HRD tidak boleh melompati tahap Atasan (Aturan BR-09).',
          },
          { status: 403 }
        );
      }

      // Validasi atasan satu divisi dengan pemohon (BR-09)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pemohonDivisiId = (pengajuan.pemohon as any)?.divisi_id;
      if (profile.divisi_id !== pemohonDivisiId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Akses ditolak. Anda hanya berhak menyetujui pengajuan anggota tim dari divisi Anda sendiri (Aturan BR-09).',
          },
          { status: 403 }
        );
      }

      // Hanya Atasan yang ditunjuk sebagai manajer divisi pemohon (BR-09).
      const { data: divisiPemohon } = await supabase
        .from('divisi')
        .select('manajer_id')
        .eq('id', pemohonDivisiId)
        .maybeSingle();

      if (divisiPemohon?.manajer_id !== user.id) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Akses ditolak. Hanya Atasan yang ditunjuk sebagai manajer divisi pemohon yang berhak menyetujui Tahap 1 (Aturan BR-09).',
          },
          { status: 403 }
        );
      }

      const { data: updated, error: rpcErr } = await supabase.rpc(
        'fn_approve_pengajuan_tahap1',
        {
          p_pengajuan_id: pengajuan_id,
          p_atasan_id: user.id,
        }
      );

      if (rpcErr) {
        return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
      }

      // Notifikasi Email & In-App ke HRD bahwa pengajuan menunggu keputusan akhir (PRD Bab 11)
      try {
        const { data: hrdList } = await supabase
          .from('profiles')
          .select('email')
          .eq('peran', 'hrd')
          .eq('aktif', true);

        const hrdEmails = (hrdList || []).map((h) => h.email).filter(Boolean);
        if (hrdEmails.length > 0) {
          const rawPemohon = pengajuan.pemohon as any;
          const pemohonProfile = Array.isArray(rawPemohon) ? rawPemohon[0] : rawPemohon;
          await notifyHrdFinalLeaveDecision({
            hrdEmails,
            pemohonNama: pemohonProfile?.nama_lengkap || 'Karyawan',
            jenis: pengajuan.jenis,
            tanggalMulai: pengajuan.tanggal_mulai,
            tanggalSelesai: pengajuan.tanggal_selesai,
            jumlahHari: pengajuan.jumlah_hari,
            alasan: pengajuan.alasan,
            disetujuiAtasanOleh: profile.nama_lengkap,
          });
        }
      } catch (emailErr) {
        console.warn('[EMAIL NOTIFICATION HRD DISPATCH FAILED]', emailErr);
      }

      return NextResponse.json({
        success: true,
        message: 'Pengajuan berhasil disetujui (Tahap 1) dan diteruskan ke HRD untuk keputusan akhir.',
        data: updated,
      });
    }

    // 3. Persetujuan Tahap 2 (Akhir) oleh HRD
    if (
      (!pengajuan.perlu_atasan && pengajuan.status === 'diajukan') ||
      (pengajuan.perlu_atasan && pengajuan.status === 'disetujui_atasan')
    ) {
      if (profile.peran !== 'hrd') {
        return NextResponse.json(
          { success: false, error: 'Akses ditolak. Hanya HRD yang berhak memberikan keputusan akhir pengajuan.' },
          { status: 403 }
        );
      }

      const { data: updated, error: rpcErr } = await supabase.rpc(
        'fn_approve_pengajuan_tahap2',
        {
          p_pengajuan_id: pengajuan_id,
          p_hrd_id: user.id,
        }
      );

      if (rpcErr) {
        return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
      }

      // Notifikasi Email & In-App ke Pemohon bahwa pengajuan disetujui HRD (PRD Bab 11)
      try {
        const { data: pemohonProfile } = await supabase
          .from('profiles')
          .select('email, nama_lengkap')
          .eq('id', pengajuan.karyawan_id)
          .maybeSingle();

        if (pemohonProfile?.email) {
          await notifyPemohonLeaveStatus({
            pemohonEmail: pemohonProfile.email,
            pemohonNama: pemohonProfile.nama_lengkap,
            jenis: pengajuan.jenis,
            status: 'disetujui',
            tanggalMulai: pengajuan.tanggal_mulai,
            tanggalSelesai: pengajuan.tanggal_selesai,
            jumlahHari: pengajuan.jumlah_hari,
            diprosesOlehNama: profile.nama_lengkap,
          });
        }
      } catch (emailErr) {
        console.warn('[EMAIL NOTIFICATION PEMOHON DISPATCH FAILED]', emailErr);
      }

      return NextResponse.json({
        success: true,
        message: 'Pengajuan resmi disetujui (Keputusan Akhir HRD).',
        data: updated,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: `Pengajuan dengan status '${pengajuan.status}' tidak dapat diproses untuk persetujuan.`,
      },
      { status: 400 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
