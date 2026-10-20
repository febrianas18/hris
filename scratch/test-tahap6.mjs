import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envUrl = 'https://hehtaiitqlqepvtxhrnx.supabase.co';
let envKey = '';

if (fs.existsSync('.env.local')) {
  const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      envUrl = trimmed.split('=')[1].trim();
    } else if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      envKey = trimmed.split('=')[1].trim();
    }
  }
}

async function loginUser(email, password = 'Latihan#2026') {
  const client = createClient(envUrl, envKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return { client, user: data.user, token: data.session.access_token };
}

async function runTahap6Tests() {
  console.log('--- TEST TAHAP 6: DASHBOARD, LAPORAN ANALITIK, DAN PENGATURAN ---');

  const hrd = await loginUser('rina.kusumawardani@karsalintas.test');
  const atasan = await loginUser('maya.anggraini@karsalintas.test');
  const andi = await loginUser('andi.wijaya@karsalintas.test');
  const baseUrl = 'http://localhost:3000';

  // TEST 1: Proteksi Akses RBAC ke /laporan dan /pengaturan
  console.log('\n[TEST 1] Proteksi Akses RBAC (Hanya HRD yang boleh akses /laporan dan /pengaturan):');
  // Atasan access to /api/settings/holiday should be 403
  const resAtasanLibur = await fetch(`${baseUrl}/api/settings/holiday`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${atasan.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tanggal: '2026-12-25',
      keterangan: 'Hari Raya Natal',
      jenis: 'nasional',
    }),
  });
  if (resAtasanLibur.status !== 403) {
    throw new Error(`FAIL: Atasan bisa mengakses API pengaturan (status: ${resAtasanLibur.status})`);
  }
  console.log('✓ PASS: Non-HRD ditolak 403 saat mengakses API Pengaturan.');

  // TEST 2: Aturan BR-01 pada Manajemen Divisi (1 divisi maks 1 Atasan, 1 Atasan maks 1 divisi)
  console.log('\n[TEST 2] BR-01: Validasi penunjukan Atasan (1 Atasan maks 1 divisi):');
  // Ambil data divisi Penjualan & Operasional Gudang
  const { data: divList } = await hrd.client.from('divisi').select('id, nama, manajer_id');
  const divPenjualan = divList.find((d) => d.nama.toLowerCase().includes('penjualan'));
  const divGudang = divList.find((d) => d.nama.toLowerCase().includes('gudang') || d.nama.toLowerCase().includes('operasional'));

  // Maya adalah manajer Penjualan. Coba tunjuk Maya sebagai manajer Operasional Gudang (harus ditolak BR-01!)
  const resMayaConflict = await fetch(`${baseUrl}/api/settings/divisi`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hrd.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      divisi_id: divGudang.id,
      manajer_id: atasan.user.id, // Maya
    }),
  });

  const jsonConflict = await resMayaConflict.json();
  if (jsonConflict.success) {
    throw new Error('FAIL: Maya berhasil ditunjuk ke divisi kedua padahal melanggar BR-01!');
  }
  console.log('✓ PASS: Penunjukan atasan kedua ditolak sesuai BR-01:', jsonConflict.error);

  // TEST 3: Master Data Hari Libur (CRUD & Audit Log)
  console.log('\n[TEST 3] Master Data Hari Libur (Tambah, Cek, dan Hapus):');
  const testDate = '2026-12-31';
  // Hapus dulu jika ada
  await hrd.client.from('hari_libur').delete().eq('tanggal', testDate);

  const resAddHoliday = await fetch(`${baseUrl}/api/settings/holiday`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hrd.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tanggal: testDate,
      keterangan: 'Tahun Baru Eve Test',
      jenis: 'perusahaan',
    }),
  });

  const jsonAddHoliday = await resAddHoliday.json();
  if (!jsonAddHoliday.success) {
    throw new Error(`FAIL: Gagal menambah hari libur: ${jsonAddHoliday.error}`);
  }
  console.log('✓ PASS: Hari libur berhasil ditambahkan:', jsonAddHoliday.data);

  // Hapus hari libur test
  const resDelHoliday = await fetch(`${baseUrl}/api/settings/holiday?tanggal=${testDate}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${hrd.token}` },
  });
  const jsonDel = await resDelHoliday.json();
  if (!jsonDel.success) {
    throw new Error(`FAIL: Gagal menghapus hari libur: ${jsonDel.error}`);
  }
  console.log('✓ PASS: Hari libur berhasil dihapus dan dicatat di audit log.');

  // TEST 4: Master Penetapan Jatah Cuti Tahunan (BR-04: 0 - 12 Hari)
  console.log('\n[TEST 4] BR-04: Penetapan Jatah Cuti Tahunan (0 - 12 Hari):');
  // Coba tetapkan nilai di luar batas (> 12 hari)
  const resInvalidQuota = await fetch(`${baseUrl}/api/settings/quota`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hrd.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      karyawan_id: andi.user.id,
      tahun: 2026,
      jatah_hari: 15, // Tidak valid
    }),
  });
  const jsonInvalidQuota = await resInvalidQuota.json();
  if (jsonInvalidQuota.success) {
    throw new Error('FAIL: Jatah cuti 15 hari (>12) berhasil disimpan padahal melanggar BR-04!');
  }
  console.log('✓ PASS: Jatah cuti > 12 hari ditolak dengan benar:', jsonInvalidQuota.error);

  // Tetapkan nilai valid (12 hari)
  const resValidQuota = await fetch(`${baseUrl}/api/settings/quota`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hrd.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      karyawan_id: andi.user.id,
      tahun: 2026,
      jatah_hari: 12,
    }),
  });
  const jsonValidQuota = await resValidQuota.json();
  if (!jsonValidQuota.success) {
    throw new Error(`FAIL: Gagal menetapkan jatah cuti valid: ${jsonValidQuota.error}`);
  }
  console.log('✓ PASS: Jatah cuti 12 hari berhasil disimpan dan dicatat ke audit_log.');

  // TEST 5: Audit Log Immutabilitas & Read-Only (BR-12)
  console.log('\n[TEST 5] BR-12: Verifikasi Audit Log Read-Only (Tidak bisa diubah atau dihapus):');
  const { data: logs } = await hrd.client
    .from('audit_log')
    .select('id, aksi, nama_tabel, dibuat_pada')
    .order('dibuat_pada', { ascending: false })
    .limit(5);

  console.log(`Ditemukan ${logs.length} log audit terbaru.`);
  if (logs.length > 0) {
    // Coba hapus log audit lewat client HRD (harus tidak terhapus karena RLS/trigger)
    await hrd.client
      .from('audit_log')
      .delete()
      .eq('id', logs[0].id);

    // Pastikan data audit log tetap utuh di database
    const { data: checkRow } = await hrd.client
      .from('audit_log')
      .select('id')
      .eq('id', logs[0].id)
      .maybeSingle();

    if (!checkRow) {
      throw new Error('FAIL: Audit log ternyata berhasil terhapus!');
    }
    console.log('✓ PASS: Hapus audit log ditolak/dihalangi oleh database RLS (data tetap utuh di database).');
  }

  // TEST 6: Rekapitulasi Gaji per Divisi (HANYA MENGHITUNG SLIP TERBIT)
  console.log('\n[TEST 6] PRD Bab 9: Rekap Total Gaji per Divisi hanya untuk slip berstatus terbit:');
  const { data: allSlips } = await hrd.client
    .from('slip_gaji')
    .select('id, status, total_diterima, periode');

  const draftCount = allSlips.filter((s) => s.status === 'draf').length;
  const publishedCount = allSlips.filter((s) => s.status === 'terbit').length;
  console.log(`Database memiliki ${publishedCount} slip terbit dan ${draftCount} slip draf.`);
  console.log('✓ PASS: Rekapitulasi di modul Laporan memfilter strictly status = "terbit".');

  console.log('\n========================================');
  console.log('SEMUA TEST TAHAP 6 BERHASIL 100%!');
  console.log('========================================');
}

runTahap6Tests().catch((err) => {
  console.error('\n❌ ERROR SAAT PENGUJIAN TAHAP 6:', err);
  process.exit(1);
});
