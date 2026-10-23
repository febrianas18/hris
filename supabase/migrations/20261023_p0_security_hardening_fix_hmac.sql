-- ==============================================================================
-- P0 SECURITY HARDENING - FIX HMAC SCHEMA
-- pgcrypto di Supabase terpasang di schema `extensions`, sehingga fungsi
-- fn_resolve_server_time harus memanggil extensions.hmac secara eksplisit.
-- ==============================================================================

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

NOTIFY pgrst, 'reload schema';
