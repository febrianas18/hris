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

async function runApiTests() {
  console.log('--- TEST API ROUTES PAYROLL (BR-11 & BR-12) ---');

  const hrd = await loginUser('rina.kusumawardani@karsalintas.test');
  const atasan = await loginUser('maya.anggraini@karsalintas.test');
  const andi = await loginUser('andi.wijaya@karsalintas.test');
  const baseUrl = 'http://localhost:3000';

  // 1. GET /api/payroll under Atasan token:
  console.log('\n[API TEST 1] GET /api/payroll by Atasan Maya:');
  const resAtasan = await fetch(`${baseUrl}/api/payroll`, {
    headers: { Authorization: `Bearer ${atasan.token}` },
  });
  const dataAtasan = await resAtasan.json();
  console.log(`Atasan receives ${dataAtasan.data.length} slips, isHrd = ${dataAtasan.isHrd}`);
  for (const s of dataAtasan.data) {
    if (s.karyawan_id !== atasan.user.id) {
      throw new Error(`FAIL: Atasan received slip for another employee: ${s.karyawan_id}`);
    }
    if (s.status !== 'terbit') {
      throw new Error(`FAIL: Atasan received non-published slip!`);
    }
  }
  console.log('✓ PASS: API /api/payroll strictly hides subordinate slips from Atasan.');

  // 2. GET /api/payroll by Karyawan Andi (who has a draft slip in seed):
  console.log('\n[API TEST 2] GET /api/payroll by Karyawan Andi:');
  const resAndi = await fetch(`${baseUrl}/api/payroll`, {
    headers: { Authorization: `Bearer ${andi.token}` },
  });
  const dataAndi = await resAndi.json();
  console.log(`Andi receives ${dataAndi.data.length} slips`);
  for (const s of dataAndi.data) {
    if (s.status === 'draf') {
      throw new Error('FAIL: Karyawan Andi received draft slip!');
    }
  }
  console.log('✓ PASS: API /api/payroll strictly hides draft slips from Karyawan Andi.');

  // 3. GET /api/payroll/previous by HRD:
  console.log('\n[API TEST 3] GET /api/payroll/previous for Andi (target period 2026-11-01):');
  const resPrev = await fetch(
    `${baseUrl}/api/payroll/previous?karyawan_id=${andi.user.id}&periode=2026-11-01`,
    { headers: { Authorization: `Bearer ${hrd.token}` } }
  );
  const dataPrev = await resPrev.json();
  console.log('Previous slip for Andi:', dataPrev.data);
  if (!dataPrev.success || !dataPrev.data) {
    throw new Error('FAIL: Failed to fetch previous slip components for Andi');
  }
  console.log('✓ PASS: HRD successfully fetched previous slip components.');

  // 4. POST /api/payroll/draft by non-HRD (should fail 403):
  console.log('\n[API TEST 4] POST /api/payroll/draft by Atasan (should be 403):');
  const resForbiddenDraft = await fetch(`${baseUrl}/api/payroll/draft`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${atasan.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      karyawan_id: andi.user.id,
      periode: '2026-11-01',
      gaji_pokok: 5000000,
    }),
  });
  if (resForbiddenDraft.status !== 403) {
    throw new Error(`FAIL: Expected 403 Forbidden, got ${resForbiddenDraft.status}`);
  }
  console.log('✓ PASS: Non-HRD forbidden from creating draft slip.');

  console.log('\n========================================');
  console.log('SEMUA TEST API ROUTE BERHASIL!');
  console.log('========================================');
}

runApiTests().catch((err) => {
  console.error('\n❌ ERROR SAAT PENGUJIAN API:', err);
  process.exit(1);
});
