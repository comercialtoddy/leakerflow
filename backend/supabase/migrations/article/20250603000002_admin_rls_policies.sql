-- =======================================================================
-- MIGRATION: Global Admin RLS Policies
-- Task 2: Implement RLS Policies for Global Admin Access
-- Created: 2025-06-03
-- =======================================================================

BEGIN;

-- =======================================================================
-- 1. ADMIN BYPASS POLICIES FOR ARTICLES SYSTEM
-- =======================================================================

-- =======================
-- ARTICLES TABLE - ADMIN POLICIES
-- =======================

-- Drop existing admin policies if they exist
DROP POLICY IF EXISTS "Global admins can manage all articles" ON articles;
DROP POLICY IF EXISTS "Global admins can view all articles" ON articles;
DROP POLICY IF EXISTS "Global admins can create articles" ON articles;
DROP POLICY IF EXISTS "Global admins can update all articles" ON articles;
DROP POLICY IF EXISTS "Global admins can delete all articles" ON articles;

-- Global admin override policies (highest priority)
CREATE POLICY "Global admins can view all articles" ON articles
FOR SELECT TO authenticated USING (is_global_admin());

CREATE POLICY "Global admins can create articles" ON articles
FOR INSERT TO authenticated WITH CHECK (is_global_admin());

CREATE POLICY "Global admins can update all articles" ON articles
FOR UPDATE TO authenticated USING (is_global_admin());

CREATE POLICY "Global admins can delete all articles" ON articles
FOR DELETE TO authenticated USING (is_global_admin());

-- =======================
-- AUTHOR APPLICATIONS TABLE - ADMIN POLICIES
-- =======================

-- Note: Policies already exist in 20250603000001_author_applications_table.sql
-- Ensuring they're compatible with is_global_admin()

-- Update existing admin policies to use is_global_admin() if needed
DROP POLICY IF EXISTS "Global admins can view all applications" ON author_applications;
DROP POLICY IF EXISTS "Global admins can review applications" ON author_applications;
DROP POLICY IF EXISTS "Global admins can manage all applications" ON author_applications;

CREATE POLICY "Global admins can view all applications" ON author_applications
FOR SELECT TO authenticated USING (is_global_admin());

CREATE POLICY "Global admins can review applications" ON author_applications
FOR UPDATE TO authenticated USING (is_global_admin());

CREATE POLICY "Global admins can manage all applications" ON author_applications
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- ARTICLE VOTES TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can manage all article votes" ON article_votes;

CREATE POLICY "Global admins can manage all article votes" ON article_votes
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- SAVED ARTICLES TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can manage all saved articles" ON saved_articles;

CREATE POLICY "Global admins can manage all saved articles" ON saved_articles
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- ARTICLE EVENTS TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can manage all article events" ON article_events;

CREATE POLICY "Global admins can manage all article events" ON article_events
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- ARTICLE ANALYTICS TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can view all analytics" ON article_analytics;

CREATE POLICY "Global admins can view all analytics" ON article_analytics
FOR SELECT TO authenticated USING (is_global_admin());

-- =======================
-- REALTIME ACTIVITY TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can manage all realtime activity" ON article_realtime_activity;

CREATE POLICY "Global admins can manage all realtime activity" ON article_realtime_activity
FOR ALL TO authenticated USING (is_global_admin());

-- =======================================================================
-- 2. ADMIN BYPASS POLICIES FOR BASEJUMP SYSTEM
-- =======================================================================

-- =======================
-- BASEJUMP ACCOUNTS TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can view all accounts" ON basejump.accounts;
DROP POLICY IF EXISTS "Global admins can manage all accounts" ON basejump.accounts;

CREATE POLICY "Global admins can view all accounts" ON basejump.accounts
FOR SELECT TO authenticated USING (is_global_admin());

CREATE POLICY "Global admins can manage all accounts" ON basejump.accounts
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- BASEJUMP ACCOUNT_USER TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can view all account users" ON basejump.account_user;
DROP POLICY IF EXISTS "Global admins can manage all account users" ON basejump.account_user;

CREATE POLICY "Global admins can view all account users" ON basejump.account_user
FOR SELECT TO authenticated USING (is_global_admin());

CREATE POLICY "Global admins can manage all account users" ON basejump.account_user
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- BASEJUMP INVITATIONS TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can view all invitations" ON basejump.invitations;
DROP POLICY IF EXISTS "Global admins can manage all invitations" ON basejump.invitations;

CREATE POLICY "Global admins can view all invitations" ON basejump.invitations
FOR SELECT TO authenticated USING (is_global_admin());

