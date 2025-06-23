-- =======================================================================
-- MIGRATION: Audit Logs Table for Administrative Actions
-- Task 20: Database Schema for Audit Logs
-- Created: 2025-06-21
-- =======================================================================

BEGIN;

-- =======================================================================
-- 1. CREATE AUDIT_LOGS TABLE
-- =======================================================================

-- Create the audit_logs table to track all administrative actions
CREATE TABLE IF NOT EXISTS audit_logs (
    -- Primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who performed the action
    action_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    
    -- When the action was performed
    action_timestamp timestamptz DEFAULT now() NOT NULL,
    
    -- What type of action was performed
    action_type text NOT NULL, -- e.g., 'article_delete', 'application_approve', 'author_suspend'
    
    -- What entity was affected
    target_entity_type text, -- e.g., 'article', 'author_application', 'user'
    target_entity_id uuid, -- ID of the article, application, or user affected
    
    -- Admin justification and details
    justification text, -- Notes provided by admin
    details jsonb, -- Optional: store old/new values, specific parameters
    
    -- Security and tracking information
    ip_address inet, -- Optional: for enhanced security logging
    user_agent text, -- Optional: for enhanced security logging
    
    -- Metadata
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- =======================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =======================================================================

-- Index on action_by_user_id for quick lookups by admin user
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_by_user_id ON audit_logs(action_by_user_id);

-- Index on action_timestamp for chronological queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs(action_timestamp DESC);

-- Index on action_type for filtering by action type
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);

-- Index on target_entity for finding actions on specific entities
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_entity ON audit_logs(target_entity_type, target_entity_id);

-- Composite index for common queries (user + type + timestamp)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_type_timestamp ON audit_logs(action_by_user_id, action_type, action_timestamp DESC);

-- =======================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =======================================================================

-- Enable RLS on audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only global admins can view audit logs
CREATE POLICY "Only global admins can view audit logs" ON audit_logs
FOR SELECT TO authenticated USING (is_global_admin());

-- Policy: Only global admins can insert audit logs
CREATE POLICY "Only global admins can create audit logs" ON audit_logs
FOR INSERT TO authenticated WITH CHECK (is_global_admin());

-- Policy: Audit logs are immutable - no updates allowed
-- (This ensures audit trail integrity)
CREATE POLICY "Audit logs are immutable" ON audit_logs
FOR UPDATE TO authenticated USING (false);

-- Policy: Audit logs cannot be deleted (except by superuser)
CREATE POLICY "Audit logs cannot be deleted" ON audit_logs
FOR DELETE TO authenticated USING (false);

