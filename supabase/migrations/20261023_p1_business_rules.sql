-- ==============================================================================
-- P1 BUSINESS RULE HARDENING
-- HRIS PT KARSA LINTAS NUSANTARA
-- Tanggal: 2026-10-23
--
-- Cakupan:
-- 1. Modul BR-01: RPC admin untuk membuat/mengubah karyawan + sinkronisasi
--    Atasan divisi. Akun auth dibuat atomik tanpa service-role key.
-- 2. BR-09: validasi Tahap 1 hanya oleh manajer divisi pemohon; HRD tidak
--    boleh menolak sebelum Tahap Atasan selesai.
-- 3. BR-10: HRD hanya boleh membatalkan pengajuan yang sudah disetujui dan
--    sebelum tanggal mulai; HRD tidak boleh membatalkan pengajuan pending.
-- 4. BR-04/05/06/07/08: validasi bisnis dipindahkan/diulang di database agar
--    tidak bisa dilewati dengan memanggil RPC langsung.
-- 5. BR-12: audit trigger untuk profiles, kuota_cuti, absensi, divisi,
--    hari_libur, dan slip_gaji (termasuk tulis langsung HRD).
-- 6. search_path tetap untuk seluruh helper/trigger function.
--
-- Catatan: fungsi workflow pengajuan dan slip di-recreate agar audit manual
-- yang sudah dicakup trigger tidak menghasilkan baris ganda.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HELPER: search_path TETAP + UTILITAS HARI KERJA
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND aktif = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_hrd()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND peran = 'hrd' AND aktif = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_atasan()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND peran = 'atasan' AND aktif = true
    );
$$;

CREATE OR REPLACE FUNCTION public.get_my_divisi_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT divisi_id FROM public.profiles WHERE id = auth.uid() AND aktif = true;
$$;

REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_hrd() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_atasan() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_divisi_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_hrd() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_atasan() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_divisi_id() TO authenticated, service_role;

-- Hitung hari kerja: Senin-Jumat, bukan hari libur. Dipakai juga oleh RPC submit.
CREATE OR REPLACE FUNCTION public.fn_count_working_days(p_start DATE, p_end DATE)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT COUNT(*)::INTEGER
    FROM generate_series(p_start, p_end, INTERVAL '1 day') AS d
    WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5
      AND NOT EXISTS (
          SELECT 1 FROM public.hari_libur h WHERE h.tanggal = d::DATE
      );
$$;

REVOKE ALL ON FUNCTION public.fn_count_working_days(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_count_working_days(DATE, DATE)
    TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. PROTEKSI PROFIL: SELF, HRD TERAKHIR, EMAIL LOGIN, KONSISTENSI ATASAN
-- ------------------------------------------------------------------------------
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

-- Minimal satu akun HRD aktif harus selalu ada.
CREATE OR REPLACE FUNCTION public.trg_protect_last_hrd()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.peran = 'hrd' AND OLD.aktif = true
           AND NOT EXISTS (
               SELECT 1 FROM public.profiles
               WHERE id <> OLD.id AND peran = 'hrd' AND aktif = true
           ) THEN
            RAISE EXCEPTION 'Minimal harus ada satu akun HRD aktif (BR-01).';
        END IF;
        RETURN OLD;
    END IF;

    IF OLD.peran = 'hrd' AND OLD.aktif = true
       AND (NEW.peran IS DISTINCT FROM 'hrd' OR NEW.aktif IS DISTINCT FROM true) THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id <> OLD.id AND peran = 'hrd' AND aktif = true
        ) THEN
            RAISE EXCEPTION 'Minimal harus ada satu akun HRD aktif (BR-01).';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Email profil harus identik dengan email login di auth.users.
CREATE OR REPLACE FUNCTION public.trg_protect_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_email TEXT;
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        SELECT email INTO v_auth_email FROM auth.users WHERE id = OLD.id;
        IF v_auth_email IS NOT NULL AND NEW.email IS DISTINCT FROM v_auth_email THEN
            RAISE EXCEPTION 'Email login harus diubah melalui admin autentikasi; email profil tidak boleh berbeda dari auth.users.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Validasi manajer divisi: harus aktif dan berperan atasan atau HRD.
CREATE OR REPLACE FUNCTION public.trg_validate_divisi_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_peran public.peran_type;
    v_aktif BOOLEAN;
BEGIN
    IF NEW.manajer_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT peran, aktif INTO v_peran, v_aktif
    FROM public.profiles
    WHERE id = NEW.manajer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Manajer divisi tidak ditemukan.';
    END IF;

    IF v_aktif IS NOT TRUE THEN
        RAISE EXCEPTION 'Karyawan nonaktif tidak dapat menjadi manajer divisi (BR-01).';
    END IF;

    IF v_peran NOT IN ('atasan', 'hrd') THEN
        RAISE EXCEPTION 'Manajer divisi harus berperan Atasan atau HRD (BR-01).';
    END IF;

    IF v_peran = 'atasan' AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.divisi_id = NEW.id
          AND p.peran = 'atasan'
          AND p.aktif = true
          AND p.id <> NEW.manajer_id
    ) THEN
        RAISE EXCEPTION 'Divisi hanya boleh dipimpin paling banyak satu Atasan (BR-01).';
    END IF;

    RETURN NEW;
END;
$$;

