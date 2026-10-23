-- ==============================================================================
-- P0 SECURITY HARDENING
-- HRIS PT KARSA LINTAS NUSANTARA
-- Tanggal: 2026-10-23
--
-- Perbaikan:
-- 1. RPC bisnis tidak lagi dapat dieksekusi oleh anon.
-- 2. Setiap RPC memverifikasi aktor = auth.uid() (atau service_role).
-- 3. Check-in/check-out dipindahkan ke RPC server-side (waktu dari DB).
-- 4. RLS absensi/pengajuan tidak lagi mengizinkan tulis langsung karyawan.
-- 5. profiles_select tidak lagi membocorkan seluruh karyawan aktif.
-- 6. profiles_update hanya HRD + proteksi self role/deactivate.
-- 7. audit_log tidak bisa ditulis langsung; lewat fn_write_audit (HRD).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. KONFIGURASI PRIVAT (untuk signature waktu simulasi saat development)
--    Nilai secret TIDAK disimpan di file migration/repo.
--
--    Untuk environment development yang ingin memakai header x-mock-server-time:
--      1. Generate secret acak, mis. 48 hex char.
--      2. INSERT INTO public.app_config(key, value)
--         VALUES ('mock_time_secret', '<secret>')
--         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--      3. Set MOCK_TIME_SECRET=<secret> pada .env.local (jangan di-commit).
--    Tanpa secret, mock time ditolak dan RPC memakai now() database.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_config FROM anon, authenticated;

COMMENT ON TABLE public.app_config IS
    'Konfigurasi privat server. Tidak dapat diakses anon/authenticated; hanya fungsi SECURITY DEFINER.';

