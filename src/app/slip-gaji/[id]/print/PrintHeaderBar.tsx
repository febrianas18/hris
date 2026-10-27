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
    <div className="mx-auto mb-5 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-xs print:hidden">
      <Link
        href="/slip-gaji"
        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs font-semibold text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
        <span>Kembali ke Slip Gaji</span>
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <span className="hidden text-[11px] text-muted-foreground tabular-nums sm:inline-block">
          {nomorSlip} · {namaKaryawan}
        </span>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Printer aria-hidden="true" className="size-4" strokeWidth={1.75} />
          <span>Cetak / Simpan PDF</span>
        </button>
      </div>
    </div>
  );
}
