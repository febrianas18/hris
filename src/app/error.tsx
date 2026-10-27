'use client';

import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-8 text-center shadow-soft">
        <span
          aria-hidden="true"
          className="mx-auto flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-destructive/25 to-destructive/5 text-destructive shadow-xs ring-1 ring-destructive/25"
        >
          <AlertTriangle className="size-6" strokeWidth={1.75} />
        </span>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Terjadi kesalahan
        </p>
        <h1 className="mt-1.5 font-heading text-xl font-semibold tracking-tight text-foreground">
          Halaman gagal dimuat
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Sistem tidak dapat menyelesaikan permintaan Anda. Coba muat ulang halaman; jika masih
          gagal, hubungi tim HRD.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground/70">Kode: {error.digest}</p>
        ) : null}

        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            Coba lagi
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            Kembali ke dasbor
          </Link>
        </div>
      </div>
    </div>
  );
}