CREATE POLICY "Global admins can manage all invitations" ON basejump.invitations
FOR ALL TO authenticated USING (is_global_admin());

-- =======================================================================
-- 3. ADMIN BYPASS POLICIES FOR CORE PLATFORM TABLES
-- =======================================================================

-- =======================
-- PROJECTS TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can manage all projects" ON projects;

CREATE POLICY "Global admins can manage all projects" ON projects
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- THREADS TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can manage all threads" ON threads;

CREATE POLICY "Global admins can manage all threads" ON threads
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- MESSAGES TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can manage all messages" ON messages;

CREATE POLICY "Global admins can manage all messages" ON messages
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- AGENT_RUNS TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can manage all agent runs" ON agent_runs;

CREATE POLICY "Global admins can manage all agent runs" ON agent_runs
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- AGENTS TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can manage all agents" ON agents;

CREATE POLICY "Global admins can manage all agents" ON agents
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- USER_AGENT_LIBRARY TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can manage all user agent library" ON user_agent_library;

CREATE POLICY "Global admins can manage all user agent library" ON user_agent_library
FOR ALL TO authenticated USING (is_global_admin());

-- =======================================================================
-- 4. ADMIN BYPASS POLICIES FOR BILLING & RECORDING TABLES
-- =======================================================================

-- =======================
-- BILLING CUSTOMERS TABLE - ADMIN POLICIES
-- =======================

-- Note: Check if billing_customers table exists first
DO $$
BEGIN
    -- Check if billing_customers table exists and create admin policy
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'basejump' AND table_name = 'billing_customers') THEN
        
        -- Drop existing admin billing customers policy if it exists
        DROP POLICY IF EXISTS "Global admins can view all billing customers" ON basejump.billing_customers;
        
        -- Create admin policy for billing customers
        CREATE POLICY "Global admins can view all billing customers" ON basejump.billing_customers
        FOR SELECT TO authenticated USING (is_global_admin());
        
        RAISE NOTICE 'Created admin policy for basejump.billing_customers table';
    ELSE
        RAISE NOTICE 'basejump.billing_customers table not found, skipping billing customers admin policies';
    END IF;
END $$;

-- =======================
-- BILLING SUBSCRIPTIONS TABLE - ADMIN POLICIES
-- =======================

-- Note: Check if billing_subscriptions table exists first
DO $$
BEGIN
    -- Check if billing_subscriptions table exists and create admin policy
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'basejump' AND table_name = 'billing_subscriptions') THEN
        
        -- Drop existing admin billing subscriptions policy if it exists
        DROP POLICY IF EXISTS "Global admins can view all billing subscriptions" ON basejump.billing_subscriptions;
        
        -- Create admin policy for billing subscriptions
        CREATE POLICY "Global admins can view all billing subscriptions" ON basejump.billing_subscriptions
        FOR SELECT TO authenticated USING (is_global_admin());
        
        RAISE NOTICE 'Created admin policy for basejump.billing_subscriptions table';
    ELSE
        RAISE NOTICE 'basejump.billing_subscriptions table not found, skipping billing subscriptions admin policies';
    END IF;
END $$;

-- =======================
-- DEVICES TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can manage all devices" ON devices;

CREATE POLICY "Global admins can manage all devices" ON devices
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- RECORDINGS TABLE - ADMIN POLICIES
-- =======================

DROP POLICY IF EXISTS "Global admins can manage all recordings" ON recordings;

CREATE POLICY "Global admins can manage all recordings" ON recordings
FOR ALL TO authenticated USING (is_global_admin());

-- =======================
-- RECORDING_FILES TABLE - ADMIN POLICIES
-- =======================

-- Note: Check if recording_files table exists first
DO $$
BEGIN
    -- Check if recording_files table exists and create admin policy
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recording_files') THEN
        
        -- Drop existing admin recording files policy if it exists
        DROP POLICY IF EXISTS "Global admins can manage all recording files" ON recording_files;
        
        -- Create admin policy for recording files
        CREATE POLICY "Global admins can manage all recording files" ON recording_files
        FOR ALL TO authenticated USING (is_global_admin());
        
        RAISE NOTICE 'Created admin policy for recording_files table';
    ELSE
        RAISE NOTICE 'recording_files table not found, skipping recording_files admin policies';
    END IF;
END $$;

-- =======================================================================
-- 5. STORAGE POLICIES FOR ADMIN ACCESS
-- =======================================================================

-- =======================
-- STORAGE OBJECTS - ADMIN POLICIES
-- =======================

