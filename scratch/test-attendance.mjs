import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hehtaiitqlqepvtxhrnx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlaHRhaWl0cWxxZXB2dHhocm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTk4OTYsImV4cCI6MjEwNzk5NTg5Nn0.cTAfznAOFqeiZQ2Ig5zplS5rlRmWyUQx39X1RafHHM4';
const BASE_URL = 'http://localhost:3000';

async function testAttendanceAPI() {
  console.log('=== TEST TAHAP 3: MODUL ABSENSI (BR-02 & BR-03) ===\n');

  // 1. Login sebagai Andi Wijaya (Karyawan)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'andi.wijaya@karsalintas.test',
    password: 'Latihan#2026',
  });

  if (loginErr || !authData.session) {
    console.error('Login gagal:', loginErr);
    process.exit(1);
  }

  const token = authData.session.access_token;
  console.log('✓ Login sukses sebagai:', authData.user.email, '(ID:', authData.user.id, ')');

  // Login juga sebagai HRD untuk keperluan cleanup data tes
  const hrdClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: hrdAuth } = await hrdClient.auth.signInWithPassword({
    email: 'rina.kusumawardani@karsalintas.test',
    password: 'Latihan#2026',
  });
  const hrdToken = hrdAuth.session.access_token;

  // Bersihkan data absensi Andi untuk tanggal uji tertentu agar pengujian bersih
  const testDate = '2026-10-27';
  const lateTestDate = '2026-10-28';
  await hrdClient.from('absensi').delete().match({ karyawan_id: authData.user.id, tanggal: testDate });
  await hrdClient.from('absensi').delete().match({ karyawan_id: authData.user.id, tanggal: lateTestDate });

  // -------------------------------------------------------------
  // Test A: Check-in tepat waktu pukul 08:15:00 WIB (status: HADIR)
  // -------------------------------------------------------------
  console.log('\n--- Test A: Check-in tepat waktu pukul 08:15:00 WIB ---');
  let res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': `sb-hehtaiitqlqepvtxhrnx-auth-token=${encodeURIComponent(JSON.stringify({ access_token: token }))}`,
      'x-mock-server-time': `${testDate}T08:15:00+07:00`,
    },
  });
  let json = await res.json();
  console.log('Status code:', res.status);
  console.log('Response:', json);

  if (json.data?.status === 'hadir') {
    console.log('✓ PASS: Check-in 08:15:00 WIB berstatus "hadir"');
  } else {
    console.error('✗ FAIL: Status harus "hadir", dapat:', json.data?.status);
  }

  // -------------------------------------------------------------
  // Test B: Check-in kedua di hari yang sama (harus ditolak - BR-02)
  // -------------------------------------------------------------
  console.log('\n--- Test B: Check-in kedua di hari yang sama (harus DITOLAK) ---');
  res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': `sb-hehtaiitqlqepvtxhrnx-auth-token=${encodeURIComponent(JSON.stringify({ access_token: token }))}`,
      'x-mock-server-time': `${testDate}T09:00:00+07:00`,
    },
  });
  json = await res.json();
  console.log('Status code:', res.status);
  console.log('Response:', json);
  if (res.status === 400 && json.error.includes('sudah melakukan check-in')) {
    console.log('✓ PASS: Check-in kedua berhasil ditolak');
  } else {
    console.error('✗ FAIL: Seharusnya ditolak 400');
  }

  // -------------------------------------------------------------
  // Test B2: Check-out tanpa check-in (harus DITOLAK)
  // -------------------------------------------------------------
  console.log('\n--- Test B2: Check-out tanpa check-in pada hari lain (harus DITOLAK) ---');
  res = await fetch(`${BASE_URL}/api/attendance/check-out`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': `sb-hehtaiitqlqepvtxhrnx-auth-token=${encodeURIComponent(JSON.stringify({ access_token: token }))}`,
      'x-mock-server-time': '2026-10-30T17:00:00+07:00',
    },
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Response:', json.error);
  if (res.status === 400 && json.error.includes('belum melakukan check-in')) {
    console.log('✓ PASS: Check-out tanpa check-in berhasil ditolak');
  }

  // -------------------------------------------------------------
  // Test B3: Check-out sebelum atau sama dengan waktu check-in (harus DITOLAK)
  // -------------------------------------------------------------
  console.log('\n--- Test B3: Check-out lebih kecil/sama dengan jam masuk (08:14:59 WIB - harus DITOLAK) ---');
  res = await fetch(`${BASE_URL}/api/attendance/check-out`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': `sb-hehtaiitqlqepvtxhrnx-auth-token=${encodeURIComponent(JSON.stringify({ access_token: token }))}`,
      'x-mock-server-time': `${testDate}T08:14:59+07:00`,
    },
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Response:', json.error);
  if (res.status === 400 && json.error.includes('harus lebih besar')) {
    console.log('✓ PASS: Check-out sebelum/sama dengan jam masuk berhasil ditolak');
  }

  // -------------------------------------------------------------
  // Test C: Check-out di hari yang sama (BR-02)
  // -------------------------------------------------------------
  console.log('\n--- Test C: Check-out pukul 17:30:00 WIB ---');
  res = await fetch(`${BASE_URL}/api/attendance/check-out`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': `sb-hehtaiitqlqepvtxhrnx-auth-token=${encodeURIComponent(JSON.stringify({ access_token: token }))}`,
      'x-mock-server-time': `${testDate}T17:30:00+07:00`,
    },
  });
  json = await res.json();
  console.log('Status code:', res.status);
  console.log('Response:', json);
  if (res.status === 200 && json.data?.jam_pulang) {
    console.log('✓ PASS: Check-out berhasil dicatat:', json.data.jam_pulang);
  } else {
    console.error('✗ FAIL: Check-out gagal');
  }

  // -------------------------------------------------------------
  // Test D: Check-out kedua di hari yang sama (harus ditolak)
  // -------------------------------------------------------------
  console.log('\n--- Test D: Check-out kedua di hari yang sama (harus DITOLAK) ---');
  res = await fetch(`${BASE_URL}/api/attendance/check-out`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': `sb-hehtaiitqlqepvtxhrnx-auth-token=${encodeURIComponent(JSON.stringify({ access_token: token }))}`,
      'x-mock-server-time': `${testDate}T18:00:00+07:00`,
    },
  });
  json = await res.json();
  console.log('Status code:', res.status);
  console.log('Response:', json);
  if (res.status === 400 && json.error.includes('sudah melakukan check-out')) {
    console.log('✓ PASS: Check-out kedua berhasil ditolak');
  } else {
    console.error('✗ FAIL: Seharusnya ditolak');
  }

  // -------------------------------------------------------------
  // Test E: Check-in terlambat (08:15:01 WIB - status: TERLAMBAT)
  // -------------------------------------------------------------
  await hrdClient.from('absensi').delete().match({ karyawan_id: authData.user.id, tanggal: lateTestDate });

  console.log('\n--- Test E: Check-in pukul 08:15:01 WIB (harus TERLAMBAT) ---');
  res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': `sb-hehtaiitqlqepvtxhrnx-auth-token=${encodeURIComponent(JSON.stringify({ access_token: token }))}`,
      'x-mock-server-time': `${lateTestDate}T08:15:01+07:00`,
    },
  });
  json = await res.json();
  console.log('Status code:', res.status);
  console.log('Response:', json);
  if (json.data?.status === 'terlambat') {
    console.log('✓ PASS: Check-in 08:15:01 WIB berstatus "terlambat"');
  } else {
    console.error('✗ FAIL: Status harus "terlambat", dapat:', json.data?.status);
  }

  // -------------------------------------------------------------
  // Test F: Check-in di luar jam kerja (05:59:59 & 12:00:01 WIB - harus ditolak)
  // -------------------------------------------------------------
  const outsideDate = '2026-10-29'; // Kamis
  console.log('\n--- Test F: Check-in di luar jam (05:59:59 WIB - harus DITOLAK) ---');
  res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': `sb-hehtaiitqlqepvtxhrnx-auth-token=${encodeURIComponent(JSON.stringify({ access_token: token }))}`,
      'x-mock-server-time': `${outsideDate}T05:59:59+07:00`,
    },
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Response:', json.error);
  if (res.status === 400 && json.error.includes('06.00 dan 12.00')) {
    console.log('✓ PASS: Check-in sebelum 06.00 WIB ditolak');
  }

  // -------------------------------------------------------------
  // Test G: Check-in di hari libur (2026-10-23 HUT PT KLN - harus ditolak)
  // -------------------------------------------------------------
  console.log('\n--- Test G: Check-in di Hari Libur (2026-10-23 - harus DITOLAK) ---');
  res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': `sb-hehtaiitqlqepvtxhrnx-auth-token=${encodeURIComponent(JSON.stringify({ access_token: token }))}`,
      'x-mock-server-time': '2026-10-23T08:00:00+07:00',
    },
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Response:', json.error);
  if (res.status === 400 && json.error.includes('hari libur')) {
    console.log('✓ PASS: Check-in di hari libur ditolak');
  }

  // -------------------------------------------------------------
  // Test H: Check-in di hari weekend (Sabtu 2026-10-24 - harus ditolak)
  // -------------------------------------------------------------
  console.log('\n--- Test H: Check-in di Akhir Pekan (2026-10-24 Sabtu - harus DITOLAK) ---');
  res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': `sb-hehtaiitqlqepvtxhrnx-auth-token=${encodeURIComponent(JSON.stringify({ access_token: token }))}`,
      'x-mock-server-time': '2026-10-24T08:00:00+07:00',
    },
  });
  json = await res.json();
  console.log('Status code:', res.status, 'Response:', json.error);
  if (res.status === 400 && json.error.includes('hari kerja')) {
    console.log('✓ PASS: Check-in di hari Sabtu ditolak');
  }

  // -------------------------------------------------------------
  // Test I: Koreksi oleh HRD (Rina Kusumawardani)
  // -------------------------------------------------------------
  console.log('\n--- Test I: Koreksi Absensi oleh HRD & Audit Log (BR-03 & BR-12) ---');

  // Coba koreksi dengan alasan < 10 karakter (harus ditolak)
  const targetAbsensiId = (await supabase.from('absensi').select('id').eq('tanggal', lateTestDate).single()).data.id;
  res = await fetch(`${BASE_URL}/api/attendance/koreksi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hrdToken}`,
      'Cookie': `sb-hehtaiitqlqepvtxhrnx-auth-token=${encodeURIComponent(JSON.stringify({ access_token: hrdToken }))}`,
    },
    body: JSON.stringify({
      absensi_id: targetAbsensiId,
      status: 'hadir',
      alasan_koreksi: 'Pendek', // < 10 karakter!
    }),
  });
  json = await res.json();
  console.log('Koreksi < 10 karakter, status code:', res.status, 'Response:', json.error);
  if (res.status === 400 && json.error.includes('minimal 10 karakter')) {
    console.log('✓ PASS: Alasan koreksi < 10 karakter ditolak');
  }

  // Koreksi sah dengan alasan >= 10 karakter
  res = await fetch(`${BASE_URL}/api/attendance/koreksi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hrdToken}`,
      'Cookie': `sb-hehtaiitqlqepvtxhrnx-auth-token=${encodeURIComponent(JSON.stringify({ access_token: hrdToken }))}`,
    },
    body: JSON.stringify({
      absensi_id: targetAbsensiId,
      status: 'hadir',
      alasan_koreksi: 'Karyawan hadir tepat waktu tetapi fingerprint bermasalah di gerbang',
    }),
  });
  json = await res.json();
  console.log('Koreksi sah, status code:', res.status, 'Response:', json.message);
  if (res.status === 200 && json.success) {
    console.log('✓ PASS: Koreksi absensi berhasil disimpan');
  }

  // Cek apakah audit log tercatat
  const { data: logs } = await hrdClient.from('audit_log').select('*').eq('data_id', targetAbsensiId);
  console.log('Audit log ditemukan:', logs?.length, 'entri');
  if (logs && logs.length > 0) {
    console.log('✓ PASS: Audit log koreksi absensi tersimpan:', logs[0].aksi);
  }

  // Cleanup data tes
  await supabase.from('absensi').delete().match({ karyawan_id: authData.user.id, tanggal: testDate });
  await supabase.from('absensi').delete().match({ karyawan_id: authData.user.id, tanggal: lateTestDate });

  console.log('\n=== SEMUA TES TAHAP 3 SUKSES! ===');
}

testAttendanceAPI().catch(console.error);
