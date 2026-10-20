import React from 'react';
import { formatRupiah, terbilang, formatPeriodeBulan } from '@/utils/formatters';
import { CheckCircle2, ShieldCheck, Building2, Calendar, FileText } from 'lucide-react';

export interface PayslipData {
  id: string;
  nomor_slip: string | null;
  periode: string;
  gaji_pokok: number;
  tunjangan: number;
  potongan: number;
  total_diterima: number;
  catatan?: string | null;
  status: 'draf' | 'terbit';
  dibuat_pada: string;
  diterbitkan_pada?: string | null;
  diterbitkan_oleh?: string | null;
  karyawan?: {
    id: string;
    nik_karyawan: string;
    nama_lengkap: string;
    email?: string;
    jabatan: string;
    status_kerja?: string;
    tanggal_masuk?: string;
    divisi?: {
      id: string;
      nama: string;
    } | null;
  };
  publisher?: {
    id: string;
    nama_lengkap: string;
    jabatan?: string;
  } | null;
}

interface PayslipDocumentProps {
  slip: PayslipData;
  isPrintMode?: boolean;
}

export default function PayslipDocument({ slip, isPrintMode = false }: PayslipDocumentProps) {
  const isTerbit = slip.status === 'terbit';
  const subtotalPenghasilan = Number(slip.gaji_pokok) + Number(slip.tunjangan);
  const totalPotongan = Number(slip.potongan);
  const totalDiterima = Number(slip.total_diterima);

  // Format tanggal terbit
  const tanggalTerbitStr = slip.diterbitkan_pada
    ? new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(slip.diterbitkan_pada)) + ' WIB'
    : '-';

  return (
    <div
      className={`bg-white text-slate-800 rounded-2xl border border-slate-200/90 shadow-sm max-w-3xl mx-auto overflow-hidden payslip-container ${
        isPrintMode ? 'p-8 border-none shadow-none print:p-0' : 'p-6 sm:p-10'
      }`}
    >
      {/* 1. Header Perusahaan & Kop Surat */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-6 border-b-2 border-slate-800/80 gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              PT KARSA LINTAS NUSANTARA
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Distribusi Logistik & Pergudangan Terpadu
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Jl. Cut Mutia No. 88, Bekasi Timur, Jawa Barat 17113 · (021) 8899-7700
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 mb-2">
            <FileText className="w-3.5 h-3.5" />
            SLIP GAJI RESMI
          </div>
          <div className="text-lg font-bold text-slate-900">
            {formatPeriodeBulan(slip.periode)}
          </div>
          <div className="text-xs font-mono text-slate-500 mt-0.5">
            No: {slip.nomor_slip || '(DRAF - Belum Terbit)'}
          </div>
        </div>
      </div>

      {/* 2. Informasi Karyawan & Status Slip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 bg-slate-50/75 rounded-xl border border-slate-100 px-4 sm:px-6 my-6 text-xs sm:text-sm">
        <div className="space-y-2">
          <div className="flex">
            <span className="w-32 text-slate-500">Nama Karyawan</span>
            <span className="font-semibold text-slate-900">: {slip.karyawan?.nama_lengkap || '-'}</span>
          </div>
          <div className="flex">
            <span className="w-32 text-slate-500">Nomor Induk (NIK)</span>
            <span className="font-mono font-medium text-slate-800">: {slip.karyawan?.nik_karyawan || '-'}</span>
          </div>
          <div className="flex">
            <span className="w-32 text-slate-500">Jabatan</span>
            <span className="text-slate-800">: {slip.karyawan?.jabatan || '-'}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex">
            <span className="w-32 text-slate-500">Divisi</span>
            <span className="text-slate-800">: {slip.karyawan?.divisi?.nama || '-'}</span>
          </div>
          <div className="flex">
            <span className="w-32 text-slate-500">Status Kepegawaian</span>
            <span className="text-slate-800">: {slip.karyawan?.status_kerja ? slip.karyawan.status_kerja.toUpperCase() : '-'}</span>
          </div>
          <div className="flex items-center">
            <span className="w-32 text-slate-500">Status Pembayaran</span>
            <span className="inline-flex items-center gap-1 font-semibold">
              : {isTerbit ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded text-xs font-bold uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Terbit & Terkunci
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded text-xs font-bold uppercase">
                  Draf (Belum Sah)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Tabel Rincian Penghasilan dan Potongan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6">
        {/* Kolom Kiri: Penghasilan */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
              A. Penghasilan
            </span>
            <span className="text-[11px] font-semibold text-slate-500">Nominal (IDR)</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between items-center text-slate-600">
              <span>Gaji Pokok</span>
              <span className="font-mono font-medium text-slate-900">{formatRupiah(slip.gaji_pokok)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Tunjangan Operasional/Lain</span>
              <span className="font-mono font-medium text-slate-900">{formatRupiah(slip.tunjangan)}</span>
            </div>
            <div className="pt-3 border-t border-dashed border-slate-200 flex justify-between items-center font-bold text-slate-900">
              <span>Total Penghasilan (Kotor)</span>
              <span className="font-mono text-emerald-700">{formatRupiah(subtotalPenghasilan)}</span>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Potongan */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
              B. Potongan
            </span>
            <span className="text-[11px] font-semibold text-slate-500">Nominal (IDR)</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between items-center text-slate-600">
              <span>Potongan (BPJS / PPh / Absensi)</span>
              <span className="font-mono font-medium text-rose-600">{formatRupiah(slip.potongan)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400 text-xs italic">
              <span>Potongan Lainnya</span>
              <span className="font-mono">Rp 0</span>
            </div>
            <div className="pt-3 border-t border-dashed border-slate-200 flex justify-between items-center font-bold text-slate-900">
              <span>Total Potongan</span>
              <span className="font-mono text-rose-600">({formatRupiah(totalPotongan)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Total Diterima (Take Home Pay) */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 my-6 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-indigo-200 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Total Gaji Bersih Diterima (Take Home Pay)
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white mt-1">
              {formatRupiah(totalDiterima)}
            </div>
          </div>
          <div className="text-left sm:text-right max-w-sm">
            <div className="text-[11px] uppercase tracking-wider text-indigo-300 font-medium">Terbilang:</div>
            <div className="text-xs sm:text-sm font-medium italic text-indigo-100 mt-0.5 capitalize">
              "{terbilang(totalDiterima)}"
            </div>
          </div>
        </div>
      </div>

      {/* Catatan / Keterangan Tambahan */}
      {slip.catatan && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-4 text-xs text-slate-600">
          <span className="font-bold text-slate-800">Catatan HRD: </span>
          {slip.catatan}
        </div>
      )}

      {/* 5. Tanda Tangan & Pengesahan */}
      <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-200 text-xs sm:text-sm">
        <div className="text-center">
          <p className="text-slate-500 font-medium mb-16">Penerima (Karyawan),</p>
          <p className="font-bold text-slate-900 underline decoration-slate-300 underline-offset-4">
            {slip.karyawan?.nama_lengkap || 'Karyawan'}
          </p>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            NIK: {slip.karyawan?.nik_karyawan || '-'}
          </p>
        </div>

        <div className="text-center">
          <p className="text-slate-500 font-medium mb-16">
            Diterbitkan oleh PT Karsa Lintas Nusantara,
          </p>
          <p className="font-bold text-slate-900 underline decoration-slate-300 underline-offset-4">
            {slip.publisher?.nama_lengkap || 'Human Resources Department'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {tanggalTerbitStr !== '-' ? `Disahkan pada: ${tanggalTerbitStr}` : 'HRD PT Karsa Lintas Nusantara'}
          </p>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="mt-8 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
        Dokumen ini bersifat rahasia (Sesuai Aturan BR-11 & BR-12). Sah dicetak secara elektronik oleh Sistem Informasi HRIS PT Karsa Lintas Nusantara tanpa tanda tangan basah.
      </div>
    </div>
  );
}
