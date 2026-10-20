'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';

interface PrintHeaderBarProps {
  nomorSlip: string;
  namaKaryawan: string;
}

export default function PrintHeaderBar({ nomorSlip, namaKaryawan }: PrintHeaderBarProps) {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between gap-4 print:hidden bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
      <Link
        href="/slip-gaji"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Slip Gaji</span>
      </Link>

      <div className="flex items-center gap-3">
        <span className="hidden sm:inline-block text-xs text-slate-400">
          {nomorSlip} · {namaKaryawan}
        </span>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-all active:scale-95"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak / Simpan PDF</span>
        </button>
      </div>
    </div>
  );
}
