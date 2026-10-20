/**
 * Utilitas Waktu Server Zona WIB (Asia/Jakarta - UTC+7)
 * Memastikan seluruh pencatatan jam dan validasi absensi diambil langsung dari server,
 * bukan dari perangkat browser pengguna (Aturan BR-02 & BR-03).
 */

export interface ServerTimeWIB {
  dateStr: string;           // Format: 'YYYY-MM-DD'
  timeStr: string;           // Format: 'HH:mm:ss'
  fullDisplayStr: string;    // Contoh: 'Kamis, 15 Okt 2026 · 08.15.00 WIB'
  weekdayStr: string;        // 'Senin', 'Selasa', dst.
  isWeekend: boolean;        // true jika Sabtu atau Minggu
  hour: number;
  minute: number;
  second: number;
  secondsSinceMidnight: number;
  isBetween06And12: boolean; // Antara 06.00.00 s/d 12.00.00 WIB
  statusKehadiran: 'hadir' | 'terlambat'; // BR-03
  timestamptzStr: string;    // Format PostgreSQL: 'YYYY-MM-DDTHH:mm:ss+07:00'
  serverDate: Date;
}

/**
 * Dapatkan waktu server dalam zona WIB (Asia/Jakarta)
 * @param customDate Date opsional (berguna untuk simulasi kasus batas/uji)
 */
export function getServerTimeWIB(customDate?: Date | string): ServerTimeWIB {
  const baseDate = customDate ? new Date(customDate) : new Date();

  // Formatter untuk mengambil komponen waktu spesifik di zona Asia/Jakarta
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(baseDate);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '0';

  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10);
  const day = parseInt(getPart('day'), 10);
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const second = parseInt(getPart('second'), 10);

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;

  // Cek hari kerja (Senin s/d Jumat) di zona Asia/Jakarta
  const dayOfWeekFormatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
  });
  const weekdayStr = dayOfWeekFormatter.format(baseDate);
  const isWeekend = weekdayStr.toLowerCase() === 'sabtu' || weekdayStr.toLowerCase() === 'minggu';

  // Detik sejak 00:00:00 WIB
  const secondsSinceMidnight = hour * 3600 + minute * 60 + second;

  // Jendela waktu check-in: 06.00.00 s/d 12.00.00 WIB (BR-02)
  const isBetween06And12 = secondsSinceMidnight >= 6 * 3600 && secondsSinceMidnight <= 12 * 3600;

  // Batas toleransi kehadiran: 08.15.00 WIB (BR-03)
  // Tepat 08.15.00 masih 'hadir', lewat dari 08.15.00 (misal 08.15.01) berstatus 'terlambat'
  const isTerlambat = secondsSinceMidnight > (8 * 3600 + 15 * 60);
  const statusKehadiran: 'hadir' | 'terlambat' = isTerlambat ? 'terlambat' : 'hadir';

  // Format ISO timestamptz untuk PostgreSQL (+07:00)
  const timestamptzStr = `${dateStr}T${timeStr}+07:00`;

  const displayFormatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const fullDisplayStr = `${displayFormatter.format(baseDate)} · ${timeStr} WIB`;

  return {
    dateStr,
    timeStr,
    fullDisplayStr,
    weekdayStr,
    isWeekend,
    hour,
    minute,
    second,
    secondsSinceMidnight,
    isBetween06And12,
    statusKehadiran,
    timestamptzStr,
    serverDate: baseDate,
  };
}
