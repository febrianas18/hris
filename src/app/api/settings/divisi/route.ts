import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/divisi
 * Menunjuk manajer/atasan divisi oleh HRD (Aturan BR-01):
 * - Setiap divisi dipimpin paling banyak satu Atasan.
 * - Satu Atasan hanya memimpin satu divisi.
 * - Dicatat ke audit_log.
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

    // 1. Validasi peran HRD (BR-01)
    const { data: hrdProfile } = await supabase
      .from('profiles')
      .select('id, peran, aktif')
      .eq('id', user.id)
      .single();

    if (!hrdProfile?.aktif || hrdProfile.peran !== 'hrd') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Hanya HRD yang berhak mengubah struktur manajer divisi (BR-01).' },
        { status: 403 }
      );
    }

    // 2. Baca payload
    const body = await req.json();
    const { divisi_id, manajer_id } = body;

    if (!divisi_id) {
      return NextResponse.json(
        { success: false, error: 'Parameter divisi_id wajib disertakan.' },
        { status: 400 }
      );
    }

    // 3. Ambil data divisi saat ini
    const { data: currentDivisi, error: divErr } = await supabase
      .from('divisi')
      .select('id, nama, manajer_id')
      .eq('id', divisi_id)
      .single();

    if (divErr || !currentDivisi) {
      return NextResponse.json(
        { success: false, error: 'Divisi tidak ditemukan.' },
        { status: 404 }
      );
    }

    // 4. Jika manajer_id diisi (bukan null): Validasi aturan BR-01
    let candidateName = '';
    if (manajer_id) {
      // Pastikan calon manajer aktif
      const { data: candidate, error: candErr } = await supabase
        .from('profiles')
        .select('id, nama_lengkap, peran, aktif, divisi_id')
        .eq('id', manajer_id)
        .single();

      if (candErr || !candidate) {
        return NextResponse.json(
          { success: false, error: 'Karyawan yang dipilih tidak ditemukan.' },
          { status: 404 }
        );
      }

      if (!candidate.aktif) {
        return NextResponse.json(
          { success: false, error: 'Karyawan nonaktif tidak dapat ditunjuk sebagai manajer divisi.' },
          { status: 400 }
        );
      }

      candidateName = candidate.nama_lengkap;

      // BR-01: Satu Atasan hanya memimpin satu divisi!
      const { data: otherDivisi } = await supabase
        .from('divisi')
        .select('id, nama')
        .eq('manajer_id', manajer_id)
        .neq('id', divisi_id)
        .maybeSingle();

      if (otherDivisi) {
        return NextResponse.json(
          {
            success: false,
            error: `Karyawan ${candidate.nama_lengkap} sudah menjadi manajer di divisi ${otherDivisi.nama}. Satu Atasan hanya boleh memimpin tepat satu divisi (Aturan BR-01).`,
          },
          { status: 400 }
        );
      }

      // Pastikan karyawan tersebut berada di divisi yang dipimpin dan memiliki peran 'atasan' jika sebelumnya 'karyawan'
      if (candidate.peran === 'karyawan') {
        await supabase
          .from('profiles')
          .update({ peran: 'atasan', divisi_id: divisi_id })
          .eq('id', manajer_id);
      } else if (candidate.divisi_id !== divisi_id) {
        await supabase
          .from('profiles')
          .update({ divisi_id: divisi_id })
          .eq('id', manajer_id);
      }
    }

    // 5. Update divisi
    const { data: updatedDivisi, error: updateErr } = await supabase
      .from('divisi')
      .update({ manajer_id: manajer_id || null })
      .eq('id', divisi_id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: `Gagal memperbarui manajer divisi: ${updateErr.message}` },
        { status: 500 }
      );
    }

    // 6. Catat ke audit_log (BR-12)
    await supabase.from('audit_log').insert({
      pelaku_id: user.id,
      aksi: 'perubahan_manajer_divisi',
      nama_tabel: 'divisi',
      data_id: divisi_id,
      nilai_sebelum: { manajer_id: currentDivisi.manajer_id, nama_divisi: currentDivisi.nama },
      nilai_sesudah: { manajer_id: updatedDivisi.manajer_id, nama_divisi: updatedDivisi.nama },
    });

    return NextResponse.json({
      success: true,
      message: manajer_id
        ? `Berhasil menunjuk ${candidateName} sebagai manajer divisi ${currentDivisi.nama}.`
        : `Manajer divisi ${currentDivisi.nama} berhasil dikosongkan.`,
      data: updatedDivisi,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
