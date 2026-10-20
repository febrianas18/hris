-- ==============================================================================
-- DDL SCHEMA DATABASE HRIS PT KARSA LINTAS NUSANTARA
-- Sesuai: docs/ERD_HRIS.pdf & docs/PRD_HRIS.docx.md
-- Target: PostgreSQL / Supabase
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TIPE ENUM
-- ==============================================================================

-- Peran akun karyawan
DO $$ BEGIN
    CREATE TYPE peran_type AS ENUM ('karyawan', 'atasan', 'hrd');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Status kepegawaian
DO $$ BEGIN
    CREATE TYPE status_kerja_type AS ENUM ('tetap', 'kontrak');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Jenis hari libur
DO $$ BEGIN
    CREATE TYPE jenis_hari_libur AS ENUM ('nasional', 'cuti_bersama', 'perusahaan');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Jenis pengajuan cuti, sakit, dan izin
DO $$ BEGIN
    CREATE TYPE jenis_pengajuan AS ENUM ('cuti_tahunan', 'sakit', 'izin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Alur status pengajuan cuti
DO $$ BEGIN
    CREATE TYPE status_pengajuan AS ENUM (
        'diajukan',
        'disetujui_atasan',
        'disetujui',
        'ditolak',
        'dibatalkan'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Status kehadiran absensi harian
DO $$ BEGIN
    CREATE TYPE status_absensi AS ENUM ('hadir', 'terlambat');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Status slip gaji bulanan
DO $$ BEGIN
    CREATE TYPE status_slip_gaji AS ENUM ('draf', 'terbit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. TABEL: DIVISI
-- ==============================================================================
CREATE TABLE IF NOT EXISTS divisi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL UNIQUE,
    manajer_id UUID UNIQUE, -- Relasi ke profiles(id), ditambahkan via ALTER TABLE karena dependensi sirkular
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE divisi IS 'Daftar divisi perusahaan dan Atasan yang memimpinnya';
COMMENT ON COLUMN divisi.id IS 'Kunci utama divisi';
COMMENT ON COLUMN divisi.nama IS 'Nama divisi unik';
COMMENT ON COLUMN divisi.manajer_id IS 'Atasan (manajer) divisi. Unik (satu Atasan hanya memimpin satu divisi, dan dipimpin paling banyak satu Atasan)';
COMMENT ON COLUMN divisi.dibuat_pada IS 'Waktu data dibuat';

-- ==============================================================================
-- 4. TABEL: PROFILES (Terhubung 1-to-1 dengan auth.users Supabase)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nik_karyawan TEXT NOT NULL UNIQUE,
    nama_lengkap TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    nomor_hp TEXT,
    peran peran_type NOT NULL DEFAULT 'karyawan',
    divisi_id UUID REFERENCES divisi(id) ON DELETE SET NULL,
    jabatan TEXT NOT NULL,
    status_kerja status_kerja_type NOT NULL,
    tanggal_masuk DATE NOT NULL,
    aktif BOOLEAN NOT NULL DEFAULT true,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT check_nik_format CHECK (nik_karyawan ~ '^KLN-[0-9]{4}$'),
    CONSTRAINT check_nama_lengkap CHECK (length(trim(nama_lengkap)) >= 3),
    CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE profiles IS 'Data karyawan dan peran akun. Satu baris untuk setiap akun di auth.users (1-to-1)';
COMMENT ON COLUMN profiles.id IS 'Kunci utama, identik dengan id di auth.users';
COMMENT ON COLUMN profiles.nik_karyawan IS 'Nomor induk karyawan (format KLN-0000)';
COMMENT ON COLUMN profiles.nama_lengkap IS 'Nama lengkap karyawan (minimal 3 karakter)';
COMMENT ON COLUMN profiles.email IS 'Email masuk aplikasi (unik)';
COMMENT ON COLUMN profiles.nomor_hp IS 'Nomor HP karyawan (opsional)';
COMMENT ON COLUMN profiles.peran IS 'Peran akun: karyawan, atasan, atau hrd (bawaan: karyawan)';
COMMENT ON COLUMN profiles.divisi_id IS 'Divisi tempat karyawan bekerja';
COMMENT ON COLUMN profiles.jabatan IS 'Nama jabatan karyawan';
COMMENT ON COLUMN profiles.status_kerja IS 'Status kepegawaian: tetap atau kontrak';
COMMENT ON COLUMN profiles.tanggal_masuk IS 'Tanggal mulai bekerja (dasar perhitungan hak cuti 12 bulan)';
COMMENT ON COLUMN profiles.aktif IS 'Status keaktifan akun (bawaan true; false tidak bisa login)';
COMMENT ON COLUMN profiles.dibuat_pada IS 'Waktu data profil dibuat';

-- Pasang foreign key divisi -> profiles (manajer_id)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_divisi_manajer'
    ) THEN
        ALTER TABLE divisi
            ADD CONSTRAINT fk_divisi_manajer
            FOREIGN KEY (manajer_id) REFERENCES profiles(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- ==============================================================================
-- 5. TABEL: HARI_LIBUR
-- ==============================================================================
CREATE TABLE IF NOT EXISTS hari_libur (
    tanggal DATE PRIMARY KEY,
    keterangan TEXT NOT NULL,
    jenis jenis_hari_libur NOT NULL,

    -- Constraints
    CONSTRAINT check_keterangan_not_empty CHECK (length(trim(keterangan)) > 0)
);

COMMENT ON TABLE hari_libur IS 'Daftar tanggal libur yang tidak dihitung sebagai hari kerja';
COMMENT ON COLUMN hari_libur.tanggal IS 'Tanggal libur (kunci utama)';
COMMENT ON COLUMN hari_libur.keterangan IS 'Nama atau keterangan hari libur';
COMMENT ON COLUMN hari_libur.jenis IS 'Jenis libur: nasional, cuti_bersama, atau perusahaan';

-- ==============================================================================
-- 6. TABEL: KUOTA_CUTI
-- ==============================================================================
CREATE TABLE IF NOT EXISTS kuota_cuti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    karyawan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    tahun INTEGER NOT NULL,
    jatah_hari INTEGER NOT NULL DEFAULT 12,
    terpakai_hari INTEGER NOT NULL DEFAULT 0,

    -- Constraints
    CONSTRAINT uq_kuota_karyawan_tahun UNIQUE (karyawan_id, tahun),
    CONSTRAINT check_tahun_valid CHECK (tahun >= 2000 AND tahun <= 2100),
    CONSTRAINT check_jatah_hari_range CHECK (jatah_hari >= 0 AND jatah_hari <= 12),
    CONSTRAINT check_terpakai_hari_non_negative CHECK (terpakai_hari >= 0),
    CONSTRAINT check_kuota_tidak_minus CHECK (terpakai_hari <= jatah_hari)
);

COMMENT ON TABLE kuota_cuti IS 'Jatah dan pemakaian cuti tahunan per karyawan per tahun kalender';
COMMENT ON COLUMN kuota_cuti.id IS 'Kunci utama kuota cuti';
COMMENT ON COLUMN kuota_cuti.karyawan_id IS 'Pemilik kuota cuti';
COMMENT ON COLUMN kuota_cuti.tahun IS 'Tahun kalender (unik bersama karyawan_id)';
COMMENT ON COLUMN kuota_cuti.jatah_hari IS 'Jatah cuti tahun berjalan (0 sampai 12, bawaan 12)';
COMMENT ON COLUMN kuota_cuti.terpakai_hari IS 'Hari yang sudah dipakai atau sedang diajukan (tidak boleh melebihi jatah_hari)';

-- ==============================================================================
-- 7. TABEL: PENGAJUAN_CUTI
-- ==============================================================================
CREATE TABLE IF NOT EXISTS pengajuan_cuti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    karyawan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    jenis jenis_pengajuan NOT NULL,
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    jumlah_hari INTEGER NOT NULL,
    alasan TEXT NOT NULL,
    lampiran_path TEXT,
    status status_pengajuan NOT NULL DEFAULT 'diajukan',
    perlu_atasan BOOLEAN NOT NULL DEFAULT true,
    disetujui_atasan_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
    disetujui_atasan_pada TIMESTAMPTZ,
    diputuskan_hrd_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
    diputuskan_hrd_pada TIMESTAMPTZ,
    alasan_penolakan TEXT,
    dibatalkan_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
    dibatalkan_pada TIMESTAMPTZ,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT check_rentang_tanggal CHECK (tanggal_selesai >= tanggal_mulai),
    CONSTRAINT check_tahun_pengajuan_sama CHECK (EXTRACT(YEAR FROM tanggal_mulai) = EXTRACT(YEAR FROM tanggal_selesai)),
    CONSTRAINT check_jumlah_hari_min CHECK (jumlah_hari >= 1),
    CONSTRAINT check_alasan_min_5 CHECK (length(trim(alasan)) >= 5),
    CONSTRAINT check_izin_max_2_hari CHECK (jenis != 'izin' OR jumlah_hari <= 2),
    CONSTRAINT check_lampiran_sakit_lebih_1_hari CHECK (
        NOT (jenis = 'sakit' AND jumlah_hari > 1 AND (lampiran_path IS NULL OR trim(lampiran_path) = ''))
    ),
    CONSTRAINT check_alasan_penolakan_min_10 CHECK (
        status != 'ditolak' OR (alasan_penolakan IS NOT NULL AND length(trim(alasan_penolakan)) >= 10)
    ),
    CONSTRAINT check_tidak_memutuskan_sendiri_atasan CHECK (
        disetujui_atasan_oleh IS NULL OR disetujui_atasan_oleh != karyawan_id
    ),
    CONSTRAINT check_tidak_memutuskan_sendiri_hrd CHECK (
        diputuskan_hrd_oleh IS NULL OR diputuskan_hrd_oleh != karyawan_id
    )
);

COMMENT ON TABLE pengajuan_cuti IS 'Pengajuan cuti tahunan, sakit, dan izin beserta alur dan jejak persetujuannya';
COMMENT ON COLUMN pengajuan_cuti.id IS 'Kunci utama pengajuan';
COMMENT ON COLUMN pengajuan_cuti.karyawan_id IS 'Pemohon pengajuan';
COMMENT ON COLUMN pengajuan_cuti.jenis IS 'Jenis pengajuan: cuti_tahunan, sakit, atau izin';
COMMENT ON COLUMN pengajuan_cuti.tanggal_mulai IS 'Tanggal awal pengajuan';
COMMENT ON COLUMN pengajuan_cuti.tanggal_selesai IS 'Tanggal akhir pengajuan (tahun kalender harus sama dengan tanggal_mulai)';
COMMENT ON COLUMN pengajuan_cuti.jumlah_hari IS 'Jumlah hari kerja dalam rentang (tanpa Sabtu, Minggu, dan hari libur)';
COMMENT ON COLUMN pengajuan_cuti.alasan IS 'Alasan pengajuan (minimal 5 karakter)';
COMMENT ON COLUMN pengajuan_cuti.lampiran_path IS 'Lokasi path surat dokter di Supabase Storage (wajib untuk sakit > 1 hari)';
COMMENT ON COLUMN pengajuan_cuti.status IS 'Status pengajuan: diajukan, disetujui_atasan, disetujui, ditolak, dibatalkan';
COMMENT ON COLUMN pengajuan_cuti.perlu_atasan IS 'Apakah membutuhkan persetujuan Atasan terlebih dahulu';
COMMENT ON COLUMN pengajuan_cuti.disetujui_atasan_oleh IS 'Atasan yang menyetujui tahap 1';
COMMENT ON COLUMN pengajuan_cuti.disetujui_atasan_pada IS 'Waktu persetujuan tahap 1';
COMMENT ON COLUMN pengajuan_cuti.diputuskan_hrd_oleh IS 'HRD yang memberi keputusan akhir';
COMMENT ON COLUMN pengajuan_cuti.diputuskan_hrd_pada IS 'Waktu keputusan akhir HRD';
COMMENT ON COLUMN pengajuan_cuti.alasan_penolakan IS 'Alasan bila ditolak (wajib minimal 10 karakter bila status ditolak)';
COMMENT ON COLUMN pengajuan_cuti.dibatalkan_oleh IS 'Pengguna yang membatalkan pengajuan';
COMMENT ON COLUMN pengajuan_cuti.dibatalkan_pada IS 'Waktu pembatalan';
COMMENT ON COLUMN pengajuan_cuti.dibuat_pada IS 'Waktu pengajuan dibuat';

-- ==============================================================================
-- 8. TABEL: ABSENSI
-- ==============================================================================
CREATE TABLE IF NOT EXISTS absensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    karyawan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    jam_masuk TIMESTAMPTZ NOT NULL,
    jam_pulang TIMESTAMPTZ,
    status status_absensi NOT NULL,
    dikoreksi_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
    alasan_koreksi TEXT,

    -- Constraints
    CONSTRAINT uq_absensi_karyawan_tanggal UNIQUE (karyawan_id, tanggal),
    CONSTRAINT check_jam_pulang_setelah_masuk CHECK (jam_pulang IS NULL OR jam_pulang > jam_masuk),
    CONSTRAINT check_koreksi_absensi CHECK (
        (dikoreksi_oleh IS NULL AND alasan_koreksi IS NULL) OR
        (dikoreksi_oleh IS NOT NULL AND alasan_koreksi IS NOT NULL AND length(trim(alasan_koreksi)) >= 10)
    )
);

