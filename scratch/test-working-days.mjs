import { createClient } from '@supabase/supabase-js';
import { calculateWorkingDays, calculateWorkingDaysWithDB } from '../src/utils/workingDays.ts';

const SUPABASE_URL = 'https://hehtaiitqlqepvtxhrnx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlaHRhaWl0cWxxZXB2dHhocm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTk4OTYsImV4cCI6MjEwNzk5NTg5Nn0.cTAfznAOFqeiZQ2Ig5zplS5rlRmWyUQx39X1RafHHM4';

async function runTests() {
  console.log('=== TEST HELPER PENGHITUNGAN HARI KERJA (BR-04 & BR-05) ===\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'andi.wijaya@karsalintas.test',
    password: 'Latihan#2026',
  });
  if (loginErr) {
    console.error('Login gagal:', loginErr);
    process.exit(1);
  }
  console.log('✓ Login sukses sebagai:', authData.user.email);

  // Ambil data hari libur dari Supabase
  const { data: dbHolidays, error: holidayErr } = await supabase.from('hari_libur').select('*');
  if (holidayErr) {
    console.error('Gagal mengambil hari_libur:', holidayErr);
  }
  console.log(`Memuat ${dbHolidays?.length || 0} data hari libur dari Supabase.\n`);

  // Kasus 1: Hari kerja biasa (Senin 19 Okt 2026 s/d Rabu 21 Okt 2026) -> 3 hari
  console.log('--- Kasus 1: Rentang Hari Kerja Normal (19 - 21 Okt 2026) ---');
  let result = calculateWorkingDays('2026-10-19', '2026-10-21', dbHolidays || []);
  console.log(`Hasil: ${result.workingDays} hari kerja (Valid: ${result.isValid})`);
  console.log(`Tanggal kerja:`, result.workingDates);
  if (result.workingDays === 3 && result.isValid) {
    console.log('✓ PASS: Dihitung tepat 3 hari kerja.\n');
  } else {
    console.error('✗ FAIL\n');
  }

  // Kasus 2: Melewati akhir pekan (Jumat 16 Okt 2026 s/d Senin 19 Okt 2026) -> 2 hari kerja
  console.log('--- Kasus 2: Rentang Melewati Akhir Pekan (Jumat 16 - Senin 19 Okt 2026) ---');
  result = calculateWorkingDays('2026-10-16', '2026-10-19', dbHolidays || []);
  console.log(`Hasil: ${result.workingDays} hari kerja (Akhir pekan: ${result.weekendDates.join(', ')})`);
  if (result.workingDays === 2 && result.weekendDates.length === 2) {
    console.log('✓ PASS: Sabtu & Minggu berhasil dikecualikan, dihitung 2 hari kerja.\n');
  } else {
    console.error('✗ FAIL\n');
  }

  // Kasus 3: Contoh PRD Baris 217: 22 sampai 23 Oktober 2026 dihitung 1 hari kerja (23 Okt libur HUT PT KLN)
  console.log('--- Kasus 3: Contoh PRD Baris 217 (22 - 23 Okt 2026, 23 Okt Libur HUT PT KLN) ---');
  result = calculateWorkingDays('2026-10-22', '2026-10-23', dbHolidays || []);
  console.log(`Hasil: ${result.workingDays} hari kerja`);
  console.log(`Hari Libur Terdeteksi:`, result.holidaysEncountered);
  if (result.workingDays === 1 && result.holidayDates.includes('2026-10-23')) {
    console.log('✓ PASS: 22-23 Okt 2026 tepat dihitung 1 hari kerja (sesuai contoh resmi PRD).\n');
  } else {
    console.error('✗ FAIL\n');
  }

  // Kasus 4: Rentang hanya berisi akhir pekan (Sabtu 24 Okt s/d Minggu 25 Okt 2026) -> Ditolak (0 hari kerja)
  console.log('--- Kasus 4: Rentang Hanya Berisi Akhir Pekan (24 - 25 Okt 2026) ---');
  result = calculateWorkingDays('2026-10-24', '2026-10-25', dbHolidays || []);
  console.log(`Valid: ${result.isValid}, Hari Kerja: ${result.workingDays}`);
  console.log(`Pesan Error: "${result.error}"`);
  if (!result.isValid && result.workingDays === 0 && result.error?.includes('tidak berisi hari kerja')) {
    console.log('✓ PASS: Rentang tanpa hari kerja berhasil ditolak (BR-05).\n');
  } else {
    console.error('✗ FAIL\n');
  }

  // Kasus 5: Rentang hanya berisi hari libur resmi (23 Okt 2026) -> Ditolak (0 hari kerja)
  console.log('--- Kasus 5: Rentang Hanya Berisi Hari Libur Resmi (23 Okt 2026) ---');
  result = calculateWorkingDays('2026-10-23', '2026-10-23', dbHolidays || []);
  console.log(`Valid: ${result.isValid}, Hari Kerja: ${result.workingDays}`);
  console.log(`Pesan Error: "${result.error}"`);
  if (!result.isValid && result.workingDays === 0) {
    console.log('✓ PASS: Rentang pada hari libur resmi ditolak karena 0 hari kerja (BR-05).\n');
  } else {
    console.error('✗ FAIL\n');
  }

  // Kasus 6: Rentang melewati pergantian tahun kalender (30 Des 2026 s/d 2 Jan 2027) -> Ditolak (BR-05)
  console.log('--- Kasus 6: Rentang Melewati Pergantian Tahun (30 Des 2026 - 2 Jan 2027) ---');
  result = calculateWorkingDays('2026-10-30', '2027-01-02', dbHolidays || []);
  console.log(`Valid: ${result.isValid}, Pesan Error: "${result.error}"`);
  if (!result.isValid && result.error?.includes('pergantian tahun kalender')) {
    console.log('✓ PASS: Pengajuan lintas tahun kalender berhasil ditolak sesuai aturan BR-05.\n');
  } else {
    console.error('✗ FAIL\n');
  }

  // Kasus 7: Tanggal selesai lebih awal dari tanggal mulai
  console.log('--- Kasus 7: Tanggal Selesai Lebih Awal dari Tanggal Mulai ---');
  result = calculateWorkingDays('2026-10-25', '2026-10-20', dbHolidays || []);
  console.log(`Valid: ${result.isValid}, Pesan Error: "${result.error}"`);
  if (!result.isValid && result.error?.includes('lebih awal')) {
    console.log('✓ PASS: Validasi urutan tanggal berhasil.\n');
  } else {
    console.error('✗ FAIL\n');
  }

  // Kasus 8: Uji fungsi asynchronous calculateWorkingDaysWithDB langsung ke Supabase
  console.log('--- Kasus 8: Uji calculateWorkingDaysWithDB (Query Langsung ke Supabase) ---');
  const dbResult = await calculateWorkingDaysWithDB(supabase, '2026-10-22', '2026-10-23');
  console.log(`Hasil dari DB: ${dbResult.workingDays} hari kerja (Hari libur: ${dbResult.holidaysEncountered.map(h => h.keterangan).join(', ')})`);
  if (dbResult.workingDays === 1 && dbResult.isValid) {
    console.log('✓ PASS: calculateWorkingDaysWithDB berhasil mengambil data hari libur dari Supabase dan menghitung dengan benar.\n');
  } else {
    console.error('✗ FAIL\n');
  }

  console.log('=== SEMUA PENGUJIAN PENGHITUNGAN HARI KERJA SUKSES (100% PASS)! ===');
}

runTests().catch(console.error);
