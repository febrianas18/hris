-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & STORAGE POLICIES
-- HRIS PT KARSA LINTAS NUSANTARA
-- Sesuai: PRD_HRIS (BR-01, BR-03, BR-08, BR-09, BR-10, BR-11, BR-12)
-- ==============================================================================

-- 1. HELPER FUNCTIONS
-- Catatan P0/P1: seluruh helper SECURITY DEFINER memakai search_path tetap
-- (public, pg_temp) agar tidak dapat dibajak objek di schema lain.
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

-- 2. TABEL: PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated
USING (
    public.is_hrd()
    OR (public.is_atasan() AND divisi_id = public.get_my_divisi_id())
    OR id = auth.uid()
);

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (public.is_hrd());

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

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE TO authenticated
USING (public.is_hrd() AND id != auth.uid());

-- 3. TABEL: DIVISI
ALTER TABLE public.divisi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "divisi_select_policy" ON public.divisi;
CREATE POLICY "divisi_select_policy" ON public.divisi
FOR SELECT TO authenticated
USING (public.is_active_user());

DROP POLICY IF EXISTS "divisi_all_hrd_policy" ON public.divisi;
CREATE POLICY "divisi_all_hrd_policy" ON public.divisi
FOR ALL TO authenticated
USING (public.is_hrd())
WITH CHECK (public.is_hrd());

-- 4. TABEL: HARI_LIBUR
ALTER TABLE public.hari_libur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hari_libur_select_policy" ON public.hari_libur;
CREATE POLICY "hari_libur_select_policy" ON public.hari_libur
FOR SELECT TO authenticated
USING (public.is_active_user());

DROP POLICY IF EXISTS "hari_libur_all_hrd_policy" ON public.hari_libur;
CREATE POLICY "hari_libur_all_hrd_policy" ON public.hari_libur
FOR ALL TO authenticated
USING (public.is_hrd())
WITH CHECK (public.is_hrd());

-- 5. TABEL: KUOTA_CUTI
ALTER TABLE public.kuota_cuti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kuota_cuti_select_policy" ON public.kuota_cuti;
CREATE POLICY "kuota_cuti_select_policy" ON public.kuota_cuti
FOR SELECT TO authenticated
USING (
    public.is_hrd()
    OR karyawan_id = auth.uid()
    OR (
        public.is_atasan() AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = kuota_cuti.karyawan_id AND p.divisi_id = public.get_my_divisi_id()
        )
    )
);

DROP POLICY IF EXISTS "kuota_cuti_modify_policy" ON public.kuota_cuti;
CREATE POLICY "kuota_cuti_modify_policy" ON public.kuota_cuti
FOR ALL TO authenticated
USING (public.is_hrd())
WITH CHECK (public.is_hrd());

-- 6. TABEL: PENGAJUAN_CUTI
ALTER TABLE public.pengajuan_cuti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pengajuan_cuti_select_policy" ON public.pengajuan_cuti;
CREATE POLICY "pengajuan_cuti_select_policy" ON public.pengajuan_cuti
FOR SELECT TO authenticated
USING (
    public.is_hrd()
    OR karyawan_id = auth.uid()
    OR (
        public.is_atasan() AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = pengajuan_cuti.karyawan_id AND p.divisi_id = public.get_my_divisi_id()
        )
    )
);

-- P0: INSERT/UPDATE pengajuan cuti hanya lewat RPC SECURITY DEFINER
-- (fn_submit_pengajuan, fn_approve_*, fn_reject_pengajuan, fn_cancel_pengajuan).
DROP POLICY IF EXISTS "pengajuan_cuti_insert_policy" ON public.pengajuan_cuti;
DROP POLICY IF EXISTS "pengajuan_cuti_update_policy" ON public.pengajuan_cuti;

-- 7. TABEL: ABSENSI
ALTER TABLE public.absensi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "absensi_select_policy" ON public.absensi;
CREATE POLICY "absensi_select_policy" ON public.absensi
FOR SELECT TO authenticated
USING (
    public.is_hrd()
    OR karyawan_id = auth.uid()
    OR (
        public.is_atasan() AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = absensi.karyawan_id AND p.divisi_id = public.get_my_divisi_id()
        )
    )
);

-- P0: INSERT/UPDATE absensi karyawan hanya lewat RPC fn_check_in/fn_check_out.
-- HRD tetap boleh insert/update langsung untuk koreksi absensi.
DROP POLICY IF EXISTS "absensi_insert_policy" ON public.absensi;
CREATE POLICY "absensi_insert_policy" ON public.absensi
FOR INSERT TO authenticated
WITH CHECK (public.is_hrd());

DROP POLICY IF EXISTS "absensi_update_policy" ON public.absensi;
CREATE POLICY "absensi_update_policy" ON public.absensi
FOR UPDATE TO authenticated
USING (public.is_hrd())
WITH CHECK (public.is_hrd());

