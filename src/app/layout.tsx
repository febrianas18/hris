import type { Metadata, Viewport } from "next";
import { Nunito_Sans, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const headingFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const bodyFont = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const monoFont = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e2954",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://hriskarsa.netlify.app"),
  title: {
    default: "KarsaHR | PT Karsa Lintas Nusantara",
    template: "%s | KarsaHR",
  },
  description:
    "Sistem Informasi Manajemen SDM dan Kepegawaian PT Karsa Lintas Nusantara - Portal Presensi, Cuti, Izin, dan Slip Gaji Karyawan.",
  keywords: [
    "HRIS",
    "PT Karsa Lintas Nusantara",
    "Manajemen SDM",
    "Presensi Online",
    "Slip Gaji",
    "Pengajuan Cuti",
  ],
  authors: [{ name: "PT Karsa Lintas Nusantara" }],
  creator: "PT Karsa Lintas Nusantara",
  publisher: "PT Karsa Lintas Nusantara",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "KarsaHR | PT Karsa Lintas Nusantara",
    description:
      "Sistem Informasi Manajemen SDM dan Kepegawaian PT Karsa Lintas Nusantara - Portal Presensi, Cuti, Izin, dan Slip Gaji Karyawan.",
    url: "https://hriskarsa.netlify.app",
    siteName: "KarsaHR",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KarsaHR | PT Karsa Lintas Nusantara",
    description:
      "Sistem Informasi Manajemen SDM dan Kepegawaian PT Karsa Lintas Nusantara",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={cn("h-full", bodyFont.variable, headingFont.variable, monoFont.variable)}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
