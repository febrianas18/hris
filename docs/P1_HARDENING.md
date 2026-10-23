# P1 Business Rules & Hardening

**Tanggal**: 23 Oktober 2026  
**Project**: HRIS PT Karsa Lintas Nusantara (`hehtaiitqlqepvtxhrnx`)  
**Migration utama**: `supabase/migrations/20261023_p1_business_rules.sql` (sudah diterapkan live)  
**Prasyarat**: P0 security hardening sudah diterapkan.

---

## 1. Ringkasan

P1 menutup celah aturan bisnis yang masih bisa dilewati lewat pemanggilan RPC/API langsung, melengkapi modul manajemen karyawan BR-01, dan memindahkan audit master data ke trigger database. Semua validasi kritis sekarang berada di database, bukan hanya di route API.

Prinsip yang dipakai:

- **Database sebagai sumber kebenaran** untuk kuota, hari kerja, alur persetujuan, dan pembatalan.
- **Atomik** untuk pembuatan akun, perubahan manajer divisi, dan pengajuan cuti.
- **Tidak butuh service-role key** di aplikasi; pembuatan `auth.users` dilakukan RPC `SECURITY DEFINER` dengan verifikasi HRD.
- **Audit otomatis** untuk tabel master; audit manual hanya untuk transisi status pengajuan.
- **`search_path` tetap** (`public, pg_temp`) pada seluruh helper/trigger function.

---

## 2. Perubahan Database

### 2.1 Helper dan utilitas

| Objek | Fungsi |
|:---|:---|
| `public.is_active_user()` | Cek profil aktif; `SECURITY DEFINER`, `search_path` tetap. |
| `public.is_hrd()` | Cek HRD aktif. |
| `public.is_atasan()` | Cek Atasan aktif. |
| `public.get_my_divisi_id()` | Divisi pengguna aktif. |
| `public.fn_count_working_days(start, end)` | Hitung hari kerja Senin–Jumat, mengecualikan `hari_libur`. |

### 2.2 Modul BR-01: manajemen karyawan

| RPC | Kegunaan |
|:---|:---|
| `fn_admin_create_karyawan(...)` | Membuat `auth.users`, `auth.identities`, `profiles`, dan `kuota_cuti` dalam satu transaksi. Hanya HRD aktif. Memvalidasi email, password, NIK `KLN-0000`, nama, jabatan, divisi, status kerja, tanggal masuk, dan jatah cuti 0–12. |
| `fn_admin_update_karyawan(...)` | Mengubah data kepegawaian/peran/divisi/status aktif. Mencegah perubahan peran/nonaktif sendiri, NIK duplikat, dan penugasan Atasan ke divisi yang sudah punya manajer. |
| `fn_admin_assign_divisi_manager(divisi, manajer)` | Menunjuk/mengganti/mengosongkan manajer divisi secara atomik. Manajer harus Atasan atau HRD aktif. Satu divisi satu manajer; satu Atasan satu divisi. Atasan lama yang diganti diturunkan menjadi Karyawan. |

Trigger pendukung:

| Trigger | Fungsi |
|:---|:---|
| `trigger_profiles_sync_manager` | Menjaga `divisi.manajer_id` tetap sinkron saat profil Atasan dibuat, diubah, dinonaktifkan, atau dihapus. |
| `trigger_validate_divisi_manager` | Menolak manajer yang bukan Atasan/HRD aktif atau berasal dari divisi lain. |
| `trigger_protect_last_hrd` | Menolak penghapusan/demosi/nonaktif HRD aktif terakhir. |
| `trigger_protect_self_profile` | Menolak pengguna mengubah peran atau menonaktifkan akun sendiri. |
| `trigger_protect_profile_email` | Menjaga `profiles.email` sama dengan email `auth.users`. |

Constraint tambahan:

- `check_atasan_has_divisi`: Atasan wajib punya `divisi_id`.
- Index/unique yang sudah ada tetap dipakai untuk NIK dan kuota per karyawan/tahun.

### 2.3 BR-09 & BR-10: alur persetujuan dan pembatalan

| RPC | Aturan yang ditegakkan |
|:---|:---|
| `fn_submit_pengajuan(...)` | Menghitung ulang `jumlah_hari` dan `perlu_atasan` di database. Memeriksa kuota, overlap, masa kerja, H-3 cuti, H-1 izin, H+3 sakit, izin maks. 2 hari kerja, dan lampiran sakit > 1 hari. Memakai advisory lock per karyawan agar pengajuan paralel tidak membuat kuota minus. |
| `fn_approve_pengajuan_tahap1(...)` | Hanya `divisi.manajer_id` pemohon; Atasan tidak boleh menyetujui pengajuan sendiri; pengajuan harus `diajukan` dan `perlu_atasan=true`. |
| `fn_approve_pengajuan_tahap2(...)` | Hanya HRD aktif; pengajuan harus sudah `disetujui_atasan`. |
| `fn_reject_pengajuan(...)` | Atasan hanya untuk Tahap 1 di divisinya. HRD hanya setelah Tahap 1 selesai (jika `perlu_atasan=true`). Kuota cuti tahunan dikembalikan. |
| `fn_cancel_pengajuan(...)` | Pemohon boleh membatalkan `diajukan`/`disetujui_atasan`. HRD boleh membatalkan pengajuan yang sudah `disetujui` dan sebelum tanggal mulai. Kuota dikembalikan. |

### 2.4 BR-12: audit trigger