DROP POLICY IF EXISTS "absensi_delete_policy" ON public.absensi;
CREATE POLICY "absensi_delete_policy" ON public.absensi
FOR DELETE TO authenticated
USING (public.is_hrd());

-- 8. TABEL: SLIP_GAJI (BR-11: Rahasia, hanya HRD dan pemilik)
ALTER TABLE public.slip_gaji ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slip_gaji_select_policy" ON public.slip_gaji;
CREATE POLICY "slip_gaji_select_policy" ON public.slip_gaji
FOR SELECT TO authenticated
USING (
    public.is_hrd()
    OR (karyawan_id = auth.uid() AND status = 'terbit')
);

DROP POLICY IF EXISTS "slip_gaji_insert_policy" ON public.slip_gaji;
CREATE POLICY "slip_gaji_insert_policy" ON public.slip_gaji
FOR INSERT TO authenticated
WITH CHECK (public.is_hrd());

DROP POLICY IF EXISTS "slip_gaji_update_policy" ON public.slip_gaji;
CREATE POLICY "slip_gaji_update_policy" ON public.slip_gaji
FOR UPDATE TO authenticated
USING (public.is_hrd())
WITH CHECK (public.is_hrd());

DROP POLICY IF EXISTS "slip_gaji_delete_policy" ON public.slip_gaji;
CREATE POLICY "slip_gaji_delete_policy" ON public.slip_gaji
FOR DELETE TO authenticated
USING (public.is_hrd());

-- 9. TABEL: AUDIT_LOG (BR-12: Hanya HRD yang dapat melihat)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_policy" ON public.audit_log;
CREATE POLICY "audit_log_select_policy" ON public.audit_log
FOR SELECT TO authenticated
USING (public.is_hrd());

-- P0: audit_log hanya ditulis lewat fn_write_audit / RPC SECURITY DEFINER.
-- Tidak ada INSERT policy untuk authenticated.
DROP POLICY IF EXISTS "audit_log_insert_policy" ON public.audit_log;

-- 10. STORAGE BUCKET: medical-certificates (BR-08)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'medical-certificates',
    'medical-certificates',
    false,
    2097152, -- 2 MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

DROP POLICY IF EXISTS "storage_medical_select_policy" ON storage.objects;
CREATE POLICY "storage_medical_select_policy" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'medical-certificates'
    AND (
        public.is_hrd()
        OR (storage.foldername(name))[1] = auth.uid()::text
        OR (
            public.is_atasan() AND EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id::text = (storage.foldername(name))[1]
                AND p.divisi_id = public.get_my_divisi_id()
            )
        )
    )
);

DROP POLICY IF EXISTS "storage_medical_insert_policy" ON storage.objects;
CREATE POLICY "storage_medical_insert_policy" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'medical-certificates'
    AND public.is_active_user()
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "storage_medical_delete_policy" ON storage.objects;
CREATE POLICY "storage_medical_delete_policy" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'medical-certificates'
    AND (
        public.is_hrd()
        OR (storage.foldername(name))[1] = auth.uid()::text
    )
);

-- ==============================================================================
-- CATATAN P1 (2026-10-23) — lihat supabase/migrations/20261023_p1_business_rules.sql
-- ==============================================================================
-- 1. Audit otomatis (BR-12) dipasang sebagai trigger AFTER pada:
--    profiles, kuota_cuti, absensi, divisi, hari_libur, dan slip_gaji.
--    Route/API TIDAK boleh lagi memanggil fn_write_audit untuk tabel-tabel
--    tersebut agar audit_log tidak berisi baris ganda.
-- 2. Workflow pengajuan cuti tetap memakai audit manual di dalam RPC karena
--    aksi transisi status (diajukan/disetujui_atasan/disetujui/ditolak/
--    dibatalkan) tidak dapat disimpulkan hanya dari perubahan baris.
-- 3. Trigger BR-01:
--    - trigger_profiles_sync_manager  : sinkronisasi divisi.manajer_id.
--    - trigger_validate_divisi_manager: manajer harus Atasan/HRD aktif.
--    - trigger_protect_last_hrd       : minimal satu HRD aktif.
--    - trigger_protect_self_profile   : larangan ubah peran/nonaktif sendiri.
--    - trigger_protect_profile_email  : email profil harus sama dengan auth.
-- 4. Semua helper dan trigger function memakai search_path tetap
--    (public, pg_temp) dan SECURITY DEFINER.
-- 5. RPC admin BR-01: fn_admin_create_karyawan, fn_admin_update_karyawan,
--    fn_admin_assign_divisi_manager. RPC ini membuat/mengubah profil dan
--    kuota secara atomik tanpa membutuhkan service-role key di aplikasi.
-- ==============================================================================
