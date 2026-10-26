'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  LayoutDashboard,
  Clock,
  CalendarDays,
  CheckSquare,
  Users,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { signOutAction } from '@/app/dashboard/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LayoutProfileData {
  id: string;
  nik_karyawan: string;
  nama_lengkap: string;
  email: string;
  peran: 'karyawan' | 'atasan' | 'hrd';
  jabatan: string;
  divisi?: { nama: string } | null;
  pendingApprovals?: number;
}

interface AppLayoutProps {
  profile: LayoutProfileData;
  children: React.ReactNode;
}

const ROLE_LABEL: Record<string, string> = {
  hrd: 'HRD',
  atasan: 'Atasan',
  karyawan: 'Karyawan',
};

function getInitials(name: string) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export default function AppLayout({ profile, children }: AppLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTimeWIB, setCurrentTimeWIB] = useState<string>('');

  const role = profile.peran;

  // Format jam server WIB (Asia/Jakarta) dinamis
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
      setCurrentTimeWIB(`${formatted} WIB`);
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Menu Navigasi Dinamis Berdasarkan Hak Akses Peran (PRD Section 3 & 7)
  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['karyawan', 'atasan', 'hrd'],
    },
    {
      label: 'Absensi',
      href: '/absensi',
      icon: Clock,
      roles: ['karyawan', 'atasan', 'hrd'],
    },
    {
      label: 'Cuti dan Izin',
      href: '/cuti-izin',
      icon: CalendarDays,
      roles: ['karyawan', 'atasan', 'hrd'],
    },
    {
      label: 'Persetujuan',
      href: '/persetujuan',
      icon: CheckSquare,
      badge: profile.pendingApprovals && profile.pendingApprovals > 0 ? profile.pendingApprovals : undefined,
      roles: ['atasan', 'hrd'],
    },
    {
      label: 'Data Karyawan',
      href: '/karyawan',
      icon: Users,
      roles: ['atasan', 'hrd'],
    },
    {
      label: 'Slip Gaji',
      href: '/slip-gaji',
      icon: Receipt,
      roles: ['karyawan', 'atasan', 'hrd'],
    },
    {
      label: 'Laporan',
      href: '/laporan',
      icon: BarChart3,
      roles: ['hrd'],
    },
    {
      label: 'Pengaturan',
      href: '/pengaturan',
      icon: Settings,
      roles: ['hrd'],
    },
  ];

  // Filter hanya menu yang diizinkan untuk peran saat ini
  const visibleNavItems = navItems.filter((item) => item.roles.includes(role));

  const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
    hrd: 'default',
    atasan: 'secondary',
    karyawan: 'outline',
  };

  const namaDivisi = profile.divisi?.nama || '-';
  const initials = getInitials(profile.nama_lengkap);

  return (
    <div className="clay-app flex min-h-screen">
      {/* Scrim gelap saat drawer menu mobile terbuka */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px] animate-in fade-in duration-150 motion-reduce:animate-none md:hidden"
        />
      )}

      {/* Sidebar Navigasi */}
      <aside
        id="app-sidebar"
        aria-label="Navigasi utama"
        className={cn(
          mobileMenuOpen ? 'flex' : 'hidden',
          'clay-sidebar fixed inset-y-0 left-0 z-50 w-72 shrink-0 flex-col overflow-hidden rounded-r-[1.75rem] md:sticky md:top-3 md:z-30 md:mb-3 md:ml-3 md:mr-0 md:mt-3 md:flex md:h-[calc(100vh-1.5rem)] md:w-64 md:rounded-[1.75rem]'
        )}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/60 px-5">
          <div className="clay-tile flex size-10 items-center justify-center rounded-xl bg-[#0f7a5f] text-white">
            <Building2 aria-hidden="true" className="size-[19px]" strokeWidth={1.9} />
          </div>
          <div className="min-w-0">
            <div className="font-heading text-[16px] font-extrabold leading-tight tracking-tight text-sidebar-foreground">
              Karsa<span className="text-primary">HR</span>
            </div>
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[#564d70]">
              PT Karsa Lintas Nusantara
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
            aria-label="Tutup menu navigasi"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a5270]">
            Menu
          </p>
          <ul className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'clay-nav-link group relative flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-[13px] transition-colors duration-150',
                      isActive
                        ? 'font-extrabold text-[#0b5b45]'
                        : 'font-semibold text-[#4f4766] hover:text-[#241d38]'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon
                        aria-hidden="true"
                        strokeWidth={1.9}
                        className={cn(
                          'size-4 shrink-0',
                          isActive
                            ? 'text-[#0f7a5f]'
                            : 'text-[#6a6182] group-hover:text-[#3b3350]'
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>

                    {item.badge !== undefined && (
                      <span
                        className={cn(
                          'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold tabular-nums',
                          isActive
                            ? 'bg-[#0f7a5f] text-white'
                            : 'bg-white/70 text-[#0f7a5f]'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Info pengguna */}
        <div className="shrink-0 border-t border-white/60 p-3">
          <div className="clay-inset flex items-center gap-2.5 rounded-2xl p-3 ring-1 ring-white/60">
            <span
              aria-hidden="true"
              className="clay-tile flex size-10 shrink-0 items-center justify-center rounded-full bg-[#c9f2e1] text-[11px] font-extrabold text-[#0b5b45]"
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-sidebar-foreground">
                {profile.nama_lengkap}
              </div>
              <div className="truncate text-[10px] font-semibold capitalize text-[#5a5270]">
                {role} · {namaDivisi}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Konten Utama */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="clay-topbar sticky top-2 z-30 mx-2 mt-2 flex h-16 shrink-0 items-center justify-between gap-3 px-4 sm:px-5 md:top-3 md:mx-3 md:mt-3 md:h-[4.25rem] md:px-6">
          {/* Menu mobile */}
          <div className="flex items-center gap-2.5 md:hidden">
            <div className="clay-tile flex size-9 items-center justify-center rounded-xl bg-[#0f7a5f] text-white">
              <Building2 aria-hidden="true" className="size-4" strokeWidth={1.9} />
            </div>
            <span className="font-heading text-sm font-extrabold text-foreground">
              Karsa<span className="text-primary">HR</span>
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="ml-1 flex size-10 items-center justify-center rounded-xl border border-white/80 bg-[#fff7ea] text-foreground/80 transition-colors hover:bg-[#f8eddc] hover:text-foreground"
              aria-label={mobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              aria-expanded={mobileMenuOpen}
              aria-controls="app-sidebar"
            >
              {mobileMenuOpen ? (
                <X aria-hidden="true" className="size-4" />
              ) : (
                <Menu aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>

          {/* Jam server WIB */}
          <div className="hidden items-center gap-2 text-xs font-semibold text-muted-foreground md:flex">
            <span aria-hidden="true" className="size-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(15,122,95,0.13)]" />
            <span className="tabular-nums">{currentTimeWIB || 'Zona WIB (Asia/Jakarta)'}</span>
          </div>

          {/* Informasi pengguna & keluar */}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs font-bold text-foreground">{profile.nama_lengkap}</span>
                <Badge
                  variant={roleBadgeVariant[role] ?? 'outline'}
                  className="h-[20px] px-2 text-[10px] font-bold uppercase tracking-wide"
                >
                  {ROLE_LABEL[role] ?? role}
                </Badge>
              </div>
              <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] font-medium text-muted-foreground">
                <span className="font-mono">{profile.nik_karyawan}</span>
                <span aria-hidden="true" className="size-1 rounded-full bg-border" />
                <span>{namaDivisi}</span>
                {profile.jabatan ? (
                  <>
                    <span aria-hidden="true" className="size-1 rounded-full bg-border" />
                    <span className="max-w-32 truncate">{profile.jabatan}</span>
                  </>
                ) : null}
              </div>
            </div>

            <form action={signOutAction}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="clay-button cursor-pointer gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                title="Keluar dari akun"
              >
                <LogOut aria-hidden="true" className="size-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </Button>
            </form>
          </div>
        </header>

        {/* Isi halaman */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-12 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