-- Note: Storage policies use different syntax, need to check if table exists
DO $$
BEGIN
    -- Check if storage.objects table exists and create admin policy
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        
        -- Drop existing admin storage policy if it exists
        DROP POLICY IF EXISTS "Global admins can manage all storage objects" ON storage.objects;
        
        -- Create comprehensive admin storage policy
        CREATE POLICY "Global admins can manage all storage objects" ON storage.objects
        FOR ALL TO authenticated USING (is_global_admin());
        
        RAISE NOTICE 'Created admin storage policy';
    ELSE
        RAISE NOTICE 'Storage.objects table not found, skipping storage admin policies';
    END IF;
END $$;

-- =======================================================================
-- 6. UTILITY FUNCTIONS FOR ADMIN TESTING
-- =======================================================================

-- Function to test admin access across all tables
CREATE OR REPLACE FUNCTION test_admin_access()
RETURNS jsonb AS $$
DECLARE
    result jsonb;
    user_id uuid;
    is_admin boolean;
    test_results jsonb := '{}';
BEGIN
    user_id := auth.uid();
    is_admin := is_global_admin();
    
    -- Test articles access
    SELECT COUNT(*) INTO result FROM articles;
    test_results := jsonb_set(test_results, '{articles_count}', to_jsonb(result));
    
    -- Test applications access
    SELECT COUNT(*) INTO result FROM author_applications;
    test_results := jsonb_set(test_results, '{applications_count}', to_jsonb(result));
    
    -- Test accounts access
    SELECT COUNT(*) INTO result FROM basejump.accounts;
    test_results := jsonb_set(test_results, '{accounts_count}', to_jsonb(result));
    
    -- Test projects access
    SELECT COUNT(*) INTO result FROM projects;
    test_results := jsonb_set(test_results, '{projects_count}', to_jsonb(result));
    
    -- Return comprehensive test results
    SELECT jsonb_build_object(
        'user_id', user_id,
        'is_global_admin', is_admin,
        'access_test_results', test_results,
        'timestamp', NOW()
    ) INTO result;
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'error', SQLERRM,
        'user_id', user_id,
        'is_global_admin', is_admin,
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION test_admin_access() TO authenticated;

-- =======================================================================
-- 7. VERIFICATION & TESTING
-- =======================================================================

-- Function to list all admin-related policies
CREATE OR REPLACE FUNCTION list_admin_policies()
RETURNS TABLE(
    table_schema text,
    table_name text,
    policy_name text,
    policy_cmd text,
    policy_permissive text,
    policy_roles text,
    policy_qual text,
    policy_with_check text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.schemaname::text,
        p.tablename::text,
        p.policyname::text,
        p.cmd::text,
        p.permissive::text,
        p.roles::text,
        p.qual::text,
        p.with_check::text
    FROM pg_policies p
    WHERE p.policyname ILIKE '%admin%' OR p.qual ILIKE '%is_global_admin%'
    ORDER BY p.schemaname, p.tablename, p.policyname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION list_admin_policies() TO authenticated;

-- =======================================================================
-- 8. VERIFICATION SCRIPT
-- =======================================================================

DO $$
DECLARE
    policy_count integer;
    admin_policies integer;
    tables_with_admin_policies text[];
BEGIN
    -- Count total policies
    SELECT COUNT(*) INTO policy_count FROM pg_policies;
    
    -- Count admin-specific policies
    SELECT COUNT(*) INTO admin_policies 
    FROM pg_policies 
    WHERE policyname ILIKE '%admin%' OR qual ILIKE '%is_global_admin%';
    
    -- Get list of tables with admin policies
    SELECT ARRAY_AGG(DISTINCT tablename) INTO tables_with_admin_policies
    FROM pg_policies 
    WHERE policyname ILIKE '%admin%' OR qual ILIKE '%is_global_admin%';
    
    RAISE NOTICE 'Global Admin RLS Policies Verification:';
    RAISE NOTICE '- Total policies in database: %', policy_count;
    RAISE NOTICE '- Admin-specific policies created: %', admin_policies;
    RAISE NOTICE '- Tables with admin policies: %', array_to_string(tables_with_admin_policies, ', ');
    
    -- Verify minimum expected admin policies
    IF admin_policies < 20 THEN
        RAISE WARNING 'Expected at least 20 admin policies, found %', admin_policies;
    ELSE
        RAISE NOTICE '✅ Admin policies successfully created: % policies', admin_policies;
    END IF;
    
    -- Test is_global_admin function exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_global_admin') THEN
        RAISE NOTICE '✅ is_global_admin() function is available';
    ELSE
        RAISE WARNING '❌ is_global_admin() function not found - policies may not work correctly';
    END IF;
    
    RAISE NOTICE 'Global Admin RLS Policies migration completed successfully';
END $$;

COMMIT; 