-- Sinkronisasi peran Atasan dengan manajer_id divisi.
CREATE OR REPLACE FUNCTION public.trg_sync_division_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_manager UUID;
BEGIN
    -- DELETE: lepaskan jabatan manajer yang dipegang profil ini.
    IF TG_OP = 'DELETE' THEN
        UPDATE public.divisi
        SET manajer_id = NULL
        WHERE manajer_id = OLD.id;
        RETURN OLD;
    END IF;

    -- Nonaktif atau bukan Atasan/HRD: lepaskan jabatan manajer yang dipegangnya.
    IF NEW.aktif IS NOT TRUE OR NEW.peran NOT IN ('atasan', 'hrd') THEN
        UPDATE public.divisi
        SET manajer_id = NULL
        WHERE manajer_id = NEW.id;
        RETURN NEW;
    END IF;

    IF NEW.peran = 'atasan' THEN
        IF NEW.divisi_id IS NULL THEN
            RAISE EXCEPTION 'Atasan wajib memiliki divisi (BR-01).';
        END IF;

        -- Satu divisi hanya boleh punya satu Atasan aktif.
        IF EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id <> NEW.id
              AND p.divisi_id = NEW.divisi_id
              AND p.peran = 'atasan'
              AND p.aktif = true
        ) THEN
            RAISE EXCEPTION 'Divisi tersebut sudah memiliki Atasan aktif. Satu divisi hanya boleh dipimpin satu Atasan (BR-01).';
        END IF;

        SELECT manajer_id INTO v_current_manager
        FROM public.divisi
        WHERE id = NEW.divisi_id
        FOR UPDATE;

        IF v_current_manager IS NOT NULL AND v_current_manager <> NEW.id THEN
            RAISE EXCEPTION 'Divisi tersebut sudah memiliki manajer. Kosongkan atau ganti manajer terlebih dahulu (BR-01).';
        END IF;

        -- Satu Atasan hanya memimpin satu divisi.
        UPDATE public.divisi
        SET manajer_id = NULL
        WHERE manajer_id = NEW.id AND id <> NEW.divisi_id;

        UPDATE public.divisi
        SET manajer_id = NEW.id
        WHERE id = NEW.divisi_id AND manajer_id IS DISTINCT FROM NEW.id;

    ELSIF NEW.peran = 'hrd' AND TG_OP = 'UPDATE' THEN
        IF OLD.peran = 'atasan' THEN
            -- Atasan yang diubah menjadi HRD tidak lagi otomatis memimpin divisi lama.
            UPDATE public.divisi
            SET manajer_id = NULL
            WHERE manajer_id = NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_self_profile ON public.profiles;
CREATE TRIGGER trigger_protect_self_profile
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_self_profile();

DROP TRIGGER IF EXISTS trigger_protect_last_hrd ON public.profiles;
CREATE TRIGGER trigger_protect_last_hrd
BEFORE UPDATE OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_last_hrd();

DROP TRIGGER IF EXISTS trigger_protect_profile_email ON public.profiles;
CREATE TRIGGER trigger_protect_profile_email
BEFORE UPDATE OF email ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_profile_email();

DROP TRIGGER IF EXISTS trigger_validate_divisi_manager ON public.divisi;
CREATE TRIGGER trigger_validate_divisi_manager
BEFORE INSERT OR UPDATE OF manajer_id ON public.divisi
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_divisi_manager();

DROP TRIGGER IF EXISTS trigger_profiles_sync_manager_ins ON public.profiles;
CREATE TRIGGER trigger_profiles_sync_manager_ins
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_division_manager();

DROP TRIGGER IF EXISTS trigger_profiles_sync_manager_upd ON public.profiles;
CREATE TRIGGER trigger_profiles_sync_manager_upd
AFTER UPDATE OF peran, divisi_id, aktif ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_division_manager();

DROP TRIGGER IF EXISTS trigger_profiles_sync_manager_del ON public.profiles;
CREATE TRIGGER trigger_profiles_sync_manager_del
AFTER DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_division_manager();

-- Atasan wajib punya divisi (data lama sudah valid).
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_atasan_has_divisi'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT check_atasan_has_divisi
            CHECK (peran <> 'atasan' OR divisi_id IS NOT NULL);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. AUDIT TRIGGER (BR-12)
