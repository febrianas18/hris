'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock,
  FileText,
  Loader2,
  Paperclip,
  Users,
  X,
  XCircle,
  Search,
  Check,
  Info,
  CalendarOff,
} from 'lucide-react';
import { PageHeader, MetaDot } from '@/components/app/PageHeader';
import { Meter } from '@/components/app/StatCard';
import { StatusPill } from '@/components/app/StatusPill';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PendingLeaveItem {
  id: string;
  karyawan_id: string;
  jenis: 'cuti_tahunan' | 'sakit' | 'izin';
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_hari: number;
  alasan: string;
  lampiran_path: string | null;
  status: 'diajukan' | 'disetujui_atasan' | 'disetujui' | 'ditolak' | 'dibatalkan';
  perlu_atasan: boolean;
  dibuat_pada: string;
  pemohon: {
    id: string;
    nik_karyawan: string;
    nama_lengkap: string;
    jabatan: string;
    status_kerja: string;
    tanggal_masuk: string;
    divisi?: { id: string; nama: string } | null;
  };
  kuota?: {
    jatah_hari: number;
    terpakai_hari: number;
  } | null;
}

interface PersetujuanClientProps {
  currentUserRole: 'atasan' | 'hrd';
  currentUserId: string;
  currentUserDivisiId?: string | null;
  initialItems: PendingLeaveItem[];
  allActiveLeavesAroundDate: Array<{
    id: string;
    karyawan_id: string;
    nama: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    status: string;
  }>;
}

const getInitials = (name: string) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

