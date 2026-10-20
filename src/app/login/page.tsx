'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
  Building2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Info,
  CheckCircle2,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'inactive') {
        setErrorMessage('Akun Anda dinonaktifkan. Silakan hubungi HRD.');
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const supabase = createClient();

      // 1. Otentikasi kredensial email & password dengan Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('invalid login credentials')) {
          setErrorMessage('Email atau kata sandi salah. Silakan periksa kembali.');
        } else {
          setErrorMessage(authError.message);
        }
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        setErrorMessage('Gagal memverifikasi akun pengguna.');
        setIsLoading(false);
        return;
      }

      // 2. Pengecekan status akun di tabel profiles (BR-01)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, nama_lengkap, peran, aktif')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error saat memeriksa profil karyawan:', profileError);
      }

      // Jika akun nonaktif (aktif = false), tolak login dengan pesan jelas sesuai aturan BR-01
      if (profile && profile.aktif === false) {
        await supabase.auth.signOut();
        setErrorMessage('Akun Anda dinonaktifkan. Silakan hubungi HRD.');
        setIsLoading(false);
        return;
      }

      // Jika berhasil dan akun aktif, arahkan ke dashboard
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      console.error('Terjadi kesalahan tidak terduga:', err);
      setErrorMessage('Terjadi kesalahan jaringan atau server. Silakan coba lagi.');
      setIsLoading(false);
    }
  };

  // Helper untuk pengujian cepat akun uji (BR-01 & skenario tes)
  const setQuickAccount = (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword('Latihan#2026');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4 sm:p-6 lg:p-8">
      {/* Decorative ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-xl shadow-indigo-500/25 mb-4 border border-indigo-400/30">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Karsa<span className="text-indigo-400">HR</span>
          </h1>
          <p className="text-sm font-medium text-slate-400 mt-1">
            PT Karsa Lintas Nusantara
          </p>
          <div className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700">
            Sistem Informasi HR Internal
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Masuk ke Akun</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Masukkan email dan kata sandi yang telah didaftarkan oleh HRD.
            </p>
          </div>

          {/* Alert Error (Termasuk pesan akun nonaktif BR-01) */}
          {errorMessage && (
            <div
              id="login-error-alert"
              className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 animate-in fade-in duration-200"
              role="alert"
            >
              {errorMessage.includes('dinonaktifkan') ? (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-sm font-medium text-rose-200">
                {errorMessage}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Email Perusahaan
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="nama.karyawan@karsalintas.test"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all disabled:opacity-60"
                />
              </div>
            </div>

            {/* Input Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-login"
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 active:scale-[0.99] transition-all duration-150 shadow-lg shadow-indigo-600/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <span>Masuk Sekarang</span>
              )}
            </button>
          </form>

          {/* Info Pendaftaran Mandiri Tidak Ada (Sesuai Ketentuan) */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span>Tidak ada pendaftaran mandiri. Akun hanya dibuat oleh HRD.</span>
            </div>
          </div>
        </div>

        {/* Quick Demo Accounts Helper (Memudahkan Pengujian Dosen/Penguji/User) */}
        <div className="mt-6 bg-slate-900/60 border border-slate-800/60 rounded-xl p-4 text-xs text-slate-400">
          <p className="font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Pilih Akun Uji Cepat (Password: Latihan#2026):</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setQuickAccount('rina.kusumawardani@karsalintas.test')}
              className="p-2 text-left rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/50 transition-all"
            >
              <div className="font-semibold text-slate-200">Rina (HRD)</div>
              <div className="text-[10px] text-slate-400 truncate">rina.kusumawardani@...</div>
            </button>
            <button
              type="button"
              onClick={() => setQuickAccount('maya.anggraini@karsalintas.test')}
              className="p-2 text-left rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/50 transition-all"
            >
              <div className="font-semibold text-slate-200">Maya (Atasan)</div>
              <div className="text-[10px] text-slate-400 truncate">maya.anggraini@...</div>
            </button>
            <button
              type="button"
              onClick={() => setQuickAccount('andi.wijaya@karsalintas.test')}
              className="p-2 text-left rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/50 transition-all"
            >
              <div className="font-semibold text-slate-200">Andi (Karyawan)</div>
              <div className="text-[10px] text-slate-400 truncate">andi.wijaya@...</div>
            </button>
            <button
              type="button"
              onClick={() => setQuickAccount('bambang.hartono@karsalintas.test')}
              className="p-2 text-left rounded-lg bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/50 hover:border-rose-500 transition-all text-rose-300"
            >
              <div className="font-semibold text-rose-200">Bambang (Nonaktif)</div>
              <div className="text-[10px] text-rose-400 truncate">Uji Tolak BR-01</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
