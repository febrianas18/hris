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
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const QUICK_ACCOUNTS = [
  {
    email: 'rina.kusumawardani@karsalintas.test',
    name: 'Rina Kusumawardani',
    role: 'HRD',
    roleBadge: 'default' as const,
    disabled: false,
    badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
  {
    email: 'maya.anggraini@karsalintas.test',
    name: 'Maya Anggraini',
    role: 'Atasan',
    roleBadge: 'secondary' as const,
    disabled: false,
    badgeColor: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
  },
  {
    email: 'andi.wijaya@karsalintas.test',
    name: 'Andi Wijaya',
    role: 'Karyawan',
    roleBadge: 'outline' as const,
    disabled: false,
    badgeColor: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20',
  },
  {
    email: 'bambang.hartono@karsalintas.test',
    name: 'Bambang Hartono',
    role: 'Nonaktif',
    roleBadge: 'destructive' as const,
    disabled: true,
    badgeColor: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') !== 'inactive') return;

    // Tampilkan pesan setelah cat pertama agar tidak memicu render berantai saat mount.
    const timer = window.setTimeout(() => {
      setErrorMessage('Akun Anda dinonaktifkan. Silakan hubungi HRD.');
    }, 0);
    return () => window.clearTimeout(timer);
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

  const isInactiveError = errorMessage?.toLowerCase().includes('dinonaktifkan');

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between items-center bg-slate-50 dark:bg-slate-950 overflow-hidden py-10 px-4 sm:px-6">
      {/* Ambient gradient glow circles matching Gradient Able template */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-40 size-[500px] rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 size-[500px] rounded-full bg-sky-500/10 blur-3xl"
      />

      {/* Main Auth Container */}
      <div className="relative z-10 w-full max-w-[450px] my-auto">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25">
            <Building2 aria-hidden="true" className="size-7" strokeWidth={2} />
          </div>
          <h2 className="text-sm font-bold tracking-widest text-primary uppercase">
            PT Karsa Lintas Nusantara
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sistem Informasi SDM & Kepegawaian Terpadu
          </p>
        </div>

        {/* Login Card */}
        <Card className="border border-border/80 shadow-xl bg-card">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Masuk ke Akun
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Masukkan email perusahaan dan kata sandi yang telah didaftarkan
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {/* Banner Alert BR-01: Akun Dinonaktifkan */}
            {errorMessage && isInactiveError && (
              <Alert
                id="login-error-alert"
                variant="destructive"
                className="border-rose-300/80 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
              >
                <ShieldAlert className="size-4 text-rose-600 dark:text-rose-400" />
                <div className="space-y-1">
                  <AlertTitle className="text-xs font-bold text-rose-800 dark:text-rose-300">
                    Akses Akun Dinonaktifkan (BR-01)
                  </AlertTitle>
                  <AlertDescription className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                    {errorMessage} Akses masuk dibatasi untuk akun nonaktif. Silakan hubungi bagian HRD untuk informasi aktivasi kembali.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {/* Standard Error Alert */}
            {errorMessage && !isInactiveError && (
              <Alert id="login-error-alert" variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription className="text-xs font-medium">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Form Input */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                  Email Perusahaan
                </Label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="nama.karyawan@karsalintas.test"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="h-10 pl-9.5 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                    Kata Sandi
                  </Label>
                </div>
                <div className="relative">
                  <Lock
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-10 pl-9.5 pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="size-4" />
                    ) : (
                      <Eye aria-hidden="true" className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                id="btn-login"
                type="submit"
                disabled={isLoading}
                className="mt-2 h-10 w-full font-semibold shadow-sm cursor-pointer transition-all hover:shadow"
              >
                {isLoading ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-4 animate-spin mr-2" />
                    <span>Memverifikasi akun...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Sistem</span>
                    <ArrowRight aria-hidden="true" className="size-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/30 p-2.5 text-muted-foreground">
              <Info aria-hidden="true" className="size-4 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Pendaftaran akun baru dilakukan terpusat oleh HRD sesuai hak akses peran (BR-01).
              </p>
            </div>
          </CardContent>

          {/* Quick Account Preset Section */}
          <CardFooter className="flex flex-col border-t border-border/70 pt-4 pb-4 bg-muted/15">
            <div className="w-full flex items-center justify-between mb-2.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Akun Uji Cepat (Demo Presets)
              </span>
              <span className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border border-border/70">
                Sandi: Latihan#2026
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full">
              {QUICK_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => setQuickAccount(account.email)}
                  className={`group flex flex-col justify-between p-2 rounded-lg border text-left transition-all ${
                    account.disabled
                      ? 'border-rose-200 bg-rose-50/60 hover:bg-rose-100/70 dark:border-rose-900/40 dark:bg-rose-950/20'
                      : 'border-border/80 bg-background hover:border-primary/50 hover:bg-primary/5'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {account.name.split(' ')[0]}
                    </span>
                    <Badge variant={account.roleBadge} className={`text-[10px] py-0 px-1.5 h-4.5 ${account.badgeColor}`}>
                      {account.role}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono truncate w-full">
                    {account.email.split('@')[0]}
                  </span>
                </button>
              ))}
            </div>
          </CardFooter>
        </Card>

        {/* Security & System Info Footer */}
        <div className="mt-6 flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Koneksi Terenkripsi · Pencatatan Absensi Jam Server WIB (BR-02)</span>
          </div>
          <p className="text-[11px] text-muted-foreground/75">
            © {new Date().getFullYear()} PT Karsa Lintas Nusantara. Hak Cipta Dilindungi.
          </p>
        </div>
      </div>
    </div>
  );
}