--    Menangkap perubahan langsung (termasuk dari HRD) pada tabel master,
--    absensi, dan slip. Pengajuan cuti tetap diaudit di RPC karena butuh
--    konteks aksi/status.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_aktor UUID := auth.uid();
    v_aksi TEXT;
    v_data_id TEXT;
    v_sebelum JSONB;
    v_sesudah JSONB;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        v_sebelum := to_jsonb(OLD);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_sesudah := to_jsonb(NEW);
    END IF;

    IF TG_TABLE_NAME = 'profiles' THEN
        v_data_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END::TEXT;
        v_aksi := CASE TG_OP
            WHEN 'INSERT' THEN 'profil_dibuat'
            WHEN 'UPDATE' THEN 'perubahan_data_kepegawaian'
            ELSE 'profil_dihapus'
        END;
        -- Jangan audit perubahan teknis email yang sudah dicek trigger lain.
    ELSIF TG_TABLE_NAME = 'kuota_cuti' THEN
        v_data_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END::TEXT;
        IF TG_OP = 'UPDATE' AND OLD.jatah_hari IS NOT DISTINCT FROM NEW.jatah_hari THEN
            RETURN NULL;
        END IF;
        v_aksi := CASE TG_OP
            WHEN 'INSERT' THEN 'penetapan_jatah_cuti_baru'
            WHEN 'UPDATE' THEN 'perubahan_jatah_cuti'
            ELSE 'penghapusan_jatah_cuti'
        END;
    ELSIF TG_TABLE_NAME = 'absensi' THEN
        v_data_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END::TEXT;
        IF TG_OP = 'INSERT' THEN
            -- Check-in karyawan sendiri bukan aksi koreksi.
            IF NEW.dikoreksi_oleh IS NULL AND auth.uid() = NEW.karyawan_id THEN
                RETURN NULL;
            END IF;
            v_aksi := 'absensi_dibuat';
        ELSIF TG_OP = 'UPDATE' THEN
            -- Check-out karyawan sendiri bukan aksi koreksi.
            IF NEW.dikoreksi_oleh IS NULL
               AND auth.uid() = NEW.karyawan_id
               AND OLD.jam_pulang IS NULL
               AND NEW.jam_pulang IS NOT NULL THEN
                RETURN NULL;
            END IF;
            v_aksi := 'koreksi_absensi';
        ELSE
            v_aksi := 'penghapusan_absensi';
        END IF;
    ELSIF TG_TABLE_NAME = 'divisi' THEN
        v_data_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END::TEXT;
        IF TG_OP = 'UPDATE' AND OLD.manajer_id IS DISTINCT FROM NEW.manajer_id THEN
            v_aksi := 'perubahan_manajer_divisi';
        ELSE
            v_aksi := CASE TG_OP
                WHEN 'INSERT' THEN 'penambahan_divisi'
                WHEN 'UPDATE' THEN 'perubahan_divisi'
                ELSE 'penghapusan_divisi'
            END;
        END IF;
    ELSIF TG_TABLE_NAME = 'hari_libur' THEN
        v_data_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.tanggal ELSE NEW.tanggal END::TEXT;
        v_aksi := CASE TG_OP
            WHEN 'INSERT' THEN 'penambahan_hari_libur'
            WHEN 'UPDATE' THEN 'perubahan_hari_libur'
            ELSE 'penghapusan_hari_libur'
        END;
    ELSIF TG_TABLE_NAME = 'slip_gaji' THEN
        v_data_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END::TEXT;
        IF TG_OP = 'INSERT' THEN
            v_aksi := 'slip_dibuat';
        ELSIF TG_OP = 'UPDATE' AND OLD.status = 'draf' AND NEW.status = 'terbit' THEN
            v_aksi := 'penerbitan_slip';
        ELSIF TG_OP = 'UPDATE' THEN
            v_aksi := 'slip_diubah';
        ELSE
            v_aksi := 'slip_dihapus';
        END IF;
    ELSE
        v_data_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END::TEXT;
        v_aksi := lower(TG_TABLE_NAME) || '_' || lower(TG_OP);
    END IF;

    INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_sebelum, nilai_sesudah
    ) VALUES (
        v_aktor, v_aksi, TG_TABLE_NAME, v_data_id, v_sebelum, v_sesudah
    );

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_profiles ON public.profiles;
CREATE TRIGGER trigger_audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_audit_row_change();

DROP TRIGGER IF EXISTS trigger_audit_kuota_cuti ON public.kuota_cuti;
CREATE TRIGGER trigger_audit_kuota_cuti
AFTER INSERT OR UPDATE OF jatah_hari OR DELETE ON public.kuota_cuti
FOR EACH ROW
EXECUTE FUNCTION public.fn_audit_row_change();

DROP TRIGGER IF EXISTS trigger_audit_absensi ON public.absensi;
CREATE TRIGGER trigger_audit_absensi
AFTER INSERT OR UPDATE OR DELETE ON public.absensi
FOR EACH ROW
EXECUTE FUNCTION public.fn_audit_row_change();

DROP TRIGGER IF EXISTS trigger_audit_divisi ON public.divisi;
CREATE TRIGGER trigger_audit_divisi
AFTER INSERT OR UPDATE OR DELETE ON public.divisi
FOR EACH ROW
EXECUTE FUNCTION public.fn_audit_row_change();

DROP TRIGGER IF EXISTS trigger_audit_hari_libur ON public.hari_libur;
CREATE TRIGGER trigger_audit_hari_libur
AFTER INSERT OR UPDATE OR DELETE ON public.hari_libur
FOR EACH ROW
EXECUTE FUNCTION public.fn_audit_row_change();

DROP TRIGGER IF EXISTS trigger_audit_slip_gaji ON public.slip_gaji;
CREATE TRIGGER trigger_audit_slip_gaji
AFTER INSERT OR UPDATE OR DELETE ON public.slip_gaji
FOR EACH ROW
EXECUTE FUNCTION public.fn_audit_row_change();

