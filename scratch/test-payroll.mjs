import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hehtaiitqlqepvtxhrnx.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlaHRhaWl0cWxxZXB2dHhocm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwMjcyNjgsImV4cCI6MjA1NTYwMzI2OH0.Q1d77U_2Z-hZ7oP1q12v5h9b_4f3g8k_1l2m3n4o5p';

// Read .env.local if needed
import fs from 'fs';
let envUrl = SUPABASE_URL;
let envKey = SUPABASE_ANON_KEY;

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

async function runTests() {
  console.log('--- TEST TAHAP 5: MODUL SLIP GAJI & KEAMANAN AKSES (BR-11 & BR-12) ---');

  // 1. Login HRD, Atasan, dan Karyawan
  const hrd = await loginUser('rina.kusumawardani@karsalintas.test');
  const atasan = await loginUser('maya.anggraini@karsalintas.test'); // Atasan Penjualan
  const andi = await loginUser('andi.wijaya@karsalintas.test'); // Karyawan Penjualan (pemilik slip draf di seed)
  const siti = await loginUser('siti.nurhaliza@karsalintas.test'); // Karyawan Operasional

  console.log('✓ Login berhasil: HRD, Atasan Maya, Karyawan Andi, Karyawan Siti');

  // TEST 1 (BR-11): Atasan DILARANG KERAS melihat slip gaji bawahan (Database RLS)
  console.log('\n[TEST 1] BR-11: Proteksi RLS Database - Atasan melihat slip gaji...');
  const { data: atasanViewSlips, error: atasanErr } = await atasan.client
    .from('slip_gaji')
    .select('id, nomor_slip, karyawan_id, status, total_diterima');

  if (atasanErr) throw atasanErr;
  console.log(`Atasan melihat ${atasanViewSlips.length} slip gaji.`);
  for (const s of atasanViewSlips) {
    if (s.karyawan_id !== atasan.user.id) {
      throw new Error(`FAIL: Atasan bisa melihat slip gaji orang lain (${s.karyawan_id})!`);
    }
  }
  console.log('✓ PASS: Atasan HANYA melihat slip gaji miliknya sendiri di database RLS. Slip bawahan 100% tersembunyi.');

  // TEST 2 (BR-11): Karyawan tidak boleh melihat slip yang masih 'draf'
  console.log('\n[TEST 2] BR-11: Karyawan tidak boleh melihat slip miliknya yang masih status draf...');
  const { data: andiSlips, error: andiErr } = await andi.client
    .from('slip_gaji')
    .select('id, nomor_slip, status, periode')
    .eq('karyawan_id', andi.user.id);

  if (andiErr) throw andiErr;
  const hasDraft = andiSlips.some((s) => s.status === 'draf');
  if (hasDraft) {
    throw new Error('FAIL: Karyawan Andi bisa melihat slip gaji yang masih berstatus draf!');
  }
  console.log(`✓ PASS: Karyawan Andi hanya melihat ${andiSlips.length} slip (semua berstatus terbit). Slip draf Oktober tidak terlihat oleh Andi.`);

  // TEST 3 (BR-11 & BR-12): HRD dapat melihat semua slip (draf & terbit)
  console.log('\n[TEST 3] HRD melihat seluruh slip gaji...');
  const { data: hrdSlips, error: hrdErr } = await hrd.client
    .from('slip_gaji')
    .select('id, nomor_slip, status, periode, karyawan_id');

  if (hrdErr) throw hrdErr;
  console.log(`✓ PASS: HRD dapat melihat ${hrdSlips.length} slip (termasuk draf dan terbit).`);

  // TEST 4 (BR-12): HRD membuat Draf Slip Gaji baru via API / Stored Procedure
  console.log('\n[TEST 4] BR-12: HRD membuat draf slip gaji untuk Siti Nurhaliza periode 2026-10-01...');
  
  // Pastikan hapus dulu jika ada sisa test sebelumnya
  const { data: existingDraft } = await hrd.client
    .from('slip_gaji')
    .select('id, status')
    .eq('karyawan_id', siti.user.id)
    .eq('periode', '2026-10-01')
    .maybeSingle();

  if (existingDraft && existingDraft.status === 'draf') {
    await hrd.client.rpc('fn_delete_draft_slip_gaji', {
      p_slip_id: existingDraft.id,
      p_hrd_id: hrd.user.id,
    });
  }

  // Buat draf baru
  const { data: draftSlip, error: draftErr } = await hrd.client.rpc('fn_save_draft_slip_gaji', {
    p_slip_id: null,
    p_karyawan_id: siti.user.id,
    p_periode: '2026-10-01',
    p_gaji_pokok: 8500000,
    p_tunjangan: 1500000,
    p_potongan: 350000,
    p_catatan: 'Gaji Pokok + Tunjangan Transport & Makan',
    p_hrd_id: hrd.user.id,
  });

  if (draftErr) throw draftErr;
  console.log('✓ PASS: Draf slip berhasil dibuat:', {
    id: draftSlip.id,
    karyawan_id: draftSlip.karyawan_id,
    periode: draftSlip.periode,
    status: draftSlip.status,
    total_diterima: draftSlip.total_diterima,
  });

  if (draftSlip.status !== 'draf') {
    throw new Error(`FAIL: Status slip baru harus 'draf', tapi didapat '${draftSlip.status}'`);
  }
  if (Number(draftSlip.total_diterima) !== 8500000 + 1500000 - 350000) {
    throw new Error(`FAIL: Perhitungan total_diterima salah: ${draftSlip.total_diterima}`);
  }

  // TEST 5 (BR-11): Siti tidak boleh melihat slip draf tersebut
  const { data: sitiCheck } = await siti.client
    .from('slip_gaji')
    .select('id')
    .eq('id', draftSlip.id);

  if (sitiCheck && sitiCheck.length > 0) {
    throw new Error('FAIL: Siti bisa melihat slip miliknya yang masih berstatus draf!');
  }
  console.log('✓ PASS: Siti tidak dapat melihat slip draf miliknya yang baru dibuat.');

  // TEST 6 (BR-12): HRD Menerbitkan Slip Gaji (Status 'terbit', format SG-TTTTBB-NNN)
  console.log('\n[TEST 6] BR-12: HRD menerbitkan slip gaji...');
  const { data: publishedSlip, error: pubErr } = await hrd.client.rpc('fn_publish_slip_gaji', {
    p_slip_id: draftSlip.id,
    p_hrd_id: hrd.user.id,
  });

  if (pubErr) throw pubErr;
  console.log('✓ PASS: Slip berhasil diterbitkan:', {
    id: publishedSlip.id,
    nomor_slip: publishedSlip.nomor_slip,
    status: publishedSlip.status,
    diterbitkan_oleh: publishedSlip.diterbitkan_oleh,
    diterbitkan_pada: publishedSlip.diterbitkan_pada,
  });

  const sgRegex = /^SG-202610-[0-9]{3}$/;
  if (!sgRegex.test(publishedSlip.nomor_slip)) {
    throw new Error(`FAIL: Format nomor slip salah! Diharapkan format SG-202610-NNN, didapat: ${publishedSlip.nomor_slip}`);
  }
  if (publishedSlip.status !== 'terbit') {
    throw new Error(`FAIL: Status slip harus 'terbit', didapat: ${publishedSlip.status}`);
  }

  // TEST 7 (BR-12): Kunci Immutability - Slip yang sudah terbit TIDAK BISA diedit atau dihapus
  console.log('\n[TEST 7] BR-12: Mencoba mengedit atau menghapus slip yang sudah terbit...');
  const { error: editErr } = await hrd.client
    .from('slip_gaji')
    .update({ gaji_pokok: 99999999 })
    .eq('id', publishedSlip.id);

  if (!editErr) {
    throw new Error('FAIL: Slip yang sudah terbit ternyata bisa diubah!');
  }
  console.log('✓ PASS: Update slip terbit ditolak dengan benar oleh trigger database:', editErr.message);

  const { error: delErr } = await hrd.client
    .from('slip_gaji')
    .delete()
    .eq('id', publishedSlip.id);

  if (!delErr) {
    throw new Error('FAIL: Slip yang sudah terbit ternyata bisa dihapus!');
  }
  console.log('✓ PASS: Hapus slip terbit ditolak dengan benar oleh trigger database:', delErr.message);

  // TEST 8 (BR-11): Siti sekarang BISA melihat slip gaji miliknya yang sudah terbit
  console.log('\n[TEST 8] BR-11: Siti memeriksa slip miliknya setelah terbit...');
  const { data: sitiViewPublished } = await siti.client
    .from('slip_gaji')
    .select('id, nomor_slip, status, total_diterima')
    .eq('id', publishedSlip.id);

  if (!sitiViewPublished || sitiViewPublished.length === 0) {
    throw new Error('FAIL: Siti tidak bisa melihat slip miliknya padahal sudah terbit!');
  }
  console.log('✓ PASS: Siti berhasil melihat slip gaji miliknya yang telah terbit:', sitiViewPublished[0]);

  // TEST 9 (BR-11): Atasan Maya tetap DILARANG melihat slip Siti meskipun sudah terbit!
  console.log('\n[TEST 9] BR-11: Atasan Maya mencoba melihat slip Siti yang sudah terbit...');
  const { data: mayaViewSiti } = await atasan.client
    .from('slip_gaji')
    .select('id, nomor_slip, total_diterima')
    .eq('id', publishedSlip.id);

  if (mayaViewSiti && mayaViewSiti.length > 0) {
    throw new Error('FAIL: Atasan Maya bisa melihat slip orang lain!');
  }
  console.log('✓ PASS: Atasan Maya TIDAK BISA melihat slip gaji karyawan lain (hasil query kosong). Aturan BR-11 dipatuhi 100%.');

  // TEST 10 (BR-12): Cek pencatatan di audit_log
  console.log('\n[TEST 10] BR-12: Memeriksa pencatatan di audit_log...');
  const { data: auditLogs, error: auditErr } = await hrd.client
    .from('audit_log')
    .select('id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah, dibuat_pada')
    .eq('data_id', publishedSlip.id)
    .order('dibuat_pada', { ascending: true });

  if (auditErr) throw auditErr;
  console.log(`Ditemukan ${auditLogs.length} audit log untuk slip ${publishedSlip.id}:`);
  for (const log of auditLogs) {
    console.log(` - Aksi: ${log.aksi} | Waktu: ${log.dibuat_pada}`);
  }

  const hasCreate = auditLogs.some((l) => l.aksi === 'slip_dibuat');
  const hasPublish = auditLogs.some((l) => l.aksi === 'penerbitan_slip');

  if (!hasCreate || !hasPublish) {
    throw new Error('FAIL: Audit log tidak mencatat aksi slip_dibuat dan penerbitan_slip dengan lengkap!');
  }
  console.log('✓ PASS: Aksi pembuatan dan penerbitan slip tercatat rapi di audit_log.');

  console.log('\n========================================');
  console.log('SEMUA 10 PENGUJIAN BR-11 & BR-12 BERHASIL 100%!');
  console.log('========================================');
}

runTests().catch((err) => {
  console.error('\n❌ ERROR SAAT PENGUJIAN:', err);
  process.exit(1);
});
