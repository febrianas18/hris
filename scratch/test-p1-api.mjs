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
const BASE = 'http://localhost:3000';
const PASSWORD = 'Latihan#2026';
const stamp = String(Date.now()).slice(-2);
const EMAIL = `p1.api.${stamp}@karsalintas.test`;
const NIK = `KLN-97${stamp}`;
const DIV_GUDANG = '22222222-2222-2222-2222-222222222222';

let createdId = null;

function ok(label, detail = '') {
  console.log(`PASS ${label}${detail ? ' :: ' + detail : ''}`);
}
function fail(label, detail = '') {
  console.log(`FAIL ${label}${detail ? ' :: ' + detail : ''}`);
}

async function login(email) {
  const client = createClient(URL, KEY);
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return data.session.access_token;
}

async function api(token, path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function main() {
  const hrd = await login('rina.kusumawardani@karsalintas.test');
  const bayu = await login('bayu.setiawan@karsalintas.test');
  const maya = await login('maya.anggraini@karsalintas.test');
  const andi = await login('andi.wijaya@karsalintas.test');
  ok('login HRD, Atasan Gudang, Atasan Penjualan, Karyawan');

  // HRD list
  const list = await api(hrd, '/api/karyawan');
  if (list.status === 200 && list.json?.success && Array.isArray(list.json.data)) {
    ok('HRD GET /api/karyawan', `${list.json.data.length} karyawan`);
  } else {
    fail('HRD GET /api/karyawan', JSON.stringify(list));
  }

  // Create
  const create = await api(hrd, '/api/karyawan', {
    method: 'POST',
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      nik_karyawan: NIK,
      nama_lengkap: 'P1 API Test Employee',
      nomor_hp: '081298765432',
      peran: 'karyawan',
      divisi_id: DIV_GUDANG,
      jabatan: 'Staf API',
      status_kerja: 'kontrak',
      tanggal_masuk: '2025-02-01',
      aktif: true,
      tahun: 2026,
      jatah_hari: 12,
    }),
  });
  if (create.status === 201 && create.json?.success && create.json.data?.profile?.id) {
    createdId = create.json.data.profile.id;
    ok('HRD POST /api/karyawan', createdId);
  } else {
    fail('HRD POST /api/karyawan', JSON.stringify(create));
    return;
  }

  // Detail
  const detail = await api(hrd, `/api/karyawan/${createdId}`);
  if (
    detail.status === 200 &&
    detail.json?.success &&
    detail.json.data?.profile?.id === createdId &&
    detail.json.data?.quota?.jatah_hari === 12
  ) {
    ok('HRD GET /api/karyawan/[id]', JSON.stringify(detail.json.data.quota));
  } else {
    fail('HRD GET /api/karyawan/[id]', JSON.stringify(detail));
  }

  // Update
  const update = await api(hrd, `/api/karyawan/${createdId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      nik_karyawan: NIK,
      nama_lengkap: 'P1 API Test Employee Updated',
      nomor_hp: '081298765433',
      peran: 'karyawan',
      divisi_id: DIV_GUDANG,
      jabatan: 'Staf API Senior',
      status_kerja: 'tetap',
      tanggal_masuk: '2025-02-01',
      aktif: true,
    }),
  });
  if (
    update.status === 200 &&
    update.json?.success &&
    update.json.data?.nama_lengkap === 'P1 API Test Employee Updated'
  ) {
    ok('HRD PATCH /api/karyawan/[id]');
  } else {
    fail('HRD PATCH /api/karyawan/[id]', JSON.stringify(update));
  }

  // Atasan Gudang can list and see same-division employee.
  const bayuList = await api(bayu, '/api/karyawan');
  const bayuCanSee =
    bayuList.status === 200 &&
    bayuList.json?.data?.some((e) => e.id === createdId);
  if (bayuCanSee) ok('Atasan GET list same division');
  else fail('Atasan GET list same division', JSON.stringify(bayuList));

  // Atasan Penjualan cannot see Gudang employee.
  const mayaDetail = await api(maya, `/api/karyawan/${createdId}`);
  if (mayaDetail.status === 404 || mayaDetail.status === 403) {
    ok('Atasan other division denied detail', `status ${mayaDetail.status}`);
  } else {
    fail('Atasan other division denied detail', JSON.stringify(mayaDetail));
  }

  // Atasan cannot create/update.
  const bayuCreate = await api(bayu, '/api/karyawan', {
    method: 'POST',
    body: JSON.stringify({ email: 'nope@karsalintas.test' }),
  });
  if (bayuCreate.status === 403) ok('Atasan POST denied');
  else fail('Atasan POST denied', JSON.stringify(bayuCreate));

  const bayuPatch = await api(bayu, `/api/karyawan/${createdId}`, {
    method: 'PATCH',
    body: JSON.stringify({ nama_lengkap: 'Hacked' }),
  });
  if (bayuPatch.status === 403) ok('Atasan PATCH denied');
  else fail('Atasan PATCH denied', JSON.stringify(bayuPatch));

  // Karyawan cannot use the directory list, but can view own detail.
  const andiList = await api(andi, '/api/karyawan');
  if (andiList.status === 403) ok('Karyawan GET list denied');
  else fail('Karyawan GET list denied', JSON.stringify(andiList));

  const andiDetail = await api(andi, `/api/karyawan/a0000000-0000-0000-0000-000000000009`);
  if (andiDetail.status === 200 && andiDetail.json?.success) ok('Karyawan GET own detail');
  else fail('Karyawan GET own detail', JSON.stringify(andiDetail));

  // Settings divisi route: HRD idempotent assign, Atasan denied.
  const divOk = await api(hrd, '/api/settings/divisi', {
    method: 'POST',
    body: JSON.stringify({
      divisi_id: DIV_GUDANG,
      manajer_id: 'a0000000-0000-0000-0000-000000000002',
    }),
  });
  if (divOk.status === 200 && divOk.json?.success) ok('HRD POST /api/settings/divisi');
  else fail('HRD POST /api/settings/divisi', JSON.stringify(divOk));

  const divForbidden = await api(bayu, '/api/settings/divisi', {
    method: 'POST',
    body: JSON.stringify({ divisi_id: DIV_GUDANG, manajer_id: null }),
  });
  if (divForbidden.status === 403) ok('Atasan POST /api/settings/divisi denied');
  else fail('Atasan POST /api/settings/divisi denied', JSON.stringify(divForbidden));

  console.log('CREATED_USER_ID=' + createdId);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exitCode = 1;
});
