import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';
import { getServerTimeWIB } from '@/utils/time';

export const dynamic = 'force-dynamic';

const PROFILE_FIELDS = `
  id,
  nik_karyawan,
  nama_lengkap,
  email,
  nomor_hp,
  peran,
  jabatan,
  status_kerja,
  tanggal_masuk,
  aktif,
  divisi_id,
  divisi:divisi_id (
    id,
    nama
  )
`;

async function getActor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from('profiles')
    .select('id, peran, aktif, divisi_id')
    .eq('id', userId)
    .single();
  return data;
}

/**
 * GET /api/karyawan/[id]
 * Detail karyawan + kuota tahun berjalan + riwayat pengajuan/absensi terbaru.
 * Atasan hanya boleh melihat anggota divisinya; Karyawan hanya dirinya sendiri.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await getAuthUser(req, supabase);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sesi login tidak valid.' },
        { status: 401 }
      );
    }

    const actor = await getActor(supabase, user.id);
    if (!actor?.aktif) {
      return NextResponse.json(
        { success: false, error: 'Akun Anda dinonaktifkan. Silakan hubungi HRD.' },
        { status: 403 }
      );
    }

    const { data: target, error: targetErr } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .eq('id', id)
      .maybeSingle();

    if (targetErr) {
      return NextResponse.json({ success: false, error: targetErr.message }, { status: 400 });
    }
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Karyawan tidak ditemukan atau tidak dapat diakses.' },
        { status: 404 }
      );
    }

    const canView =
      actor.peran === 'hrd' ||
      (actor.peran === 'atasan' && actor.divisi_id === target.divisi_id) ||
      actor.id === target.id;

    if (!canView) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak ke data karyawan ini.' },
        { status: 403 }
      );
    }

    const currentYear = parseInt(getServerTimeWIB().dateStr.slice(0, 4), 10);

    const [{ data: quota }, { data: pengajuan }, { data: absensi }] = await Promise.all([
      supabase
        .from('kuota_cuti')
        .select('id, tahun, jatah_hari, terpakai_hari')
        .eq('karyawan_id', id)
        .eq('tahun', currentYear)
        .maybeSingle(),
      supabase
        .from('pengajuan_cuti')
        .select(
          'id, jenis, tanggal_mulai, tanggal_selesai, jumlah_hari, status, alasan, dibuat_pada'
        )
        .eq('karyawan_id', id)
        .order('dibuat_pada', { ascending: false })
        .limit(10),
      supabase
        .from('absensi')
        .select('id, tanggal, jam_masuk, jam_pulang, status, alasan_koreksi')
        .eq('karyawan_id', id)
        .order('tanggal', { ascending: false })
        .limit(10),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        profile: target,
        quota: quota ?? null,
        pengajuan: pengajuan ?? [],
        absensi: absensi ?? [],
        tahun: currentYear,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/karyawan/[id]
 * HRD mengubah data kepegawaian/peran/divisi/status aktif (BR-01).
 * Email login tidak dapat diubah dari sini.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await getAuthUser(req, supabase);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sesi login tidak valid.' },
        { status: 401 }
      );
    }

    const actor = await getActor(supabase, user.id);
    if (!actor?.aktif || actor.peran !== 'hrd') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Hanya HRD yang berhak mengubah data karyawan (BR-01).' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      nik_karyawan,
      nama_lengkap,
      nomor_hp,
      peran,
      divisi_id,
      jabatan,
      status_kerja,
      tanggal_masuk,
      aktif,
    } = body ?? {};

    if (!nik_karyawan || !nama_lengkap || !peran || !status_kerja || !tanggal_masuk) {
      return NextResponse.json(
        {
          success: false,
          error: 'NIK, nama, peran, status kerja, dan tanggal masuk wajib diisi.',
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('fn_admin_update_karyawan', {
      p_user_id: id,
      p_nik_karyawan: String(nik_karyawan).trim().toUpperCase(),
      p_nama_lengkap: String(nama_lengkap).trim(),
      p_nomor_hp: nomor_hp ? String(nomor_hp).trim() : null,
      p_peran: peran,
      p_divisi_id: divisi_id || null,
      p_jabatan: String(jabatan ?? '').trim(),
      p_status_kerja: status_kerja,
      p_tanggal_masuk: tanggal_masuk,
      p_aktif: aktif !== false,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Data karyawan ${String(nama_lengkap).trim()} berhasil diperbarui.`,
      data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