COMMENT ON TABLE absensi IS 'Catatan check-in dan check-out harian karyawan';
COMMENT ON COLUMN absensi.id IS 'Kunci utama absensi';
COMMENT ON COLUMN absensi.karyawan_id IS 'Karyawan yang melakukan absensi';
COMMENT ON COLUMN absensi.tanggal IS 'Tanggal kerja WIB (unik bersama karyawan_id, satu kali per hari)';
COMMENT ON COLUMN absensi.jam_masuk IS 'Waktu check-in dari server (Wajib)';
COMMENT ON COLUMN absensi.jam_pulang IS 'Waktu check-out dari server (Boleh kosong, harus setelah jam_masuk)';
COMMENT ON COLUMN absensi.status IS 'Status kehadiran: hadir atau terlambat (lewat 08.15.00 WIB)';
COMMENT ON COLUMN absensi.dikoreksi_oleh IS 'HRD yang mengoreksi data absensi (kosong jika tidak dikoreksi)';
COMMENT ON COLUMN absensi.alasan_koreksi IS 'Alasan koreksi oleh HRD (minimal 10 karakter jika dikoreksi)';

-- ==============================================================================
-- 9. TABEL: SLIP_GAJI
-- ==============================================================================
CREATE TABLE IF NOT EXISTS slip_gaji (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_slip TEXT UNIQUE,
    karyawan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    periode DATE NOT NULL,
    gaji_pokok NUMERIC(12, 0) NOT NULL,
    tunjangan NUMERIC(12, 0) NOT NULL DEFAULT 0,
    potongan NUMERIC(12, 0) NOT NULL DEFAULT 0,
    total_diterima NUMERIC(12, 0) GENERATED ALWAYS AS (gaji_pokok + tunjangan - potongan) STORED,
    catatan TEXT,
    status status_slip_gaji NOT NULL DEFAULT 'draf',
    dibuat_oleh UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    diterbitkan_oleh UUID REFERENCES profiles(id) ON DELETE RESTRICT,
    diterbitkan_pada TIMESTAMPTZ,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT uq_slip_karyawan_periode UNIQUE (karyawan_id, periode),
    CONSTRAINT check_periode_tanggal_1 CHECK (EXTRACT(DAY FROM periode) = 1),
    CONSTRAINT check_gaji_pokok_non_negatif CHECK (gaji_pokok >= 0),
    CONSTRAINT check_tunjangan_non_negatif CHECK (tunjangan >= 0),
    CONSTRAINT check_potongan_non_negatif CHECK (potongan >= 0),
    CONSTRAINT check_total_diterima_non_negatif CHECK (gaji_pokok + tunjangan - potongan >= 0),
    CONSTRAINT check_nomor_slip_format CHECK (nomor_slip IS NULL OR nomor_slip ~ '^SG-[0-9]{6}-[0-9]{3}$'),
    CONSTRAINT check_syarat_slip_terbit CHECK (
        status != 'terbit' OR (nomor_slip IS NOT NULL AND diterbitkan_oleh IS NOT NULL AND diterbitkan_pada IS NOT NULL)
    )
);

