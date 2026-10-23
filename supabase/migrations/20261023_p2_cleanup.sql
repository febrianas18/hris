-- ==============================================================================
-- P2 CLEANUP & SECURITY HARDENING
-- HRIS PT KARSA LINTAS NUSANTARA
-- Tanggal: 2026-10-23
--
-- Cakupan:
-- 9. REVOKE EXECUTE pada fungsi-fungsi SECURITY DEFINER yang seharusnya tidak
--    dapat dipanggil langsung oleh anon/authenticated (temuan Supabase Advisor).
--    Fungsi trigger tidak perlu EXECUTE grant karena dipanggil oleh DB engine,
--    bukan oleh user. Fungsi RPC bisnis tetap accessible tapi hanya oleh
--    authenticated, bukan anon.
-- 10. Aktifkan proteksi leaked-password (dilakukan via Supabase Dashboard /
--     Management API — tidak bisa melalui SQL migration).
--     Catatan: instruksi ada di komentar bawah.
-- 11. Perbaiki RLS app_config: tambahkan policy agar tabel tidak kosong policy
--     (temuan Supabase Advisor: rls_enabled_no_policy).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 9a. REVOKE EXECUTE dari anon dan authenticated untuk fungsi-fungsi trigger
--     (dipanggil oleh DB engine, BUKAN oleh user via RPC)
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.fn_audit_row_change()                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_protect_last_hrd()                   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_protect_profile_email()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_protect_self_profile()               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_division_manager()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_validate_divisi_manager()            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_lock_terbit_slip_gaji()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_prevent_audit_log_modification()     FROM anon, authenticated;

-- Helper internal — tidak perlu dieksekusi langsung oleh user
REVOKE EXECUTE ON FUNCTION public.fn_write_audit(text, text, text, jsonb, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_count_working_days(date, date)              FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 9b. REVOKE EXECUTE dari anon untuk fungsi RPC bisnis
--     (authenticated tetap bisa — diperlukan untuk operasi normal)
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.fn_check_in(text, text)                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_check_out(text, text)                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_submit_pengajuan(uuid, public.jenis_pengajuan, date, date, integer, text, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_approve_pengajuan_tahap1(uuid, uuid)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_approve_pengajuan_tahap2(uuid, uuid)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_reject_pengajuan(uuid, uuid, text)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_cancel_pengajuan(uuid, uuid)                FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_save_draft_slip_gaji(uuid, uuid, date, numeric, numeric, numeric, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_publish_slip_gaji(uuid, uuid)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_delete_draft_slip_gaji(uuid, uuid)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_admin_create_karyawan(text, text, text, text, text, public.peran_type, uuid, text, public.status_kerja_type, date, boolean, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_admin_update_karyawan(uuid, text, text, text, public.peran_type, uuid, text, public.status_kerja_type, date, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_admin_assign_divisi_manager(uuid, uuid)     FROM anon;

-- Helper RLS: cabut dari anon saja (authenticated membutuhkan untuk RLS policies)
REVOKE EXECUTE ON FUNCTION public.is_active_user()   FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_hrd()           FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_atasan()        FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_divisi_id() FROM anon;

-- rls_auto_enable = fungsi internal Supabase, lewati (bukan milik kita)

-- ------------------------------------------------------------------------------
-- 11. Perbaiki RLS app_config: tambahkan policy minimal (temuan advisor)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'app_config'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'app_config'
        ) THEN
            EXECUTE $policy$
                CREATE POLICY "app_config_hrd_select"
                ON public.app_config
                FOR SELECT
                TO authenticated
                USING (public.is_hrd());
            $policy$;
        END IF;
    END IF;
END;
$$;

-- ==============================================================================
-- CATATAN ITEM 10 — Leaked Password Protection:
-- Tidak dapat diaktifkan via SQL. Lakukan via Supabase Dashboard:
--   1. Buka https://supabase.com/dashboard/project/hehtaiitqlqepvtxhrnx
--   2. Authentication → Providers → Email
--   3. Aktifkan "Enable Leaked Password Protection"
--   4. Klik Save
-- ==============================================================================