export default function PersetujuanClient({
  currentUserRole,
  initialItems,
  allActiveLeavesAroundDate,
}: PersetujuanClientProps) {
  const [items, setItems] = useState<PendingLeaveItem[]>(initialItems);
  const [selectedItem, setSelectedItem] = useState<PendingLeaveItem | null>(
    initialItems.length > 0 ? initialItems[0] : null
  );

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [jenisFilter, setJenisFilter] = useState('semua');

  // Modal Penolakan (BR-09)
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [alasanPenolakan, setAlasanPenolakan] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const [processing, setProcessing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const formatDateDisplay = (dateString: string) => {
    try {
      const parts = dateString.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return dateString;
    }
  };

  // Setujui Pengajuan
  const handleApprove = async () => {
    if (!selectedItem) return;
    setProcessing(true);
    setActionFeedback(null);

    try {
      const res = await fetch('/api/leave/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pengajuan_id: selectedItem.id }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        setActionFeedback({ type: 'success', message: resJson.message });
        const remaining = items.filter((i) => i.id !== selectedItem.id);
        setItems(remaining);
        setSelectedItem(remaining.length > 0 ? remaining[0] : null);
      } else {
        setActionFeedback({ type: 'error', message: resJson.error || 'Persetujuan gagal.' });
      }
    } catch {
      setActionFeedback({ type: 'error', message: 'Terjadi kesalahan jaringan.' });
    } finally {
      setProcessing(false);
    }
  };

  // Tolak Pengajuan (BR-09: Wajib min. 10 karakter)
  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (alasanPenolakan.trim().length < 10) {
      setRejectError('Alasan penolakan wajib diisi minimal 10 karakter agar pemohon memahami alasan keputusan.');
      return;
    }

    setProcessing(true);
    setRejectError(null);

    try {
      const res = await fetch('/api/leave/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pengajuan_id: selectedItem.id,
          alasan_penolakan: alasanPenolakan.trim(),
        }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        setRejectModalOpen(false);
        setAlasanPenolakan('');
        setActionFeedback({ type: 'success', message: resJson.message });
        const remaining = items.filter((i) => i.id !== selectedItem.id);
        setItems(remaining);
        setSelectedItem(remaining.length > 0 ? remaining[0] : null);
      } else {
        setRejectError(resJson.error || 'Penolakan gagal diproses.');
      }
    } catch {
      setRejectError('Terjadi kesalahan jaringan.');
    } finally {
      setProcessing(false);
    }
  };

  // Filter antrean pengajuan
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (jenisFilter !== 'semua' && item.jenis !== jenisFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = item.pemohon.nama_lengkap.toLowerCase().includes(q);
        const matchNik = item.pemohon.nik_karyawan.toLowerCase().includes(q);
        const matchJabatan = item.pemohon.jabatan.toLowerCase().includes(q);
        const matchAlasan = item.alasan.toLowerCase().includes(q);
        if (!matchNama && !matchNik && !matchJabatan && !matchAlasan) return false;
      }
      return true;
    });
  }, [items, jenisFilter, searchQuery]);

  // Tim yang cuti di sekitar tanggal ini (Wireframe Hal. 3)
  const overlappingTeamLeaves = useMemo(() => {
    if (!selectedItem) return [];
    return allActiveLeavesAroundDate.filter(
      (l) => l.karyawan_id !== selectedItem.karyawan_id
    );
  }, [selectedItem, allActiveLeavesAroundDate]);

  const stageLabel =
    currentUserRole === 'atasan'
      ? 'Tahap 1: Atasan Divisi'
      : selectedItem?.status === 'disetujui_atasan'
      ? 'Tahap 2: Keputusan Akhir HRD'
      : 'Keputusan HRD (Langsung)';

  const isFinalHrdStage =
    currentUserRole === 'hrd' && selectedItem?.status === 'disetujui_atasan';

  const selectedInitials = selectedItem ? getInitials(selectedItem.pemohon.nama_lengkap) : '';
  const sisaHariPemohon = selectedItem?.kuota
    ? Math.max(0, selectedItem.kuota.jatah_hari - selectedItem.kuota.terpakai_hari)
    : 12;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        accent="warning"
        title="Persetujuan Cuti & Izin"
        icon={CheckSquare}
        meta={
          <Badge
            variant="secondary"
            className="h-5 gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-700 dark:text-amber-300"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" />
            {items.length} Menunggu Keputusan
          </Badge>
        }
      />

      {/* Banner Notifikasi Aksi */}
      {actionFeedback && (
        <Alert
          variant={actionFeedback.type === 'error' ? 'destructive' : 'default'}
          className={cn(
            actionFeedback.type === 'success' &&
              'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
          )}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="size-4" />
          )}
          <AlertTitle className="text-xs font-bold">
            {actionFeedback.type === 'success' ? 'Berhasil' : 'Pemberitahuan'}
          </AlertTitle>
          <AlertDescription className="text-xs">{actionFeedback.message}</AlertDescription>
        </Alert>
      )}

      {items.length === 0 ? (
        <Card className="border-border/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3">
              <CheckCircle2 className="size-7" />
            </div>
            <p className="text-base font-bold text-foreground">
              Semua Antrean Pengajuan Telah Selesai
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Tidak ada pengajuan cuti, sakit, atau izin yang sedang menunggu keputusan Anda saat ini.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* KOLOM KIRI: DAFTAR ANTREAN PENGAJUAN (MASTER) */}
          <Card className="lg:col-span-5 xl:col-span-4 border-border/80 shadow-sm flex flex-col">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    Antrean Masuk
                  </CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {filteredItems.length}
                </Badge>
              </div>

              {/* Filter & Search Bar */}
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Cari nama, NIK, jabatan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                  {[
                    { id: 'semua', label: 'Semua' },
                    { id: 'cuti_tahunan', label: 'Cuti' },
                    { id: 'izin', label: 'Izin' },
                    { id: 'sakit', label: 'Sakit' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setJenisFilter(btn.id)}
                      className={cn(
                        'rounded-md px-2 py-0.5 font-semibold transition-colors',
                        jenisFilter === btn.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-2 space-y-2 max-h-[620px] overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Tidak ada pengajuan yang sesuai dengan kriteria filter.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedItem(item);
                        setActionFeedback(null);
                      }}
                      className={cn(
                        'w-full cursor-pointer rounded-xl border p-3 text-left transition-all duration-150',
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-2xs ring-1 ring-primary/20'
                          : 'border-border/70 bg-card hover:bg-muted/30 hover:border-border'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-primary/10 text-primary'
                            )}
                          >
                            {getInitials(item.pemohon.nama_lengkap)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-foreground">
                              {item.pemohon.nama_lengkap}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {item.pemohon.divisi?.nama || '-'} · {item.pemohon.jabatan}
                            </p>
                          </div>
                        </div>
                        <StatusPill status={item.status} />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-medium text-foreground tabular-nums">
                          <CalendarDays className="size-3 text-muted-foreground" />
                          {formatDateDisplay(item.tanggal_mulai)}
                        </span>
                        <span>·</span>
                        <span className="font-mono font-bold text-foreground tabular-nums">
                          {item.jumlah_hari} hari kerja
                        </span>
                        <span>·</span>
                        <span className="capitalize font-medium">
                          {item.jenis.replace('_', ' ')}
                        </span>
                      </div>

                      <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
                        {item.alasan}
                      </p>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* KOLOM KANAN: DETAIL PENGAJUAN & KOTAK KEPUTUSAN (DETAIL) */}
          {selectedItem && (
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-4 border-b border-border/60">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary shadow-2xs">
                        {selectedInitials}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold text-foreground">
                            {selectedItem.pemohon.nama_lengkap}
                          </CardTitle>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {selectedItem.pemohon.nik_karyawan}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs text-muted-foreground mt-0.5">
                          {selectedItem.pemohon.jabatan} · Divisi{' '}
                          {selectedItem.pemohon.divisi?.nama || 'Tanpa Divisi'} · Status{' '}
                          {selectedItem.pemohon.status_kerja}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[10px] font-semibold uppercase tracking-wide',
                          isFinalHrdStage
                            ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                            : 'bg-primary/10 text-primary'
                        )}
                      >
                        {stageLabel}
                      </Badge>
                      <StatusPill status={selectedItem.status} />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 pt-4">
                  {/* 4 Kartu Metrik Rincian */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Jenis
                      </p>
                      <p className="mt-1 text-xs font-bold text-foreground capitalize">
                        {selectedItem.jenis.replace('_', ' ')}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Lama Kerja
                      </p>
                      <p className="mt-1 font-mono text-sm font-extrabold text-foreground tabular-nums">
                        {selectedItem.jumlah_hari} Hari
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Sisa Cuti Pemohon
                      </p>
                      <p className="mt-1 font-mono text-sm font-extrabold text-primary tabular-nums">
                        {sisaHariPemohon} Hari
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Tgl Masuk
                      </p>
                      <p className="mt-1 text-xs font-medium text-foreground tabular-nums">
                        {formatDateDisplay(selectedItem.pemohon.tanggal_masuk)}
                      </p>
                    </div>
                  </div>

                  {/* Rentang Tanggal & Progress Sisa Kuota */}
                  <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Rentang Pelaksanaan Cuti:</span>
                        <p className="font-semibold text-foreground text-sm mt-0.5 tabular-nums">
                          {formatDateDisplay(selectedItem.tanggal_mulai)} s/d{' '}
                          {formatDateDisplay(selectedItem.tanggal_selesai)}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="text-muted-foreground">Diajukan Pada:</span>
                        <p className="font-medium text-foreground text-xs mt-0.5">
                          {formatDateDisplay(selectedItem.dibuat_pada.slice(0, 10))}
                        </p>
                      </div>
                    </div>

                    {selectedItem.kuota && selectedItem.jenis === 'cuti_tahunan' && (
                      <div className="space-y-1.5 pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                          <span>Ketersediaan Kuota Tahunan 2026</span>
                          <span className="font-mono tabular-nums text-foreground font-bold">
                            {selectedItem.kuota.terpakai_hari} terpakai dari{' '}
                            {selectedItem.kuota.jatah_hari} hari
                          </span>
                        </div>
                        <Meter
                          value={selectedItem.kuota.terpakai_hari}
                          max={selectedItem.kuota.jatah_hari}
                          label="Ketersediaan kuota pemohon"
                          tone="info"
                        />
                      </div>
                    )}
                  </div>

                  {/* Lampiran Surat Dokter (jika ada) */}
                  {selectedItem.lampiran_path && (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Paperclip className="size-4.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            Lampiran Surat Keterangan Dokter
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Berkas terverifikasi: {selectedItem.lampiran_path.split('/').pop()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs font-medium bg-background">
                        Terlampir
                      </Badge>
                    </div>
                  )}

                  {/* Alasan Pengajuan */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Alasan Pengajuan
                    </p>
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 text-xs text-foreground leading-relaxed font-medium">
                      &ldquo;{selectedItem.alasan}&rdquo;
                    </div>
                  </div>

                  {/* Jadwal Tim Divisi yang Cuti di Sekitar Tanggal Ini (Wireframe Hal. 3) */}
                  <div className="space-y-2 border-t border-border/60 pt-4">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-primary" />
                      <p className="text-xs font-bold text-foreground">
                        Ketersediaan Tim Divisi di Periode Ini
                      </p>
                    </div>

                    {overlappingTeamLeaves.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-3 text-xs text-muted-foreground flex items-center gap-2">
                        <Check className="size-4 text-emerald-500 shrink-0" />
                        <span>Tidak ada anggota tim lain yang mengambil cuti pada rentang waktu ini.</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-muted-foreground">
                          Perhatikan potensi bentrok jadwal kerja dengan anggota divisi berikut:
                        </p>
                        <div className="divide-y divide-border/60 rounded-xl border border-border/70 overflow-hidden">
                          {overlappingTeamLeaves.map((l) => (
                            <div
                              key={l.id}
                              className="flex items-center justify-between p-2.5 bg-card text-xs hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{l.nama}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground tabular-nums text-[11px]">
                                  {formatDateDisplay(l.tanggal_mulai)} - {formatDateDisplay(l.tanggal_selesai)}
                                </span>
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                  {l.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* KOTAK AKSI KEPUTUSAN */}
                <CardFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border/60 bg-muted/20 p-4">
                  <div className="text-xs text-muted-foreground leading-tight">
                    {currentUserRole === 'atasan' ? (
                      <span>
                        Persetujuan Anda akan meneruskan pengajuan ini ke <strong>HRD</strong> untuk keputusan akhir (Tahap 2).
                      </span>
                    ) : (
                      <span>
                        Persetujuan ini merupakan keputusan final dan kuota/jadwal akan langsung disinkronkan resmi.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                    <Button
                      type="button"
                      id="btn-open-reject-leave"
                      variant="outline"
                      onClick={() => {
                        setRejectError(null);
                        setAlasanPenolakan('');
                        setRejectModalOpen(true);
                      }}
                      disabled={processing}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive gap-1.5 font-semibold text-xs h-9"
                    >
                      <XCircle className="size-4" />
                      <span>Tolak</span>
                    </Button>

                    <Button
                      type="button"
                      id="btn-approve-leave"
                      onClick={handleApprove}
                      disabled={processing}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold text-xs h-9 shadow-xs"
                    >
                      {processing ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      <span>Setujui Pengajuan</span>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* MODAL PENOLAKAN PENGAJUAN (BR-09: Wajib Alasan >= 10 Karakter) */}
      {rejectModalOpen && selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <Card className="w-full max-w-md border-border/80 shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <XCircle className="size-5" />
                  </div>
                  <div>
                    <CardTitle id="reject-dialog-title" className="text-base font-bold text-foreground">
                      Tolak Pengajuan
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Pemohon: {selectedItem.pemohon.nama_lengkap}
                    </CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setRejectModalOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <form onSubmit={handleReject}>
              <CardContent className="space-y-4 pt-4">
                {rejectError && (
                  <Alert variant="destructive" className="py-2.5 px-3">
                    <AlertCircle className="size-4" />
                    <AlertDescription className="text-xs">{rejectError}</AlertDescription>
                  </Alert>
                )}

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jenis Pengajuan:</span>
                    <span className="font-semibold text-foreground capitalize">
                      {selectedItem.jenis.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durasi:</span>
                    <span className="font-mono font-bold text-foreground">
                      {selectedItem.jumlah_hari} hari kerja
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                    Penolakan akan mengembalikan saldo kuota cuti pemohon secara otomatis.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="input-alasan-penolakan"
                      className="text-xs font-semibold text-foreground"
                    >
                      Alasan Penolakan <span className="text-destructive">*</span>
                    </label>
                    <span
                      className={cn(
                        'text-[11px] font-mono font-semibold tabular-nums',
                        alasanPenolakan.trim().length >= 10
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground'
                      )}
                    >
                      {alasanPenolakan.trim().length} / min. 10 karakter
                    </span>
                  </div>

                  <Textarea
                    id="input-alasan-penolakan"
                    rows={3}
                    required
                    value={alasanPenolakan}
                    onChange={(e) => setAlasanPenolakan(e.target.value)}
                    placeholder="Contoh: Jadwal operasional proyek sedang padat pada tanggal tersebut, mohon ajukan di minggu berikutnya."
                    className="text-xs resize-none"
                  />

                  <p className="text-[11px] text-muted-foreground">
                    Alasan penolakan wajib diisi minimal 10 karakter agar pemohon memahami konteks keputusan.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 p-4 rounded-b-xl">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={processing || alasanPenolakan.trim().length < 10}
                  className="gap-1.5 font-semibold text-xs"
                >
                  {processing && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Konfirmasi Tolak Pengajuan</span>
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