COMMENT ON TABLE slip_gaji IS 'Slip gaji bulanan karyawan. Data rahasia (hanya HRD dan karyawan pemilik)';
COMMENT ON COLUMN slip_gaji.id IS 'Kunci utama slip gaji';
COMMENT ON COLUMN slip_gaji.nomor_slip IS 'Nomor slip berurutan format SG-TTTTBB-NNN (unik, terisi saat terbit)';
COMMENT ON COLUMN slip_gaji.karyawan_id IS 'Penerima gaji';
COMMENT ON COLUMN slip_gaji.periode IS 'Bulan gaji, ditulis tanggal 1 (unik bersama karyawan_id)';
COMMENT ON COLUMN slip_gaji.gaji_pokok IS 'Gaji pokok dalam rupiah (tidak boleh negatif)';
COMMENT ON COLUMN slip_gaji.tunjangan IS 'Total tunjangan (tidak boleh negatif, bawaan 0)';
COMMENT ON COLUMN slip_gaji.potongan IS 'Total potongan (tidak boleh negatif, bawaan 0)';
COMMENT ON COLUMN slip_gaji.total_diterima IS 'Total gaji diterima: gaji_pokok + tunjangan - potongan (otomatis, tidak boleh negatif)';
COMMENT ON COLUMN slip_gaji.catatan IS 'Rincian singkat tunjangan atau potongan (opsional)';
COMMENT ON COLUMN slip_gaji.status IS 'Status slip: draf atau terbit (terbit terkunci)';
COMMENT ON COLUMN slip_gaji.dibuat_oleh IS 'HRD pembuat draf slip gaji';
COMMENT ON COLUMN slip_gaji.diterbitkan_oleh IS 'HRD yang menerbitkan slip gaji';
COMMENT ON COLUMN slip_gaji.diterbitkan_pada IS 'Waktu slip gaji diterbitkan';
COMMENT ON COLUMN slip_gaji.dibuat_pada IS 'Waktu draf slip gaji dibuat';

