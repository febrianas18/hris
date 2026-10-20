/**
 * SEED SCRIPT (Node.js) - HRIS PT Karsa Lintas Nusantara
 * Membaca 'docs/Data_Contoh_HRIS.xlsx' (jika ada file Excel) atau fallback ke data contoh default.
 * - Mengabaikan semua kolom yang berakhiran '(bantu)'
 * - Membuat user Supabase Auth untuk setiap karyawan di sheet 'Akun Uji' dengan password 'Latihan#2026'
 * - Memasukkan data ke tabel: divisi, profiles, hari_libur, kuota_cuti, absensi, slip_gaji, audit_log
 * 
 * Penggunaan:
 *   npm install @supabase/supabase-js xlsx dotenv
 *   node supabase/seed.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Konfigurasi Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hehtaiitqlqepvtxhrnx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[PERINGATAN] SUPABASE_SERVICE_ROLE_KEY belum diset di environment.');
  console.warn('Untuk memasukkan langsung via database, Anda juga dapat menjalankan file SQL: supabase/seed.sql');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DEFAULT_PASSWORD = 'Latihan#2026';
const EXCEL_PATH = path.resolve(__dirname, '../docs/Data_Contoh_HRIS.xlsx');

/**
 * Filter kolom: buang kolom yang berakhiran '(bantu)'
 */
function cleanRow(row) {
  const cleaned = {};
  for (const [key, value] of Object.entries(row)) {
    const trimmedKey = key.trim();
    if (!trimmedKey.endsWith('(bantu)')) {
      cleaned[trimmedKey] = value;
    }
  }
  return cleaned;
}

async function runSeed() {
  console.log('=== MEMULAI SEEDING HRIS PT KARSA LINTAS NUSANTARA ===');

  if (!fs.existsSync(EXCEL_PATH)) {
    console.log(`[INFO] File Excel '${EXCEL_PATH}' tidak ditemukan secara fisik di folder docs/.`);
    console.log('[INFO] Gunakan file DDL SQL "supabase/seed.sql" yang telah menyertakan seluruh data contoh siap pakai.');
    return;
  }

  // Jika file Excel ada, load xlsx
  let xlsx;
  try {
    xlsx = await import('xlsx');
  } catch (err) {
    console.error('[ERROR] Module "xlsx" belum terinstal. Silakan jalankan: npm install xlsx');
    return;
  }

  const workbook = xlsx.readFile(EXCEL_PATH);
  console.log('Sheet yang tersedia:', workbook.SheetNames);

  // 1. Baca sheet Akun Uji
  if (workbook.SheetNames.includes('Akun Uji')) {
    const rawAkun = xlsx.utils.sheet_to_json(workbook.Sheets['Akun Uji']);
    console.log(`Menemukan ${rawAkun.length} akun uji.`);

    for (const item of rawAkun) {
      const data = cleanRow(item);
      const email = data.email;
      if (!email) continue;

      console.log(`Membuat auth user: ${email}...`);
      const { data: user, error } = await supabase.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          nama_lengkap: data.nama || data.nama_lengkap
        }
      });

      if (error && !error.message.includes('already registered')) {
        console.error(`Gagal membuat user ${email}:`, error.message);
      }
    }
  }

  // 2. Daftar tabel yang akan diimpor berurutan
  const tableOrder = [
    'divisi',
    'profiles',
    'hari_libur',
    'kuota_cuti',
    'pengajuan_cuti',
    'absensi',
    'slip_gaji',
    'audit_log'
  ];

  for (const table of tableOrder) {
    if (workbook.SheetNames.includes(table)) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[table]).map(cleanRow);
      console.log(`Mengimpor ${rows.length} baris ke tabel '${table}'...`);

      if (rows.length > 0) {
        const { error } = await supabase.from(table).upsert(rows);
        if (error) {
          console.error(`Gagal mengimpor ke '${table}':`, error.message);
        } else {
          console.log(`Berhasil mengimpor data ke '${table}'.`);
        }
      }
    }
  }

  console.log('=== SEEDING SELESAI ===');
}

runSeed().catch(console.error);
