import Link from 'next/link';
import { Building2, Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-8 text-center shadow-soft">
        <span
          aria-hidden="true"
          className="mx-auto flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 text-primary shadow-xs ring-1 ring-primary/25"
        >
          <Compass className="size-6" strokeWidth={1.75} />
        </span>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Error 404
        </p>
        <h1 className="mt-1.5 font-heading text-xl font-semibold tracking-tight text-foreground">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Alamat yang Anda buka tidak tersedia atau sudah dipindahkan. Periksa kembali tautan, lalu
          kembali ke dasbor.
        </p>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          Kembali ke dasbor
        </Link>

        <div className="mt-8 flex items-center justify-center gap-1.5 border-t border-border/70 pt-4 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          <Building2 className="size-3" strokeWidth={1.75} aria-hidden="true" />
          KarsaHR · PT Karsa Lintas Nusantara
        </div>
      </div>
    </div>
  );
}