-- Trigger lama: tambahkan search_path tetap.
CREATE OR REPLACE FUNCTION public.trg_lock_terbit_slip_gaji()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.status = 'terbit' THEN
        RAISE EXCEPTION 'Slip gaji yang sudah terbit terkunci dan tidak dapat dihapus.';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status = 'terbit' THEN
        RAISE EXCEPTION 'Slip gaji yang sudah terbit terkunci dan tidak dapat diubah.';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log bersifat immutable: data riwayat tidak boleh diubah atau dihapus.';
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. RPC ADMIN KARYAWAN (BR-01)
--    Akun auth dibuat atomik di fungsi SECURITY DEFINER. Tidak memerlukan
--    SUPABASE_SERVICE_ROLE_KEY dan mendukung domain email .test.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_create_karyawan(
    p_email TEXT,
    p_password TEXT,
    p_nik_karyawan TEXT,
    p_nama_lengkap TEXT,
    p_nomor_hp TEXT,
    p_peran public.peran_type,
    p_divisi_id UUID,
    p_jabatan TEXT,
    p_status_kerja public.status_kerja_type,
    p_tanggal_masuk DATE,
    p_aktif BOOLEAN DEFAULT TRUE,
    p_tahun INTEGER DEFAULT NULL,
    p_jatah_hari INTEGER DEFAULT 12
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := gen_random_uuid();
    v_email TEXT := lower(trim(COALESCE(p_email, '')));
    v_nik TEXT := upper(trim(COALESCE(p_nik_karyawan, '')));
    v_nama TEXT := trim(COALESCE(p_nama_lengkap, ''));
    v_jabatan TEXT := trim(COALESCE(p_jabatan, ''));
    v_tahun INTEGER := COALESCE(p_tahun, EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Jakarta'))::INTEGER);
    v_profile public.profiles%ROWTYPE;
    v_quota public.kuota_cuti%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_hrd() THEN
        RAISE EXCEPTION 'Hanya HRD aktif yang berhak membuat akun karyawan (BR-01).';
    END IF;

    IF v_email = '' OR v_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Format email tidak valid.';
    END IF;

    IF length(COALESCE(p_password, '')) < 8 THEN
        RAISE EXCEPTION 'Kata sandi awal minimal 8 karakter.';
    END IF;

    IF v_nik !~ '^KLN-[0-9]{4}$' THEN
        RAISE EXCEPTION 'NIK karyawan harus berformat KLN-0000.';
    END IF;

    IF length(v_nama) < 3 THEN
        RAISE EXCEPTION 'Nama lengkap minimal 3 karakter.';
    END IF;

    IF v_jabatan = '' THEN
        RAISE EXCEPTION 'Jabatan wajib diisi.';
    END IF;

    IF p_status_kerja IS NULL THEN
        RAISE EXCEPTION 'Status kerja wajib diisi.';
    END IF;

    IF p_tanggal_masuk IS NULL THEN
        RAISE EXCEPTION 'Tanggal masuk wajib diisi.';
    END IF;

    IF p_jatah_hari IS NULL OR p_jatah_hari < 0 OR p_jatah_hari > 12 THEN
        RAISE EXCEPTION 'Jatah cuti tahunan harus antara 0 sampai 12 hari (BR-04).';
    END IF;

    IF p_peran IS NULL THEN
        RAISE EXCEPTION 'Peran wajib diisi.';
    END IF;

    IF p_peran = 'atasan' AND p_divisi_id IS NULL THEN
        RAISE EXCEPTION 'Atasan wajib memiliki divisi (BR-01).';
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
        RAISE EXCEPTION 'Email % sudah terdaftar sebagai akun login.', v_email;
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE email = v_email) THEN
        RAISE EXCEPTION 'Email % sudah digunakan pada profil karyawan.', v_email;
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE nik_karyawan = v_nik) THEN
        RAISE EXCEPTION 'NIK % sudah digunakan.', v_nik;
    END IF;

    IF p_divisi_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.divisi WHERE id = p_divisi_id
    ) THEN
        RAISE EXCEPTION 'Divisi tidak ditemukan.';
    END IF;

    -- 4.1 Akun auth (email/password) + identity.
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::UUID,
        v_user_id,
        'authenticated',
        'authenticated',
        v_email,
        extensions.crypt(p_password, extensions.gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('nama_lengkap', v_nama, 'nik_karyawan', v_nik),
        now(),
        now(),
        '', '', '', ''
    );

    INSERT INTO auth.identities (
        provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
        v_user_id::TEXT,
        v_user_id,
        jsonb_build_object(
            'sub', v_user_id::TEXT,
            'email', v_email,
            'email_verified', true,
            'phone_verified', false
        ),
        'email',
        now(),
        now(),
        now()
    );

    -- 4.2 Profil. Trigger BR-01 akan menyinkronkan manajer divisi.
    INSERT INTO public.profiles (
        id, nik_karyawan, nama_lengkap, email, nomor_hp, peran, divisi_id,
        jabatan, status_kerja, tanggal_masuk, aktif
    ) VALUES (
        v_user_id,
        v_nik,
        v_nama,
        v_email,
        NULLIF(trim(COALESCE(p_nomor_hp, '')), ''),
        p_peran,
        p_divisi_id,
        v_jabatan,
        p_status_kerja,
        p_tanggal_masuk,
        COALESCE(p_aktif, true)
    )
    RETURNING * INTO v_profile;

    -- 4.3 Kuota cuti tahun berjalan.
    INSERT INTO public.kuota_cuti (karyawan_id, tahun, jatah_hari, terpakai_hari)
    VALUES (v_user_id, v_tahun, p_jatah_hari, 0)
    ON CONFLICT (karyawan_id, tahun) DO UPDATE
    SET jatah_hari = EXCLUDED.jatah_hari
    RETURNING * INTO v_quota;

    RETURN jsonb_build_object(
        'profile', to_jsonb(v_profile),
        'quota', to_jsonb(v_quota)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_admin_update_karyawan(
    p_user_id UUID,
    p_nik_karyawan TEXT,
    p_nama_lengkap TEXT,
    p_nomor_hp TEXT,
    p_peran public.peran_type,
    p_divisi_id UUID,
    p_jabatan TEXT,
    p_status_kerja public.status_kerja_type,
    p_tanggal_masuk DATE,
    p_aktif BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_nik TEXT := upper(trim(COALESCE(p_nik_karyawan, '')));
    v_nama TEXT := trim(COALESCE(p_nama_lengkap, ''));
    v_jabatan TEXT := trim(COALESCE(p_jabatan, ''));
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_hrd() THEN
        RAISE EXCEPTION 'Hanya HRD aktif yang berhak mengubah data karyawan (BR-01).';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Karyawan tidak ditemukan.';
    END IF;

    IF p_peran IS NULL OR p_aktif IS NULL OR p_status_kerja IS NULL OR p_tanggal_masuk IS NULL THEN
        RAISE EXCEPTION 'Peran, status kerja, tanggal masuk, dan status aktif wajib diisi.';
    END IF;

    IF v_nik !~ '^KLN-[0-9]{4}$' THEN
        RAISE EXCEPTION 'NIK karyawan harus berformat KLN-0000.';
    END IF;

    IF length(v_nama) < 3 THEN
        RAISE EXCEPTION 'Nama lengkap minimal 3 karakter.';
    END IF;

    IF v_jabatan = '' THEN
        RAISE EXCEPTION 'Jabatan wajib diisi.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE nik_karyawan = v_nik AND id <> p_user_id
    ) THEN
        RAISE EXCEPTION 'NIK % sudah digunakan karyawan lain.', v_nik;
    END IF;

    IF p_peran = 'atasan' AND p_divisi_id IS NULL THEN
        RAISE EXCEPTION 'Atasan wajib memiliki divisi (BR-01).';
    END IF;

    IF p_divisi_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.divisi WHERE id = p_divisi_id
    ) THEN
        RAISE EXCEPTION 'Divisi tidak ditemukan.';
    END IF;

    IF p_user_id = auth.uid()
       AND (p_peran IS DISTINCT FROM v_profile.peran OR p_aktif IS DISTINCT FROM v_profile.aktif) THEN
        RAISE EXCEPTION 'Anda tidak boleh mengubah peran atau menonaktifkan akun sendiri (BR-01).';
    END IF;

    UPDATE public.profiles
    SET
        nik_karyawan = v_nik,
        nama_lengkap = v_nama,
        nomor_hp = NULLIF(trim(COALESCE(p_nomor_hp, '')), ''),
        peran = p_peran,
        divisi_id = p_divisi_id,
        jabatan = v_jabatan,
        status_kerja = p_status_kerja,
        tanggal_masuk = p_tanggal_masuk,
        aktif = p_aktif
    WHERE id = p_user_id
    RETURNING * INTO v_profile;

    RETURN to_jsonb(v_profile);
