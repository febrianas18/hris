import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/divisi
 * Menunjuk manajer/atasan divisi oleh HRD (Aturan BR-01):
 * - Setiap divisi dipimpin paling banyak satu Atasan.
 * - Satu Atasan hanya memimpin satu divisi.
 * - Pergantian manajer dilakukan atomik oleh RPC database.
 * - Audit dicatat otomatis oleh trigger audit_log.
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

    // Defense-in-depth: hanya HRD aktif.
    const { data: hrdProfile } = await supabase
      .from('profiles')
      .select('id, peran, aktif')
      .eq('id', user.id)
      .single();

    if (!hrdProfile?.aktif || hrdProfile.peran !== 'hrd') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Akses ditolak. Hanya HRD yang berhak mengubah struktur manajer divisi (BR-01).',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const divisi_id = typeof body?.divisi_id === 'string' ? body.divisi_id : null;
    const manajer_id =
      typeof body?.manajer_id === 'string' && body.manajer_id.length > 0
        ? body.manajer_id
        : null;

    if (!divisi_id) {
      return NextResponse.json(
        { success: false, error: 'Parameter divisi_id wajib disertakan.' },
        { status: 400 }
      );
    }

    const { data: divisi, error: divErr } = await supabase
      .from('divisi')
      .select('id, nama, manajer_id')
      .eq('id', divisi_id)
      .single();

    if (divErr || !divisi) {
      return NextResponse.json(
        { success: false, error: 'Divisi tidak ditemukan.' },
        { status: 404 }
      );
    }

    let candidateName = '';
    if (manajer_id) {
      const { data: candidate } = await supabase
        .from('profiles')
        .select('id, nama_lengkap')
        .eq('id', manajer_id)
        .maybeSingle();

      if (!candidate) {
        return NextResponse.json(
          { success: false, error: 'Karyawan yang dipilih tidak ditemukan.' },
          { status: 404 }
        );
      }
      candidateName = candidate.nama_lengkap;
    }

    const { data: updatedDivisi, error: rpcErr } = await supabase.rpc(
      'fn_admin_assign_divisi_manager',
      {
        p_divisi_id: divisi_id,
        p_manajer_id: manajer_id,
      }
    );

    if (rpcErr) {
      return NextResponse.json(
        { success: false, error: rpcErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: manajer_id
        ? `Berhasil menunjuk ${candidateName} sebagai manajer divisi ${divisi.nama}.`
        : `Manajer divisi ${divisi.nama} berhasil dikosongkan.`,
      data: updatedDivisi,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
