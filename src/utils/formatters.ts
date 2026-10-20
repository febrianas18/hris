/**
 * Format angka ke format mata uang Rupiah Indonesia (contoh: Rp 8.500.000)
 */
export function formatRupiah(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return 'Rp 0';
  }
  const num = Number(amount);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Konversi angka rupiah ke kalimat terbilang Bahasa Indonesia
 * Contoh: 8500000 -> "Delapan Juta Lima Ratus Ribu Rupiah"
 */
export function terbilang(n: number | string): string {
  const num = Math.floor(Math.abs(Number(n)));
  if (isNaN(num) || num === 0) return 'Nol Rupiah';

  const satuan = [
    '',
    'Satu',
    'Dua',
    'Tiga',
    'Empat',
    'Lima',
    'Enam',
    'Tujuh',
    'Delapan',
    'Sembilan',
    'Sepuluh',
    'Sebelas',
  ];

  function bilang(val: number): string {
    if (val < 12) {
      return satuan[val];
    } else if (val < 20) {
      return bilang(val - 10) + ' Belas';
    } else if (val < 100) {
      return bilang(Math.floor(val / 10)) + ' Puluh ' + bilang(val % 10);
    } else if (val < 200) {
      return 'Seratus ' + bilang(val - 100);
    } else if (val < 1000) {
      return bilang(Math.floor(val / 100)) + ' Ratus ' + bilang(val % 100);
    } else if (val < 2000) {
      return 'Seribu ' + bilang(val - 1000);
    } else if (val < 1000000) {
      return bilang(Math.floor(val / 1000)) + ' Ribu ' + bilang(val % 1000);
    } else if (val < 1000000000) {
      return bilang(Math.floor(val / 1000000)) + ' Juta ' + bilang(val % 1000000);
    } else if (val < 1000000000000) {
      return bilang(Math.floor(val / 1000000000)) + ' Miliar ' + bilang(val % 1000000000);
    } else {
      return bilang(Math.floor(val / 1000000000000)) + ' Triliun ' + bilang(val % 1000000000000);
    }
  }

  const result = bilang(num).replace(/\s+/g, ' ').trim();
  return `${result} Rupiah`;
}

/**
 * Format string tanggal periode 'YYYY-MM-01' ke nama bulan dan tahun Bahasa Indonesia
 * Contoh: '2026-10-01' -> "Oktober 2026"
 */
export function formatPeriodeBulan(dateStr: string): string {
  if (!dateStr) return '';
  const [yearStr, monthStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;

  const date = new Date(year, month, 1);
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}
