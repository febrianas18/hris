import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payroll/previous?karyawan_id=...&periode=...
 * Mengambil komponen gaji karyawan dari periode sebelumnya (BR-12: Fitur "Salin dari periode sebelumnya").
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

    // Hanya HRD yang berhak melihat data untuk salin draf
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, peran, aktif')
      .eq('id', user.id)
      .single();

    if (!profile?.aktif || profile.peran !== 'hrd') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Hanya HRD yang berhak mengakses fitur ini.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const karyawanId = searchParams.get('karyawan_id');
    const targetPeriode = searchParams.get('periode');

    if (!karyawanId || !targetPeriode) {
      return NextResponse.json(
        { success: false, error: 'Parameter karyawan_id dan periode wajib disertakan.' },
        { status: 400 }
      );
    }

    // Ambil slip gaji terakhir sebelum targetPeriode
    const { data: prevSlip, error } = await supabase
      .from('slip_gaji')
      .select('id, nomor_slip, periode, gaji_pokok, tunjangan, potongan, catatan, status')
      .eq('karyawan_id', karyawanId)
      .lt('periode', targetPeriode)
      .order('periode', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: `Gagal mencari slip sebelumnya: ${error.message}` },
        { status: 500 }
      );
    }

    if (!prevSlip) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Tidak ditemukan riwayat slip gaji pada periode sebelumnya.',
      });
    }

    return NextResponse.json({
      success: true,
      data: prevSlip,
      message: `Berhasil mengambil komponen gaji dari periode ${prevSlip.periode}.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

/**
 * POST /api/payroll/previous
 * Batch salin dari periode sebelumnya untuk semua karyawan aktif yang belum memiliki slip pada target periode.
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
        { success: false, error: 'Akses ditolak. Hanya HRD yang berhak mengakses fitur ini.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { target_periode } = body;

    if (!target_periode || parseInt(target_periode.slice(8, 10), 10) !== 1) {
      return NextResponse.json(
        { success: false, error: 'target_periode wajib berupa tanggal 1 bulan (YYYY-MM-01).' },
        { status: 400 }
      );
    }

    // 1. Ambil semua karyawan aktif
    const { data: activeEmployees, error: empErr } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, nik_karyawan')
      .eq('aktif', true);

    if (empErr || !activeEmployees) {
      return NextResponse.json(
        { success: false, error: 'Gagal mengambil data karyawan aktif.' },
        { status: 500 }
      );
    }

    // 2. Ambil slip yang sudah ada pada target_periode
    const { data: existingSlips } = await supabase
      .from('slip_gaji')
      .select('karyawan_id')
      .eq('periode', target_periode);

    const existingKaryawanIds = new Set((existingSlips || []).map((s) => s.karyawan_id));

    let createdCount = 0;
    const skippedNames: string[] = [];
    const createdNames: string[] = [];

    for (const emp of activeEmployees) {
      // Lewati jika sudah ada slip pada periode ini
      if (existingKaryawanIds.has(emp.id)) {
        continue;
      }

      // Cari slip gaji terakhir sebelum target_periode
      const { data: prevSlip } = await supabase
        .from('slip_gaji')
        .select('gaji_pokok, tunjangan, potongan, catatan')
        .eq('karyawan_id', emp.id)
        .lt('periode', target_periode)
        .order('periode', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevSlip) {
        // Buat draf baru
        const { error: saveErr } = await supabase.rpc('fn_save_draft_slip_gaji', {
          p_slip_id: null,
          p_karyawan_id: emp.id,
          p_periode: target_periode,
          p_gaji_pokok: Number(prevSlip.gaji_pokok),
          p_tunjangan: Number(prevSlip.tunjangan),
          p_potongan: Number(prevSlip.potongan),
          p_catatan: prevSlip.catatan || 'Salin dari periode sebelumnya',
          p_hrd_id: user.id,
        });

        if (!saveErr) {
          createdCount++;
          createdNames.push(emp.nama_lengkap);
        }
      } else {
        skippedNames.push(emp.nama_lengkap);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil membuat ${createdCount} draf slip gaji untuk periode ${target_periode}.`,
      data: {
        createdCount,
        createdNames,
        skippedCount: skippedNames.length,
        skippedNames,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
