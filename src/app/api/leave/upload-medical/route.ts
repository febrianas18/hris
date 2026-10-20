import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB (BR-08)

/**
 * POST /api/leave/upload-medical
 * Mengunggah surat dokter ke bucket privat 'medical-certificates' (BR-08).
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

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File surat dokter wajib disertakan.' },
        { status: 400 }
      );
    }

    // 1. Validasi Tipe File (PDF, JPG, PNG)
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Format file tidak diizinkan (${file.type}). Hanya format PDF, JPG, atau PNG yang diperbolehkan. Aturan BR-08.`,
        },
        { status: 400 }
      );
    }

    // 2. Validasi Ukuran File (Maksimal 2 MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Ukuran file terlalu besar (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maksimal 2 MB. Aturan BR-08.`,
        },
        { status: 400 }
      );
    }

    // 3. Nama file aman dan terisolasi per folder karyawan
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop() || 'pdf';
    const cleanFileName = `${user.id}/${timestamp}_surat_dokter.${fileExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('medical-certificates')
      .upload(cleanFileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json(
        { success: false, error: `Gagal mengunggah file ke storage: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Surat dokter berhasil diunggah.',
      filePath: uploadData.path,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
