import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const lines = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
const env = Object.fromEntries(
  lines
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = 'Latihan#2026';
const stamp = String(Date.now()).slice(-4);
const EMAIL = `p1.employee.${stamp}@karsalintas.test`;
const NIK = `KLN-99${stamp.slice(-2)}`;
const DIV_GUDANG = '22222222-2222-2222-2222-222222222222';
const DIV_PENJUALAN = '33333333-3333-3333-3333-333333333333';

let createdUserId = null;

function ok(label, detail = '') {
  console.log(`PASS ${label}${detail ? ' :: ' + detail : ''}`);
}
function fail(label, detail = '') {
  console.log(`FAIL ${label}${detail ? ' :: ' + detail : ''}`);
}

async function login(email, password = PASSWORD) {
  const client = createClient(URL, KEY);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { client, user: data.user };
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  return { data, error };
}

async function main() {
  const hrd = await login('rina.kusumawardani@karsalintas.test');
  ok('login HRD');

  // 1. Create employee account + profile + quota.
  const create = await rpc(hrd.client, 'fn_admin_create_karyawan', {
    p_email: EMAIL,
    p_password: PASSWORD,
    p_nik_karyawan: NIK,
    p_nama_lengkap: 'P1 Test Employee',
    p_nomor_hp: '081234567890',
    p_peran: 'karyawan',
    p_divisi_id: DIV_GUDANG,
    p_jabatan: 'Staf Uji',
    p_status_kerja: 'kontrak',
    p_tanggal_masuk: '2025-01-01',
    p_aktif: true,
    p_tahun: 2026,
    p_jatah_hari: 12,
  });
  if (create.error) {
    fail('create employee', create.error.message);
    return;
  }
  createdUserId = create.data.profile.id;
  ok('create employee', createdUserId);

  const { data: profile } = await hrd.client
    .from('profiles')
    .select('id, email, peran, divisi_id, aktif, nik_karyawan')
    .eq('id', createdUserId)
    .single();
  if (profile?.email === EMAIL && profile?.peran === 'karyawan' && profile?.aktif) {
    ok('profile created');
  } else {
    fail('profile created', JSON.stringify(profile));
  }

  const { data: quota } = await hrd.client
    .from('kuota_cuti')
    .select('tahun, jatah_hari, terpakai_hari')
    .eq('karyawan_id', createdUserId)
    .eq('tahun', 2026)
    .maybeSingle();
  if (quota?.jatah_hari === 12) ok('quota created');
  else fail('quota created', JSON.stringify(quota));

  // 2. New account can log in.
  const emp = await login(EMAIL);
  ok('new employee login');

  // 3. Employee cannot use admin RPC.
  const forbidden = await rpc(emp.client, 'fn_admin_create_karyawan', {
    p_email: 'nope@karsalintas.test',
    p_password: PASSWORD,
    p_nik_karyawan: 'KLN-9997',
    p_nama_lengkap: 'Nope',
    p_nomor_hp: '',
    p_peran: 'karyawan',
    p_divisi_id: DIV_GUDANG,
    p_jabatan: 'Nope',
    p_status_kerja: 'kontrak',
    p_tanggal_masuk: '2025-01-01',
    p_aktif: true,
    p_tahun: 2026,
    p_jatah_hari: 12,
  });
  if (forbidden.error && /Hanya HRD/i.test(forbidden.error.message)) ok('employee denied admin RPC');
  else fail('employee denied admin RPC', JSON.stringify(forbidden));

  // 4. HRD updates employee.
  const update = await rpc(hrd.client, 'fn_admin_update_karyawan', {
    p_user_id: createdUserId,
    p_nik_karyawan: NIK,
    p_nama_lengkap: 'P1 Test Employee Updated',
    p_nomor_hp: '081234567891',
    p_peran: 'karyawan',
    p_divisi_id: DIV_GUDANG,
    p_jabatan: 'Staf Uji Senior',
    p_status_kerja: 'tetap',
    p_tanggal_masuk: '2025-01-01',
    p_aktif: true,
  });
  if (update.error) fail('update employee', update.error.message);
  else if (update.data.nama_lengkap === 'P1 Test Employee Updated') ok('update employee');
  else fail('update employee', JSON.stringify(update.data));

  // 5. HRD cannot change own role.
  const self = await rpc(hrd.client, 'fn_admin_update_karyawan', {
    p_user_id: hrd.user.id,
    p_nik_karyawan: 'KLN-0003',
    p_nama_lengkap: 'Rina Kusumawardani',
    p_nomor_hp: null,
    p_peran: 'karyawan',
    p_divisi_id: '11111111-1111-1111-1111-111111111111',
    p_jabatan: 'HRD Manager',
    p_status_kerja: 'tetap',
    p_tanggal_masuk: '2020-01-01',
    p_aktif: true,
  });
  if (self.error && /sendiri/i.test(self.error.message)) ok('self role change blocked');
  else fail('self role change blocked', JSON.stringify(self));

  // 6. One atasan one division: Bayu already manages Gudang, cannot manage Penjualan.
  const managerConflict = await rpc(hrd.client, 'fn_admin_assign_divisi_manager', {
    p_divisi_id: DIV_PENJUALAN,
    p_manajer_id: 'a0000000-0000-0000-0000-000000000002',
  });
  if (managerConflict.error && /satu divisi|manajer di divisi lain/i.test(managerConflict.error.message)) {
    ok('one atasan one division blocked');
  } else {
    fail('one atasan one division blocked', JSON.stringify(managerConflict));
  }

  // 7. Submit a leave that requires stage 1.
  const submit = await rpc(emp.client, 'fn_submit_pengajuan', {
    p_karyawan_id: createdUserId,
    p_jenis: 'cuti_tahunan',
    p_tanggal_mulai: '2026-11-10',
    p_tanggal_selesai: '2026-11-11',
    p_jumlah_hari: 1, // deliberately wrong: DB must compute 2
    p_alasan: 'Uji P1 validasi database',
    p_lampiran_path: null,
    p_perlu_atasan: false, // deliberately wrong: DB must compute true
  });
  if (submit.error) {
    fail('submit leave', submit.error.message);
    return;
  }
  const leaveId = submit.data.id;
  if (submit.data.jumlah_hari === 2 && submit.data.perlu_atasan === true) {
    ok('DB computes working days and perlu_atasan', JSON.stringify({ hari: submit.data.jumlah_hari, perlu: submit.data.perlu_atasan }));
  } else {
    fail('DB computes working days and perlu_atasan', JSON.stringify(submit.data));
  }

  // 8. Wrong division manager cannot approve.
  const maya = await login('maya.anggraini@karsalintas.test');
  const wrongAtasan = await rpc(maya.client, 'fn_approve_pengajuan_tahap1', {
    p_pengajuan_id: leaveId,
    p_atasan_id: maya.user.id,
  });
  if (wrongAtasan.error && /divisi lain/i.test(wrongAtasan.error.message)) ok('wrong division atasan blocked');
  else fail('wrong division atasan blocked', JSON.stringify(wrongAtasan));

  // 9. HRD cannot reject before stage 1.
  const hrdEarlyReject = await rpc(hrd.client, 'fn_reject_pengajuan', {
    p_pengajuan_id: leaveId,
    p_pelaku_id: hrd.user.id,
    p_alasan_penolakan: 'Mencoba menolak sebelum tahap atasan selesai.',
  });
  if (hrdEarlyReject.error && /Tahap Atasan/i.test(hrdEarlyReject.error.message)) ok('HRD early reject blocked');
  else fail('HRD early reject blocked', JSON.stringify(hrdEarlyReject));

  // 10. HRD cannot approve stage 2 before stage 1.
  const hrdEarlyApprove = await rpc(hrd.client, 'fn_approve_pengajuan_tahap2', {
    p_pengajuan_id: leaveId,
    p_hrd_id: hrd.user.id,
  });
  if (hrdEarlyApprove.error && /melompati|tahap/i.test(hrdEarlyApprove.error.message)) ok('HRD early approve blocked');
  else fail('HRD early approve blocked', JSON.stringify(hrdEarlyApprove));

  // 11. Correct manager approves stage 1.
  const bayu = await login('bayu.setiawan@karsalintas.test');
  const stage1 = await rpc(bayu.client, 'fn_approve_pengajuan_tahap1', {
    p_pengajuan_id: leaveId,
    p_atasan_id: bayu.user.id,
  });
  if (stage1.error) fail('stage 1 approve', stage1.error.message);
  else ok('stage 1 approve');

  // 12. HRD cannot cancel a pending (stage-1 approved) request.
  const hrdCancelPending = await rpc(hrd.client, 'fn_cancel_pengajuan', {
    p_pengajuan_id: leaveId,
    p_pelaku_id: hrd.user.id,
  });
  if (hrdCancelPending.error && /hanya dapat membatalkan.*disetujui|BR-10/i.test(hrdCancelPending.error.message)) {
    ok('HRD cancel pending blocked');
  } else {
    fail('HRD cancel pending blocked', JSON.stringify(hrdCancelPending));
  }

  // 13. HRD may reject after stage 1; quota returns.
  const hrdReject = await rpc(hrd.client, 'fn_reject_pengajuan', {
    p_pengajuan_id: leaveId,
    p_pelaku_id: hrd.user.id,
    p_alasan_penolakan: 'Ditolak setelah tahap atasan untuk pengujian P1.',
  });
  if (hrdReject.error) fail('HRD reject after stage 1', hrdReject.error.message);
  else ok('HRD reject after stage 1');

  const { data: quotaAfterReject } = await hrd.client
    .from('kuota_cuti')
    .select('terpakai_hari')
    .eq('karyawan_id', createdUserId)
    .eq('tahun', 2026)
    .single();
  if (quotaAfterReject?.terpakai_hari === 0) ok('quota restored after reject');
  else fail('quota restored after reject', JSON.stringify(quotaAfterReject));

  // 14. Second request: approve both stages, then employee cancel must fail and HRD cancel must pass.
  const submit2 = await rpc(emp.client, 'fn_submit_pengajuan', {
    p_karyawan_id: createdUserId,
    p_jenis: 'cuti_tahunan',
    p_tanggal_mulai: '2026-11-17',
    p_tanggal_selesai: '2026-11-18',
    p_jumlah_hari: 2,
    p_alasan: 'Uji P1 pembatalan cuti disetujui',
    p_lampiran_path: null,
    p_perlu_atasan: true,
  });
  if (submit2.error) {
    fail('submit second leave', submit2.error.message);
    return;
  }
  const leave2 = submit2.data.id;
  await rpc(bayu.client, 'fn_approve_pengajuan_tahap1', {
    p_pengajuan_id: leave2,
    p_atasan_id: bayu.user.id,
  });
  const stage2 = await rpc(hrd.client, 'fn_approve_pengajuan_tahap2', {
    p_pengajuan_id: leave2,
    p_hrd_id: hrd.user.id,
  });
  if (stage2.error) fail('stage 2 approve', stage2.error.message);
  else ok('stage 2 approve');

  const empCancel = await rpc(emp.client, 'fn_cancel_pengajuan', {
    p_pengajuan_id: leave2,
    p_pelaku_id: createdUserId,
  });
  if (empCancel.error && /disetujui akhir|Hubungi HRD/i.test(empCancel.error.message)) ok('employee cancel approved blocked');
  else fail('employee cancel approved blocked', JSON.stringify(empCancel));

  const hrdCancel = await rpc(hrd.client, 'fn_cancel_pengajuan', {
    p_pengajuan_id: leave2,
    p_pelaku_id: hrd.user.id,
  });
  if (hrdCancel.error) fail('HRD cancel approved', hrdCancel.error.message);
  else ok('HRD cancel approved');

  const { data: quotaAfterCancel } = await hrd.client
    .from('kuota_cuti')
    .select('terpakai_hari')
    .eq('karyawan_id', createdUserId)
    .eq('tahun', 2026)
    .single();
  if (quotaAfterCancel?.terpakai_hari === 0) ok('quota restored after cancel');
  else fail('quota restored after cancel', JSON.stringify(quotaAfterCancel));

  // 15. Audit trail present for profile creation and leave actions.
  const { data: logs } = await hrd.client
    .from('audit_log')
    .select('aksi, nama_tabel, data_id')
    .or(`data_id.eq.${createdUserId},data_id.eq.${leaveId},data_id.eq.${leave2}`)
    .order('dibuat_pada', { ascending: true });
  const actions = new Set((logs ?? []).map((l) => l.aksi));
  const expected = ['profil_dibuat', 'pengajuan_dibuat', 'pengajuan_disetujui_atasan', 'pengajuan_ditolak', 'pengajuan_disetujui_hrd', 'pengajuan_dibatalkan'];
  const missing = expected.filter((a) => !actions.has(a));
  if (missing.length === 0) ok('audit trail complete', [...actions].join(', '));
  else fail('audit trail complete', `missing: ${missing.join(', ')}; got: ${[...actions].join(', ')}`);

  console.log('CREATED_USER_ID=' + createdUserId);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exitCode = 1;
});
