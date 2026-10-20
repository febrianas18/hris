import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/holiday
 * Tambah atau perbarui data hari libur oleh HRD (Kunci utama: tanggal DATE).
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
      .select('id, peran, aktif')
      .eq('id', user.id)
      .single();

    if (!profile?.aktif || profile.peran !== 'hrd') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Hanya HRD yang berhak mengelola master hari libur.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { tanggal, keterangan, jenis, old_tanggal } = body;

    if (!tanggal || !keterangan || !jenis) {
      return NextResponse.json(
        { success: false, error: 'Parameter tanggal, keterangan, dan jenis wajib diisi.' },
        { status: 400 }
      );
    }

    if (!['nasional', 'cuti_bersama', 'perusahaan'].includes(jenis)) {
      return NextResponse.json(
        { success: false, error: 'Jenis hari libur harus: nasional, cuti_bersama, atau perusahaan.' },
        { status: 400 }
      );
    }

    // Jika old_tanggal diberikan dan berbeda dengan tanggal baru, hapus old_tanggal dulu
    if (old_tanggal && old_tanggal !== tanggal) {
      await supabase.from('hari_libur').delete().eq('tanggal', old_tanggal);
    }

    // Cek apakah tanggal sudah ada
    const { data: existing } = await supabase
      .from('hari_libur')
      .select('*')
      .eq('tanggal', tanggal)
      .maybeSingle();

    const { data: saved, error } = await supabase
      .from('hari_libur')
      .upsert({ tanggal, keterangan, jenis })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    await supabase.from('audit_log').insert({
      pelaku_id: user.id,
      aksi: existing ? 'perubahan_hari_libur' : 'penambahan_hari_libur',
      nama_tabel: 'hari_libur',
      data_id: tanggal,
      nilai_sebelum: existing,
      nilai_sesudah: saved,
    });

    return NextResponse.json({
      success: true,
      message: 'Data hari libur berhasil disimpan.',
      data: saved,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/holiday?tanggal=...
 * Hapus data hari libur oleh HRD.
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
        { success: false, error: 'Akses ditolak. Hanya HRD yang berhak menghapus master hari libur.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const tanggal = searchParams.get('tanggal') || searchParams.get('id');

    if (!tanggal) {
      return NextResponse.json(
        { success: false, error: 'Parameter tanggal wajib disertakan.' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from('hari_libur')
      .select('*')
      .eq('tanggal', tanggal)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Data hari libur tidak ditemukan.' },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from('hari_libur')
      .delete()
      .eq('tanggal', tanggal);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    await supabase.from('audit_log').insert({
      pelaku_id: user.id,
      aksi: 'penghapusan_hari_libur',
      nama_tabel: 'hari_libur',
      data_id: tanggal,
      nilai_sebelum: existing,
      nilai_sesudah: null,
    });

    return NextResponse.json({
      success: true,
      message: `Hari libur tanggal ${tanggal} berhasil dihapus.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
