import { getCurrentProfile } from '@/utils/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DataKaryawanPage() {
  const { profile } = await getCurrentProfile();

  // Defense-in-depth authorization check (Atasan & HRD only)
  if (profile.peran === 'karyawan') {
    redirect('/dashboard?forbidden=1&target=/karyawan');
  }

  return (
    <AppLayout profile={profile}>
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Data Karyawan
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {profile.peran === 'hrd'
                ? 'Kelola data seluruh karyawan, divisi, dan status aktif (BR-01)'
                : 'Daftar data anggota divisi'}
            </p>
          </div>
        </div>

        <div className="mt-6 text-sm text-slate-600">
          Halaman Data Karyawan siap untuk pengelolaan data kepegawaian tanpa kolom gaji (BR-01 & BR-11).
        </div>
      </div>
    </AppLayout>
  );
}
