import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payroll/draft
 * Membuat atau memperbarui draf slip gaji oleh HRD (BR-11 & BR-12).
 * Slip pertama kali dibuat dengan status 'draf'.
 * Tercatat di audit_log (slip_dibuat / slip_diubah).
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

    // 1. Validasi peran HRD (BR-11)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, peran, aktif')
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
          error: 'Akses ditolak. Hanya HRD yang berhak membuat atau mengedit draf slip gaji (BR-11).',
        },
        { status: 403 }
      );
    }

    // 2. Baca payload
    const body = await req.json();
    const {
      id,
      karyawan_id,
      periode,
      gaji_pokok,
      tunjangan = 0,
      potongan = 0,
      catatan = '',
    } = body;

    if (!karyawan_id || !periode) {
      return NextResponse.json(
        { success: false, error: 'Parameter karyawan_id dan periode wajib disertakan.' },
        { status: 400 }
      );
    }

    // 3. Validasi tanggal periode (harus tanggal 1)
    const dateObj = new Date(periode);
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Format tanggal periode tidak valid (gunakan YYYY-MM-01).' },
        { status: 400 }
      );
    }

    const dayOfMonth = parseInt(periode.slice(8, 10), 10);
    if (dayOfMonth !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Periode slip gaji harus berupa tanggal 1 pada bulan tersebut (contoh: 2026-10-01).',
        },
        { status: 400 }
      );
    }

    // 4. Validasi angka non-negatif & total_diterima >= 0 (BR-12)
    const gPokok = Number(gaji_pokok);
    const tunj = Number(tunjangan);
    const pot = Number(potongan);

    if (isNaN(gPokok) || gPokok < 0) {
      return NextResponse.json(
        { success: false, error: 'Gaji pokok tidak boleh bernilai negatif.' },
        { status: 400 }
      );
    }

    if (isNaN(tunj) || tunj < 0) {
      return NextResponse.json(
        { success: false, error: 'Tunjangan tidak boleh bernilai negatif.' },
        { status: 400 }
      );
    }

    if (isNaN(pot) || pot < 0) {
      return NextResponse.json(
        { success: false, error: 'Potongan tidak boleh bernilai negatif.' },
        { status: 400 }
      );
    }

    const totalDiterima = gPokok + tunj - pot;
    if (totalDiterima < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Total diterima tidak boleh di bawah 0 (gaji_pokok + tunjangan - potongan >= 0).',
        },
        { status: 400 }
      );
    }

    // 5. Eksekusi Stored Procedure fn_save_draft_slip_gaji
    const { data: savedSlip, error: rpcError } = await supabase.rpc(
      'fn_save_draft_slip_gaji',
      {
        p_slip_id: id || null,
        p_karyawan_id: karyawan_id,
        p_periode: periode,
        p_gaji_pokok: gPokok,
        p_tunjangan: tunj,
        p_potongan: pot,
        p_catatan: catatan || null,
        p_hrd_id: user.id,
      }
    );

    if (rpcError) {
      return NextResponse.json(
        { success: false, error: rpcError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Draf slip gaji berhasil disimpan dan dicatat di audit log.',
      data: savedSlip,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

/**
 * DELETE /api/payroll/draft
 * Menghapus draf slip gaji oleh HRD (hanya jika masih berstatus 'draf').
 */
export async function DELETE(req: NextRequest) {
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
      .select('id, peran, aktif')
      .eq('id', user.id)
      .single();

    if (!profile?.aktif || profile.peran !== 'hrd') {
      return NextResponse.json(
        {
          success: false,
          error: 'Akses ditolak. Hanya HRD yang berhak menghapus draf slip gaji.',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const slipId = searchParams.get('id');

    if (!slipId) {
      return NextResponse.json(
        { success: false, error: 'Parameter id wajib disertakan.' },
        { status: 400 }
      );
    }

    const { error: rpcError } = await supabase.rpc('fn_delete_draft_slip_gaji', {
      p_slip_id: slipId,
      p_hrd_id: user.id,
    });

    if (rpcError) {
      return NextResponse.json(
        { success: false, error: rpcError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Draf slip gaji berhasil dihapus.',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