-- Trigger: Mengunci slip gaji yang sudah berstatus 'terbit' agar tidak dapat diubah atau dihapus (BR-12)
CREATE OR REPLACE FUNCTION trg_lock_terbit_slip_gaji()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.status = 'terbit' THEN
        RAISE EXCEPTION 'Slip gaji yang sudah terbit terkunci dan tidak dapat dihapus.';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status = 'terbit' THEN
        RAISE EXCEPTION 'Slip gaji yang sudah terbit terkunci dan tidak dapat diubah.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lock_terbit_slip_gaji ON slip_gaji;
CREATE TRIGGER trigger_lock_terbit_slip_gaji
BEFORE UPDATE OR DELETE ON slip_gaji
FOR EACH ROW
EXECUTE FUNCTION trg_lock_terbit_slip_gaji();

-- ==============================================================================
-- 10. TABEL: AUDIT_LOG (Immutable)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pelaku_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    aksi TEXT NOT NULL,
    nama_tabel TEXT NOT NULL,
    data_id TEXT,
    nilai_sebelum JSONB,
    nilai_sesudah JSONB,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_log IS 'Jejak aksi sensitif kepegawaian. Bersifat immutable (tidak dapat diubah atau dihapus)';
COMMENT ON COLUMN audit_log.id IS 'Nomor urut audit log (otomatis)';
COMMENT ON COLUMN audit_log.pelaku_id IS 'Akun yang melakukan aksi (boleh kosong untuk proses sistem)';
COMMENT ON COLUMN audit_log.aksi IS 'Nama aksi, misal: cuti_update, slip_update, koreksi_absensi_insert';
COMMENT ON COLUMN audit_log.nama_tabel IS 'Tabel yang mengalami perubahan';
COMMENT ON COLUMN audit_log.data_id IS 'ID baris data yang berubah';
COMMENT ON COLUMN audit_log.nilai_sebelum IS 'Snapshot isi baris sebelum berubah (null untuk insert/data baru)';
COMMENT ON COLUMN audit_log.nilai_sesudah IS 'Snapshot isi baris sesudah berubah (null untuk delete)';
COMMENT ON COLUMN audit_log.dibuat_pada IS 'Waktu pencatatan log (otomatis)';

