import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Definisi aturan batasan rute URL berdasarkan peran (RBAC)
const RESTRICTED_ROUTES: { prefix: string; allowedRoles: string[] }[] = [
  // Persetujuan: Hanya Atasan dan HRD (Karyawan ditolak)
  { prefix: '/persetujuan', allowedRoles: ['atasan', 'hrd'] },
  // Data Karyawan: Hanya Atasan (baca divisi sendiri) dan HRD (kelola) (Karyawan ditolak)
  { prefix: '/karyawan', allowedRoles: ['atasan', 'hrd'] },
  // Laporan: Hanya HRD (Karyawan & Atasan ditolak)
  { prefix: '/laporan', allowedRoles: ['hrd'] },
  // Pengaturan: Hanya HRD (Karyawan & Atasan ditolak)
  { prefix: '/pengaturan', allowedRoles: ['hrd'] },
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === '/login';
  const isAuthCallback = pathname.startsWith('/auth');
  const isApiRoute = pathname.startsWith('/api');

  // 1. Jika belum login dan mencoba mengakses rute terproteksi -> redirect paksa ke /login
  // Abaikan rute API agar mengembalikan respon JSON 401, bukan HTML redirect
  if (!user && !isLoginPage && !isAuthCallback && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // 2. Jika sudah login dan mengakses /login -> arahkan ke /dashboard
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // 3. Pengecekan Otorisasi Peran (RBAC) untuk pengguna yang sedang login
  if (user && !isAuthCallback) {
    // Ambil data peran dan status aktif dari tabel profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('peran, aktif')
      .eq('id', user.id)
      .maybeSingle();

    // Jika akun terdeteksi nonaktif, putus sesi login dan arahkan ke /login
    if (profile && profile.aktif === false) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'inactive');
      return NextResponse.redirect(url);
    }

    const userRole = profile?.peran || 'karyawan';

    // Periksa apakah URL yang dituju merupakan rute terbatas
    for (const route of RESTRICTED_ROUTES) {
      if (pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)) {
        if (!route.allowedRoles.includes(userRole)) {
          // Akses ditolak: Pengguna mencoba mengubah URL manual di luar hak aksesnya
          // Dialihkan kembali ke Dashboard dengan indikator Forbidden (403)
          const url = request.nextUrl.clone();
          url.pathname = '/dashboard';
          url.searchParams.set('forbidden', '1');
          url.searchParams.set('target', pathname);
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
