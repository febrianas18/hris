-- ==============================================================================
-- SEEDING DATA LENGKAP HRIS PT KARSA LINTAS NUSANTARA
-- Sesuai: docs/PRD_HRIS.docx.md, docs/ERD_HRIS.pdf, & Petunjuk Data Contoh
-- Akun Uji Password: Latihan#2026
-- Tabel: divisi, profiles, hari_libur, kuota_cuti, pengajuan_cuti, absensi, slip_gaji, audit_log
-- ==============================================================================

DO $$
DECLARE
    -- Hash password default untuk 'Latihan#2026'
    v_password_hash TEXT := crypt('Latihan#2026', gen_salt('bf'));

    -- UUID Divisi
    v_div_hr UUID := '11111111-1111-1111-1111-111111111111';
    v_div_ops UUID := '22222222-2222-2222-2222-222222222222';
    v_div_sales UUID := '33333333-3333-3333-3333-333333333333';
    v_div_fin UUID := '44444444-4444-4444-4444-444444444444';

    -- UUID Karyawan (16 akun)
    v_id_bayu UUID := 'a0000000-0000-0000-0000-000000000002';
    v_id_rina UUID := 'a0000000-0000-0000-0000-000000000003';
    v_id_maya UUID := 'a0000000-0000-0000-0000-000000000004';
    v_id_hendra UUID := 'a0000000-0000-0000-0000-000000000005';
    v_id_siti UUID := 'a0000000-0000-0000-0000-000000000006';
    v_id_bambang UUID := 'a0000000-0000-0000-0000-000000000007';
    v_id_agus UUID := 'a0000000-0000-0000-0000-000000000008';
    v_id_andi UUID := 'a0000000-0000-0000-0000-000000000009';
    v_id_larasati UUID := 'a0000000-0000-0000-0000-000000000010';
    v_id_dimas UUID := 'a0000000-0000-0000-0000-000000000011';
    v_id_putri UUID := 'a0000000-0000-0000-0000-000000000012';
    v_id_fajar UUID := 'a0000000-0000-0000-0000-000000000013';
    v_id_wulan UUID := 'a0000000-0000-0000-0000-000000000015';
    v_id_yoga UUID := 'a0000000-0000-0000-0000-000000000016';
    v_id_rizky UUID := 'a0000000-0000-0000-0000-000000000018';
    v_id_nadia UUID := 'a0000000-0000-0000-0000-000000000019';

    rec RECORD;
