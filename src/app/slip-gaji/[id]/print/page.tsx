import { notFound, redirect } from 'next/navigation';
import { getCurrentProfile } from '@/utils/auth';
import { createClient } from '@/utils/supabase/server';
import PayslipDocument, { PayslipData } from '@/components/PayslipDocument';
import PrintHeaderBar from './PrintHeaderBar';

export const dynamic = 'force-dynamic';

export default async function PrintSlipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await getCurrentProfile();
  const supabase = await createClient();

  // 1. Ambil data slip gaji
  const { data: slip, error } = await supabase
    .from('slip_gaji')
    .select(`
      id,
      nomor_slip,
      karyawan_id,
      periode,
      gaji_pokok,
      tunjangan,
      potongan,
      total_diterima,
      catatan,
      status,
      dibuat_pada,
      diterbitkan_pada,
      diterbitkan_oleh,
      karyawan:karyawan_id (
        id,
        nik_karyawan,
        nama_lengkap,
        email,
        jabatan,
        status_kerja,
        tanggal_masuk,
        divisi:divisi_id (
          id,
          nama
        )
      ),
      publisher:diterbitkan_oleh (
        id,
        nama_lengkap,
        jabatan
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !slip) {
    notFound();
  }

  // 2. Proteksi Hak Akses Ketat (BR-11)
  if (profile.peran !== 'hrd') {
    // Karyawan dan Atasan HANYA berhak mencetak slip miliknya sendiri dan berstatus 'terbit'
    if (slip.karyawan_id !== profile.id || slip.status !== 'terbit') {
      redirect('/dashboard?forbidden=1');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSlip = slip as any;
  const payslipData: PayslipData = {
    id: rawSlip.id,
    nomor_slip: rawSlip.nomor_slip,
    periode: rawSlip.periode,
    gaji_pokok: Number(rawSlip.gaji_pokok),
    tunjangan: Number(rawSlip.tunjangan),
    potongan: Number(rawSlip.potongan),
    total_diterima: Number(rawSlip.total_diterima),
    catatan: rawSlip.catatan,
    status: rawSlip.status,
    dibuat_pada: rawSlip.dibuat_pada,
    diterbitkan_pada: rawSlip.diterbitkan_pada,
    diterbitkan_oleh: rawSlip.diterbitkan_oleh,
    karyawan: rawSlip.karyawan,
    publisher: rawSlip.publisher,
  };

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-6 text-foreground sm:py-10 print:min-h-0 print:bg-white print:p-0 print:text-black">
      {/* Aturan kertas A4: margin cetak 12mm, latar selalu putih. */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
        @media print {
          html,
          body {
            background: #ffffff !important;
          }
          .payslip-container {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* Top action bar (hidden on print) */}
      <PrintHeaderBar
        nomorSlip={payslipData.nomor_slip || 'Draf'}
        namaKaryawan={payslipData.karyawan?.nama_lengkap || ''}
      />

      {/* Payslip Document */}
      <div className="print:m-0 print:p-0">
        <PayslipDocument slip={payslipData} isPrintMode={true} />
      </div>
    </div>
  );
}
