import React from 'react';
import { formatRupiah, terbilang, formatPeriodeBulan } from '@/utils/formatters';
import { CheckCircle2, ShieldCheck, Building2, Clock, FileText } from 'lucide-react';

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

/**
 * Lembar slip gaji. Selalu dirender sebagai kertas putih dengan teks gelap
 * agar hasil cetak (A4) konsisten, termasuk saat aplikasi memakai tema gelap.
 * Semua warna eksplisit (hitam/putih) dibatasi di dalam komponen ini.
 */
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
      className={`payslip-container mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-black/10 bg-white text-black shadow-sm print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none ${
        isPrintMode ? 'p-6 sm:p-10 print:p-0' : 'p-5 sm:p-8'
      }`}
    >
      {/* 1. Header Perusahaan & Kop Surat */}
      <div className="flex flex-col justify-between gap-4 border-b border-black/15 pb-5 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-black/15 bg-black/[0.04]"
          >
            <Building2 className="size-5" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight text-black sm:text-xl">
              PT KARSA LINTAS NUSANTARA
            </h2>
            <p className="mt-0.5 text-xs font-medium text-black/60">
              Distribusi Logistik &amp; Pergudangan Terpadu
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-black/50">
              Jl. Cut Mutia No. 88, Bekasi Timur, Jawa Barat 17113 · (021) 8899-7700
            </p>
          </div>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-black/[0.04] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/70">
            <FileText aria-hidden="true" className="size-3" strokeWidth={1.75} />
            SLIP GAJI RESMI
          </div>
          <div className="font-heading text-base font-semibold tracking-tight text-black">
            {formatPeriodeBulan(slip.periode)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-black/60">
            No: {slip.nomor_slip || '(DRAF - Belum Terbit)'}
          </div>
        </div>
      </div>

      {/* 2. Informasi Karyawan & Status Slip */}
      <div className="my-5 grid grid-cols-1 gap-4 rounded-xl border border-black/10 bg-black/[0.02] px-4 py-4 text-xs sm:grid-cols-2 sm:px-5">
        <div className="space-y-2">
          <div className="flex gap-2">
            <span className="w-36 shrink-0 text-black/60">Nama Karyawan</span>
            <span className="font-semibold text-black">: {slip.karyawan?.nama_lengkap || '-'}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-36 shrink-0 text-black/60">Nomor Induk (NIK)</span>
            <span className="font-mono font-medium tabular-nums text-black">
              : {slip.karyawan?.nik_karyawan || '-'}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="w-36 shrink-0 text-black/60">Jabatan</span>
            <span className="text-black">: {slip.karyawan?.jabatan || '-'}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <span className="w-36 shrink-0 text-black/60">Divisi</span>
            <span className="text-black">: {slip.karyawan?.divisi?.nama || '-'}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-36 shrink-0 text-black/60">Status Kepegawaian</span>
            <span className="text-black">
              :{' '}
              {slip.karyawan?.status_kerja
                ? slip.karyawan.status_kerja.toUpperCase()
                : '-'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-36 shrink-0 text-black/60">Status Pembayaran</span>
            <span className="inline-flex items-center gap-1.5">
              :
              {isTerbit ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                  <CheckCircle2 aria-hidden="true" className="size-3" strokeWidth={1.75} />
                  Terbit &amp; Terkunci
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black/70">
                  <Clock aria-hidden="true" className="size-3" strokeWidth={1.75} />
                  Draf (Belum Sah)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Tabel Rincian Penghasilan dan Potongan */}
      <div className="my-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Kolom Kiri: Penghasilan */}
        <div className="overflow-hidden rounded-xl border border-black/15">
          <div className="flex items-center justify-between gap-2 border-b border-black/10 bg-black/[0.03] px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black/70">
              A. Penghasilan
            </span>
            <span className="text-[11px] font-medium text-black/50">Nominal (IDR)</span>
          </div>
          <div className="space-y-3 p-4 text-xs">
            <div className="flex items-center justify-between gap-3 text-black/60">
              <span>Gaji Pokok</span>
              <span className="font-mono font-medium tabular-nums text-black">
                {formatRupiah(slip.gaji_pokok)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-black/60">
              <span>Tunjangan Operasional/Lain</span>
              <span className="font-mono font-medium tabular-nums text-black">
                {formatRupiah(slip.tunjangan)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-dashed border-black/15 pt-2.5 font-semibold text-black">
              <span>Total Penghasilan (Kotor)</span>
              <span className="font-mono tabular-nums">{formatRupiah(subtotalPenghasilan)}</span>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Potongan */}
        <div className="overflow-hidden rounded-xl border border-black/15">
          <div className="flex items-center justify-between gap-2 border-b border-black/10 bg-black/[0.03] px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black/70">
              B. Potongan
            </span>
            <span className="text-[11px] font-medium text-black/50">Nominal (IDR)</span>
          </div>
          <div className="space-y-3 p-4 text-xs">
            <div className="flex items-center justify-between gap-3 text-black/60">
              <span>Potongan (BPJS / PPh / Absensi)</span>
              <span className="font-mono font-medium tabular-nums text-black">
                {formatRupiah(slip.potongan)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px] italic text-black/50">
              <span>Potongan Lainnya</span>
              <span className="font-mono tabular-nums">Rp 0</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-dashed border-black/15 pt-2.5 font-semibold text-black">
              <span>Total Potongan</span>
              <span className="font-mono tabular-nums">({formatRupiah(totalPotongan)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Total Diterima (Take Home Pay) */}
      <div className="my-5 rounded-xl border border-black/20 bg-black/[0.04] px-4 py-4 sm:px-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-black/60">
              <ShieldCheck aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              Total Gaji Bersih Diterima (Take Home Pay)
            </div>
            <div className="mt-1.5 font-heading text-2xl font-semibold tracking-tight text-black tabular-nums sm:text-3xl">
              {formatRupiah(totalDiterima)}
            </div>
          </div>
          <div className="max-w-xs text-left sm:text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black/50">
              Terbilang:
            </div>
            <div className="mt-0.5 text-xs italic leading-relaxed text-black/70 capitalize">
              &ldquo;{terbilang(totalDiterima)}&rdquo;
            </div>
          </div>
        </div>
      </div>

      {/* Catatan / Keterangan Tambahan */}
      {slip.catatan && (
        <div className="my-4 rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 text-[11px] leading-relaxed text-black/70">
          <span className="font-semibold text-black">Catatan HRD: </span>
          {slip.catatan}
        </div>
      )}

      {/* 5. Tanda Tangan & Pengesahan */}
      <div className="mt-6 grid grid-cols-2 gap-6 border-t border-black/10 pt-6 text-xs">
        <div className="text-center">
          <p className="mb-14 font-medium text-black/60">Penerima (Karyawan),</p>
          <p className="font-semibold text-black underline decoration-black/20 underline-offset-4">
            {slip.karyawan?.nama_lengkap || 'Karyawan'}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-black/60">
            NIK: {slip.karyawan?.nik_karyawan || '-'}
          </p>
        </div>

        <div className="text-center">
          <p className="mb-14 font-medium text-black/60">
            Diterbitkan oleh PT Karsa Lintas Nusantara,
          </p>
          <p className="font-semibold text-black underline decoration-black/20 underline-offset-4">
            {slip.publisher?.nama_lengkap || 'Human Resources Department'}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-black/60">
            {tanggalTerbitStr !== '-'
              ? `Disahkan pada: ${tanggalTerbitStr}`
              : 'HRD PT Karsa Lintas Nusantara'}
          </p>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="mt-6 border-t border-black/10 pt-3 text-center text-[11px] leading-relaxed text-black/50">
        Dokumen ini bersifat rahasia (Sesuai Aturan BR-11 &amp; BR-12). Sah dicetak secara
        elektronik oleh Sistem Informasi HRIS PT Karsa Lintas Nusantara tanpa tanda tangan basah.
      </div>
    </div>
  );
}