-- Trigger: Menjaga sifat immutable audit_log (mencegah UPDATE & DELETE)
CREATE OR REPLACE FUNCTION trg_prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log bersifat immutable: data riwayat tidak boleh diubah atau dihapus.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_audit_log_modification ON audit_log;
CREATE TRIGGER trigger_prevent_audit_log_modification
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_audit_log_modification();

-- ==============================================================================
-- 11. INDEX UNTUK PERFORMA QUERY & LAPORAN
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_divisi_id ON profiles(divisi_id);
CREATE INDEX IF NOT EXISTS idx_profiles_peran ON profiles(peran);
CREATE INDEX IF NOT EXISTS idx_profiles_aktif ON profiles(aktif);

CREATE INDEX IF NOT EXISTS idx_absensi_karyawan_tanggal ON absensi(karyawan_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON absensi(tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_status ON absensi(status);

CREATE INDEX IF NOT EXISTS idx_pengajuan_karyawan_status ON pengajuan_cuti(karyawan_id, status);
CREATE INDEX IF NOT EXISTS idx_pengajuan_rentang ON pengajuan_cuti(tanggal_mulai, tanggal_selesai);
CREATE INDEX IF NOT EXISTS idx_pengajuan_status ON pengajuan_cuti(status);

CREATE INDEX IF NOT EXISTS idx_slip_gaji_periode ON slip_gaji(periode);
CREATE INDEX IF NOT EXISTS idx_slip_gaji_status ON slip_gaji(status);
CREATE INDEX IF NOT EXISTS idx_slip_gaji_karyawan ON slip_gaji(karyawan_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_pelaku ON audit_log(pelaku_id, dibuat_pada DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabel_waktu ON audit_log(nama_tabel, dibuat_pada DESC);

-- ==============================================================================
-- 12. STORED FUNCTIONS: WORKFLOW PENGAJUAN CUTI, PERSETUJUAN & PEMBATALAN (BR-06, BR-09, BR-10, BR-12)
-- ==============================================================================

-- 12.1 Submit Pengajuan Cuti (Atomic Kuota Locking - BR-06)
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
AS $$
DECLARE
    v_tahun INTEGER;
    v_kuota RECORD;
    v_pengajuan public.pengajuan_cuti%ROWTYPE;
BEGIN
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
        pelaku_id,
        aksi,
        nama_tabel,
        data_id,
        nilai_sebelum,
        nilai_sesudah
    ) VALUES (
        p_karyawan_id,
        'pengajuan_dibuat',
        'pengajuan_cuti',
        v_pengajuan.id::TEXT,
        NULL,
        row_to_json(v_pengajuan)::JSONB
    );

    RETURN row_to_json(v_pengajuan)::JSONB;
END;
$$;

-- 12.2 Persetujuan Tahap 1 oleh Atasan (BR-09)
CREATE OR REPLACE FUNCTION public.fn_approve_pengajuan_tahap1(
    p_pengajuan_id UUID,
    p_atasan_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pengajuan public.pengajuan_cuti%ROWTYPE;
    v_sebelum JSONB;
    v_pemohon RECORD;
    v_atasan RECORD;
BEGIN
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
        p_atasan_id, 'pengajuan_disetujui_atasan', 'pengajuan_cuti', v_pengajuan.id::TEXT, v_sebelum, row_to_json(v_pengajuan)::JSONB
    );

    RETURN row_to_json(v_pengajuan)::JSONB;
END;
$$;

-- 12.3 Persetujuan Tahap 2 oleh HRD (BR-09)
CREATE OR REPLACE FUNCTION public.fn_approve_pengajuan_tahap2(
    p_pengajuan_id UUID,
    p_hrd_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pengajuan public.pengajuan_cuti%ROWTYPE;
    v_sebelum JSONB;
    v_hrd RECORD;
BEGIN
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
        p_hrd_id, 'pengajuan_disetujui_hrd', 'pengajuan_cuti', v_pengajuan.id::TEXT, v_sebelum, row_to_json(v_pengajuan)::JSONB
    );

    RETURN row_to_json(v_pengajuan)::JSONB;
END;
$$;

-- 12.4 Penolakan Pengajuan dengan Alasan >= 10 Karakter & Pengembalian Kuota (BR-06 & BR-09)
CREATE OR REPLACE FUNCTION public.fn_reject_pengajuan(
    p_pengajuan_id UUID,
    p_pelaku_id UUID,
    p_alasan_penolakan TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pengajuan public.pengajuan_cuti%ROWTYPE;
    v_sebelum JSONB;
    v_pelaku RECORD;
    v_pemohon RECORD;
    v_tahun INTEGER;
BEGIN
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
        p_pelaku_id, 'pengajuan_ditolak', 'pengajuan_cuti', v_pengajuan.id::TEXT, v_sebelum, row_to_json(v_pengajuan)::JSONB
    );

    RETURN row_to_json(v_pengajuan)::JSONB;
END;
$$;

-- 12.5 Pembatalan Pengajuan & Pengembalian Kuota Cuti (BR-06 & BR-10)
CREATE OR REPLACE FUNCTION public.fn_cancel_pengajuan(
    p_pengajuan_id UUID,
    p_pelaku_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pengajuan public.pengajuan_cuti%ROWTYPE;
    v_sebelum JSONB;
    v_pelaku RECORD;
    v_tahun INTEGER;
    v_today DATE;
BEGIN
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
        p_pelaku_id, 'pengajuan_dibatalkan', 'pengajuan_cuti', v_pengajuan.id::TEXT, v_sebelum, row_to_json(v_pengajuan)::JSONB
    );

    RETURN row_to_json(v_pengajuan)::JSONB;
END;
$$;

-- ==============================================================================
-- 13. MODUL SLIP GAJI & KEAMANAN AKSES (BR-11 & BR-12)
-- ==============================================================================

-- 13.1 Simpan Draf Slip Gaji (Buat Baru atau Update Draf)
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
AS $$
DECLARE
    v_hrd RECORD;
    v_slip public.slip_gaji%ROWTYPE;
    v_sebelum JSONB := NULL;
    v_total NUMERIC;
    v_aksi TEXT;
BEGIN
    SELECT peran INTO v_hrd FROM public.profiles WHERE id = p_hrd_id;
    IF v_hrd.peran != 'hrd' THEN
        RAISE EXCEPTION 'Hanya HRD yang berhak membuat atau mengedit slip gaji (BR-11 & BR-12).';
    END IF;

    -- Validasi tanggal 1
    IF EXTRACT(DAY FROM p_periode) != 1 THEN
        RAISE EXCEPTION 'Periode slip gaji harus tanggal 1 pada bulan tersebut.';
    END IF;

    -- Validasi nilai non-negatif
    IF p_gaji_pokok < 0 OR p_tunjangan < 0 OR p_potongan < 0 THEN
        RAISE EXCEPTION 'Komponen gaji tidak boleh bernilai negatif.';
    END IF;

    v_total := p_gaji_pokok + p_tunjangan - p_potongan;
    IF v_total < 0 THEN
        RAISE EXCEPTION 'Total gaji diterima tidak boleh di bawah 0.';
    END IF;

    -- Jika p_slip_id diberikan, lakukan UPDATE
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
        -- Periksa apakah sudah ada slip gaji untuk karyawan & periode ini
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
            -- Buat baru
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

    -- Catat ke audit log (BR-12)
    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah
    ) VALUES (
        p_hrd_id, v_aksi, 'slip_gaji', v_slip.id::TEXT, v_sebelum, row_to_json(v_slip)::JSONB
    );

    RETURN row_to_json(v_slip)::JSONB;
END;
$$;

-- 13.2 Penerbitan Slip Gaji (Kunci status 'terbit', Generate Nomor Slip SG-TTTTBB-NNN)
CREATE OR REPLACE FUNCTION public.fn_publish_slip_gaji(
    p_slip_id UUID,
    p_hrd_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_slip public.slip_gaji%ROWTYPE;
    v_sebelum JSONB;
    v_prefix TEXT;
    v_seq INTEGER;
    v_nomor_slip TEXT;
    v_hrd RECORD;
BEGIN
    SELECT peran INTO v_hrd FROM public.profiles WHERE id = p_hrd_id;
    IF v_hrd.peran != 'hrd' THEN
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

    -- Format SG-TTTTBB-
    v_prefix := 'SG-' || to_char(v_slip.periode, 'YYYYMM') || '-';

    -- Cari nomor urut tertinggi untuk periode tersebut
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

    -- Catat ke audit_log (BR-12)
    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah
    ) VALUES (
        p_hrd_id, 'penerbitan_slip', 'slip_gaji', v_slip.id::TEXT, v_sebelum, row_to_json(v_slip)::JSONB
    );

    RETURN row_to_json(v_slip)::JSONB;
END;
$$;

-- 13.3 Hapus Draf Slip Gaji (Hanya jika masih berstatus 'draf')
CREATE OR REPLACE FUNCTION public.fn_delete_draft_slip_gaji(
    p_slip_id UUID,
    p_hrd_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hrd RECORD;
    v_slip public.slip_gaji%ROWTYPE;
BEGIN
    SELECT peran INTO v_hrd FROM public.profiles WHERE id = p_hrd_id;
    IF v_hrd.peran != 'hrd' THEN
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


