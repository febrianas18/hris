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
import NotificationBell from '@/components/NotificationBell';

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
  const role = profile.peran;

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
    <div className="flex min-h-screen bg-background">
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
          'fixed inset-y-0 left-0 z-50 w-72 shrink-0 flex-col overflow-hidden border-r border-border/70 bg-card shadow-lg md:sticky md:top-3 md:z-30 md:mb-3 md:ml-3 md:mr-0 md:mt-3 md:flex md:h-[calc(100vh-1.5rem)] md:w-64 md:rounded-2xl md:border md:shadow-xs'
        )}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border/70 px-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Building2 aria-hidden="true" className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="font-heading text-base font-bold leading-tight tracking-tight text-foreground">
              Karsa<span className="text-primary">HR</span>
            </div>
            <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              PT Karsa Lintas Nusantara
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            aria-label="Tutup menu navigasi"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
            Menu Utama
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
                      'group relative flex items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon
                        aria-hidden="true"
                        strokeWidth={1.8}
                        className={cn(
                          'size-4 shrink-0 transition-colors',
                          isActive
                            ? 'text-primary'
                            : 'text-muted-foreground group-hover:text-foreground'
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>

                    {item.badge !== undefined && (
                      <span
                        className={cn(
                          'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
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

        {/* Info pengguna & Tombol Keluar di Pojok Kiri Bawah */}
        <div className="shrink-0 border-t border-border/70 p-3 space-y-2">
          <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-muted/30 p-2.5">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary"
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-foreground">
                {profile.nama_lengkap}
              </div>
              <div className="truncate text-[10px] font-medium capitalize text-muted-foreground">
                {namaDivisi}
              </div>
            </div>
          </div>

          <form action={signOutAction} className="w-full">
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              title="Keluar dari akun"
            >
              <LogOut aria-hidden="true" className="size-3.5 text-white" />
              <span>Keluar</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Konten Utama */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header (hanya tampil di layar ponsel) */}
        <div className="relative z-40 flex h-14 shrink-0 items-center justify-between border-b border-border/70 bg-card px-4 md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Building2 aria-hidden="true" className="size-4" strokeWidth={2} />
            </div>
            <span className="font-heading text-sm font-bold text-foreground">
              Karsa<span className="text-primary">HR</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell userRole={role} userEmail={profile.email} />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex size-9 items-center justify-center rounded-lg border border-border/70 bg-background text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
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
        </div>

        {/* Desktop Header Top Bar */}
        <header className="relative z-40 hidden md:flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-card/80 backdrop-blur-md px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Badge variant={roleBadgeVariant[role]} className="capitalize text-[11px] font-bold">
              {ROLE_LABEL[role] || role}
            </Badge>
            {namaDivisi !== '-' && (
              <span className="text-xs font-semibold text-muted-foreground">
                Divisi {namaDivisi}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell userRole={role} userEmail={profile.email} />
            <div className="flex items-center gap-2 pl-2 border-l border-border/70">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {initials}
              </span>
              <span className="text-xs font-bold text-foreground">
                {profile.nama_lengkap}
              </span>
            </div>
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
