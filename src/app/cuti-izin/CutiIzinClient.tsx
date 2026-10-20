'use client';

import React, { useState, useMemo } from 'react';
import { calculateWorkingDays, HolidayItem } from '@/utils/workingDays';
import {
  CalendarDays,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Upload,
  Loader2,
  Calendar,
  AlertTriangle,
  FileCheck,
  Ban,
  Info,
} from 'lucide-react';

export interface LeaveRequestRecord {
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
  disetujui_atasan_pada: string | null;
  diputuskan_hrd_pada: string | null;
  alasan_penolakan: string | null;
  dibatalkan_pada: string | null;
  dibuat_pada: string;
}

interface KuotaCuti {
  tahun: number;
  jatah_hari: number;
  terpakai_hari: number;
}

interface CutiIzinClientProps {
  currentUserId: string;
  currentUserRole: string;
  tanggalMasuk: string;
  kuotaCuti: KuotaCuti | null;
  holidays: HolidayItem[];
  initialLeaves: LeaveRequestRecord[];
  todayStr: string;
}

export default function CutiIzinClient({
  currentUserId,
  currentUserRole,
  tanggalMasuk,
  kuotaCuti: initialKuota,
  holidays,
  initialLeaves,
  todayStr,
}: CutiIzinClientProps) {
  const [leaves, setLeaves] = useState<LeaveRequestRecord[]>(initialLeaves);
  const [kuota, setKuota] = useState<KuotaCuti | null>(initialKuota);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [jenis, setJenis] = useState<'cuti_tahunan' | 'sakit' | 'izin'>('cuti_tahunan');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [alasan, setAlasan] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Pembatalan
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedLeaveToCancel, setSelectedLeaveToCancel] = useState<LeaveRequestRecord | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Sisa Kuota Cuti
  const jatahHari = kuota?.jatah_hari ?? 12;
  const terpakaiHari = kuota?.terpakai_hari ?? 0;
  const sisaKuota = Math.max(0, jatahHari - terpakaiHari);

  // Kalkulasi hari kerja real-time menggunakan fungsi calculateWorkingDays (BR-04, BR-05)
  const workingDaysCalc = useMemo(() => {
    if (!tanggalMulai || !tanggalSelesai) return null;
    return calculateWorkingDays(tanggalMulai, tanggalSelesai, holidays);
  }, [tanggalMulai, tanggalSelesai, holidays]);

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

  // Submit Pengajuan Baru
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!workingDaysCalc || !workingDaysCalc.isValid) {
      setFormError(workingDaysCalc?.error || 'Rentang tanggal tidak valid.');
      return;
    }

    if (jenis === 'cuti_tahunan' && workingDaysCalc.workingDays > sisaKuota) {
      setFormError(`Sisa kuota cuti tahunan Anda tidak mencukupi (sisa: ${sisaKuota}, diminta: ${workingDaysCalc.workingDays} hari).`);
      return;
    }

    if (jenis === 'sakit' && workingDaysCalc.workingDays > 1 && !fileToUpload) {
      setFormError('Pengajuan sakit lebih dari 1 hari kerja wajib melampirkan surat dokter (PDF/JPG/PNG maksimal 2MB).');
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedFilePath: string | null = null;

      // Unggah surat dokter jika ada file
      if (fileToUpload) {
        setUploadingFile(true);
        const formData = new FormData();
        formData.append('file', fileToUpload);

        const uploadRes = await fetch('/api/leave/upload-medical', {
          method: 'POST',
          body: formData,
        });
        const uploadJson = await uploadRes.json();
        setUploadingFile(false);

        if (!uploadRes.ok || !uploadJson.success) {
          setFormError(uploadJson.error || 'Gagal mengunggah surat dokter.');
          setIsSubmitting(false);
          return;
        }
        uploadedFilePath = uploadJson.filePath;
      }

      // Kirim Pengajuan ke API
      const res = await fetch('/api/leave/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenis,
          tanggal_mulai: tanggalMulai,
          tanggal_selesai: tanggalSelesai,
          alasan: alasan.trim(),
          lampiran_path: uploadedFilePath,
        }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        setFormSuccess(resJson.message);
        setLeaves((prev) => [resJson.data, ...prev]);

        // Perbarui sisa kuota jika cuti tahunan
        if (jenis === 'cuti_tahunan') {
          setKuota((prev) =>
            prev
              ? { ...prev, terpakai_hari: prev.terpakai_hari + workingDaysCalc.workingDays }
              : null
          );
        }

        setTimeout(() => {
          setModalOpen(false);
          setTanggalMulai('');
          setTanggalSelesai('');
          setAlasan('');
          setFileToUpload(null);
          setFormSuccess(null);
        }, 1500);
      } else {
        setFormError(resJson.error || 'Gagal mengirim pengajuan.');
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Batalkan Pengajuan (BR-10)
  const handleCancel = async () => {
    if (!selectedLeaveToCancel) return;
    setCancelling(true);

    try {
      const res = await fetch('/api/leave/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pengajuan_id: selectedLeaveToCancel.id }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        setLeaves((prev) =>
          prev.map((l) => (l.id === selectedLeaveToCancel.id ? resJson.data : l))
        );

        // Jika cuti tahunan, kembalikan kuota di UI
        if (selectedLeaveToCancel.jenis === 'cuti_tahunan') {
          setKuota((prev) =>
            prev
              ? {
                  ...prev,
                  terpakai_hari: Math.max(0, prev.terpakai_hari - selectedLeaveToCancel.jumlah_hari),
                }
              : null
          );
        }

        setCancelModalOpen(false);
        setSelectedLeaveToCancel(null);
      } else {
        alert(resJson.error || 'Gagal membatalkan pengajuan.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Kartu Ringkasan Kuota & Aksi Utama (Wireframe Hal. 1) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <CalendarDays className="w-6 h-6 text-blue-600" />
              <span>Pengajuan Cuti, Sakit, & Izin</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Pencatatan hari kerja (Senin–Jumat di luar libur resmi), persetujuan berjenjang, dan transparansi kuota
            </p>
          </div>

          <button
            type="button"
            id="btn-open-ajukan-cuti"
            onClick={() => {
              setFormError(null);
              setFormSuccess(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-200 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Ajukan cuti atau izin</span>
          </button>
        </div>

        {/* Info Kuota & Hak Cuti */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Sisa Cuti Tahunan 2026
              </div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">
                {sisaKuota} <span className="text-xs font-normal text-slate-500">dari {jatahHari} hari</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {terpakaiHari} hari terpakai atau sedang diajukan (BR-04 & BR-06)
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-slate-200/80 text-slate-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Masa Kerja Anda
              </div>
              <div className="text-sm font-bold text-slate-800 mt-1">
                Masuk: {formatDateDisplay(tanggalMasuk)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Cuti tahunan berhak diambil setelah genap 12 bulan kerja (BR-04)
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Aturan Pengajuan (BR-05)
              </div>
              <div className="text-xs text-slate-700 font-medium space-y-0.5 mt-1">
                <div>• Cuti tahunan: Minimal H-3 kalender</div>
                <div>• Izin: Minimal H-1 (maks. 2 hari)</div>
                <div>• Sakit: Hari H s/d H+3 (surat dokter jika &gt;1 hari)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Riwayat Pengajuan Saya (Wireframe Hal. 1) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Pengajuan Saya</span>
          </h3>
          <span className="text-xs text-slate-500">
            Total riwayat: <strong>{leaves.length}</strong> pengajuan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Jenis</th>
                <th className="py-3 px-4">Rentang Tanggal</th>
                <th className="py-3 px-4">Lama</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Keterangan / Alasan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada pengajuan cuti, sakit, atau izin yang pernah Anda buat.
                  </td>
                </tr>
              ) : (
                leaves.map((item) => {
                  const isCancellable = item.status === 'diajukan' || item.status === 'disetujui_atasan';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold capitalize text-slate-800">
                        {item.jenis.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {formatDateDisplay(item.tanggal_mulai)}{' '}
                        {item.tanggal_mulai !== item.tanggal_selesai && (
                          <span>sampai {formatDateDisplay(item.tanggal_selesai)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        {item.jumlah_hari} hari
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                            item.status === 'disetujui'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.status === 'disetujui_atasan'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : item.status === 'diajukan'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : item.status === 'ditolak'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {item.status === 'disetujui_atasan'
                            ? 'Disetujui Atasan'
                            : item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {item.status === 'ditolak' && item.alasan_penolakan ? (
                          <span className="text-rose-600 font-medium">
                            Ditolak: {item.alasan_penolakan}
                          </span>
                        ) : (
                          item.alasan
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isCancellable ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLeaveToCancel(item);
                              setCancelModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                          >
                            Batalkan
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FORM PENGAJUAN BARU */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Formulir Pengajuan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cuti tahunan, izin, atau sakit (BR-04 s/d BR-08)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="flex-1 leading-relaxed">{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Pilihan Jenis */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Jenis Pengajuan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setJenis('cuti_tahunan')}
                    className={`py-2 px-3 rounded-xl border font-semibold text-center transition-all ${
                      jenis === 'cuti_tahunan'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Cuti Tahunan
                  </button>
                  <button
                    type="button"
                    onClick={() => setJenis('izin')}
                    className={`py-2 px-3 rounded-xl border font-semibold text-center transition-all ${
                      jenis === 'izin'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Izin (Max 2 Hari)
                  </button>
                  <button
                    type="button"
                    onClick={() => setJenis('sakit')}
                    className={`py-2 px-3 rounded-xl border font-semibold text-center transition-all ${
                      jenis === 'sakit'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Sakit
                  </button>
                </div>
              </div>

              {/* Rentang Tanggal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal Mulai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={tanggalMulai}
                    onChange={(e) => {
                      setTanggalMulai(e.target.value);
                      if (!tanggalSelesai || tanggalSelesai < e.target.value) {
                        setTanggalSelesai(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal Selesai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={tanggalMulai}
                    value={tanggalSelesai}
                    onChange={(e) => setTanggalSelesai(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Rincian Hari Kerja Real-time */}
              {workingDaysCalc && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    workingDaysCalc.isValid
                      ? 'bg-blue-50/50 border-blue-200 text-blue-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {workingDaysCalc.isValid ? (
                    <div>
                      <div className="font-bold flex items-center justify-between">
                        <span>Lama Hari Kerja: {workingDaysCalc.workingDays} hari</span>
                        <span className="text-[11px] font-normal text-slate-500">
                          Total kalender: {workingDaysCalc.totalCalendarDays} hari
                        </span>
                      </div>
                      {workingDaysCalc.weekendDates.length > 0 && (
                        <div className="text-[11px] text-slate-600 mt-1">
                          • Akhir pekan dikecualikan: {workingDaysCalc.weekendDates.length} hari
                        </div>
                      )}
                      {workingDaysCalc.holidaysEncountered.length > 0 && (
                        <div className="text-[11px] text-emerald-700 mt-0.5">
                          • Hari libur resmi dilewati: {workingDaysCalc.holidaysEncountered.map(h => h.keterangan).join(', ')}
                        </div>
                      )}
                      {jenis === 'cuti_tahunan' && (
                        <div className="text-[11px] font-semibold text-slate-700 mt-1.5 pt-1.5 border-t border-blue-200/60">
                          Sisa kuota Anda setelah ini: {Math.max(0, sisaKuota - workingDaysCalc.workingDays)} dari {jatahHari} hari
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-rose-700">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{workingDaysCalc.error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Upload Surat Dokter jika Sakit */}
              {jenis === 'sakit' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Lampiran Surat Dokter{' '}
                    {workingDaysCalc && workingDaysCalc.workingDays > 1 ? (
                      <span className="text-rose-500">* (Wajib untuk sakit &gt; 1 hari)</span>
                    ) : (
                      <span className="text-slate-400 font-normal">(Opsional)</span>
                    )}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFileToUpload(e.target.files[0]);
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Format: PDF, JPG, atau PNG (Maksimal 2 MB). Tersimpan privat di Storage.
                  </p>
                </div>
              )}

              {/* Alasan Pengajuan */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Alasan Pengajuan <span className="text-rose-500">* (Min. 5 karakter)</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Jelaskan keperluan pengajuan cuti, sakit, atau izin Anda..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              {/* Tombol Aksi */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !workingDaysCalc?.isValid || alasan.trim().length < 5}
                  className={`px-4 py-2 rounded-xl text-white font-semibold flex items-center gap-1.5 transition-all ${
                    workingDaysCalc?.isValid && alasan.trim().length >= 5 && !isSubmitting
                      ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm shadow-blue-200'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Kirim Pengajuan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI PEMBATALAN (BR-10) */}
      {cancelModalOpen && selectedLeaveToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Ban className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Batalkan Pengajuan?
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Anda akan membatalkan pengajuan{' '}
              <strong className="text-slate-800 capitalize">
                {selectedLeaveToCancel.jenis.replace('_', ' ')}
              </strong>{' '}
              ({selectedLeaveToCancel.jumlah_hari} hari kerja) tanggal{' '}
              {formatDateDisplay(selectedLeaveToCancel.tanggal_mulai)}.
              {selectedLeaveToCancel.jenis === 'cuti_tahunan' && (
                <span className="text-emerald-700 block font-semibold mt-1">
                  Kuota cuti Anda akan langsung dikembalikan.
                </span>
              )}
            </p>

            <div className="grid grid-cols-2 gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Batalkan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