-- ------------------------------------------------------------------------------
-- 1. HELPER: VERIFIKASI AKTOR RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_actor(p_actor UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid  UUID := auth.uid();
    v_role TEXT := COALESCE(auth.role(), '');
BEGIN
    IF v_uid IS NOT NULL THEN
        IF p_actor IS DISTINCT FROM v_uid THEN
            RAISE EXCEPTION 'Aktor tidak sesuai dengan sesi login (Aturan keamanan).';
        END IF;

        IF NOT public.is_active_user() THEN
            RAISE EXCEPTION 'Akun Anda dinonaktifkan. Silakan hubungi HRD.';
        END IF;
    ELSIF v_role <> 'service_role'
          AND session_user NOT IN ('postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'Akses ditolak: pengguna tidak terautentikasi.';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_actor(UUID) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. HELPER: WAKTU SERVER + SIGNATURE MOCK (DEV ONLY)
--    Dipakai route API saat header x-mock-server-time dikirim di non-production.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_resolve_server_time(
    p_mock_time_str TEXT,
    p_mock_sig TEXT
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_secret TEXT;
BEGIN
    IF p_mock_time_str IS NULL OR p_mock_time_str = '' THEN
        RETURN now();
    END IF;

    SELECT value INTO v_secret
    FROM public.app_config
    WHERE key = 'mock_time_secret';

    IF v_secret IS NULL
       OR p_mock_sig IS NULL
       OR encode(extensions.hmac(p_mock_time_str, v_secret, 'sha256'), 'hex') <> p_mock_sig THEN
        RAISE EXCEPTION 'Waktu simulasi tidak valid.';
    END IF;

    RETURN p_mock_time_str::TIMESTAMPTZ;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_resolve_server_time(TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. RPC CHECK-IN / CHECK-OUT (BR-02, BR-03)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_check_in(
    p_mock_time_str TEXT DEFAULT NULL,
    p_mock_sig TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid    UUID := auth.uid();
    v_now    TIMESTAMPTZ;
    v_today  DATE;
    v_time   TIME;
    v_status public.status_absensi;
    v_row    public.absensi%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sesi login tidak valid.';
    END IF;

    IF NOT public.is_active_user() THEN
        RAISE EXCEPTION 'Akun Anda dinonaktifkan. Silakan hubungi HRD.';
    END IF;

    v_now := public.fn_resolve_server_time(p_mock_time_str, p_mock_sig);
    v_today := (v_now AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_time := (v_now AT TIME ZONE 'Asia/Jakarta')::TIME;

    IF EXTRACT(ISODOW FROM v_today) NOT BETWEEN 1 AND 5 THEN
        RAISE EXCEPTION 'Check-in hanya dapat dilakukan pada hari kerja (Senin sampai Jumat).';
    END IF;

    IF EXISTS (SELECT 1 FROM public.hari_libur WHERE tanggal = v_today) THEN
        RAISE EXCEPTION 'Hari ini adalah hari libur. Check-in tidak diizinkan.';
    END IF;

    IF v_time < TIME '06:00:00' OR v_time > TIME '12:00:00' THEN
        RAISE EXCEPTION 'Check-in hanya dapat dilakukan antara pukul 06.00 dan 12.00 WIB.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.pengajuan_cuti
        WHERE karyawan_id = v_uid
          AND status = 'disetujui'
          AND tanggal_mulai <= v_today
          AND tanggal_selesai >= v_today
    ) THEN
        RAISE EXCEPTION 'Check-in ditolak: Anda memiliki cuti/izin/sakit yang telah disetujui untuk hari ini.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.absensi
        WHERE karyawan_id = v_uid AND tanggal = v_today
    ) THEN
        RAISE EXCEPTION 'Anda sudah melakukan check-in untuk hari ini.';
    END IF;

    v_status := CASE
        WHEN v_time > TIME '08:15:00' THEN 'terlambat'::public.status_absensi
        ELSE 'hadir'::public.status_absensi
    END;

    INSERT INTO public.absensi (karyawan_id, tanggal, jam_masuk, status)
    VALUES (v_uid, v_today, v_now, v_status)
    RETURNING * INTO v_row;

    RETURN row_to_json(v_row)::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_check_out(
    p_mock_time_str TEXT DEFAULT NULL,
    p_mock_sig TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid   UUID := auth.uid();
    v_now   TIMESTAMPTZ;
    v_today DATE;
    v_row   public.absensi%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sesi login tidak valid.';
    END IF;

    IF NOT public.is_active_user() THEN
        RAISE EXCEPTION 'Akun Anda dinonaktifkan. Silakan hubungi HRD.';
    END IF;

    v_now := public.fn_resolve_server_time(p_mock_time_str, p_mock_sig);
    v_today := (v_now AT TIME ZONE 'Asia/Jakarta')::DATE;

    SELECT * INTO v_row
    FROM public.absensi
    WHERE karyawan_id = v_uid AND tanggal = v_today
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Check-out gagal: Anda belum melakukan check-in pada hari ini.';
    END IF;

    IF v_row.jam_pulang IS NOT NULL THEN
        RAISE EXCEPTION 'Anda sudah melakukan check-out hari ini.';
    END IF;

    IF v_now <= v_row.jam_masuk THEN
        RAISE EXCEPTION 'Waktu check-out harus lebih besar dari waktu check-in.';
    END IF;

    UPDATE public.absensi
    SET jam_pulang = v_now
    WHERE id = v_row.id
    RETURNING * INTO v_row;

    RETURN row_to_json(v_row)::JSONB;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. RPC AUDIT LOG TERBATAS (HRD)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_write_audit(
    p_aksi TEXT,
    p_nama_tabel TEXT,
    p_data_id TEXT,
    p_nilai_sebelum JSONB,
    p_nilai_sesudah JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_hrd() THEN
        RAISE EXCEPTION 'Hanya HRD yang berhak menulis audit log.';
    END IF;

    IF p_aksi NOT IN (
        'koreksi_absensi',
        'perubahan_jatah_cuti',
        'penetapan_jatah_cuti_baru',
        'perubahan_manajer_divisi',
        'perubahan_hari_libur',
        'penambahan_hari_libur',
        'penghapusan_hari_libur'
    ) THEN
        RAISE EXCEPTION 'Aksi audit tidak diizinkan: %', p_aksi;
    END IF;

    IF p_nama_tabel NOT IN ('absensi', 'kuota_cuti', 'divisi', 'hari_libur') THEN
        RAISE EXCEPTION 'Tabel audit tidak diizinkan: %', p_nama_tabel;
    END IF;

    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah
    ) VALUES (
        auth.uid(), p_aksi, p_nama_tabel, p_data_id, p_nilai_sebelum, p_nilai_sesudah
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. RPC PENGAJUAN CUTI + PAYROLL (auth check, body tidak berubah)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_submit_pengajuan(
    p_karyawan_id UUID,
    p_jenis public.jenis_pengajuan,
    p_tanggal_mulai DATE,
    p_tanggal_selesai DATE,
    p_jumlah_hari INTEGER,
    p_alasan TEXT,
    p_lampiran_path TEXT,
    p_perlu_atasan BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tahun INTEGER;
    v_kuota RECORD;
    v_pengajuan public.pengajuan_cuti%ROWTYPE;
BEGIN
    PERFORM public.assert_actor(p_karyawan_id);

    v_tahun := EXTRACT(YEAR FROM p_tanggal_mulai)::INTEGER;

    IF p_jenis = 'cuti_tahunan' THEN
        SELECT id, jatah_hari, terpakai_hari
        INTO v_kuota
        FROM public.kuota_cuti
        WHERE karyawan_id = p_karyawan_id AND tahun = v_tahun
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Kuota cuti tahunan untuk tahun % belum ditetapkan oleh HRD.', v_tahun;
        END IF;

        IF (v_kuota.jatah_hari - v_kuota.terpakai_hari) < p_jumlah_hari THEN
            RAISE EXCEPTION 'Sisa kuota cuti tahunan tidak mencukupi (sisa: %, diminta: % hari).',
                (v_kuota.jatah_hari - v_kuota.terpakai_hari), p_jumlah_hari;
        END IF;

        UPDATE public.kuota_cuti
        SET terpakai_hari = terpakai_hari + p_jumlah_hari
        WHERE id = v_kuota.id;
    END IF;

    INSERT INTO public.pengajuan_cuti (
        karyawan_id,
        jenis,
        tanggal_mulai,
        tanggal_selesai,
        jumlah_hari,
        alasan,
        lampiran_path,
        perlu_atasan,
        status
    ) VALUES (
        p_karyawan_id,
        p_jenis,
        p_tanggal_mulai,
        p_tanggal_selesai,
        p_jumlah_hari,
        p_alasan,
        p_lampiran_path,
        p_perlu_atasan,
        'diajukan'
    )
    RETURNING * INTO v_pengajuan;

    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah
    ) VALUES (
        p_karyawan_id, 'pengajuan_dibuat', 'pengajuan_cuti',
        v_pengajuan.id::TEXT, NULL, row_to_json(v_pengajuan)::JSONB
    );

    RETURN row_to_json(v_pengajuan)::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_approve_pengajuan_tahap1(
    p_pengajuan_id UUID,
    p_atasan_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pengajuan public.pengajuan_cuti%ROWTYPE;
    v_sebelum JSONB;
    v_pemohon RECORD;
    v_atasan RECORD;
BEGIN
    PERFORM public.assert_actor(p_atasan_id);

    SELECT * INTO v_pengajuan
    FROM public.pengajuan_cuti
    WHERE id = p_pengajuan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pengajuan tidak ditemukan.';
    END IF;

    IF v_pengajuan.status != 'diajukan' THEN
        RAISE EXCEPTION 'Pengajuan tidak dapat disetujui pada status saat ini (%).', v_pengajuan.status;
    END IF;

    IF v_pengajuan.perlu_atasan = false THEN
        RAISE EXCEPTION 'Pengajuan ini tidak memerlukan persetujuan Atasan (langsung ke HRD).';
    END IF;

    IF v_pengajuan.karyawan_id = p_atasan_id THEN
        RAISE EXCEPTION 'Atasan tidak boleh memutuskan pengajuannya sendiri (Aturan BR-09).';
    END IF;

    SELECT divisi_id INTO v_pemohon FROM public.profiles WHERE id = v_pengajuan.karyawan_id;
    SELECT divisi_id, peran INTO v_atasan FROM public.profiles WHERE id = p_atasan_id;

    IF v_atasan.peran != 'atasan' THEN
        RAISE EXCEPTION 'Hanya Atasan yang berhak menyetujui Tahap 1.';
    END IF;

    IF v_atasan.divisi_id IS DISTINCT FROM v_pemohon.divisi_id THEN
        RAISE EXCEPTION 'Atasan tidak boleh menyetujui anggota dari divisi lain (Aturan BR-09).';
    END IF;

    v_sebelum := row_to_json(v_pengajuan)::JSONB;

    UPDATE public.pengajuan_cuti
    SET
        status = 'disetujui_atasan',
        disetujui_atasan_oleh = p_atasan_id,
        disetujui_atasan_pada = now()
    WHERE id = p_pengajuan_id
    RETURNING * INTO v_pengajuan;

    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah
    ) VALUES (
        p_atasan_id, 'pengajuan_disetujui_atasan', 'pengajuan_cuti',
        v_pengajuan.id::TEXT, v_sebelum, row_to_json(v_pengajuan)::JSONB
    );

    RETURN row_to_json(v_pengajuan)::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_approve_pengajuan_tahap2(
    p_pengajuan_id UUID,
    p_hrd_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pengajuan public.pengajuan_cuti%ROWTYPE;
    v_sebelum JSONB;
    v_hrd RECORD;
BEGIN
    PERFORM public.assert_actor(p_hrd_id);

    SELECT * INTO v_pengajuan
    FROM public.pengajuan_cuti
    WHERE id = p_pengajuan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pengajuan tidak ditemukan.';
    END IF;

    IF v_pengajuan.karyawan_id = p_hrd_id THEN
        RAISE EXCEPTION 'HRD tidak boleh memutuskan pengajuannya sendiri (Aturan BR-09).';
    END IF;

    SELECT peran INTO v_hrd FROM public.profiles WHERE id = p_hrd_id;
    IF v_hrd.peran != 'hrd' THEN
        RAISE EXCEPTION 'Hanya HRD yang berhak memberikan keputusan akhir.';
    END IF;

    IF v_pengajuan.perlu_atasan = true AND v_pengajuan.status != 'disetujui_atasan' THEN
        RAISE EXCEPTION 'HRD tidak boleh melompati tahap persetujuan Atasan (Aturan BR-09).';
    END IF;

    IF v_pengajuan.perlu_atasan = false AND v_pengajuan.status != 'diajukan' THEN
        RAISE EXCEPTION 'Pengajuan tidak dapat disetujui pada status saat ini (%).', v_pengajuan.status;
    END IF;

    v_sebelum := row_to_json(v_pengajuan)::JSONB;

    UPDATE public.pengajuan_cuti
    SET
        status = 'disetujui',
        diputuskan_hrd_oleh = p_hrd_id,
        diputuskan_hrd_pada = now()
    WHERE id = p_pengajuan_id
    RETURNING * INTO v_pengajuan;

    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah
    ) VALUES (
        p_hrd_id, 'pengajuan_disetujui_hrd', 'pengajuan_cuti',
        v_pengajuan.id::TEXT, v_sebelum, row_to_json(v_pengajuan)::JSONB
    );

    RETURN row_to_json(v_pengajuan)::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_reject_pengajuan(
    p_pengajuan_id UUID,
    p_pelaku_id UUID,
    p_alasan_penolakan TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pengajuan public.pengajuan_cuti%ROWTYPE;
    v_sebelum JSONB;
    v_pelaku RECORD;
    v_pemohon RECORD;
    v_tahun INTEGER;
BEGIN
    PERFORM public.assert_actor(p_pelaku_id);

    IF length(trim(COALESCE(p_alasan_penolakan, ''))) < 10 THEN
        RAISE EXCEPTION 'Penolakan pengajuan wajib disertai alasan minimal 10 karakter (Aturan BR-09).';
    END IF;

    SELECT * INTO v_pengajuan
    FROM public.pengajuan_cuti
    WHERE id = p_pengajuan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pengajuan tidak ditemukan.';
    END IF;

    IF v_pengajuan.status IN ('ditolak', 'dibatalkan', 'disetujui') THEN
        RAISE EXCEPTION 'Pengajuan dengan status % tidak dapat ditolak.', v_pengajuan.status;
    END IF;

    IF v_pengajuan.karyawan_id = p_pelaku_id THEN
        RAISE EXCEPTION 'Pengguna tidak boleh menolak pengajuannya sendiri (Aturan BR-09).';
    END IF;

    SELECT divisi_id, peran INTO v_pelaku FROM public.profiles WHERE id = p_pelaku_id;
    SELECT divisi_id INTO v_pemohon FROM public.profiles WHERE id = v_pengajuan.karyawan_id;

    IF v_pelaku.peran = 'atasan' THEN
        IF v_pelaku.divisi_id IS DISTINCT FROM v_pemohon.divisi_id THEN
            RAISE EXCEPTION 'Atasan tidak boleh menolak anggota dari divisi lain (Aturan BR-09).';
        END IF;
        IF v_pengajuan.status != 'diajukan' THEN
            RAISE EXCEPTION 'Atasan hanya dapat menolak pengajuan berstatus diajukan.';
        END IF;
    ELSIF v_pelaku.peran != 'hrd' THEN
        RAISE EXCEPTION 'Hanya Atasan divisi atau HRD yang berhak menolak pengajuan.';
    END IF;

    v_sebelum := row_to_json(v_pengajuan)::JSONB;

    IF v_pengajuan.jenis = 'cuti_tahunan' THEN
        v_tahun := EXTRACT(YEAR FROM v_pengajuan.tanggal_mulai)::INTEGER;
        UPDATE public.kuota_cuti
        SET terpakai_hari = GREATEST(0, terpakai_hari - v_pengajuan.jumlah_hari)
        WHERE karyawan_id = v_pengajuan.karyawan_id AND tahun = v_tahun;
    END IF;

    UPDATE public.pengajuan_cuti
    SET
        status = 'ditolak',
        alasan_penolakan = trim(p_alasan_penolakan),
        disetujui_atasan_oleh = CASE WHEN v_pelaku.peran = 'atasan' THEN p_pelaku_id ELSE disetujui_atasan_oleh END,
        disetujui_atasan_pada = CASE WHEN v_pelaku.peran = 'atasan' THEN now() ELSE disetujui_atasan_pada END,
        diputuskan_hrd_oleh = CASE WHEN v_pelaku.peran = 'hrd' THEN p_pelaku_id ELSE diputuskan_hrd_oleh END,
        diputuskan_hrd_pada = CASE WHEN v_pelaku.peran = 'hrd' THEN now() ELSE diputuskan_hrd_pada END
    WHERE id = p_pengajuan_id
    RETURNING * INTO v_pengajuan;

    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah
    ) VALUES (
        p_pelaku_id, 'pengajuan_ditolak', 'pengajuan_cuti',
        v_pengajuan.id::TEXT, v_sebelum, row_to_json(v_pengajuan)::JSONB
    );

    RETURN row_to_json(v_pengajuan)::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_cancel_pengajuan(
    p_pengajuan_id UUID,
    p_pelaku_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pengajuan public.pengajuan_cuti%ROWTYPE;
    v_sebelum JSONB;
    v_pelaku RECORD;
    v_tahun INTEGER;
    v_today DATE;
BEGIN
    PERFORM public.assert_actor(p_pelaku_id);

    SELECT * INTO v_pengajuan
    FROM public.pengajuan_cuti
    WHERE id = p_pengajuan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pengajuan tidak ditemukan.';
    END IF;

    IF v_pengajuan.status IN ('dibatalkan', 'ditolak') THEN
        RAISE EXCEPTION 'Pengajuan sudah dalam status % dan tidak dapat dibatalkan lagi.', v_pengajuan.status;
    END IF;

    SELECT peran INTO v_pelaku FROM public.profiles WHERE id = p_pelaku_id;
    v_today := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;

    IF v_pengajuan.karyawan_id = p_pelaku_id THEN
        IF v_pengajuan.status NOT IN ('diajukan', 'disetujui_atasan') THEN
            RAISE EXCEPTION 'Pengajuan yang sudah disetujui akhir oleh HRD tidak dapat dibatalkan oleh pemohon. Hubungi HRD.';
        END IF;
    ELSE
        IF v_pelaku.peran != 'hrd' THEN
            RAISE EXCEPTION 'Hanya pemohon atau HRD yang berhak membatalkan pengajuan (Aturan BR-10).';
        END IF;

        IF v_pengajuan.status = 'disetujui' AND v_today >= v_pengajuan.tanggal_mulai THEN
            RAISE EXCEPTION 'Cuti yang sudah disetujui hanya dapat dibatalkan oleh HRD sebelum tanggal mulai cuti (Aturan BR-10).';
        END IF;
    END IF;

    v_sebelum := row_to_json(v_pengajuan)::JSONB;

    IF v_pengajuan.jenis = 'cuti_tahunan' THEN
        v_tahun := EXTRACT(YEAR FROM v_pengajuan.tanggal_mulai)::INTEGER;
        UPDATE public.kuota_cuti
        SET terpakai_hari = GREATEST(0, terpakai_hari - v_pengajuan.jumlah_hari)
        WHERE karyawan_id = v_pengajuan.karyawan_id AND tahun = v_tahun;
    END IF;

    UPDATE public.pengajuan_cuti
    SET
        status = 'dibatalkan',
        dibatalkan_oleh = p_pelaku_id,
        dibatalkan_pada = now()
    WHERE id = p_pengajuan_id
    RETURNING * INTO v_pengajuan;

    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah
    ) VALUES (
        p_pelaku_id, 'pengajuan_dibatalkan', 'pengajuan_cuti',
        v_pengajuan.id::TEXT, v_sebelum, row_to_json(v_pengajuan)::JSONB
    );

    RETURN row_to_json(v_pengajuan)::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_save_draft_slip_gaji(
    p_slip_id UUID,
    p_karyawan_id UUID,
    p_periode DATE,
    p_gaji_pokok NUMERIC,
    p_tunjangan NUMERIC,
    p_potongan NUMERIC,
    p_catatan TEXT,
    p_hrd_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_hrd RECORD;
    v_slip public.slip_gaji%ROWTYPE;
    v_sebelum JSONB := NULL;
    v_total NUMERIC;
    v_aksi TEXT;
BEGIN
    PERFORM public.assert_actor(p_hrd_id);

    SELECT peran, aktif INTO v_hrd FROM public.profiles WHERE id = p_hrd_id;
    IF v_hrd.peran != 'hrd' OR v_hrd.aktif IS NOT TRUE THEN
        RAISE EXCEPTION 'Hanya HRD yang berhak membuat atau mengedit slip gaji (BR-11 & BR-12).';
    END IF;

    IF EXTRACT(DAY FROM p_periode) != 1 THEN
        RAISE EXCEPTION 'Periode slip gaji harus tanggal 1 pada bulan tersebut.';
    END IF;

    IF p_gaji_pokok < 0 OR p_tunjangan < 0 OR p_potongan < 0 THEN
        RAISE EXCEPTION 'Komponen gaji tidak boleh bernilai negatif.';
    END IF;

    v_total := p_gaji_pokok + p_tunjangan - p_potongan;
    IF v_total < 0 THEN
        RAISE EXCEPTION 'Total gaji diterima tidak boleh di bawah 0.';
    END IF;

    IF p_slip_id IS NOT NULL THEN
        SELECT * INTO v_slip FROM public.slip_gaji WHERE id = p_slip_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Slip gaji tidak ditemukan.';
        END IF;

        IF v_slip.status = 'terbit' THEN
            RAISE EXCEPTION 'Slip gaji yang sudah terbit terkunci dan tidak dapat diubah.';
        END IF;

        v_sebelum := row_to_json(v_slip)::JSONB;
        v_aksi := 'slip_diubah';

        UPDATE public.slip_gaji
        SET
            gaji_pokok = p_gaji_pokok,
            tunjangan = p_tunjangan,
            potongan = p_potongan,
            catatan = p_catatan
        WHERE id = p_slip_id
        RETURNING * INTO v_slip;
    ELSE
        SELECT * INTO v_slip FROM public.slip_gaji
        WHERE karyawan_id = p_karyawan_id AND periode = p_periode
        FOR UPDATE;

        IF FOUND THEN
            IF v_slip.status = 'terbit' THEN
                RAISE EXCEPTION 'Slip gaji karyawan untuk periode ini sudah terbit dan terkunci.';
            ELSE
                v_sebelum := row_to_json(v_slip)::JSONB;
                v_aksi := 'slip_diubah';

                UPDATE public.slip_gaji
                SET
                    gaji_pokok = p_gaji_pokok,
                    tunjangan = p_tunjangan,
                    potongan = p_potongan,
                    catatan = p_catatan
                WHERE id = v_slip.id
                RETURNING * INTO v_slip;
            END IF;
        ELSE
            v_aksi := 'slip_dibuat';

            INSERT INTO public.slip_gaji (
                karyawan_id,
                periode,
                gaji_pokok,
                tunjangan,
                potongan,
                catatan,
                status,
                dibuat_oleh
            ) VALUES (
                p_karyawan_id,
                p_periode,
                p_gaji_pokok,
                p_tunjangan,
                p_potongan,
                p_catatan,
                'draf',
                p_hrd_id
            )
            RETURNING * INTO v_slip;
        END IF;
    END IF;

    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah
    ) VALUES (
        p_hrd_id, v_aksi, 'slip_gaji', v_slip.id::TEXT, v_sebelum, row_to_json(v_slip)::JSONB
    );

    RETURN row_to_json(v_slip)::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_publish_slip_gaji(
    p_slip_id UUID,
    p_hrd_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_slip public.slip_gaji%ROWTYPE;
    v_sebelum JSONB;
    v_prefix TEXT;
    v_seq INTEGER;
    v_nomor_slip TEXT;
    v_hrd RECORD;
BEGIN
    PERFORM public.assert_actor(p_hrd_id);

    SELECT peran, aktif INTO v_hrd FROM public.profiles WHERE id = p_hrd_id;
    IF v_hrd.peran != 'hrd' OR v_hrd.aktif IS NOT TRUE THEN
        RAISE EXCEPTION 'Hanya HRD yang berhak menerbitkan slip gaji (Aturan BR-11 & BR-12).';
    END IF;

    SELECT * INTO v_slip
    FROM public.slip_gaji
    WHERE id = p_slip_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Slip gaji tidak ditemukan.';
    END IF;

    IF v_slip.status = 'terbit' THEN
        RAISE EXCEPTION 'Slip gaji ini sudah berstatus terbit dan terkunci.';
    END IF;

    v_prefix := 'SG-' || to_char(v_slip.periode, 'YYYYMM') || '-';

    SELECT COALESCE(MAX(SUBSTRING(nomor_slip FROM 11 FOR 3)::INTEGER), 0) + 1
    INTO v_seq
    FROM public.slip_gaji
    WHERE periode = v_slip.periode AND nomor_slip LIKE v_prefix || '%';

    v_nomor_slip := v_prefix || LPAD(v_seq::TEXT, 3, '0');

    v_sebelum := row_to_json(v_slip)::JSONB;

    UPDATE public.slip_gaji
    SET
        status = 'terbit',
        nomor_slip = v_nomor_slip,
        diterbitkan_oleh = p_hrd_id,
        diterbitkan_pada = now()
    WHERE id = p_slip_id
    RETURNING * INTO v_slip;

    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah
    ) VALUES (
        p_hrd_id, 'penerbitan_slip', 'slip_gaji',
        v_slip.id::TEXT, v_sebelum, row_to_json(v_slip)::JSONB
    );

    RETURN row_to_json(v_slip)::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_delete_draft_slip_gaji(
    p_slip_id UUID,
    p_hrd_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_hrd RECORD;
    v_slip public.slip_gaji%ROWTYPE;
BEGIN
    PERFORM public.assert_actor(p_hrd_id);

    SELECT peran, aktif INTO v_hrd FROM public.profiles WHERE id = p_hrd_id;
    IF v_hrd.peran != 'hrd' OR v_hrd.aktif IS NOT TRUE THEN
        RAISE EXCEPTION 'Hanya HRD yang berhak menghapus slip gaji.';
    END IF;

    SELECT * INTO v_slip FROM public.slip_gaji WHERE id = p_slip_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Slip gaji tidak ditemukan.';
    END IF;

    IF v_slip.status = 'terbit' THEN
        RAISE EXCEPTION 'Slip gaji yang sudah terbit terkunci dan tidak dapat dihapus.';
    END IF;

    DELETE FROM public.slip_gaji WHERE id = p_slip_id;

    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah
    ) VALUES (
        p_hrd_id, 'slip_dihapus', 'slip_gaji', p_slip_id::TEXT, row_to_json(v_slip)::JSONB, NULL
    );

    RETURN true;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. RLS: PROFILES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated
USING (
    public.is_hrd()
    OR (public.is_atasan() AND divisi_id = public.get_my_divisi_id())
    OR id = auth.uid()
);

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE TO authenticated
USING (public.is_hrd())
WITH CHECK (public.is_hrd());

-- Cegah siapa pun (termasuk HRD) mengubah peran/menonaktifkan akun sendiri.
CREATE OR REPLACE FUNCTION public.trg_protect_self_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL
       AND OLD.id = auth.uid()
       AND (NEW.peran IS DISTINCT FROM OLD.peran
            OR NEW.aktif IS DISTINCT FROM OLD.aktif) THEN
        RAISE EXCEPTION 'Anda tidak boleh mengubah peran atau menonaktifkan akun sendiri (BR-01).';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_self_profile ON public.profiles;
CREATE TRIGGER trigger_protect_self_profile
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_self_profile();

-- ------------------------------------------------------------------------------
-- 7. RLS: ABSENSI (karyawan hanya lewat RPC check-in/check-out)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "absensi_insert_policy" ON public.absensi;
CREATE POLICY "absensi_insert_policy" ON public.absensi
FOR INSERT TO authenticated
WITH CHECK (public.is_hrd());

DROP POLICY IF EXISTS "absensi_update_policy" ON public.absensi;
CREATE POLICY "absensi_update_policy" ON public.absensi
FOR UPDATE TO authenticated
USING (public.is_hrd())
WITH CHECK (public.is_hrd());

-- ------------------------------------------------------------------------------
-- 8. RLS: PENGAJUAN CUTI (karyawan/atasan/HRD hanya lewat RPC)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "pengajuan_cuti_insert_policy" ON public.pengajuan_cuti;
DROP POLICY IF EXISTS "pengajuan_cuti_update_policy" ON public.pengajuan_cuti;

-- ------------------------------------------------------------------------------
-- 9. RLS: AUDIT LOG (hanya via fn_write_audit / RPC definer)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_log_insert_policy" ON public.audit_log;

-- ------------------------------------------------------------------------------
-- 10. HAK EKSEKUSI RPC
--     anon/PUBLIC dicabut; authenticated + service_role tetap boleh.
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fn_submit_pengajuan(
    UUID, public.jenis_pengajuan, DATE, DATE, INTEGER, TEXT, TEXT, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_submit_pengajuan(
    UUID, public.jenis_pengajuan, DATE, DATE, INTEGER, TEXT, TEXT, BOOLEAN
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_approve_pengajuan_tahap1(UUID, UUID)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_approve_pengajuan_tahap1(UUID, UUID)
    TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_approve_pengajuan_tahap2(UUID, UUID)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_approve_pengajuan_tahap2(UUID, UUID)
    TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_reject_pengajuan(UUID, UUID, TEXT)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reject_pengajuan(UUID, UUID, TEXT)
    TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_cancel_pengajuan(UUID, UUID)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cancel_pengajuan(UUID, UUID)
    TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_save_draft_slip_gaji(
    UUID, UUID, DATE, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_save_draft_slip_gaji(
    UUID, UUID, DATE, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_publish_slip_gaji(UUID, UUID)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_publish_slip_gaji(UUID, UUID)
    TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_delete_draft_slip_gaji(UUID, UUID)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_delete_draft_slip_gaji(UUID, UUID)
    TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_check_in(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_check_in(TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_check_out(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_check_out(TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_write_audit(TEXT, TEXT, TEXT, JSONB, JSONB)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_write_audit(TEXT, TEXT, TEXT, JSONB, JSONB)
    TO authenticated;

-- Pastikan PostgREST memuat ulang definisi fungsi/policy.
NOTIFY pgrst, 'reload schema';