BEGIN

    -- ==========================================================================
    -- 1. SEED DIVISI
    -- ==========================================================================
    INSERT INTO public.divisi (id, nama) VALUES
        (v_div_hr, 'Human Resources'),
        (v_div_ops, 'Operasional Gudang'),
        (v_div_sales, 'Penjualan'),
        (v_div_fin, 'Keuangan')
    ON CONFLICT (id) DO UPDATE SET nama = EXCLUDED.nama;

    -- ==========================================================================
    -- 2. SEED AKUN SUPABASE AUTH (auth.users & auth.identities)
    -- ==========================================================================
    FOR rec IN
        SELECT * FROM (VALUES
            (v_id_rina, 'rina.kusumawardani@karsalintas.test'),
            (v_id_dimas, 'dimas.pratama@karsalintas.test'),
            (v_id_bayu, 'bayu.setiawan@karsalintas.test'),
            (v_id_maya, 'maya.anggraini@karsalintas.test'),
            (v_id_hendra, 'hendra.gunawan@karsalintas.test'),
            (v_id_siti, 'siti.nurhaliza@karsalintas.test'),
            (v_id_bambang, 'bambang.hartono@karsalintas.test'),
            (v_id_agus, 'agus.salim@karsalintas.test'),
            (v_id_andi, 'andi.wijaya@karsalintas.test'),
            (v_id_larasati, 'larasati.dewi@karsalintas.test'),
            (v_id_putri, 'putri.lestari@karsalintas.test'),
            (v_id_fajar, 'fajar.nugroho@karsalintas.test'),
            (v_id_wulan, 'wulan.sari@karsalintas.test'),
            (v_id_yoga, 'yoga.permana@karsalintas.test'),
            (v_id_rizky, 'rizky.ramadhan@karsalintas.test'),
            (v_id_nadia, 'nadia.safitri@karsalintas.test')
        ) AS t(id, email)
    LOOP
        -- Buat akun di auth.users jika belum ada
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', rec.id, 'authenticated', 'authenticated',
            rec.email, v_password_hash, now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now(),
            '', '', '', ''
        ) ON CONFLICT (id) DO UPDATE SET
            encrypted_password = v_password_hash,
            email_confirmed_at = now();

        -- Buat identitas login auth.identities
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) VALUES (
            rec.id, rec.id,
            jsonb_build_object('sub', rec.id::text, 'email', rec.email),
            'email', rec.id::text,
            now(), now(), now()
        ) ON CONFLICT (id) DO NOTHING;
    END LOOP;

    -- ==========================================================================
    -- 3. SEED PROFILES (1-to-1 dengan auth.users)
    -- ==========================================================================
    INSERT INTO public.profiles (
        id, nik_karyawan, nama_lengkap, email, nomor_hp, peran, divisi_id, jabatan, status_kerja, tanggal_masuk, aktif
    ) VALUES
        -- Human Resources
        (v_id_rina, 'KLN-0003', 'Rina Kusumawardani', 'rina.kusumawardani@karsalintas.test', '08123456003', 'hrd', v_div_hr, 'Kepala HRD', 'tetap', '2020-01-05', true),
        (v_id_dimas, 'KLN-0011', 'Dimas Pratama', 'dimas.pratama@karsalintas.test', '08123456011', 'hrd', v_div_hr, 'Staf HR dan Payroll', 'tetap', '2022-03-01', true),

        -- Atasan Divisi
        (v_id_bayu, 'KLN-0002', 'Bayu Setiawan', 'bayu.setiawan@karsalintas.test', '08123456002', 'atasan', v_div_ops, 'Manajer Operasional', 'tetap', '2019-08-15', true),
        (v_id_maya, 'KLN-0004', 'Maya Anggraini', 'maya.anggraini@karsalintas.test', '08123456004', 'atasan', v_div_sales, 'Manajer Penjualan', 'tetap', '2020-02-10', true),
        (v_id_hendra, 'KLN-0005', 'Hendra Gunawan', 'hendra.gunawan@karsalintas.test', '08123456005', 'atasan', v_div_fin, 'Manajer Keuangan', 'tetap', '2020-05-01', true),

        -- Penjualan
        (v_id_andi, 'KLN-0009', 'Andi Wijaya', 'andi.wijaya@karsalintas.test', '08123456009', 'karyawan', v_div_sales, 'Sales Executive', 'tetap', '2021-06-01', true),
        (v_id_putri, 'KLN-0012', 'Putri Lestari', 'putri.lestari@karsalintas.test', '08123456012', 'karyawan', v_div_sales, 'Sales Admin', 'kontrak', '2022-07-01', true),
        (v_id_yoga, 'KLN-0016', 'Yoga Permana', 'yoga.permana@karsalintas.test', '08123456016', 'karyawan', v_div_sales, 'Account Executive', 'tetap', '2023-03-01', true),
        (v_id_nadia, 'KLN-0019', 'Nadia Safitri', 'nadia.safitri@karsalintas.test', '08123456019', 'karyawan', v_div_sales, 'Sales Support', 'kontrak', '2026-03-01', true),

        -- Operasional Gudang
        (v_id_siti, 'KLN-0006', 'Siti Nurhaliza', 'siti.nurhaliza@karsalintas.test', '08123456006', 'karyawan', v_div_ops, 'Staf Gudang', 'tetap', '2021-02-15', true),
        (v_id_agus, 'KLN-0008', 'Agus Salim', 'agus.salim@karsalintas.test', '08123456008', 'karyawan', v_div_ops, 'Operator Forklift', 'tetap', '2021-04-10', true),
        (v_id_fajar, 'KLN-0013', 'Fajar Nugroho', 'fajar.nugroho@karsalintas.test', '08123456013', 'karyawan', v_div_ops, 'Staf Logistik', 'tetap', '2022-09-01', true),
        (v_id_wulan, 'KLN-0015', 'Wulan Sari', 'wulan.sari@karsalintas.test', '08123456015', 'karyawan', v_div_ops, 'Staf Gudang', 'kontrak', '2023-01-10', true),
        (v_id_rizky, 'KLN-0018', 'Rizky Ramadhan', 'rizky.ramadhan@karsalintas.test', '08123456018', 'karyawan', v_div_ops, 'Staf Gudang', 'kontrak', '2025-11-02', true),
        (v_id_bambang, 'KLN-0007', 'Bambang Hartono', 'bambang.hartono@karsalintas.test', '08123456007', 'karyawan', v_div_ops, 'Staf Gudang', 'tetap', '2021-03-01', false),

        -- Keuangan
        (v_id_larasati, 'KLN-0010', 'Larasati Dewi', 'larasati.dewi@karsalintas.test', '08123456010', 'karyawan', v_div_fin, 'Staf Akuntansi', 'tetap', '2022-01-15', true)
    ON CONFLICT (id) DO UPDATE SET
        nik_karyawan = EXCLUDED.nik_karyawan,
        nama_lengkap = EXCLUDED.nama_lengkap,
        email = EXCLUDED.email,
        peran = EXCLUDED.peran,
        divisi_id = EXCLUDED.divisi_id,
        jabatan = EXCLUDED.jabatan,
        status_kerja = EXCLUDED.status_kerja,
        tanggal_masuk = EXCLUDED.tanggal_masuk,
        aktif = EXCLUDED.aktif;

    -- ==========================================================================
    -- 4. UPDATE ATASAN / MANAJER DIVISI
    -- ==========================================================================
    UPDATE public.divisi SET manajer_id = v_id_rina WHERE id = v_div_hr;
    UPDATE public.divisi SET manajer_id = v_id_bayu WHERE id = v_div_ops;
    UPDATE public.divisi SET manajer_id = v_id_maya WHERE id = v_div_sales;
    UPDATE public.divisi SET manajer_id = v_id_hendra WHERE id = v_div_fin;

    -- ==========================================================================
    -- 5. SEED HARI_LIBUR 2026 (17 Hari Libur)
    -- ==========================================================================
    INSERT INTO public.hari_libur (tanggal, keterangan, jenis) VALUES
        ('2026-01-01', 'Tahun Baru 2026 Masehi', 'nasional'),
        ('2026-01-16', 'Isra Mi''raj Nabi Muhammad SAW', 'nasional'),
        ('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili', 'nasional'),
        ('2026-03-03', 'Hari Suci Nyepi Tahun Baru Saka 1948', 'nasional'),
        ('2026-03-20', 'Hari Raya Idul Fitri 1447 H (Hari Pertama)', 'nasional'),
        ('2026-03-21', 'Hari Raya Idul Fitri 1447 H (Hari Kedua)', 'nasional'),
        ('2026-03-23', 'Cuti Bersama Idul Fitri 1447 H', 'cuti_bersama'),
        ('2026-03-24', 'Cuti Bersama Idul Fitri 1447 H', 'cuti_bersama'),
        ('2026-04-03', 'Wafat Yesus Kristus', 'nasional'),
        ('2026-05-01', 'Hari Buruh Internasional', 'nasional'),
        ('2026-05-14', 'Kenaikan Yesus Kristus', 'nasional'),
        ('2026-05-24', 'Hari Raya Waisak 2570 BE', 'nasional'),
        ('2026-06-01', 'Hari Lahir Pancasila', 'nasional'),
        ('2026-06-27', 'Hari Raya Idul Adha 1447 H', 'nasional'),
        ('2026-07-17', 'Tahun Baru Islam 1448 H', 'nasional'),
        ('2026-08-17', 'Hari Kemerdekaan Republik Indonesia', 'nasional'),
        ('2026-10-23', 'Hari Ulang Tahun PT KLN (Libur Perusahaan)', 'perusahaan')
    ON CONFLICT (tanggal) DO UPDATE SET
        keterangan = EXCLUDED.keterangan,
        jenis = EXCLUDED.jenis;

    -- ==========================================================================
    -- 6. SEED KUOTA_CUTI 2026 (Kasus Uji Kuota)
    -- ==========================================================================
    INSERT INTO public.kuota_cuti (karyawan_id, tahun, jatah_hari, terpakai_hari) VALUES
        (v_id_rina, 2026, 12, 4),
        (v_id_dimas, 2026, 12, 3),
        (v_id_bayu, 2026, 12, 5),
        (v_id_maya, 2026, 12, 4),
        (v_id_hendra, 2026, 12, 2),
        (v_id_andi, 2026, 12, 7),     -- Andi: sisa 5 hari
        (v_id_siti, 2026, 12, 11),   -- Kasus uji: Siti sisa kuota 1 hari
        (v_id_agus, 2026, 12, 3),
        (v_id_larasati, 2026, 12, 4),
        (v_id_putri, 2026, 12, 12),  -- Kasus uji: Putri sisa kuota 0 hari
        (v_id_fajar, 2026, 12, 5),
        (v_id_wulan, 2026, 12, 4),
        (v_id_yoga, 2026, 12, 6),
        (v_id_rizky, 2026, 2, 0),    -- Kasus uji: Masuk Nov 2025, jatah cuti 2026: 2 hari
        (v_id_nadia, 2026, 0, 0),    -- Kasus uji: Masuk Mar 2026, jatah cuti 2026: 0 hari
        (v_id_bambang, 2026, 12, 6)
    ON CONFLICT (karyawan_id, tahun) DO UPDATE SET
        jatah_hari = EXCLUDED.jatah_hari,
        terpakai_hari = EXCLUDED.terpakai_hari;

    -- ==========================================================================
    -- 7. SEED PENGAJUAN_CUTI
    -- ==========================================================================
    INSERT INTO public.pengajuan_cuti (
        id, karyawan_id, jenis, tanggal_mulai, tanggal_selesai, jumlah_hari, alasan, status, perlu_atasan, disetujui_atasan_oleh, disetujui_atasan_pada, diputuskan_hrd_oleh, diputuskan_hrd_pada
    ) VALUES
        ('c0000000-0000-0000-0000-000000000001', v_id_andi, 'cuti_tahunan', '2026-10-26', '2026-10-28', 3, 'Pulang kampung ke Yogyakarta', 'diajukan', true, NULL, NULL, NULL, NULL),
        ('c0000000-0000-0000-0000-000000000002', v_id_andi, 'cuti_tahunan', '2026-09-21', '2026-09-22', 2, 'Keperluan keluarga mendesak', 'disetujui', true, v_id_maya, '2026-09-15 10:00:00+07', v_id_rina, '2026-09-16 14:00:00+07'),
        ('c0000000-0000-0000-0000-000000000003', v_id_yoga, 'cuti_tahunan', '2026-10-19', '2026-10-20', 2, 'Acara keluarga besar di Bandung', 'disetujui', true, v_id_maya, '2026-10-12 11:00:00+07', v_id_rina, '2026-10-13 09:00:00+07'),
        ('c0000000-0000-0000-0000-000000000004', v_id_putri, 'cuti_tahunan', '2026-11-09', '2026-11-11', 3, 'Liburan keluarga tahunan', 'disetujui_atasan', true, v_id_maya, '2026-10-14 15:30:00+07', NULL, NULL),
        ('c0000000-0000-0000-0000-000000000005', v_id_agus, 'sakit', '2026-10-08', '2026-10-08', 1, 'Demam tinggi dan flu berat', 'disetujui', true, v_id_bayu, '2026-10-08 08:30:00+07', v_id_rina, '2026-10-08 09:00:00+07')
    ON CONFLICT (id) DO NOTHING;

    -- ==========================================================================
    -- 8. SEED ABSENSI (8 - 15 OKTOBER 2026)
    -- ==========================================================================
    INSERT INTO public.absensi (karyawan_id, tanggal, jam_masuk, jam_pulang, status) VALUES
        -- Tanggal 8 Okt 2026 (Wireframe Halaman 2)
        (v_id_hendra, '2026-10-08', '2026-10-08 07:57:00+07', '2026-10-08 17:24:00+07', 'hadir'),
        (v_id_larasati, '2026-10-08', '2026-10-08 08:14:00+07', '2026-10-08 17:02:00+07', 'hadir'),
        (v_id_dimas, '2026-10-08', '2026-10-08 07:54:00+07', '2026-10-08 18:12:00+07', 'hadir'),
        (v_id_rina, '2026-10-08', '2026-10-08 08:06:00+07', '2026-10-08 18:06:00+07', 'hadir'),
        (v_id_bayu, '2026-10-08', '2026-10-08 07:39:00+07', '2026-10-08 17:40:00+07', 'hadir'),
        (v_id_fajar, '2026-10-08', '2026-10-08 07:39:00+07', '2026-10-08 18:09:00+07', 'hadir'),
        (v_id_rizky, '2026-10-08', '2026-10-08 08:57:00+07', '2026-10-08 17:31:00+07', 'terlambat'),
        (v_id_siti, '2026-10-08', '2026-10-08 08:11:00+07', '2026-10-08 18:09:00+07', 'hadir'),
        (v_id_wulan, '2026-10-08', '2026-10-08 07:37:00+07', NULL, 'hadir'),
        (v_id_andi, '2026-10-08', '2026-10-08 07:56:00+07', '2026-10-08 17:22:00+07', 'hadir'),
        (v_id_maya, '2026-10-08', '2026-10-08 08:13:00+07', '2026-10-08 17:03:00+07', 'hadir'),
        (v_id_nadia, '2026-10-08', '2026-10-08 08:08:00+07', '2026-10-08 18:06:00+07', 'hadir'),
        (v_id_putri, '2026-10-08', '2026-10-08 08:01:00+07', '2026-10-08 17:54:00+07', 'hadir'),
        (v_id_yoga, '2026-10-08', '2026-10-08 08:17:00+07', '2026-10-08 18:23:00+07', 'terlambat'),

        -- Tanggal 12 Okt 2026 (Kasus Uji: Tepat 08.15.00 Hadir vs 08.15.01 Terlambat)
        (v_id_andi, '2026-10-12', '2026-10-12 08:15:00+07', '2026-10-12 17:49:00+07', 'hadir'),
        (v_id_siti, '2026-10-12', '2026-10-12 08:15:01+07', '2026-10-12 17:30:00+07', 'terlambat'),

        -- Tanggal 15 Okt 2026 (Hari ini)
        (v_id_andi, '2026-10-15', '2026-10-15 07:39:00+07', NULL, 'hadir')
    ON CONFLICT (karyawan_id, tanggal) DO NOTHING;

    -- ==========================================================================
    -- 9. SEED SLIP_GAJI (September Terbit & Oktober Draf)
    -- ==========================================================================
    INSERT INTO public.slip_gaji (
        id, nomor_slip, karyawan_id, periode, gaji_pokok, tunjangan, potongan, status, dibuat_oleh, diterbitkan_oleh, diterbitkan_pada
    ) VALUES
        -- September 2026 (Terbit - Terkunci)
        ('e0000000-0000-0000-0000-000000000001', 'SG-202609-001', v_id_rina, '2026-09-01', 14000000, 2000000, 500000, 'terbit', v_id_dimas, v_id_rina, '2026-09-28 10:00:00+07'),
        ('e0000000-0000-0000-0000-000000000002', 'SG-202609-002', v_id_bayu, '2026-09-01', 12000000, 1500000, 400000, 'terbit', v_id_dimas, v_id_rina, '2026-09-28 10:00:00+07'),
        ('e0000000-0000-0000-0000-000000000003', 'SG-202609-003', v_id_maya, '2026-09-01', 12000000, 1500000, 300000, 'terbit', v_id_dimas, v_id_rina, '2026-09-28 10:00:00+07'),
        ('e0000000-0000-0000-0000-000000000004', 'SG-202609-004', v_id_hendra, '2026-09-01', 12000000, 1500000, 250000, 'terbit', v_id_dimas, v_id_rina, '2026-09-28 10:00:00+07'),
        ('e0000000-0000-0000-0000-000000000007', 'SG-202609-007', v_id_andi, '2026-09-01', 7000000, 1500000, 388000, 'terbit', v_id_dimas, v_id_rina, '2026-09-28 10:00:00+07'),

        -- Oktober 2026 (Draf)
        ('e0000000-0000-0000-0000-000000000010', NULL, v_id_andi, '2026-10-01', 7000000, 1500000, 350000, 'draf', v_id_dimas, NULL, NULL)
    ON CONFLICT (karyawan_id, periode) DO NOTHING;

    -- ==========================================================================
    -- 10. SEED AUDIT_LOG (Immutable Jejak Aksi)
    -- ==========================================================================
    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah, dibuat_pada
    ) VALUES
        (v_id_rina, 'karyawan_insert', 'profiles', v_id_andi::text, NULL, jsonb_build_object('nik', 'KLN-0009', 'nama', 'Andi Wijaya', 'peran', 'karyawan'), '2026-09-01 08:00:00+07'),
        (v_id_rina, 'kuota_cuti_insert', 'kuota_cuti', v_id_andi::text, NULL, jsonb_build_object('tahun', 2026, 'jatah_hari', 12), '2026-09-01 08:30:00+07'),
        (v_id_maya, 'cuti_approval_atasan', 'pengajuan_cuti', 'c0000000-0000-0000-0000-000000000002', jsonb_build_object('status', 'diajukan'), jsonb_build_object('status', 'disetujui_atasan'), '2026-09-15 10:00:00+07'),
        (v_id_rina, 'cuti_approval_hrd', 'pengajuan_cuti', 'c0000000-0000-0000-0000-000000000002', jsonb_build_object('status', 'disetujui_atasan'), jsonb_build_object('status', 'disetujui'), '2026-09-16 14:00:00+07'),
        (v_id_rina, 'koreksi_absensi_insert', 'absensi', v_id_agus::text, NULL, jsonb_build_object('tanggal', '2026-09-29', 'status', 'hadir', 'alasan_koreksi', 'Koreksi kehadiran lupa check-in karena genset padam'), '2026-09-30 09:15:00+07'),
        (v_id_dimas, 'slip_gaji_insert', 'slip_gaji', 'e0000000-0000-0000-0000-000000000007', NULL, jsonb_build_object('nomor_slip', 'SG-202609-007', 'status', 'draf', 'periode', '2026-09-01'), '2026-09-27 16:00:00+07'),
        (v_id_rina, 'slip_gaji_publish', 'slip_gaji', 'e0000000-0000-0000-0000-000000000007', jsonb_build_object('status', 'draf'), jsonb_build_object('status', 'terbit', 'nomor_slip', 'SG-202609-007'), '2026-09-28 10:00:00+07');

END $$;
