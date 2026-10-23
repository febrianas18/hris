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

async function requireActiveProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, peran, aktif, divisi_id')
    .eq('id', userId)
    .single();

  return profile;
}

/**
 * GET /api/karyawan
 * Daftar karyawan. HRD melihat semua; Atasan hanya melihat anggota divisinya
 * (difilter juga oleh RLS profiles_select_policy).
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

    const profile = await requireActiveProfile(supabase, user.id);
    if (!profile?.aktif) {
      return NextResponse.json(
        { success: false, error: 'Akun Anda dinonaktifkan. Silakan hubungi HRD.' },
        { status: 403 }
      );
    }

    if (profile.peran === 'karyawan') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Halaman data karyawan hanya untuk Atasan dan HRD.' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .order('nama_lengkap', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/karyawan
 * HRD membuat akun login + profil + kuota cuti secara atomik (BR-01).
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

    const profile = await requireActiveProfile(supabase, user.id);
    if (!profile?.aktif || profile.peran !== 'hrd') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Hanya HRD yang berhak membuat akun karyawan (BR-01).' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      email,
      password,
      nik_karyawan,
      nama_lengkap,
      nomor_hp,
      peran,
      divisi_id,
      jabatan,
      status_kerja,
      tanggal_masuk,
      aktif,
      tahun,
      jatah_hari,
    } = body ?? {};

    if (!email || !password || !nik_karyawan || !nama_lengkap || !peran || !divisi_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email, kata sandi, NIK, nama, peran, dan divisi wajib diisi.',
        },
        { status: 400 }
      );
    }

    if (!['karyawan', 'atasan', 'hrd'].includes(peran)) {
      return NextResponse.json(
        { success: false, error: 'Peran tidak valid.' },
        { status: 400 }
      );
    }

    const currentYear = parseInt(getServerTimeWIB().dateStr.slice(0, 4), 10);
    const jatah = jatah_hari === undefined || jatah_hari === null ? 12 : Number(jatah_hari);

    const { data, error } = await supabase.rpc('fn_admin_create_karyawan', {
      p_email: String(email).trim().toLowerCase(),
      p_password: String(password),
      p_nik_karyawan: String(nik_karyawan).trim().toUpperCase(),
      p_nama_lengkap: String(nama_lengkap).trim(),
      p_nomor_hp: nomor_hp ? String(nomor_hp).trim() : null,
      p_peran: peran,
      p_divisi_id: divisi_id,
      p_jabatan: String(jabatan ?? '').trim(),
      p_status_kerja: status_kerja ?? 'kontrak',
      p_tanggal_masuk: tanggal_masuk,
      p_aktif: aktif !== false,
      p_tahun: tahun ? Number(tahun) : currentYear,
      p_jatah_hari: jatah,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        message: `Akun karyawan ${String(nama_lengkap).trim()} berhasil dibuat.`,
        data,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