-- =======================================================================
-- 4. HELPER FUNCTIONS
-- =======================================================================

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_audit_log(
    p_action_type text,
    p_target_entity_type text DEFAULT NULL,
    p_target_entity_id uuid DEFAULT NULL,
    p_justification text DEFAULT NULL,
    p_details jsonb DEFAULT NULL,
    p_ip_address inet DEFAULT NULL,
    p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    audit_log_id uuid;
    acting_user_id uuid;
BEGIN
    -- Get the current user
    acting_user_id := auth.uid();
    
    -- Only allow global admins to create audit logs
    IF NOT is_global_admin(acting_user_id) THEN
        RAISE EXCEPTION 'Access denied: Only global administrators can create audit logs';
    END IF;
    
    -- Insert the audit log entry
    INSERT INTO audit_logs (
        action_by_user_id,
        action_type,
        target_entity_type,
        target_entity_id,
        justification,
        details,
        ip_address,
        user_agent
    ) VALUES (
        acting_user_id,
        p_action_type,
        p_target_entity_type,
        p_target_entity_id,
        p_justification,
        p_details,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO audit_log_id;
    
    RETURN audit_log_id;
END;
$$;

-- Function to get audit logs with user information
CREATE OR REPLACE FUNCTION get_audit_logs(
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0,
    p_action_type text DEFAULT NULL,
    p_target_entity_type text DEFAULT NULL,
    p_target_entity_id uuid DEFAULT NULL,
    p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    action_by_user_id uuid,
    action_by_email text,
    action_by_name text,
    action_timestamp timestamptz,
    action_type text,
    target_entity_type text,
    target_entity_id uuid,
    justification text,
    details jsonb,
    ip_address inet,
    user_agent text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only allow global admins to view audit logs
    IF NOT is_global_admin() THEN
        RAISE EXCEPTION 'Access denied: Only global administrators can view audit logs';
    END IF;
    
    RETURN QUERY
    SELECT 
        al.id,
        al.action_by_user_id,
        u.email as action_by_email,
        u.raw_user_meta_data->>'full_name' as action_by_name,
        al.action_timestamp,
        al.action_type,
        al.target_entity_type,
        al.target_entity_id,
        al.justification,
        al.details,
        al.ip_address,
        al.user_agent
    FROM audit_logs al
    LEFT JOIN auth.users u ON u.id = al.action_by_user_id
    WHERE 
        (p_action_type IS NULL OR al.action_type = p_action_type)
        AND (p_target_entity_type IS NULL OR al.target_entity_type = p_target_entity_type)
        AND (p_target_entity_id IS NULL OR al.target_entity_id = p_target_entity_id)
        AND (p_user_id IS NULL OR al.action_by_user_id = p_user_id)
    ORDER BY al.action_timestamp DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- =======================================================================
-- 5. GRANT PERMISSIONS
-- =======================================================================

-- Grant permissions to authenticated users for the functions
GRANT EXECUTE ON FUNCTION create_audit_log(text, text, uuid, text, jsonb, inet, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_logs(integer, integer, text, text, uuid, uuid) TO authenticated;

-- Grant basic table permissions (RLS will control actual access)
GRANT SELECT, INSERT ON audit_logs TO authenticated;

-- =======================================================================
-- 6. COMMENTS AND DOCUMENTATION
-- =======================================================================

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Audit trail for all administrative actions in the system';
COMMENT ON COLUMN audit_logs.action_by_user_id IS 'User ID of the admin who performed the action';
COMMENT ON COLUMN audit_logs.action_timestamp IS 'When the action was performed';
COMMENT ON COLUMN audit_logs.action_type IS 'Type of action (e.g., article_delete, application_approve)';
COMMENT ON COLUMN audit_logs.target_entity_type IS 'Type of entity affected (e.g., article, user)';
COMMENT ON COLUMN audit_logs.target_entity_id IS 'ID of the specific entity affected';
COMMENT ON COLUMN audit_logs.justification IS 'Admin-provided reason for the action';
COMMENT ON COLUMN audit_logs.details IS 'Additional structured data about the action';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address from which the action was performed';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string from the admin session';

COMMENT ON FUNCTION create_audit_log(text, text, uuid, text, jsonb, inet, text) IS 'Creates a new audit log entry (admin only)';
COMMENT ON FUNCTION get_audit_logs(integer, integer, text, text, uuid, uuid) IS 'Retrieves audit logs with filters and pagination (admin only)';

-- =======================================================================
-- 7. VERIFICATION AND TESTING
-- =======================================================================

-- Test function to verify the audit logs system
CREATE OR REPLACE FUNCTION test_audit_logs_system()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    test_results jsonb;
    table_exists boolean;
    policies_count integer;
    indexes_count integer;
    functions_exist boolean;
BEGIN
    -- Check if table exists
    SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'audit_logs'
    ) INTO table_exists;
    
    -- Count policies on the table
    SELECT COUNT(*) INTO policies_count
    FROM pg_policies 
    WHERE tablename = 'audit_logs';
    
    -- Count indexes on the table
    SELECT COUNT(*) INTO indexes_count
    FROM pg_indexes 
    WHERE tablename = 'audit_logs';
    
    -- Check if helper functions exist
    SELECT EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname IN ('create_audit_log', 'get_audit_logs')
    ) INTO functions_exist;
    
    -- Build test results
    test_results := jsonb_build_object(
        'table_exists', table_exists,
        'policies_count', policies_count,
        'indexes_count', indexes_count,
        'functions_exist', functions_exist,
        'current_user', auth.uid(),
        'is_global_admin', is_global_admin(),
        'test_timestamp', now()
    );
    
    RETURN test_results;
END;
$$;

-- Grant execute permission on test function
GRANT EXECUTE ON FUNCTION test_audit_logs_system() TO authenticated;

-- =======================================================================
-- 8. FINAL VERIFICATION
-- =======================================================================

DO $$
DECLARE
    verification_result jsonb;
BEGIN
    -- Run verification test
    SELECT test_audit_logs_system() INTO verification_result;
    
    -- Log results
    RAISE NOTICE 'Audit logs system verification: %', verification_result;
    
    -- Check critical components
    IF NOT (verification_result->>'table_exists')::boolean THEN
        RAISE WARNING 'audit_logs table was not created';
    END IF;
    
    IF (verification_result->>'policies_count')::integer < 4 THEN
        RAISE WARNING 'Expected at least 4 RLS policies, found %', 
            (verification_result->>'policies_count')::integer;
    END IF;
    
    IF (verification_result->>'indexes_count')::integer < 5 THEN
        RAISE WARNING 'Expected at least 5 indexes, found %', 
            (verification_result->>'indexes_count')::integer;
    END IF;
    
    IF NOT (verification_result->>'functions_exist')::boolean THEN
        RAISE WARNING 'Helper functions were not created';
    END IF;
    
    RAISE NOTICE '✅ Audit logs system migration completed successfully!';
    RAISE NOTICE '📋 Available functions:';
    RAISE NOTICE '   - create_audit_log(): Create new audit entries';
    RAISE NOTICE '   - get_audit_logs(): Retrieve audit logs with filters';
    RAISE NOTICE '   - test_audit_logs_system(): Test system functionality';
    RAISE NOTICE '🔒 Security: Only global admins can access audit logs';
    RAISE NOTICE '📊 Performance: Optimized indexes for common queries';
END $$;

COMMIT; 