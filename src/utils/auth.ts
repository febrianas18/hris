import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export interface UserProfile {
  id: string;
  nik_karyawan: string;
  nama_lengkap: string;
  email: string;
  peran: 'karyawan' | 'atasan' | 'hrd';
  jabatan: string;
  status_kerja: string;
  tanggal_masuk: string;
  divisi: { id: string; nama: string } | null;
  pendingApprovals: number;
}

export async function getCurrentProfile(): Promise<{ user: any; profile: UserProfile }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id,
      nik_karyawan,
      nama_lengkap,
      email,
      peran,
      jabatan,
      status_kerja,
      tanggal_masuk,
      aktif,
      divisi:divisi_id (
        id,
        nama
      )
    `)
    .eq('id', user.id)
    .single();

  if (!profile || profile.aktif === false) {
    await supabase.auth.signOut();
    redirect('/login?error=inactive');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawDivisi = profile.divisi as any;

  // Hitung jumlah pengajuan yang menunggu keputusan sesuai peran (Wireframe badge Persetujuan)
  let pendingApprovals = 0;
  try {
    if (profile.peran === 'atasan') {
      const { count } = await supabase
        .from('pengajuan_cuti')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'diajukan')
        .eq('perlu_atasan', true)
        .neq('karyawan_id', profile.id);
      pendingApprovals = count || 0;
    } else if (profile.peran === 'hrd') {
      const { count } = await supabase
        .from('pengajuan_cuti')
        .select('id', { count: 'exact', head: true })
        .or('status.eq.disetujui_atasan,and(status.eq.diajukan,perlu_atasan.eq.false)')
        .neq('karyawan_id', profile.id);
      pendingApprovals = count || 0;
    }
  } catch (err) {
    console.error('Error calculating pending approvals:', err);
  }

  return {
    user,
    profile: {
      id: profile.id,
      nik_karyawan: profile.nik_karyawan,
      nama_lengkap: profile.nama_lengkap,
      email: profile.email,
      peran: profile.peran as 'karyawan' | 'atasan' | 'hrd',
      jabatan: profile.jabatan,
      status_kerja: profile.status_kerja,
      tanggal_masuk: profile.tanggal_masuk,
      divisi: rawDivisi ? { id: rawDivisi.id, nama: rawDivisi.nama } : null,
      pendingApprovals,
    },
  };
}

/**
 * Mendapatkan user terautentikasi baik dari session cookies Next.js maupun Authorization Bearer token.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAuthUser(req: Request, supabase: any) {
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();
  if (cookieUser) return cookieUser;

  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const { data: tokenUser } = await supabase.auth.getUser(token);
    if (tokenUser?.user) return tokenUser.user;
  }

  return null;
}

