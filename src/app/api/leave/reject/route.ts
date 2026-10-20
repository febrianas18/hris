import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leave/reject
 * Menolak pengajuan cuti/izin/sakit:
 * - Wajib menyertakan alasan minimal 10 karakter (BR-09).
 * - Kuota cuti tahunan langsung dikembalikan secara atomik (BR-06).
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
      .select('id, peran, aktif, divisi_id')
      .eq('id', user.id)
      .single();

    if (!profile?.aktif) {
      return NextResponse.json(
        { success: false, error: 'Akun Anda dinonaktifkan. Silakan hubungi HRD.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { pengajuan_id, alasan_penolakan } = body;

    if (!pengajuan_id) {
      return NextResponse.json(
        { success: false, error: 'Parameter pengajuan_id wajib disertakan.' },
        { status: 400 }
      );
    }

    const trimmedAlasan = (alasan_penolakan || '').trim();
    if (trimmedAlasan.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: 'Penolakan pengajuan wajib menyertakan alasan minimal 10 karakter (Aturan BR-09).',
        },
        { status: 400 }
      );
    }

    // Eksekusi fungsi penolakan di PostgreSQL
    const { data: updated, error: rpcErr } = await supabase.rpc(
      'fn_reject_pengajuan',
      {
        p_pengajuan_id: pengajuan_id,
        p_pelaku_id: user.id,
        p_alasan_penolakan: trimmedAlasan,
      }
    );

    if (rpcErr) {
      return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Pengajuan berhasil ditolak dan kuota cuti (jika cuti tahunan) telah dikembalikan.',
      data: updated,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
