import { SupabaseClient } from '@supabase/supabase-js';

export interface WeeklyAttendanceStat {
  minggu: string; // e.g. 'Minggu 1', 'Minggu 2', ...
  rentang: string; // e.g. '29 Sep - 03 Okt'
  hadir: number;
  terlambat: number;
  cuti_izin: number;
  tanpa_keterangan: number;
}

export interface DivisionLeaveStat {
  divisi: string;
  cuti_tahunan: number;
  sakit: number;
  izin: number;
}

export interface DivisionPayrollStat {
  divisi_id: string;
  divisi_nama: string;
  jumlah_karyawan: number;
  total_gaji_pokok: number;
  total_tunjangan: number;
  total_potongan: number;
  total_diterima: number;
}

export interface LateEmployeeStat {
  karyawan_id: string;
  nama_lengkap: string;
  nik_karyawan: string;
  jabatan: string;
  divisi_nama: string;
  jumlah_terlambat: number;
}

/**
 * Helper untuk menghitung statistik kehadiran 4 minggu terakhir secara presisi (PRD Bab 9)
 * Menghitung otomatis: Hadir tepat waktu, Terlambat, Cuti/Izin disetujui, dan Tanpa Keterangan (Alpa)
 */
export async function getFourWeeksAttendanceStats(
  supabase: SupabaseClient,
  referenceDateStr: string = '2026-10-20'
): Promise<WeeklyAttendanceStat[]> {
  // 1. Ambil seluruh data hari libur resmi
  const { data: holidaysData } = await supabase
    .from('hari_libur')
    .select('tanggal');
  const holidaySet = new Set((holidaysData || []).map((h) => h.tanggal));

  // 2. Ambil seluruh karyawan aktif
  const { data: employees } = await supabase
    .from('profiles')
    .select('id, nama_lengkap, tanggal_masuk')
    .eq('aktif', true);

  const activeEmployees = employees || [];

  // 3. Tentukan 4 rentang minggu kerja (Senin - Jumat) sebelum/hingga tanggal acuan
  const refDate = new Date(referenceDateStr);
  const currentDay = refDate.getDay(); // 0 = Minggu, 1 = Senin, ...
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

  const currentMonday = new Date(refDate);
  currentMonday.setDate(refDate.getDate() + mondayOffset);

  const weeks: { label: string; start: Date; end: Date }[] = [];
  for (let i = 3; i >= 0; i--) {
    const mon = new Date(currentMonday);
    mon.setDate(currentMonday.getDate() - i * 7);

    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);

    const label = `Minggu ${4 - i}`;
    weeks.push({ label, start: mon, end: fri });
  }

  // Rentang total 4 minggu
  const overallStart = weeks[0].start.toISOString().slice(0, 10);
  const overallEnd = weeks[3].end.toISOString().slice(0, 10);

  // 4. Ambil seluruh absensi dalam rentang 4 minggu
  const { data: attendances } = await supabase
    .from('absensi')
    .select('karyawan_id, tanggal, status')
    .gte('tanggal', overallStart)
    .lte('tanggal', overallEnd);

  // Map: `${karyawan_id}_${tanggal}` -> status ('hadir' | 'terlambat')
  const attMap = new Map<string, string>();
  (attendances || []).forEach((a) => {
    attMap.set(`${a.karyawan_id}_${a.tanggal}`, a.status);
  });

  // 5. Ambil seluruh pengajuan cuti yang disetujui dalam rentang 4 minggu
  const { data: leaves } = await supabase
    .from('pengajuan_cuti')
    .select('karyawan_id, tanggal_mulai, tanggal_selesai, jenis')
    .eq('status', 'disetujui')
    .lte('tanggal_mulai', overallEnd)
    .gte('tanggal_selesai', overallStart);

  const approvedLeaves = leaves || [];

  // Helper cek apakah karyawan sedang cuti pada tanggal tertentu
  const isEmployeeOnLeave = (karyawanId: string, dateStr: string): boolean => {
    return approvedLeaves.some(
      (l) =>
        l.karyawan_id === karyawanId &&
        dateStr >= l.tanggal_mulai &&
        dateStr <= l.tanggal_selesai
    );
  };

  // 6. Hitung agregat per minggu
  const result: WeeklyAttendanceStat[] = [];

  for (const week of weeks) {
    let countHadir = 0;
    let countTerlambat = 0;
    let countCutiIzin = 0;
    let countAlpa = 0;

    const startStr = week.start.toISOString().slice(0, 10);
    const endStr = week.end.toISOString().slice(0, 10);

    // Iterasi 5 hari kerja (Senin s/d Jumat)
    const cursor = new Date(week.start);
    while (cursor <= week.end) {
      const dateStr = cursor.toISOString().slice(0, 10);

      // Hanya hitung jika bukan hari libur
      if (!holidaySet.has(dateStr)) {
        for (const emp of activeEmployees) {
          // Hanya hitung jika karyawan sudah bergabung pada tanggal tersebut
          if (emp.tanggal_masuk && emp.tanggal_masuk > dateStr) {
            continue;
          }

          const isLeave = isEmployeeOnLeave(emp.id, dateStr);
          const attStatus = attMap.get(`${emp.id}_${dateStr}`);
          if (isLeave) {
            countCutiIzin++;
          } else if (attStatus === 'hadir') {
            countHadir++;
          } else if (attStatus === 'terlambat') {
            countTerlambat++;
          } else {
            // Tanpa Keterangan (Alpa) dihitung otomatis jika hari kerja tidak ada absensi dan tidak cuti
            // Hanya jika tanggal <= referenceDateStr
            if (dateStr <= referenceDateStr) {
              countAlpa++;
            }
          }
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    const formatShortDate = (d: Date) =>
      new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d);

    result.push({
      minggu: week.label,
      rentang: `${formatShortDate(week.start)} - ${formatShortDate(week.end)}`,
      hadir: countHadir,
      terlambat: countTerlambat,
      cuti_izin: countCutiIzin,
      tanpa_keterangan: countAlpa,
    });
  }

  return result;
}