END;
$$;

-- Penunjukan/penukaran manajer divisi secara atomik (BR-01).
CREATE OR REPLACE FUNCTION public.fn_admin_assign_divisi_manager(
    p_divisi_id UUID,
    p_manajer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_divisi public.divisi%ROWTYPE;
    v_lama public.profiles%ROWTYPE;
    v_baru public.profiles%ROWTYPE;
    v_other_divisi UUID;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_hrd() THEN
        RAISE EXCEPTION 'Hanya HRD aktif yang berhak menunjuk manajer divisi (BR-01).';
    END IF;

    SELECT * INTO v_divisi FROM public.divisi WHERE id = p_divisi_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Divisi tidak ditemukan.';
    END IF;

    -- Kosongkan manajer.
    IF p_manajer_id IS NULL THEN
        IF v_divisi.manajer_id IS NOT NULL THEN
            SELECT * INTO v_lama FROM public.profiles WHERE id = v_divisi.manajer_id FOR UPDATE;
            IF FOUND AND v_lama.peran = 'atasan' THEN
                UPDATE public.profiles SET peran = 'karyawan' WHERE id = v_lama.id;
            END IF;
        END IF;

        UPDATE public.divisi SET manajer_id = NULL WHERE id = p_divisi_id
        RETURNING * INTO v_divisi;

        RETURN to_jsonb(v_divisi);
    END IF;

    SELECT * INTO v_baru FROM public.profiles WHERE id = p_manajer_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Karyawan yang dipilih tidak ditemukan.';
    END IF;

    IF v_baru.aktif IS NOT TRUE THEN
        RAISE EXCEPTION 'Karyawan nonaktif tidak dapat ditunjuk sebagai manajer divisi (BR-01).';
    END IF;

    SELECT id INTO v_other_divisi
    FROM public.divisi
    WHERE manajer_id = p_manajer_id AND id <> p_divisi_id
    LIMIT 1;

    IF v_other_divisi IS NOT NULL THEN
        RAISE EXCEPTION 'Karyawan tersebut sudah menjadi manajer di divisi lain. Satu Atasan hanya boleh memimpin satu divisi (BR-01).';
    END IF;

    IF v_baru.peran = 'atasan' AND v_baru.divisi_id IS DISTINCT FROM p_divisi_id THEN
        RAISE EXCEPTION 'Atasan hanya boleh memimpin satu divisi (BR-01).';
    END IF;

    IF v_baru.peran = 'hrd' AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.divisi_id = p_divisi_id
          AND p.peran = 'atasan'
          AND p.aktif = true
          AND p.id <> p_manajer_id
    ) THEN
        RAISE EXCEPTION 'Divisi tersebut sudah memiliki Atasan aktif (BR-01).';
    END IF;

    -- Lepaskan manajer lama bila berbeda.
    IF v_divisi.manajer_id IS NOT NULL AND v_divisi.manajer_id <> p_manajer_id THEN
        SELECT * INTO v_lama FROM public.profiles WHERE id = v_divisi.manajer_id FOR UPDATE;
        IF FOUND AND v_lama.peran = 'atasan' THEN
            UPDATE public.profiles SET peran = 'karyawan' WHERE id = v_lama.id;
        END IF;

        -- Pastikan slot manajer kosong sebelum target dipromosikan. Ini juga
        -- menangani manajer lama berperan HRD yang tidak perlu diturunkan.
        UPDATE public.divisi
        SET manajer_id = NULL
        WHERE id = p_divisi_id AND manajer_id IS NOT NULL;
    END IF;

    IF v_baru.peran = 'karyawan' THEN
        UPDATE public.profiles
        SET peran = 'atasan', divisi_id = p_divisi_id
        WHERE id = p_manajer_id;
    ELSIF v_baru.peran = 'atasan' AND v_baru.divisi_id IS DISTINCT FROM p_divisi_id THEN
        UPDATE public.profiles
        SET divisi_id = p_divisi_id
        WHERE id = p_manajer_id;
    END IF;

    UPDATE public.divisi SET manajer_id = p_manajer_id WHERE id = p_divisi_id
    RETURNING * INTO v_divisi;

    RETURN to_jsonb(v_divisi);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_create_karyawan(
    TEXT, TEXT, TEXT, TEXT, TEXT, public.peran_type, UUID, TEXT,
    public.status_kerja_type, DATE, BOOLEAN, INTEGER, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_create_karyawan(
    TEXT, TEXT, TEXT, TEXT, TEXT, public.peran_type, UUID, TEXT,
    public.status_kerja_type, DATE, BOOLEAN, INTEGER, INTEGER
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_admin_update_karyawan(
    UUID, TEXT, TEXT, TEXT, public.peran_type, UUID, TEXT,
    public.status_kerja_type, DATE, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_update_karyawan(
    UUID, TEXT, TEXT, TEXT, public.peran_type, UUID, TEXT,
    public.status_kerja_type, DATE, BOOLEAN
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_admin_assign_divisi_manager(UUID, UUID)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_assign_divisi_manager(UUID, UUID)
    TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. RPC PENGAJUAN: VALIDASI BR-04 s/d BR-10 DI DATABASE
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
    v_pemohon RECORD;
    v_manajer RECORD;
    v_hari_kerja INTEGER;
    v_hari_ini DATE := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_selisih INTEGER;
    v_perlu_atasan BOOLEAN := false;
BEGIN
    PERFORM public.assert_actor(p_karyawan_id);

    IF p_karyawan_id IS NULL THEN
        RAISE EXCEPTION 'Pemohon tidak valid.';
    END IF;

    SELECT peran, divisi_id, tanggal_masuk, aktif
    INTO v_pemohon
    FROM public.profiles
    WHERE id = p_karyawan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profil pemohon tidak ditemukan.';
    END IF;

    IF v_pemohon.aktif IS NOT TRUE THEN
        RAISE EXCEPTION 'Akun Anda dinonaktifkan. Silakan hubungi HRD.';
    END IF;

    IF p_jenis IS NULL OR p_tanggal_mulai IS NULL OR p_tanggal_selesai IS NULL THEN
        RAISE EXCEPTION 'Jenis dan tanggal pengajuan wajib diisi.';
    END IF;

    IF p_tanggal_selesai < p_tanggal_mulai THEN
        RAISE EXCEPTION 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.';
    END IF;

    IF EXTRACT(YEAR FROM p_tanggal_mulai) <> EXTRACT(YEAR FROM p_tanggal_selesai) THEN
        RAISE EXCEPTION 'Satu pengajuan tidak boleh melewati pergantian tahun kalender (BR-05).';
    END IF;

    IF length(trim(COALESCE(p_alasan, ''))) < 5 THEN
        RAISE EXCEPTION 'Alasan pengajuan wajib diisi minimal 5 karakter.';
    END IF;

    v_hari_kerja := public.fn_count_working_days(p_tanggal_mulai, p_tanggal_selesai);
    IF v_hari_kerja < 1 THEN
        RAISE EXCEPTION 'Rentang tanggal tidak berisi hari kerja (BR-05).';
    END IF;

    IF p_jenis = 'cuti_tahunan' THEN
        IF p_tanggal_mulai < (v_pemohon.tanggal_masuk + INTERVAL '12 months')::DATE THEN
            RAISE EXCEPTION 'Cuti tahunan baru boleh dimulai setelah masa kerja genap 12 bulan sejak tanggal masuk (BR-04).';
        END IF;

        v_selisih := p_tanggal_mulai - v_hari_ini;
        IF v_selisih < 3 THEN
            RAISE EXCEPTION 'Pengajuan cuti tahunan paling lambat H-3 kalender sebelum tanggal mulai (BR-05).';
        END IF;
    ELSIF p_jenis = 'izin' THEN
        IF v_hari_kerja > 2 THEN
            RAISE EXCEPTION 'Pengajuan izin maksimal 2 hari kerja per pengajuan (BR-08).';
        END IF;

        v_selisih := p_tanggal_mulai - v_hari_ini;
        IF v_selisih < 1 THEN
            RAISE EXCEPTION 'Pengajuan izin paling lambat H-1 kalender sebelum tanggal mulai (BR-05).';
        END IF;
    ELSIF p_jenis = 'sakit' THEN
        v_selisih := p_tanggal_mulai - v_hari_ini;
        IF v_selisih < -3 THEN
            RAISE EXCEPTION 'Pengajuan sakit paling lambat 3 hari kalender setelah tanggal mulai sakit (BR-05).';
        END IF;

        IF v_hari_kerja > 1 AND (p_lampiran_path IS NULL OR trim(p_lampiran_path) = '') THEN
            RAISE EXCEPTION 'Pengajuan sakit lebih dari 1 hari kerja wajib melampirkan surat dokter (BR-08).';
        END IF;
    END IF;

    -- Serialisasi per karyawan agar dua pengajuan bersamaan tidak lolos cek bentrok.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_karyawan_id::TEXT, 0));

    -- BR-07: tidak boleh beririsan dengan pengajuan aktif lain.
    IF EXISTS (
        SELECT 1 FROM public.pengajuan_cuti
        WHERE karyawan_id = p_karyawan_id
          AND status IN ('diajukan', 'disetujui_atasan', 'disetujui')
          AND tanggal_mulai <= p_tanggal_selesai
          AND tanggal_selesai >= p_tanggal_mulai
    ) THEN
        RAISE EXCEPTION 'Tanggal pengajuan beririsan dengan pengajuan lain yang masih aktif (BR-07).';
    END IF;

    -- BR-07: tidak boleh beririsan dengan data absensi.
    IF EXISTS (
        SELECT 1 FROM public.absensi
        WHERE karyawan_id = p_karyawan_id
          AND tanggal BETWEEN p_tanggal_mulai AND p_tanggal_selesai
    ) THEN
        RAISE EXCEPTION 'Sudah ada rekaman absensi pada rentang tanggal pengajuan (BR-07).';
    END IF;

    -- BR-09: Tahap Atasan hanya diperlukan bila pemohon karyawan dan divisinya
    -- memiliki manajer aktif berperan Atasan.
    IF v_pemohon.peran = 'karyawan' AND v_pemohon.divisi_id IS NOT NULL THEN
        SELECT p.peran, p.aktif
        INTO v_manajer
        FROM public.divisi d
        JOIN public.profiles p ON p.id = d.manajer_id
        WHERE d.id = v_pemohon.divisi_id;

        IF FOUND THEN
            IF v_manajer.aktif IS TRUE AND v_manajer.peran = 'atasan' THEN
                v_perlu_atasan := true;
            END IF;
        END IF;
    END IF;

    IF p_jenis = 'cuti_tahunan' THEN
        SELECT id, jatah_hari, terpakai_hari
        INTO v_kuota
        FROM public.kuota_cuti
        WHERE karyawan_id = p_karyawan_id AND tahun = EXTRACT(YEAR FROM p_tanggal_mulai)::INTEGER
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Kuota cuti tahunan untuk tahun % belum ditetapkan oleh HRD.',
                EXTRACT(YEAR FROM p_tanggal_mulai)::INTEGER;
        END IF;

        IF (v_kuota.jatah_hari - v_kuota.terpakai_hari) < v_hari_kerja THEN
            RAISE EXCEPTION 'Sisa kuota cuti tahunan tidak mencukupi (sisa: %, diminta: % hari).',
                (v_kuota.jatah_hari - v_kuota.terpakai_hari), v_hari_kerja;
        END IF;

        UPDATE public.kuota_cuti
        SET terpakai_hari = terpakai_hari + v_hari_kerja
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
        v_hari_kerja,
        trim(p_alasan),
        p_lampiran_path,
        v_perlu_atasan,
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
    v_manajer_id UUID;
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
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profil pemohon tidak ditemukan.';
    END IF;

    SELECT divisi_id, peran, aktif INTO v_atasan FROM public.profiles WHERE id = p_atasan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profil Atasan tidak ditemukan.';
    END IF;

    IF v_atasan.peran != 'atasan' OR v_atasan.aktif IS NOT TRUE THEN
        RAISE EXCEPTION 'Hanya Atasan aktif yang berhak menyetujui Tahap 1.';
    END IF;

    IF v_atasan.divisi_id IS DISTINCT FROM v_pemohon.divisi_id THEN
        RAISE EXCEPTION 'Atasan tidak boleh menyetujui anggota dari divisi lain (Aturan BR-09).';
    END IF;

    SELECT manajer_id INTO v_manajer_id
    FROM public.divisi
    WHERE id = v_pemohon.divisi_id;

    IF v_manajer_id IS DISTINCT FROM p_atasan_id THEN
        RAISE EXCEPTION 'Hanya Atasan yang ditunjuk sebagai manajer divisi pemohon yang berhak menyetujui Tahap 1 (Aturan BR-09).';
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

    SELECT peran, aktif INTO v_hrd FROM public.profiles WHERE id = p_hrd_id;
    IF v_hrd.peran != 'hrd' OR v_hrd.aktif IS NOT TRUE THEN
        RAISE EXCEPTION 'Hanya HRD aktif yang berhak memberikan keputusan akhir.';
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
    v_manajer_id UUID;
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

    SELECT divisi_id, peran, aktif INTO v_pelaku FROM public.profiles WHERE id = p_pelaku_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profil pengguna tidak ditemukan.';
    END IF;

    SELECT divisi_id INTO v_pemohon FROM public.profiles WHERE id = v_pengajuan.karyawan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profil pemohon tidak ditemukan.';
    END IF;

    IF v_pelaku.aktif IS NOT TRUE THEN
        RAISE EXCEPTION 'Akun Anda dinonaktifkan. Silakan hubungi HRD.';
    END IF;

    IF v_pelaku.peran = 'atasan' THEN
        IF v_pengajuan.perlu_atasan IS NOT TRUE THEN
            RAISE EXCEPTION 'Pengajuan ini tidak memerlukan keputusan Atasan (langsung ke HRD).';
        END IF;

        IF v_pengajuan.status != 'diajukan' THEN
            RAISE EXCEPTION 'Atasan hanya dapat menolak pengajuan berstatus diajukan.';
        END IF;

        IF v_pelaku.divisi_id IS DISTINCT FROM v_pemohon.divisi_id THEN
            RAISE EXCEPTION 'Atasan tidak boleh menolak anggota dari divisi lain (Aturan BR-09).';
        END IF;

        SELECT manajer_id INTO v_manajer_id
        FROM public.divisi
        WHERE id = v_pemohon.divisi_id;

        IF v_manajer_id IS DISTINCT FROM p_pelaku_id THEN
            RAISE EXCEPTION 'Hanya Atasan yang ditunjuk sebagai manajer divisi pemohon yang berhak menolak (Aturan BR-09).';
        END IF;
    ELSIF v_pelaku.peran = 'hrd' THEN
        -- HRD tidak boleh melompati Tahap Atasan.
        IF v_pengajuan.perlu_atasan = true AND v_pengajuan.status != 'disetujui_atasan' THEN
            RAISE EXCEPTION 'HRD tidak boleh menolak sebelum Tahap Atasan selesai (Aturan BR-09).';
        END IF;

        IF v_pengajuan.perlu_atasan = false AND v_pengajuan.status != 'diajukan' THEN
            RAISE EXCEPTION 'Pengajuan tidak dapat ditolak pada status saat ini (%).', v_pengajuan.status;
        END IF;
    ELSE
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

    SELECT peran, aktif INTO v_pelaku FROM public.profiles WHERE id = p_pelaku_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profil pengguna tidak ditemukan.';
    END IF;

    IF v_pelaku.aktif IS NOT TRUE THEN
        RAISE EXCEPTION 'Akun Anda dinonaktifkan. Silakan hubungi HRD.';
    END IF;

    v_today := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;

    IF v_pengajuan.karyawan_id = p_pelaku_id THEN
        -- Pemohon boleh membatalkan selama belum disetujui akhir.
        IF v_pengajuan.status NOT IN ('diajukan', 'disetujui_atasan') THEN
            IF v_pelaku.peran = 'hrd'
               AND v_pengajuan.status = 'disetujui'
               AND v_today < v_pengajuan.tanggal_mulai THEN
                -- HRD yang juga pemohon boleh membatalkan cuti yang sudah disetujui
                -- sebelum tanggal mulai (BR-10).
                NULL;
            ELSE
                RAISE EXCEPTION 'Pengajuan yang sudah disetujui akhir oleh HRD tidak dapat dibatalkan oleh pemohon. Hubungi HRD.';
            END IF;
        END IF;
    ELSIF v_pelaku.peran = 'hrd' THEN
        -- HRD hanya boleh membatalkan pengajuan yang sudah disetujui dan
        -- belum dimulai. Pengajuan pending tetap milik pemohon (BR-10).
        IF v_pengajuan.status != 'disetujui' THEN
            RAISE EXCEPTION 'HRD hanya dapat membatalkan pengajuan yang sudah disetujui; pengajuan berstatus % hanya dapat dibatalkan pemohon (BR-10).', v_pengajuan.status;
        END IF;

        IF v_today >= v_pengajuan.tanggal_mulai THEN
            RAISE EXCEPTION 'Cuti yang sudah disetujui hanya dapat dibatalkan oleh HRD sebelum tanggal mulai cuti (Aturan BR-10).';
        END IF;
    ELSE
        RAISE EXCEPTION 'Hanya pemohon atau HRD yang berhak membatalkan pengajuan (Aturan BR-10).';
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

-- ------------------------------------------------------------------------------
-- 6. RPC SLIP GAJI: audit manual dihapus, trigger audit yang mencatat.
-- ------------------------------------------------------------------------------
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
    v_total NUMERIC;
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

    UPDATE public.slip_gaji
    SET
        status = 'terbit',
        nomor_slip = v_nomor_slip,
        diterbitkan_oleh = p_hrd_id,
        diterbitkan_pada = now()
    WHERE id = p_slip_id
    RETURNING * INTO v_slip;

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

    RETURN true;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. HAK EKSEKUSI (tidak berubah dari P0, diulang untuk fungsi yang di-recreate)
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

NOTIFY pgrst, 'reload schema';
