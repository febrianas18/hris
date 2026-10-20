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
  User,
  Shield,
  Menu,
  X,
} from 'lucide-react';
import { signOutAction } from '@/app/dashboard/actions';

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

export default function AppLayout({ profile, children }: AppLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTimeWIB, setCurrentTimeWIB] = useState<string>('');

  const role = profile.peran;

  // Format jam server WIB (Asia/Jakarta) dinamis
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Gunakan Intl.DateTimeFormat untuk WIB (GMT+7)
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

  const roleBadgeStyle = {
    hrd: 'bg-purple-100 text-purple-700 border-purple-200',
    atasan: 'bg-amber-100 text-amber-700 border-amber-200',
    karyawan: 'bg-blue-100 text-blue-700 border-blue-200',
  }[role];

  const namaDivisi = profile.divisi?.nama || '-';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center font-bold text-sm">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-white text-sm">KarsaHR</span>
            <span className="text-[10px] text-slate-400 block -mt-0.5">PT KLN</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          aria-label="Toggle Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigasi Desktop (Sesuai Wireframe Halaman 1 & 2) */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 md:fixed md:inset-y-0 z-40 transition-all`}
      >
        {/* Brand Header */}
        <div className="h-18 flex items-center gap-3 px-6 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-extrabold text-slate-900 tracking-tight">
              Karsa<span className="text-blue-600">HR</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">PT Karsa Lintas Nusantara</div>
          </div>
        </div>

        {/* Menu Items Dinamis Sesuai Hak Akses Peran */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {/* Badge Notifikasi Persetujuan (Wireframe Halaman 2: badge "4", Halaman 3: badge "1") */}
                {item.badge !== undefined && (
                  <span
                    className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold ${
                      isActive ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Info di Sudut Kiri Bawah Sidebar (Referensi Wireframe Halaman 1 & 2) */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 border border-slate-300/80 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              {/* Nama Pengguna */}
              <div className="text-xs font-bold text-slate-900 truncate">
                {profile.nama_lengkap}
              </div>
              {/* Peran · Divisi / Jabatan (Format Wireframe: "Karyawan · Penjualan" / "HRD · Kepala HRD") */}
              <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5 capitalize">
                {role} · {namaDivisi}
              </div>
              {/* NIK Pengguna */}
              <div className="text-[10px] font-mono font-semibold text-slate-400 mt-0.5">
                {profile.nik_karyawan}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Body Content with Top Bar */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        {/* Top Navbar Header (Menampilkan Info Pengguna di Sudut Kanan Atas) */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Server Time (WIB) */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{currentTimeWIB || 'Zona WIB (Asia/Jakarta)'}</span>
          </div>
          <div className="sm:hidden text-xs font-bold text-slate-800">
            {profile.nama_lengkap}
          </div>

          {/* User Info di Sudut Kanan Atas (Nama, NIK, Peran, Divisi) */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs font-bold text-slate-900">
                  {profile.nama_lengkap}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${roleBadgeStyle}`}>
                  {role}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-end gap-2 mt-0.5">
                <span className="font-mono font-medium text-slate-600">{profile.nik_karyawan}</span>
                <span>·</span>
                <span className="font-medium text-slate-700">{namaDivisi}</span>
                {profile.jabatan && (
                  <>
                    <span>·</span>
                    <span className="text-slate-500">{profile.jabatan}</span>
                  </>
                )}
              </div>
            </div>

            {/* Logout Action Button */}
            <form action={signOutAction}>
              <button
                type="submit"
                title="Keluar dari akun"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </form>
          </div>
        </header>

        {/* Page Children Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
