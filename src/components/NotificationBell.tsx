'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarDays,
  Receipt,
  Mail,
  ExternalLink,
  X,
  Check,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/utils/notifications';

interface NotificationBellProps {
  userRole: 'karyawan' | 'atasan' | 'hrd';
  userEmail: string;
}

export default function NotificationBell({ userRole, userEmail }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isResendConfigured, setIsResendConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEmailPreview, setSelectedEmailPreview] = useState<AppNotification | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifikasi
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
          setIsResendConfigured(Boolean(data.isResendConfigured));
        }
      }
    } catch (err) {
      console.warn('Gagal memuat notifikasi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Polling setiap 10 detik agar demo responsif dan update otomatis
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const getIconForType = (type: AppNotification['type']) => {
    switch (type) {
      case 'leave_request':
        return <CalendarDays className="size-4 text-emerald-600 dark:text-emerald-400" />;
      case 'leave_approved':
        return <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />;
      case 'leave_rejected':
        return <XCircle className="size-4 text-rose-600 dark:text-rose-400" />;
      case 'leave_cancelled':
        return <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />;
      case 'payslip':
        return <Receipt className="size-4 text-blue-600 dark:text-blue-400" />;
      default:
        return <Mail className="size-4 text-primary" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} menit lalu`;
      if (diffHours < 24) return `${diffHours} jam lalu`;

      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return 'Baru saja';
    }
  };

  return (
    <div className="relative z-50 inline-block text-left" ref={dropdownRef}>
      {/* Tombol Lonceng Notifikasi */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            fetchNotifications();
          }
        }}
        className={cn(
          'relative flex size-9 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground/80 shadow-xs transition-all hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary',
          isOpen && 'bg-muted text-foreground ring-2 ring-primary/20'
        )}
        aria-label="Buka notifikasi"
        aria-expanded={isOpen}
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex size-4.5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Panel Notifikasi */}
      {isOpen && (
        <div className="absolute right-0 z-[60] mt-2 w-80 sm:w-96 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md p-0 shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Panel */}
          <div className="flex items-center justify-between border-b border-border/70 p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell className="size-3.5" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-foreground leading-tight">Pusat Notifikasi</h3>
                <p className="text-[10px] text-muted-foreground">
                  {isResendConfigured ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Email Live (Resend Active)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      Mode Demo (Simulasi Log & Preview)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                <Check className="size-3" />
                Tandai dibaca
              </button>
            )}
          </div>

          {/* List Notifikasi */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center px-4">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
                  <Mail className="size-5 opacity-60" />
                </div>
                <p className="text-xs font-semibold text-foreground">Belum ada notifikasi baru</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Setiap pengajuan cuti, persetujuan, atau slip gaji akan muncul di sini.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'group relative flex flex-col gap-1.5 p-3.5 transition-colors hover:bg-muted/50',
                    !item.isRead && 'bg-primary/[0.03]'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
                        {getIconForType(item.type)}
                      </span>
                      <span className="text-xs font-bold text-foreground leading-tight">
                        {item.title}
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed pl-8">
                    {item.message}
                  </p>

                  <div className="flex items-center justify-between pl-8 pt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary/90 bg-primary/10 px-2 py-0.5 rounded-full">
                      <Mail className="size-2.5" />
                      Email Transaksional
                    </span>

                    <div className="flex items-center gap-2">
                      {item.emailHtml && (
                        <button
                          type="button"
                          onClick={() => setSelectedEmailPreview(item)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-foreground/80 hover:text-primary transition-colors underline decoration-dotted"
                        >
                          <Eye className="size-3" />
                          Lihat Email
                        </button>
                      )}

                      <Link
                        href={item.link}
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline"
                      >
                        <span>Buka</span>
                        <ExternalLink className="size-2.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Panel */}
          <div className="border-t border-border/70 bg-muted/30 px-3.5 py-2.5 text-center">
            <span className="text-[10px] text-muted-foreground">
              Notifikasi otomatis dikirim ke email karyawan & atasan (PRD Bab 11 & BR-11)
            </span>
          </div>
        </div>
      )}

      {/* Modal Preview Email Transaksional */}
      {selectedEmailPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Mail className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Preview Email Transaksional</h4>
                  <p className="text-[10px] text-muted-foreground truncate max-w-sm">
                    Subjek: {selectedEmailPreview.emailSubject || selectedEmailPreview.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmailPreview(null)}
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Tutup preview email"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body / Email Render */}
            <div className="flex-1 overflow-y-auto p-4 bg-muted/10">
              <div className="rounded-xl border border-border/80 bg-background p-4 text-xs shadow-xs mb-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground w-16">Penerima:</span>
                  <span className="font-mono text-foreground">{selectedEmailPreview.recipientEmail || userEmail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground w-16">Pengirim:</span>
                  <span className="font-mono text-foreground">KarsaHR &lt;notifications@karsalintas.test&gt;</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground w-16">Status:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    <CheckCircle2 className="size-3" />
                    Terkirim & Tercatat di Sistem
                  </span>
                </div>
              </div>

              {/* Render HTML Template Email */}
              <div
                className="rounded-xl border border-border/80 bg-white overflow-hidden shadow-xs"
                dangerouslySetInnerHTML={{ __html: selectedEmailPreview.emailHtml || '' }}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border bg-card px-5 py-3">
              <span className="text-[10px] text-muted-foreground">
                Sesuai aturan BR-11: Nominal gaji dirahasiakan & hanya berupa tautan aman.
              </span>
              <button
                type="button"
                onClick={() => setSelectedEmailPreview(null)}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

