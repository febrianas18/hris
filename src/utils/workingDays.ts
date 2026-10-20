/**
 * Utilitas Penghitungan Hari Kerja (Business Rules BR-04 & BR-05)
 * - Menghitung hanya hari kerja (Senin s/d Jumat).
 * - Mengecualikan tanggal yang terdaftar di tabel 'hari_libur' (libur nasional, cuti bersama, libur perusahaan).
 * - Menolak pengajuan jika rentang tanggal tidak memuat hari kerja (0 hari).
 * - Menolak pengajuan jika rentang tanggal melewati pergantian tahun kalender (BR-05).
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface HolidayItem {
  tanggal: string;
  keterangan: string;
  jenis?: 'nasional' | 'cuti_bersama' | 'perusahaan';
}

export interface WorkingDaysResult {
  workingDays: number;
  workingDates: string[];
  holidayDates: string[];
  holidaysEncountered: HolidayItem[];
  weekendDates: string[];
  totalCalendarDays: number;
  year: number;
  isValid: boolean;
  error?: string;
}

/**
 * Normalisasi input tanggal (string 'YYYY-MM-DD' atau objek Date)
 */
function parseDateParts(dateInput: string | Date): {
  year: number;
  month: number;
  day: number;
  dateStr: string;
} {
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim().slice(0, 10);
    const [y, m, d] = cleanStr.split('-').map(Number);
    if (!y || !m || !d) {
      throw new Error(`Format tanggal tidak valid: '${dateInput}'. Gunakan format YYYY-MM-DD.`);
    }
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { year: y, month: m, day: d, dateStr };
  } else {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = formatter.format(dateInput);
    const [y, m, d] = dateStr.split('-').map(Number);
    return { year: y, month: m, day: d, dateStr };
  }
}

/**
 * Menghitung jumlah hari kerja murni antara startDate dan endDate.
 *
 * @param startDate Tanggal awal pengajuan ('YYYY-MM-DD' atau Date)
 * @param endDate Tanggal akhir pengajuan ('YYYY-MM-DD' atau Date)
 * @param holidays Daftar hari libur (bisa berupa Set string tanggal, array string tanggal, atau array objek HolidayItem)
 */
export function calculateWorkingDays(
  startDate: string | Date,
  endDate: string | Date,
  holidays:
    | Set<string>
    | string[]
    | HolidayItem[] = []
): WorkingDaysResult {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);

  // 1. Validasi urutan tanggal
  if (start.dateStr > end.dateStr) {
    return {
      workingDays: 0,
      workingDates: [],
      holidayDates: [],
      holidaysEncountered: [],
      weekendDates: [],
      totalCalendarDays: 0,
      year: start.year,
      isValid: false,
      error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai pengajuan.',
    };
  }

  // 2. Validasi Pergantian Tahun Kalender (Aturan BR-05)
  // "Satu pengajuan tidak boleh melewati pergantian tahun."
  if (start.year !== end.year) {
    return {
      workingDays: 0,
      workingDates: [],
      holidayDates: [],
      holidaysEncountered: [],
      weekendDates: [],
      totalCalendarDays: 0,
      year: start.year,
      isValid: false,
      error: `Pengajuan tidak boleh melewati pergantian tahun kalender (${start.year} ke ${end.year}) sesuai aturan BR-05. Silakan buat dua pengajuan terpisah untuk masing-masing tahun.`,
    };
  }

  // Buat lookup map untuk hari libur
  const holidayMap = new Map<string, HolidayItem>();
  if (holidays instanceof Set) {
    holidays.forEach((dateStr) => {
      holidayMap.set(dateStr, { tanggal: dateStr, keterangan: 'Hari Libur Resmi' });
    });
  } else if (Array.isArray(holidays)) {
    holidays.forEach((item) => {
      if (typeof item === 'string') {
        holidayMap.set(item, { tanggal: item, keterangan: 'Hari Libur Resmi' });
      } else if (item && item.tanggal) {
        holidayMap.set(item.tanggal, item);
      }
    });
  }

  const workingDates: string[] = [];
  const holidayDates: string[] = [];
  const holidaysEncountered: HolidayItem[] = [];
  const weekendDates: string[] = [];
  let totalCalendarDays = 0;

  // Iterasi hari demi hari menggunakan UTC millisecond arithmetic agar kebal terhadap DST
  let currentUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  while (currentUtc <= endUtc) {
    totalCalendarDays++;
    const curDate = new Date(currentUtc);
    const curYear = curDate.getUTCFullYear();
    const curMonth = curDate.getUTCMonth() + 1;
    const curDay = curDate.getUTCDate();
    const curDateStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(curDay).padStart(2, '0')}`;
    const dayOfWeek = curDate.getUTCDay(); // 0 = Minggu, 6 = Sabtu

    // Cek apakah akhir pekan (Sabtu atau Minggu)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendDates.push(curDateStr);
    } else if (holidayMap.has(curDateStr)) {
      // Cek apakah hari libur nasional / perusahaan
      holidayDates.push(curDateStr);
      holidaysEncountered.push(holidayMap.get(curDateStr)!);
    } else {
      // Hari kerja sah
      workingDates.push(curDateStr);
    }

    currentUtc += ONE_DAY_MS;
  }

  const workingDays = workingDates.length;

  // 3. Validasi rentang tanpa hari kerja (Aturan BR-05)
  // "Rentang yang tidak berisi hari kerja ditolak."
  if (workingDays === 0) {
    return {
      workingDays: 0,
      workingDates,
      holidayDates,
      holidaysEncountered,
      weekendDates,
      totalCalendarDays,
      year: start.year,
      isValid: false,
      error: 'Rentang tanggal yang dipilih tidak berisi hari kerja (hanya berisi akhir pekan atau hari libur resmi). Aturan BR-05.',
    };
  }

  return {
    workingDays,
    workingDates,
    holidayDates,
    holidaysEncountered,
    weekendDates,
    totalCalendarDays,
    year: start.year,
    isValid: true,
  };
}

/**
 * Helper asynchronous untuk menghitung hari kerja dengan mengambil data hari libur langsung dari Supabase.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function calculateWorkingDaysWithDB(
  supabase: SupabaseClient<any, any, any>,
  startDate: string | Date,
  endDate: string | Date
): Promise<WorkingDaysResult> {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);

  // Validasi awal sebelum query database
  if (start.dateStr > end.dateStr) {
    return calculateWorkingDays(startDate, endDate, []);
  }

  if (start.year !== end.year) {
    return calculateWorkingDays(startDate, endDate, []);
  }

  // Ambil hari libur dalam rentang tanggal pengajuan dari tabel hari_libur
  const { data: holidaysData, error } = await supabase
    .from('hari_libur')
    .select('tanggal, keterangan, jenis')
    .gte('tanggal', start.dateStr)
    .lte('tanggal', end.dateStr);

  if (error) {
    console.error('Gagal mengambil data hari_libur dari database:', error);
  }

  const holidays: HolidayItem[] = holidaysData || [];
  return calculateWorkingDays(startDate, endDate, holidays);
}
