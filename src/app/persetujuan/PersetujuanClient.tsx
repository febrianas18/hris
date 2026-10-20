'use client';

import React, { useState } from 'react';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Calendar,
  Building,
  FileText,
  Paperclip,
  Loader2,
  X,
  ExternalLink,
  Users,
} from 'lucide-react';

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

export default function PersetujuanClient({
  currentUserRole,
  currentUserId,
  currentUserDivisiId,
  initialItems,
  allActiveLeavesAroundDate,
}: PersetujuanClientProps) {
  const [items, setItems] = useState<PendingLeaveItem[]>(initialItems);
  const [selectedItem, setSelectedItem] = useState<PendingLeaveItem | null>(
    initialItems.length > 0 ? initialItems[0] : null
  );

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
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
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

  // Tolak Pengajuan
  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (alasanPenolakan.trim().length < 10) {
      setRejectError('Alasan penolakan wajib minimal 10 karakter (Aturan BR-09).');
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
        setRejectError(resJson.error || 'Penolakan gagal.');
      }
    } catch {
      setRejectError('Terjadi kesalahan jaringan.');
    } finally {
      setProcessing(false);
    }
  };

  // Tim yang cuti di sekitar tanggal ini (Wireframe Hal. 3)
  const overlappingTeamLeaves = React.useMemo(() => {
    if (!selectedItem) return [];
    return allActiveLeavesAroundDate.filter(
      (l) => l.karyawan_id !== selectedItem.karyawan_id
    );
  }, [selectedItem, allActiveLeavesAroundDate]);

  return (
    <div className="space-y-6">
      {/* Banner Notifikasi Aksi */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2.5 animate-in fade-in duration-200 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Tidak Ada Pengajuan Menunggu Persetujuan
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Semua pengajuan cuti, sakit, dan izin dari staf telah Anda putuskan.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Daftar Antrean Pengajuan */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-amber-600" />
                <span>Menunggu Keputusan</span>
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {items.length}
              </span>
            </div>

            <div className="space-y-2">
              {items.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedItem(item);
                      setActionFeedback(null);
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900">
                        {item.pemohon.nama_lengkap}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {item.jenis.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {item.pemohon.divisi?.nama || '-'} · {item.jumlah_hari} hari kerja
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {formatDateDisplay(item.tanggal_mulai)} - {formatDateDisplay(item.tanggal_selesai)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kolom Kanan: Detail Pengajuan & Formulir Keputusan (Wireframe Hal. 3) */}
          {selectedItem && (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
                {/* Header Detail */}
                <div className="pb-5 border-b border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Persetujuan / Detail Pengajuan
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
                      {selectedItem.status === 'disetujui_atasan' ? 'Disetujui Atasan (Tahap 1)' : 'Diajukan'}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight capitalize">
                    {selectedItem.jenis.replace('_', ' ')}: {selectedItem.pemohon.nama_lengkap}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Diajukan pada {formatDateDisplay(selectedItem.dibuat_pada.slice(0, 10))} ·{' '}
                    {selectedItem.perlu_atasan
                      ? selectedItem.status === 'disetujui_atasan'
                        ? 'Tahap 2 dari 2 (Keputusan Akhir HRD)'
                        : 'Tahap 1 dari 2 (Persetujuan Atasan Divisi)'
                      : 'Tahap 1 (Langsung ke HRD)'}
                  </p>
                </div>

                {/* Grid Rincian Pengajuan (Wireframe Hal. 3) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 text-xs">
                  <div className="space-y-4">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Pemohon</div>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        {selectedItem.pemohon.nama_lengkap}
                      </div>
                      <div className="text-slate-600 mt-0.5">
                        {selectedItem.pemohon.nik_karyawan} · {selectedItem.pemohon.jabatan}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Tanggal Pengajuan</div>
                      <div className="font-bold text-slate-800 mt-0.5">
                        {formatDateDisplay(selectedItem.tanggal_mulai)} sampai{' '}
                        {formatDateDisplay(selectedItem.tanggal_selesai)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Lama Hari Kerja</div>
                      <div className="font-bold text-slate-800 mt-0.5">
                        {selectedItem.jumlah_hari} hari kerja
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Alasan Pengajuan</div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 font-medium mt-1 leading-relaxed">
                        {selectedItem.alasan}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Kuota Cuti Pemohon 2026</div>
                      {selectedItem.kuota ? (
                        <div className="mt-0.5">
                          <span className="font-bold text-slate-900">
                            Jatah {selectedItem.kuota.jatah_hari} hari
                          </span>{' '}
                          · terpakai {selectedItem.kuota.terpakai_hari} (termasuk pengajuan ini) ·{' '}
                          <span className="text-emerald-700 font-semibold">
                            sisa {Math.max(0, selectedItem.kuota.jatah_hari - selectedItem.kuota.terpakai_hari)} hari
                          </span>
                        </div>
                      ) : (
                        <div className="text-slate-500 mt-0.5">-</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Lampiran Surat Dokter</div>
                      <div className="mt-0.5">
                        {selectedItem.lampiran_path ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>Surat Dokter Terlampir ({selectedItem.lampiran_path.split('/').pop()})</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">Tidak ada lampiran</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Status & Masa Kerja</div>
                      <div className="text-slate-800 font-medium mt-0.5">
                        {selectedItem.pemohon.status_kerja}, masuk{' '}
                        {formatDateDisplay(selectedItem.pemohon.tanggal_masuk)}
                      </div>
                    </div>

                    {/* Tim yang Cuti di Sekitar Tanggal Ini (Wireframe Hal. 3) */}
                    <div className="pt-2">
                      <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>Tim divisi yang cuti di sekitar tanggal ini:</span>
                      </div>
                      {overlappingTeamLeaves.length === 0 ? (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 text-[11px]">
                          Tidak ada anggota lain yang mengambil cuti pada periode ini.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {overlappingTeamLeaves.map((l) => (
                            <div
                              key={l.id}
                              className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-between text-[11px]"
                            >
                              <span className="font-semibold text-slate-800">{l.nama}</span>
                              <span className="text-slate-500 font-mono">
                                {formatDateDisplay(l.tanggal_mulai)} - {formatDateDisplay(l.tanggal_selesai)}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold uppercase text-[9px]">
                                {l.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Kotak Keputusan Anda (Wireframe Hal. 3) */}
                <div className="mt-8 p-5 rounded-2xl bg-slate-50 border border-slate-200">
                  <h3 className="text-xs font-bold text-slate-900 mb-3">
                    Keputusan Anda
                  </h3>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      id="btn-approve-leave"
                      onClick={handleApprove}
                      disabled={processing}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-200 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>Setujui</span>
                    </button>

                    <button
                      type="button"
                      id="btn-open-reject-leave"
                      onClick={() => {
                        setRejectError(null);
                        setAlasanPenolakan('');
                        setRejectModalOpen(true);
                      }}
                      disabled={processing}
                      className="px-6 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 text-slate-700 font-semibold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                      <span>Tolak</span>
                    </button>

                    <span className="text-[11px] text-slate-500 italic ml-2">
                      {currentUserRole === 'atasan'
                        ? 'Setelah Anda setujui, pengajuan akan diteruskan ke HRD untuk keputusan akhir.'
                        : 'Setelah Anda setujui, pengajuan berstatus resmi disetujui.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL PENOLAKAN PENGAJUAN (BR-09: Wajib Alasan >= 10 Karakter) */}
      {rejectModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Tolak Pengajuan {selectedItem.pemohon.nama_lengkap}
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReject} className="mt-4 space-y-4 text-xs">
              {rejectError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{rejectError}</span>
                </div>
              )}

              <p className="text-slate-500 leading-relaxed">
                Penolakan akan mengembalikan kuota cuti tahunan ke saldo pemohon secara otomatis.
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Alasan Penolakan <span className="text-rose-500">* (Min. 10 karakter - BR-09)</span>
                  </label>
                  <span
                    className={`text-[10px] font-semibold ${
                      alasanPenolakan.trim().length >= 10 ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {alasanPenolakan.trim().length}/10 karakter
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  value={alasanPenolakan}
                  onChange={(e) => setAlasanPenolakan(e.target.value)}
                  placeholder="Contoh: Jadwal kerja sedang padat dan ada rilis proyek penting pada tanggal tersebut."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={processing || alasanPenolakan.trim().length < 10}
                  className={`px-4 py-2 rounded-xl text-white font-semibold flex items-center gap-1.5 transition-all ${
                    alasanPenolakan.trim().length >= 10 && !processing
                      ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-sm'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  {processing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Konfirmasi Penolakan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