Trigger audit otomatis dipasang pada:

- `profiles`
- `kuota_cuti` (khusus perubahan `jatah_hari`)
- `absensi`
- `divisi`
- `hari_libur`
- `slip_gaji`

Aksi yang dicatat antara lain: `profil_dibuat`, `perubahan_data_kepegawaian`, `perubahan_jatah_cuti`, `koreksi_absensi`, `perubahan_manajer_divisi`, `penambahan_hari_libur`, `slip_dibuat`, `penerbitan_slip`, dan seterusnya.

Route/API berikut **tidak lagi** memanggil `fn_write_audit` manual:

- `src/app/api/settings/quota/route.ts`
- `src/app/api/settings/holiday/route.ts`
- `src/app/api/attendance/koreksi/route.ts`

Workflow pengajuan tetap menulis audit manual di RPC karena aksi transisi status tidak bisa disimpulkan hanya dari perubahan baris.

---

## 3. Perubahan Aplikasi

### 3.1 Modul Data Karyawan (BR-01)

| File | Perubahan |
|:---|:---|
| `src/app/karyawan/page.tsx` | Server page memuat karyawan, divisi, manajer, dan kuota tahun berjalan. Karyawan biasa diarahkan keluar. |
| `src/app/karyawan/KaryawanClient.tsx` | UI daftar, pencarian, filter divisi/peran/status, statistik, form tambah/edit, aktif/nonaktif, dan modal detail (profil, kuota, pengajuan, absensi). Tidak menampilkan gaji (BR-11). |
| `src/app/api/karyawan/route.ts` | `GET` daftar (HRD semua, Atasan divisinya via RLS) dan `POST` buat akun (HRD). |
| `src/app/api/karyawan/[id]/route.ts` | `GET` detail + kuota + riwayat; `PATCH` ubah data (HRD). |

### 3.2 Route lain yang disesuaikan

| File | Perubahan |
|:---|:---|
| `src/app/api/settings/divisi/route.ts` | Memanggil `fn_admin_assign_divisi_manager`, bukan update dua tabel manual. |
| `src/app/api/leave/request/route.ts` | `perlu_atasan` dihitung dari `divisi.manajer_id` yang berperan Atasan aktif. |
| `src/app/api/leave/approve/route.ts` | Pre-check Tahap 1: aktor harus `divisi.manajer_id` pemohon. |
| `src/app/api/settings/quota/route.ts` | Audit manual dihapus (trigger). |
| `src/app/api/settings/holiday/route.ts` | Audit manual dihapus (trigger). |
| `src/app/api/attendance/koreksi/route.ts` | Audit manual dihapus (trigger). |

---

## 4. Verifikasi

### 4.1 Uji database

`node scratch/test-p1-db.mjs` — **21/21 PASS**:

- buat akun/profil/kuota, login akun baru, Karyawan ditolak RPC admin;
- update karyawan, proteksi peran sendiri, aturan satu Atasan satu divisi;
- DB menghitung hari kerja dan `perlu_atasan`, Atasan divisi lain ditolak;
- HRD tidak bisa melompati/menolak sebelum Tahap 1;
- Tahap 1 oleh manajer yang benar, HRD tidak bisa membatalkan pending;
- HRD menolak setelah Tahap 1 dan kuota kembali;
- Tahap 2, pemohon tidak bisa membatalkan yang sudah disetujui, HRD bisa membatalkan + kuota kembali;
- audit trail lengkap.

### 4.2 Uji API

`node scratch/test-p1-api.mjs` — **12/12 PASS**:

- HRD list/create/detail/update karyawan;
- Atasan hanya melihat divisinya, ditolak saat create/update;
- Karyawan ditolak dari direktori, tetapi bisa melihat detail sendiri;
- `POST /api/settings/divisi` hanya HRD dan berhasil untuk penugasan idempoten.

### 4.3 Regresi

| Skrip | Hasil |
|:---|:---|
| `scratch/test-attendance.mjs` | PASS |
| `scratch/test-payroll.mjs` | 10/10 PASS |
| `scratch/test-payroll-api.mjs` | PASS |
| `scratch/test-tahap6.mjs` | PASS |
| `scratch/test-leave-workflow.mjs` | PASS |
| `npm run build` | PASS |

Catatan: sebelum regresi, state uji lama Siti dikembalikan ke `terpakai_hari=11` dan slip Siti Oktober 2026 yang sudah terbit dari pengujian sebelumnya dihapus. Ini pembersihan state, bukan perubahan aturan P1.

---

## 5. Catatan Operasional

- Migration P1 sudah diterapkan live. Untuk instalasi baru, jalankan `schema.sql`, `rls_policies.sql`, lalu migration P0, P0 HMAC fix, dan P1 secara berurutan.
- Jangan menambahkan `fn_write_audit` manual untuk tabel yang sudah punya trigger audit.
- Jika mengganti manajer divisi, gunakan `fn_admin_assign_divisi_manager` atau UI Pengaturan; jangan update `divisi.manajer_id` dan `profiles.peran` manual karena dapat melanggar aturan satu Atasan satu divisi.
- `auth.users` hanya boleh dibuat lewat `fn_admin_create_karyawan`. Jangan memakai `auth.signUp` untuk akun internal karena domain `.test` dan status konfirmasi dapat menyebabkan login gagal.
- HRD aktif minimal satu; constraint/trigger akan menolak demosi atau nonaktif terakhir.
