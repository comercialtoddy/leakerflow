-- =======================================================================
-- MIGRATION: Admin Roles System for Articles Moderation
-- Task 1: Database Schema for Admin Roles and Global Admin Function
-- Created: 2025-06-03
-- =======================================================================

BEGIN;

-- =======================================================================
-- 1. EXPAND BASEJUMP ACCOUNT_ROLE ENUM TO INCLUDE 'admin'
-- =======================================================================

-- Add 'admin' to the existing basejump.account_role enum
-- This allows account-level admin privileges within teams/organizations
ALTER TYPE basejump.account_role ADD VALUE 'admin';

-- =======================================================================
-- 2. CREATE SYSTEM_ADMINS TABLE FOR GLOBAL ADMINISTRATORS
-- =======================================================================

-- Table to track global system administrators
-- These are users who have full platform-wide administrative access
CREATE TABLE IF NOT EXISTS system_admins (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at timestamptz DEFAULT now() NOT NULL,
    revoked_at timestamptz,
    revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    notes text,
    
    -- Ensure one active admin record per user
    UNIQUE(user_id),
    
    -- Check constraint to ensure revoked_at is null for active admins
    CONSTRAINT active_admin_check CHECK (
        (revoked_at IS NULL AND revoked_by IS NULL) OR 
        (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_admins_user_id ON system_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_system_admins_active ON system_admins(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_admins_granted_at ON system_admins(granted_at DESC);

-- =======================================================================
-- 3. CREATE is_global_admin() FUNCTION
-- =======================================================================

-- Function to check if a user is a global administrator
-- Supports both explicit user_id parameter and current auth user
-- Returns true if:
-- 1. User is in system_admins table (and not revoked), OR
-- 2. User's email ends with '@leakerflow.com' (legacy admin check)
CREATE OR REPLACE FUNCTION is_global_admin(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    check_user_id uuid;
    user_email text;
    is_explicit_admin boolean := false;
    is_leakerflow_admin boolean := false;
BEGIN
    -- Use provided user_id or fall back to current authenticated user
    check_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Return false if no user to check
    IF check_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check 1: Explicit admin in system_admins table
    SELECT EXISTS(
        SELECT 1 FROM system_admins 
        WHERE user_id = check_user_id 
        AND revoked_at IS NULL
    ) INTO is_explicit_admin;
    
    -- Check 2: Legacy @leakerflow.com email check
    SELECT u.email INTO user_email
    FROM auth.users u 
    WHERE u.id = check_user_id;
    
    IF user_email IS NOT NULL AND user_email LIKE '%@leakerflow.com' THEN
        is_leakerflow_admin := true;
    END IF;
    
    -- Return true if either condition is met
    RETURN (is_explicit_admin OR is_leakerflow_admin);
END;
$$;

-- =======================================================================
-- 4. HELPER FUNCTIONS FOR ADMIN MANAGEMENT
-- =======================================================================

-- Function to grant global admin privileges to a user
CREATE OR REPLACE FUNCTION grant_global_admin(
    p_target_user_id uuid,
    p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    granting_user_id uuid;
BEGIN
    -- Get current authenticated user
    granting_user_id := auth.uid();
    
    -- Only existing global admins can grant admin privileges
    IF NOT is_global_admin(granting_user_id) THEN
        RAISE EXCEPTION 'Access denied: Only global administrators can grant admin privileges';
    END IF;
    
    -- Check if target user exists
    IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
        RAISE EXCEPTION 'Target user does not exist';
    END IF;
    
    -- Check if user is already an admin
    IF is_global_admin(p_target_user_id) THEN
        RAISE NOTICE 'User is already a global administrator';
        RETURN false;
    END IF;
    
    -- Grant admin privileges
    INSERT INTO system_admins (user_id, granted_by, notes)
    VALUES (p_target_user_id, granting_user_id, p_notes)
    ON CONFLICT (user_id) DO UPDATE SET
        granted_by = granting_user_id,
        granted_at = now(),
        revoked_at = NULL,
        revoked_by = NULL,
        notes = EXCLUDED.notes;
    
    RETURN true;
END;
$$;

-- Function to revoke global admin privileges from a user
CREATE OR REPLACE FUNCTION revoke_global_admin(
    p_target_user_id uuid,
    p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    revoking_user_id uuid;
BEGIN
    -- Get current authenticated user
    revoking_user_id := auth.uid();
    
    -- Only existing global admins can revoke admin privileges
    IF NOT is_global_admin(revoking_user_id) THEN
        RAISE EXCEPTION 'Access denied: Only global administrators can revoke admin privileges';
    END IF;
    
    -- Prevent self-revocation unless there are other admins
    IF p_target_user_id = revoking_user_id THEN
        IF (SELECT COUNT(*) FROM system_admins WHERE revoked_at IS NULL) <= 1 THEN
            RAISE EXCEPTION 'Cannot revoke your own admin privileges - at least one admin must remain';
        END IF;
    END IF;
    
    -- Revoke admin privileges
    UPDATE system_admins 
    SET 
        revoked_at = now(),
        revoked_by = revoking_user_id,
        notes = COALESCE(p_notes, notes)
    WHERE user_id = p_target_user_id 
    AND revoked_at IS NULL;
    
    RETURN FOUND;
END;
$$;

-- Function to list all global administrators
CREATE OR REPLACE FUNCTION list_global_admins()
RETURNS TABLE (
    user_id uuid,
    email text,
    full_name text,
    is_explicit_admin boolean,
    is_leakerflow_admin boolean,
    granted_at timestamptz,
    granted_by_email text,
    notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only global admins can list admin users
    IF NOT is_global_admin() THEN
        RAISE EXCEPTION 'Access denied: Only global administrators can list admin users';
    END IF;
    
    RETURN QUERY
    WITH all_admins AS (
        -- Explicit admins from system_admins table
        SELECT DISTINCT
            sa.user_id,
            true as is_explicit_admin,
            false as is_leakerflow_admin,
            sa.granted_at,
            sa.granted_by,
            sa.notes
        FROM system_admins sa
        WHERE sa.revoked_at IS NULL
        
        UNION
        
        -- Legacy @leakerflow.com admins
        SELECT DISTINCT
            u.id as user_id,
            false as is_explicit_admin,
            true as is_leakerflow_admin,
            u.created_at as granted_at,
            NULL as granted_by,
            'Legacy @leakerflow.com admin' as notes
        FROM auth.users u
        WHERE u.email LIKE '%@leakerflow.com'
        AND u.id NOT IN (
            SELECT user_id FROM system_admins WHERE revoked_at IS NULL
        )
    )
    SELECT 
        a.user_id,
        u.email,
        u.raw_user_meta_data->>'full_name' as full_name,
        a.is_explicit_admin,
        a.is_leakerflow_admin,
        a.granted_at,
        gb.email as granted_by_email,
        a.notes
    FROM all_admins a
    JOIN auth.users u ON u.id = a.user_id
    LEFT JOIN auth.users gb ON gb.id = a.granted_by
    ORDER BY a.granted_at DESC;
END;
$$;

-- =======================================================================
-- 5. PERMISSIONS AND SECURITY
-- =======================================================================

-- Enable RLS on system_admins table
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;

-- Policy: Only global admins can view admin records
CREATE POLICY "Only global admins can view system_admins" ON system_admins
FOR SELECT USING (is_global_admin());

-- Policy: Only global admins can manage admin records
CREATE POLICY "Only global admins can manage system_admins" ON system_admins
FOR ALL USING (is_global_admin());

-- Grant permissions to authenticated users
GRANT SELECT ON system_admins TO authenticated;
GRANT EXECUTE ON FUNCTION is_global_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION grant_global_admin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_global_admin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION list_global_admins() TO authenticated;

-- =======================================================================
-- 6. VERIFICATION AND TESTING
-- =======================================================================

-- Verification function to test the admin system
CREATE OR REPLACE FUNCTION test_admin_system()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    test_results jsonb;
    enum_values text[];
    admin_table_exists boolean;
    function_exists boolean;
BEGIN
    -- Check if account_role enum includes admin
    SELECT array_agg(enumlabel::text) INTO enum_values
    FROM pg_enum 
    WHERE enumtypid = 'basejump.account_role'::regtype;
    
    -- Check if system_admins table exists
    SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'system_admins'
    ) INTO admin_table_exists;
    
    -- Check if is_global_admin function exists
    SELECT EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'is_global_admin'
    ) INTO function_exists;
    
    -- Build test results
    test_results := jsonb_build_object(
        'enum_updated', 'admin' = ANY(enum_values),
        'enum_values', enum_values,
        'table_exists', admin_table_exists,
        'function_exists', function_exists,
        'current_user', auth.uid(),
        'is_current_user_admin', is_global_admin(),
        'test_timestamp', now()
    );
    
    RETURN test_results;
END;
$$;

-- Grant execute permission on test function
GRANT EXECUTE ON FUNCTION test_admin_system() TO authenticated;

-- =======================================================================
-- 7. COMMENTS AND DOCUMENTATION
-- =======================================================================

-- Add comments for documentation
COMMENT ON TABLE system_admins IS 'Global system administrators with platform-wide access';
COMMENT ON COLUMN system_admins.user_id IS 'Reference to auth.users - the admin user';
COMMENT ON COLUMN system_admins.granted_by IS 'Admin who granted the privileges';
COMMENT ON COLUMN system_admins.revoked_at IS 'When admin privileges were revoked (NULL = active)';
COMMENT ON COLUMN system_admins.notes IS 'Optional notes about the admin grant/revoke';

COMMENT ON FUNCTION is_global_admin(uuid) IS 'Check if user is global admin (explicit or @leakerflow.com)';
COMMENT ON FUNCTION grant_global_admin(uuid, text) IS 'Grant global admin privileges to a user';
COMMENT ON FUNCTION revoke_global_admin(uuid, text) IS 'Revoke global admin privileges from a user';
COMMENT ON FUNCTION list_global_admins() IS 'List all current global administrators';

-- =======================================================================
-- 8. FINAL VERIFICATION
-- =======================================================================

DO $$
DECLARE
    verification_result jsonb;
BEGIN
    -- Run verification test
    SELECT test_admin_system() INTO verification_result;
    
    -- Log results
    RAISE NOTICE 'Admin system verification: %', verification_result;
    
    -- Check critical components
    IF NOT (verification_result->>'enum_updated')::boolean THEN
        RAISE WARNING 'ENUM was not updated properly';
    END IF;
    
    IF NOT (verification_result->>'table_exists')::boolean THEN
        RAISE WARNING 'system_admins table was not created';
    END IF;
    
    IF NOT (verification_result->>'function_exists')::boolean THEN
        RAISE WARNING 'is_global_admin function was not created';
    END IF;
    
    RAISE NOTICE '✅ Admin roles system migration completed successfully!';
    RAISE NOTICE '📋 Next steps:';
    RAISE NOTICE '   1. Test with: SELECT test_admin_system();';
    RAISE NOTICE '   2. Grant admin to yourself: SELECT grant_global_admin(auth.uid(), ''Initial admin'');';
    RAISE NOTICE '   3. List admins: SELECT * FROM list_global_admins();';
END $$;

COMMIT; 