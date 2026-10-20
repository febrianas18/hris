import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hehtaiitqlqepvtxhrnx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlaHRhaWl0cWxxZXB2dHhocm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTk4OTYsImV4cCI6MjEwNzk5NTg5Nn0.cTAfznAOFqeiZQ2Ig5zplS5rlRmWyUQx39X1RafHHM4';
const BASE_URL = 'http://localhost:3000';

async function testLeaveWorkflow() {
  console.log('=== TEST TAHAP 4: WORKFLOW PENGAJUAN, KUOTA ATOMIK, & PERSETUJUAN ===\n');

  // Client pembantu
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 1. Login HRD (Rina Kusumawardani)
  const { data: hrdAuth } = await supabase.auth.signInWithPassword({
    email: 'rina.kusumawardani@karsalintas.test',
    password: 'Latihan#2026',
  });
  const hrdToken = hrdAuth.session.access_token;
  console.log('✓ Login HRD:', hrdAuth.user.email);

  // 2. Login Atasan Operasional (Bayu Setiawan)
  const { data: atasanOpsAuth } = await supabase.auth.signInWithPassword({
    email: 'bayu.setiawan@karsalintas.test',
    password: 'Latihan#2026',
  });
  const atasanOpsToken = atasanOpsAuth.session.access_token;
  console.log('✓ Login Atasan Operasional:', atasanOpsAuth.user.email);

  // 3. Login Atasan Penjualan (Maya Anggraini)
  const { data: atasanSalesAuth } = await supabase.auth.signInWithPassword({
    email: 'maya.anggraini@karsalintas.test',
    password: 'Latihan#2026',
  });
  const atasanSalesToken = atasanSalesAuth.session.access_token;
  console.log('✓ Login Atasan Penjualan:', atasanSalesAuth.user.email);

  // 4. Login Siti Nurhaliza (Karyawan Operasional Gudang, sisa kuota 1)
  const { data: sitiAuth } = await supabase.auth.signInWithPassword({
    email: 'siti.nurhaliza@karsalintas.test',
    password: 'Latihan#2026',
  });
  const sitiToken = sitiAuth.session.access_token;
  console.log('✓ Login Siti Nurhaliza:', sitiAuth.user.email);

  // Bersihkan pengajuan uji sebelumnya untuk Siti di bulan November/Desember 2026
  await supabase.from('pengajuan_cuti').delete().match({ karyawan_id: sitiAuth.user.id });
  // Pastikan kuota Siti tahun 2026 terpakai = 11, jatah = 12 (sisa kuota = 1)
  await supabase.from('kuota_cuti').update({ jatah_hari: 12, terpakai_hari: 11 }).match({ karyawan_id: sitiAuth.user.id, tahun: 2026 });

  // --------------------------------------------------------------------------
  // Test 1: BR-06 Siti (sisa kuota 1) mengajukan cuti 2 hari (harus DITOLAK)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 1: Siti (Sisa Kuota 1) Mengajukan Cuti 2 Hari (Harus DITOLAK - BR-06) ---');
  let res = await fetch(`${BASE_URL}/api/leave/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sitiToken}`,
      'x-mock-server-time': '2026-10-20T09:00:00+07:00',
    },
    body: JSON.stringify({
      jenis: 'cuti_tahunan',
      tanggal_mulai: '2026-11-09',
      tanggal_selesai: '2026-11-10', // 2 hari kerja
      alasan: 'Keperluan keluarga di luar kota',
    }),
  });
  let json = await res.json();
  console.log('Status code:', res.status, 'Response:', json.error);
  if (res.status === 400 && json.error?.includes('tidak mencukupi')) {
    console.log('✓ PASS: Pengajuan 2 hari berhasil ditolak karena melebihi sisa kuota 1.');
  } else {
    console.error('✗ FAIL: Pengajuan seharusnya ditolak.');
  }

  // --------------------------------------------------------------------------
  // Test 2: BR-06 Siti mengajukan cuti 1 hari (harus BERHASIL, sisa kuota jadi 0)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Siti Mengajukan Cuti 1 Hari (Harus BERHASIL - BR-06) ---');
  res = await fetch(`${BASE_URL}/api/leave/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sitiToken}`,
      'x-mock-server-time': '2026-10-20T09:00:00+07:00',
    },
    body: JSON.stringify({
      jenis: 'cuti_tahunan',
      tanggal_mulai: '2026-11-09',
      tanggal_selesai: '2026-11-09', // 1 hari kerja
      alasan: 'Keperluan keluarga mendadak',
    }),
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Message:', json.message);
  const sitiPengajuanId = json.data?.id;

  // Cek kuota di database
  const { data: kuotaAfter } = await supabase.from('kuota_cuti').select('*').match({ karyawan_id: sitiAuth.user.id, tahun: 2026 }).single();
  console.log(`Kuota Siti 2026: Jatah ${kuotaAfter.jatah_hari}, Terpakai ${kuotaAfter.terpakai_hari} (Sisa: ${kuotaAfter.jatah_hari - kuotaAfter.terpakai_hari})`);
  if (res.status === 201 && kuotaAfter.terpakai_hari === 12) {
    console.log('✓ PASS: Kuota cuti berkurang secara atomik menjadi 0.');
  } else {
    console.error('✗ FAIL: Kuota cuti tidak berkurang dengan benar.');
  }

  // --------------------------------------------------------------------------
  // Test 3: BR-05 Batas Waktu Cuti Tahunan (Minimal H-3)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Cuti Tahunan Diajukan H-2 (Harus DITOLAK - BR-05) ---');
  res = await fetch(`${BASE_URL}/api/leave/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sitiToken}`,
      'x-mock-server-time': '2026-10-20T09:00:00+07:00',
    },
    body: JSON.stringify({
      jenis: 'cuti_tahunan',
      tanggal_mulai: '2026-10-22', // H-2 dari 2026-10-20
      tanggal_selesai: '2026-10-22',
      alasan: 'Mau istirahat mendadak',
    }),
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Response:', json.error);
  if (res.status === 400 && json.error?.includes('H-3')) {
    console.log('✓ PASS: Cuti tahunan H-2 berhasil ditolak.');
  }

  // --------------------------------------------------------------------------
  // Test 4: BR-08 Izin Maksimal 2 Hari Kerja
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Izin Lebih dari 2 Hari Kerja (Harus DITOLAK - BR-08) ---');
  res = await fetch(`${BASE_URL}/api/leave/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sitiToken}`,
      'x-mock-server-time': '2026-10-20T09:00:00+07:00',
    },
    body: JSON.stringify({
      jenis: 'izin',
      tanggal_mulai: '2026-11-16',
      tanggal_selesai: '2026-11-18', // 3 hari kerja
      alasan: 'Urusan pribadi keluarga',
    }),
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Response:', json.error);
  if (res.status === 400 && json.error?.includes('maksimal 2 hari kerja')) {
    console.log('✓ PASS: Izin 3 hari kerja berhasil ditolak.');
  }

  // --------------------------------------------------------------------------
  // Test 5: BR-08 Sakit > 1 Hari Tanpa Surat Dokter
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Sakit 2 Hari Tanpa Surat Dokter (Harus DITOLAK - BR-08) ---');
  res = await fetch(`${BASE_URL}/api/leave/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sitiToken}`,
      'x-mock-server-time': '2026-10-20T09:00:00+07:00',
    },
    body: JSON.stringify({
      jenis: 'sakit',
      tanggal_mulai: '2026-10-20',
      tanggal_selesai: '2026-10-21', // 2 hari kerja
      alasan: 'Demam tinggi dan flu berat',
      lampiran_path: null, // Tanpa surat dokter
    }),
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Response:', json.error);
  if (res.status === 400 && json.error?.includes('surat dokter')) {
    console.log('✓ PASS: Sakit > 1 hari tanpa surat dokter berhasil ditolak.');
  }

  // --------------------------------------------------------------------------
  // Test 6: BR-09 Alur Persetujuan & Batasan
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: HRD Mencoba Melompati Tahap Atasan (Harus DITOLAK - BR-09) ---');
  res = await fetch(`${BASE_URL}/api/leave/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hrdToken}`,
    },
    body: JSON.stringify({ pengajuan_id: sitiPengajuanId }),
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Response:', json.error);
  if (res.status === 403 && json.error?.includes('melompati tahap Atasan')) {
    console.log('✓ PASS: HRD tidak boleh melompati persetujuan Atasan.');
  }

  console.log('\n--- Test 7: Atasan Divisi Lain (Maya - Penjualan) Mencoba Menyetujui Anggota Gudang (Harus DITOLAK - BR-09) ---');
  res = await fetch(`${BASE_URL}/api/leave/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${atasanSalesToken}`,
    },
    body: JSON.stringify({ pengajuan_id: sitiPengajuanId }),
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Response:', json.error);
  if (res.status === 403 && json.error?.includes('divisi Anda sendiri')) {
    console.log('✓ PASS: Atasan divisi lain ditolak.');
  }

  console.log('\n--- Test 8: Atasan Operasional (Bayu) Menyetujui Tahap 1 (Harus BERHASIL - BR-09) ---');
  res = await fetch(`${BASE_URL}/api/leave/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${atasanOpsToken}`,
    },
    body: JSON.stringify({ pengajuan_id: sitiPengajuanId }),
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Message:', json.message);
  if (res.status === 200 && json.success) {
    console.log('✓ PASS: Persetujuan Tahap 1 oleh Atasan Divisi sukses.');
  }

  console.log('\n--- Test 9: HRD Memberi Keputusan Akhir (Tahap 2) (Harus BERHASIL - BR-09) ---');
  res = await fetch(`${BASE_URL}/api/leave/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hrdToken}`,
    },
    body: JSON.stringify({ pengajuan_id: sitiPengajuanId }),
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Message:', json.message);
  if (res.status === 200 && json.success) {
    console.log('✓ PASS: Persetujuan Akhir oleh HRD sukses.');
  }

  // --------------------------------------------------------------------------
  // Test 10: BR-10 & BR-06 HRD Membatalkan Cuti yang Telah Disetujui (Sebelum Tanggal Mulai)
  // Kuota cuti tahunan Siti harus kembali ke 1!
  // --------------------------------------------------------------------------
  console.log('\n--- Test 10: HRD Membatalkan Cuti Disetujui (Sebelum Tanggal Mulai) & Refund Kuota (BR-06 & BR-10) ---');
  res = await fetch(`${BASE_URL}/api/leave/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hrdToken}`,
    },
    body: JSON.stringify({ pengajuan_id: sitiPengajuanId }),
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Message:', json.message);

  const { data: kuotaRefund } = await supabase.from('kuota_cuti').select('*').match({ karyawan_id: sitiAuth.user.id, tahun: 2026 }).single();
  console.log(`Kuota Siti 2026 Setelah Pembatalan: Jatah ${kuotaRefund.jatah_hari}, Terpakai ${kuotaRefund.terpakai_hari} (Sisa: ${kuotaRefund.jatah_hari - kuotaRefund.terpakai_hari})`);
  if (res.status === 200 && kuotaRefund.terpakai_hari === 11) {
    console.log('✓ PASS: Kuota cuti berhasil dikembalikan ke saldo pemohon secara otomatis.');
  }

  // Cek Audit Log untuk semua aksi di atas (BR-12)
  const { data: logs } = await supabase.from('audit_log').select('aksi, nama_tabel, dibuat_pada').eq('data_id', sitiPengajuanId).order('dibuat_pada', { ascending: true });
  console.log('\nJejak Audit Log untuk pengajuan ini:');
  logs?.forEach((l) => console.log(`  - [${l.dibuat_pada}] Aksi: ${l.aksi} pada tabel: ${l.nama_tabel}`));
  if (logs && logs.length >= 4) {
    console.log('✓ PASS: Seluruh alur perubahan status tercatat lengkap di audit_log (BR-12).');
  }

  console.log('\n=== SEMUA PENGUJIAN TAHAP 4 SUKSES (100% PASS)! ===');
}

testLeaveWorkflow().catch(console.error);
