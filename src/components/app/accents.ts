/**
 * Peta aksen warna bersama untuk kartu metrik, panel, dan header.
 *
 * Setiap aksen membawa empat peran visual:
 * - `bar`    : gradasi aksen di bagian atas kartu
 * - `tile`   : kotak ikon pastel dengan bayangan clay
 * - `surface`: warna pastel utama kartu
 * - `header` : sapuan header panel yang lebih pekat
 * - `soft`   : pill label lembut
 *
 * Semua class ditulis literal agar terdeteksi pemindai Tailwind.
 */
export type Accent = 'primary' | 'info' | 'warning' | 'danger' | 'neutral';

export interface AccentStyle {
  bar: string;
  tile: string;
  surface: string;
  header: string;
  soft: string;
  dot: string;
}

export const ACCENT_STYLES: Record<Accent, AccentStyle> = {
  primary: {
    bar: 'from-[#0f7a5f] via-[#43b992] to-[#a9eed7]',
    tile: 'bg-[#b9f0dc] text-[#0b5b45]',
    surface: 'bg-[#d9f5e8]',
    header: 'from-[#c7f1df] via-[#ddf8ec] to-[#eefcf6]',
    soft: 'bg-[#c9f2e1] text-[#0b5b45] ring-[#8edcc1]',
    dot: 'bg-[#0f7a5f]',
  },
  info: {
    bar: 'from-[#1d5f8f] via-[#62a8d8] to-[#b9e1ff]',
    tile: 'bg-[#c2e2ff] text-[#134a78]',
    surface: 'bg-[#dcecff]',
    header: 'from-[#c9e2ff] via-[#e0efff] to-[#f2f9ff]',
    soft: 'bg-[#cfe5ff] text-[#134a78] ring-[#9fcdf5]',
    dot: 'bg-[#1d5f8f]',
  },
  warning: {
    bar: 'from-[#a96f00] via-[#e5ad2a] to-[#ffe9a8]',
    tile: 'bg-[#ffe09a] text-[#6b4a00]',
    surface: 'bg-[#fff0c7]',
    header: 'from-[#ffe6a3] via-[#fff1cb] to-[#fffaeb]',
    soft: 'bg-[#ffe9ad] text-[#6b4a00] ring-[#efc65f]',
    dot: 'bg-[#a96f00]',
  },
  danger: {
    bar: 'from-[#a5263d] via-[#e46d82] to-[#ffc3ce]',
    tile: 'bg-[#ffc3ce] text-[#7a1f31]',
    surface: 'bg-[#ffdfe4]',
    header: 'from-[#ffcbd4] via-[#ffe3e8] to-[#fff3f5]',
    soft: 'bg-[#ffcbd4] text-[#7a1f31] ring-[#f49aab]',
    dot: 'bg-[#a5263d]',
  },
  neutral: {
    bar: 'from-[#4d3f78] via-[#9c8ad1] to-[#e2d9ff]',
    tile: 'bg-[#ddd3ff] text-[#3b2c6b]',
    surface: 'bg-[#ece6ff]',
    header: 'from-[#e0d8ff] via-[#eee9ff] to-[#faf7ff]',
    soft: 'bg-[#e3dbff] text-[#3b2c6b] ring-[#c3b4f2]',
    dot: 'bg-[#4d3f78]',
  },
};
