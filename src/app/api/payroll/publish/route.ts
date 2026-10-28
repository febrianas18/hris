import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';
import { notifyEmployeePayslipPublished } from '@/utils/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payroll/publish
 * Menerbitkan slip gaji oleh HRD (BR-12).
 * - Mengunci slip (status: 'terbit'). Slip yang sudah terbit TIDAK BISA diedit atau dihapus lagi oleh siapa pun.
 * - Buat nomor slip otomatis dengan format: 'SG-TTTTBB-NNN' (contoh: SG-202610-001, SG-202610-002), nomor urut berurutan per periode dan dijamin unik.
 * - Mencatat ke 'audit_log' dengan aksi 'penerbitan_slip'.
 * - Notifikasi email transaksional ke karyawan (PRD Bab 11 & BR-11: TANPA NOMINAL GAJI).
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

    // 1. Validasi peran HRD (BR-11 & BR-12)
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
          error: 'Akses ditolak. Hanya HRD yang berhak menerbitkan slip gaji (BR-11 & BR-12).',
        },
        { status: 403 }
      );
    }

    // 2. Baca payload
    const body = await req.json();
    const { slip_id } = body;

    if (!slip_id) {
      return NextResponse.json(
        { success: false, error: 'Parameter slip_id wajib disertakan.' },
        { status: 400 }
      );
    }

    // 3. Eksekusi Stored Procedure fn_publish_slip_gaji
    const { data: publishedSlip, error: rpcError } = await supabase.rpc(
      'fn_publish_slip_gaji',
      {
        p_slip_id: slip_id,
        p_hrd_id: user.id,
      }
    );

    if (rpcError) {
      return NextResponse.json(
        { success: false, error: rpcError.message },
        { status: 400 }
      );
    }

    // 4. Kirim Notifikasi Email Transaksional & In-App ke Karyawan (PRD Bab 11 & BR-11)
    // Sesuai aturan kerahasiaan BR-11, email hanya berisi nomor slip dan tautan, TANPA NOMINAL GAJI.
    try {
      const { data: employeeProfile } = await supabase
        .from('profiles')
        .select('email, nama_lengkap')
        .eq('id', publishedSlip.karyawan_id)
        .maybeSingle();

      if (employeeProfile?.email) {
        await notifyEmployeePayslipPublished({
          employeeEmail: employeeProfile.email,
          employeeNama: employeeProfile.nama_lengkap,
          periode: publishedSlip.periode,
          nomorSlip: publishedSlip.nomor_slip,
        });
      }
    } catch (emailErr) {
      console.warn('[EMAIL NOTIFICATION PAYSLIP DISPATCH FAILED]', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: `Slip gaji berhasil diterbitkan dengan nomor ${publishedSlip.nomor_slip} dan tercatat di audit log.`,
      data: publishedSlip,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
