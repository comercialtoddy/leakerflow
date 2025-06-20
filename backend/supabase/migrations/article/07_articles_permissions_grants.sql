-- =======================
-- MIGRATION: Articles Permissions & Grants
-- Consolidation of: 08_articles_permissions.sql + all permission grants
-- Applied fixes: Complete permission setup for all components
-- =======================

BEGIN;

-- =======================
-- SCHEMA PERMISSIONS
-- =======================

-- Grant necessary schema permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- =======================
-- TABLE PERMISSIONS
-- =======================

-- Articles table permissions
GRANT ALL ON articles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON articles TO authenticated;
GRANT SELECT ON articles TO anon;

-- Saved articles table permissions
GRANT ALL ON saved_articles TO postgres, service_role;
GRANT SELECT, INSERT, DELETE ON saved_articles TO authenticated;

-- Voting table permissions
GRANT ALL ON article_votes TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON article_votes TO authenticated;

-- Events table permissions
GRANT ALL ON article_events TO postgres, service_role;
GRANT SELECT, INSERT ON article_events TO authenticated, anon;

-- Analytics table permissions
GRANT ALL ON article_analytics TO postgres, service_role;
GRANT SELECT ON article_analytics TO authenticated, anon;

-- Realtime activity table permissions
GRANT ALL ON article_realtime_activity TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON article_realtime_activity TO authenticated;

-- =======================
-- VIEW PERMISSIONS
-- =======================

-- Basejump integration views
GRANT SELECT ON account_article_stats TO authenticated;
GRANT SELECT ON article_publish_permissions TO authenticated;

-- =======================
-- CORE FUNCTION PERMISSIONS
-- =======================

-- Core utility functions
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cleanup_article_storage() TO service_role;
GRANT EXECUTE ON FUNCTION protect_article_immutable_fields() TO authenticated;
GRANT EXECUTE ON FUNCTION update_article_total_saves() TO authenticated;

-- =======================
-- VOTING FUNCTION PERMISSIONS
-- =======================

-- Voting system functions
GRANT EXECUTE ON FUNCTION vote_on_article(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_vote(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION calculate_trend_scores() TO authenticated, service_role;

-- =======================
-- ANALYTICS FUNCTION PERMISSIONS
-- =======================

-- Basic analytics functions
GRANT EXECUTE ON FUNCTION track_article_event(uuid, text, integer, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION update_article_metrics(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_article_analytics_summary(uuid, date, date) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION aggregate_daily_analytics(date) TO service_role;

-- Advanced analytics function permissions
GRANT EXECUTE ON FUNCTION get_enhanced_dashboard_stats(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_time_series(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_performing_articles(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_reader_behavior_insights(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_analytics(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_analytics_cache() TO service_role;

-- =======================
-- REALTIME ACTIVITY FUNCTION PERMISSIONS
-- =======================

-- Realtime activity function permissions
GRANT EXECUTE ON FUNCTION track_realtime_activity(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION end_realtime_activity(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_article_active_users(uuid, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_global_active_users(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cleanup_old_activities() TO service_role;

-- =======================
-- USER INTERACTION FUNCTION PERMISSIONS
-- =======================

-- User interaction functions
GRANT EXECUTE ON FUNCTION user_has_saved_article(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION toggle_article_save(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_article_bookmark(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_article_views(uuid, integer, numeric) TO authenticated;

-- Public article functions
GRANT EXECUTE ON FUNCTION get_articles_paginated(integer, integer, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_articles_paginated(integer, integer, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_article_by_id(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_saved_articles(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trending_articles(integer, integer) TO authenticated, anon;

-- Utility functions
GRANT EXECUTE ON FUNCTION recalculate_article_saves() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_articles() TO service_role;

-- =======================
-- BASEJUMP INTEGRATION FUNCTION PERMISSIONS
-- =======================

-- Basejump helper functions
GRANT EXECUTE ON FUNCTION get_user_default_account() TO authenticated;
GRANT EXECUTE ON FUNCTION can_create_article_in_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_article_accounts() TO authenticated;

-- =======================
-- STORAGE PERMISSIONS
-- =======================

-- Note: RLS on storage.objects is already enabled by Supabase
-- Storage permissions are handled by policies created in the Basejump integration

-- =======================
-- SEQUENCE PERMISSIONS
-- =======================

-- Grant permissions on any sequences (if they exist)
DO $$
DECLARE
    seq_name text;
BEGIN
    FOR seq_name IN
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
        AND sequence_name LIKE '%articles%'
    LOOP
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I TO authenticated', seq_name);
        EXECUTE format('GRANT ALL ON SEQUENCE %I TO service_role', seq_name);
    END LOOP;
END $$;

-- =======================
-- TRIGGER PERMISSIONS
-- =======================

-- Triggers are automatically granted with table permissions
-- But we explicitly ensure trigger functions can be executed

GRANT EXECUTE ON FUNCTION update_updated_at_column() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION update_article_total_saves() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION cleanup_article_storage() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION protect_article_immutable_fields() TO postgres, service_role;

-- =======================
-- SPECIAL ROLE PERMISSIONS
-- =======================

-- Service role needs full access for maintenance functions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Anon role needs read access to public content
GRANT SELECT ON articles TO anon;
GRANT SELECT ON article_votes TO anon;
GRANT SELECT ON article_events TO anon;
GRANT SELECT ON article_analytics TO anon;

-- Execute permissions for anon on safe read functions
GRANT EXECUTE ON FUNCTION get_articles_paginated(integer, integer, text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_article_by_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_trending_articles(integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION get_user_vote(uuid) TO anon;
GRANT EXECUTE ON FUNCTION user_has_saved_article(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_article_active_users(uuid, integer) TO anon;
GRANT EXECUTE ON FUNCTION get_global_active_users(integer) TO anon;

-- =======================
-- SECURITY POLICIES ENABLEMENT
-- =======================

-- Ensure RLS is enabled on all tables (already done in foundation, but verify)
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_realtime_activity ENABLE ROW LEVEL SECURITY;

-- =======================
-- VERIFICATION
-- =======================

DO $$
DECLARE
    table_count integer;
    function_count integer;
    rls_count integer;
BEGIN
    -- Check table permissions
    SELECT COUNT(DISTINCT tablename) INTO table_count
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename LIKE '%article%';
    
    -- Check function permissions
    SELECT COUNT(DISTINCT proname) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND (proname LIKE '%article%' OR proname IN (
        'update_updated_at_column',
        'cleanup_old_activities',
        'get_user_default_account'
    ));
    
    -- Check RLS is enabled
    SELECT COUNT(*) INTO rls_count
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
    AND t.tablename LIKE '%article%'
    AND c.relrowsecurity = true;
    
    RAISE NOTICE 'Permissions verification:';
    RAISE NOTICE '- Tables with permissions: %', table_count;
    RAISE NOTICE '- Functions with permissions: %', function_count;
    RAISE NOTICE '- Tables with RLS enabled: %', rls_count;
    
    IF table_count < 5 THEN
        RAISE WARNING 'Expected at least 5 article tables, found %', table_count;
    END IF;
    
    IF function_count < 20 THEN
        RAISE WARNING 'Expected at least 20 functions, found %', function_count;
    END IF;
    
    IF rls_count < 5 THEN
        RAISE WARNING 'Expected at least 5 tables with RLS, found %', rls_count;
    END IF;
    
    RAISE NOTICE 'Articles permissions & grants setup completed successfully';
END $$;

COMMIT; 