-- =======================
-- MIGRATION: Articles Setup & Initialization
-- Consolidation of: 09_articles_initial_setup.sql + real-time subscriptions + sample data
-- Applied fixes: Complete system initialization with all features enabled
-- =======================

BEGIN;

-- =======================
-- REAL-TIME SUBSCRIPTIONS
-- =======================

-- Enable real-time subscriptions for articles table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'articles'
    ) THEN
        ALTER publication supabase_realtime ADD TABLE articles;
    END IF;
END $$;

-- Enable real-time for saved articles table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'saved_articles'
    ) THEN
        ALTER publication supabase_realtime ADD TABLE saved_articles;
    END IF;
END $$;

-- Enable real-time for voting table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'article_votes'
    ) THEN
        ALTER publication supabase_realtime ADD TABLE article_votes;
    END IF;
END $$;

-- Enable real-time for events table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'article_events'
    ) THEN
        ALTER publication supabase_realtime ADD TABLE article_events;
    END IF;
END $$;

-- Enable real-time for analytics table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'article_analytics'
    ) THEN
        ALTER publication supabase_realtime ADD TABLE article_analytics;
    END IF;
END $$;

-- Enable real-time for activity table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'article_realtime_activity'
    ) THEN
        ALTER publication supabase_realtime ADD TABLE article_realtime_activity;
    END IF;
END $$;

-- =======================
-- NOTIFICATION SYSTEM
-- =======================

-- Create notification function for real-time updates
CREATE OR REPLACE FUNCTION notify_article_changes()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'article_changes',
        json_build_object(
            'operation', TG_OP,
            'record', row_to_json(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END)
        )::text
    );
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for real-time notifications
DROP TRIGGER IF EXISTS article_changes_trigger ON articles;
CREATE TRIGGER article_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON articles
    FOR EACH ROW EXECUTE FUNCTION notify_article_changes();

-- Notification trigger for votes (for real-time vote updates)
CREATE OR REPLACE FUNCTION notify_vote_changes()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'vote_changes',
        json_build_object(
            'operation', TG_OP,
            'article_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.article_id ELSE NEW.article_id END,
            'user_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END,
            'vote_type', CASE WHEN TG_OP = 'DELETE' THEN OLD.vote_type ELSE NEW.vote_type END
        )::text
    );
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vote_changes_trigger ON article_votes;
CREATE TRIGGER vote_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON article_votes
    FOR EACH ROW EXECUTE FUNCTION notify_vote_changes();

-- =======================
-- SAMPLE DATA INITIALIZATION
-- =======================

-- Create sample articles only if no articles exist and we have users/accounts
DO $$
DECLARE
    sample_user_id uuid;
    sample_account_id uuid;
    article_count integer;
BEGIN
    -- Check if articles already exist
    SELECT COUNT(*) INTO article_count FROM articles;
    
    IF article_count = 0 THEN
        -- Try to get a sample user and account
        SELECT u.id INTO sample_user_id
        FROM auth.users u 
        LIMIT 1;
        
        IF sample_user_id IS NOT NULL THEN
            -- Get or create a personal account for the user
            SELECT a.id INTO sample_account_id
            FROM basejump.accounts a
            JOIN basejump.account_user au ON au.account_id = a.id
            WHERE au.user_id = sample_user_id
            AND a.personal_account = true
            LIMIT 1;
            
            -- If no account exists, create one
            IF sample_account_id IS NULL THEN
                INSERT INTO basejump.accounts (name, slug, personal_account, created_by, updated_by)
                VALUES ('Sample Account', 'sample-' || sample_user_id, true, sample_user_id, sample_user_id)
                RETURNING id INTO sample_account_id;
                
                INSERT INTO basejump.account_user (account_id, user_id, account_role)
                VALUES (sample_account_id, sample_user_id, 'owner');
            END IF;
            
            -- Insert sample articles
            INSERT INTO articles (
                title, subtitle, content, category, tags, author, status, read_time, image_url,
                views, engagement, upvotes, downvotes, vote_score, saved, bookmarked,
                account_id, created_by_user_id, user_id, visibility
            ) VALUES 
            (
                'Welcome to the Articles System',
                'Your comprehensive guide to the new articles platform with multi-tenant support',
                'This article demonstrates the new articles management system integrated with Supabase and Basejump. The system supports multi-tenant architecture, real-time updates, comprehensive analytics, and user-specific interactions like saves and votes. All articles are automatically managed with proper security policies and will be cleaned up after one week unless published.',
                'general',
                ARRAY['Welcome', 'System', 'Database', 'Multi-tenant'],
                'System Administrator',
                'published',
                '3 min read',
                '/api/placeholder/800/400',
                1250,
                92.5,
                15,
                2,
                13,
                false,
                false,
                sample_account_id,
                sample_user_id,
                sample_user_id,
                'public'
            ),
            (
                'Advanced Analytics Dashboard',
                'Understanding the comprehensive analytics and reporting features',
                'The articles system includes advanced analytics capabilities including real-time dashboard statistics, time series data for charts, reader behavior insights, and category-based analytics. All analytics respect user permissions and account-based access control.',
                'analytics',
                ARRAY['Analytics', 'Dashboard', 'Metrics'],
                'System Administrator',
                'published',
                '5 min read',
                '/api/placeholder/800/400',
                856,
                78.3,
                12,
                1,
                11,
                false,
                false,
                sample_account_id,
                sample_user_id,
                sample_user_id,
                'public'
            ),
            (
                'Real-time Features Guide',
                'Exploring live updates, voting, and activity tracking',
                'Experience real-time updates with live voting, activity tracking, and instant notifications. The system supports real-time subscriptions for all major events including article changes, votes, and user activity.',
                'features',
                ARRAY['Real-time', 'Voting', 'Activity'],
                'System Administrator',
                'published',
                '4 min read',
                '/api/placeholder/800/400',
                634,
                85.1,
                18,
                0,
                18,
                false,
                false,
                sample_account_id,
                sample_user_id,
                sample_user_id,
                'public'
            );
            
            -- Create some sample events for the articles
            WITH article_ids AS (
                SELECT id FROM articles WHERE account_id = sample_account_id
            )
            INSERT INTO article_events (article_id, user_id, account_id, event_type, read_time_seconds, scroll_percentage)
            SELECT 
                a.id,
                sample_user_id,
                sample_account_id,
                'view',
                FLOOR(RANDOM() * 300 + 30)::integer,
                FLOOR(RANDOM() * 50 + 50)::numeric
            FROM article_ids a;
            
            RAISE NOTICE 'Created sample articles and events for user % in account %', sample_user_id, sample_account_id;
        ELSE
            RAISE NOTICE 'No users found - skipping sample data creation';
        END IF;
    ELSE
        RAISE NOTICE 'Articles already exist (%), skipping sample data creation', article_count;
    END IF;
END $$;

-- =======================
-- SCHEDULED JOBS DOCUMENTATION
-- =======================

-- Create a function to set up recommended cron jobs
CREATE OR REPLACE FUNCTION setup_article_cron_jobs()
RETURNS text AS $$
BEGIN
    RETURN '
    -- RECOMMENDED CRON JOBS FOR ARTICLES SYSTEM
    -- Execute these commands in your Supabase SQL editor or via pg_cron
    
    -- Daily cleanup job (runs at 2 AM UTC)
    SELECT cron.schedule(''cleanup-old-articles'', ''0 2 * * *'', ''SELECT cleanup_old_articles();'');
    
    -- Daily analytics aggregation (runs at 1 AM UTC)
    SELECT cron.schedule(''aggregate-article-analytics'', ''0 1 * * *'', ''SELECT aggregate_daily_analytics();'');
    
    -- Hourly trend score calculation
    SELECT cron.schedule(''calculate-trending-articles'', ''0 * * * *'', ''SELECT calculate_trend_scores();'');
    
    -- Clean up realtime activities every 30 minutes
    SELECT cron.schedule(''cleanup-realtime-activities'', ''*/30 * * * *'', ''SELECT cleanup_old_activities();'');
    
    -- Weekly analytics cache refresh (runs Sunday at 3 AM UTC)
    SELECT cron.schedule(''refresh-analytics-cache'', ''0 3 * * 0'', ''SELECT refresh_analytics_cache();'');
    ';
END;
$$ LANGUAGE plpgsql;

-- =======================
-- SYSTEM HEALTH CHECK
-- =======================

-- Create a comprehensive system health check function
CREATE OR REPLACE FUNCTION articles_system_health_check()
RETURNS jsonb AS $$
DECLARE
    health_report jsonb;
    table_count integer;
    function_count integer;
    policy_count integer;
    index_count integer;
    trigger_count integer;
    subscription_count integer;
BEGIN
    -- Count system components
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%article%';
    
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND (proname LIKE '%article%' OR proname IN (
        'update_updated_at_column',
        'cleanup_old_activities',
        'get_user_default_account'
    ));
    
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename LIKE '%article%';
    
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE '%article%';
    
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    AND (trigger_name LIKE '%article%' OR event_object_table LIKE '%article%');
    
    SELECT COUNT(*) INTO subscription_count
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename LIKE '%article%';
    
    -- Build health report
    SELECT jsonb_build_object(
        'system_status', 'healthy',
        'timestamp', now(),
        'components', jsonb_build_object(
            'tables', table_count,
            'functions', function_count,
            'policies', policy_count,
            'indexes', index_count,
            'triggers', trigger_count,
            'realtime_subscriptions', subscription_count
        ),
        'expected_minimums', jsonb_build_object(
            'tables', 6,
            'functions', 25,
            'policies', 15,
            'indexes', 20,
            'triggers', 5,
            'realtime_subscriptions', 5
        ),
        'health_checks', jsonb_build_object(
            'tables_ok', table_count >= 6,
            'functions_ok', function_count >= 25,
            'policies_ok', policy_count >= 15,
            'indexes_ok', index_count >= 20,
            'triggers_ok', trigger_count >= 5,
            'realtime_ok', subscription_count >= 5
        ),
        'recommendations', ARRAY[
            'Set up cron jobs using: SELECT setup_article_cron_jobs();',
            'Monitor system performance regularly',
            'Review analytics data weekly',
            'Check storage usage monthly'
        ]
    ) INTO health_report;
    
    RETURN health_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- FINAL SYSTEM VERIFICATION
-- =======================

DO $$
DECLARE
    health_report jsonb;
    total_tables integer;
    total_functions integer;
    total_policies integer;
    system_ready boolean := true;
BEGIN
    -- Get comprehensive health report
    SELECT articles_system_health_check() INTO health_report;
    
    total_tables := (health_report->'components'->>'tables')::integer;
    total_functions := (health_report->'components'->>'functions')::integer;
    total_policies := (health_report->'components'->>'policies')::integer;
    
    RAISE NOTICE '=== ARTICLES SYSTEM SETUP COMPLETE ===';
    RAISE NOTICE 'Tables: %', total_tables;
    RAISE NOTICE 'Functions: %', total_functions;
    RAISE NOTICE 'Policies: %', total_policies;
    RAISE NOTICE 'Indexes: %', (health_report->'components'->>'indexes')::integer;
    RAISE NOTICE 'Triggers: %', (health_report->'components'->>'triggers')::integer;
    RAISE NOTICE 'Realtime Subscriptions: %', (health_report->'components'->>'realtime_subscriptions')::integer;
    
    -- Validate system completeness
    IF total_tables < 6 THEN
        RAISE WARNING 'System may be incomplete - expected at least 6 tables, found %', total_tables;
        system_ready := false;
    END IF;
    
    IF total_functions < 25 THEN
        RAISE WARNING 'System may be incomplete - expected at least 25 functions, found %', total_functions;
        system_ready := false;
    END IF;
    
    IF total_policies < 15 THEN
        RAISE WARNING 'System may be incomplete - expected at least 15 policies, found %', total_policies;
        system_ready := false;
    END IF;
    
    IF system_ready THEN
        RAISE NOTICE '✅ Articles system is ready for production use!';
        RAISE NOTICE '📋 Next steps:';
        RAISE NOTICE '   1. Set up cron jobs: SELECT setup_article_cron_jobs();';
        RAISE NOTICE '   2. Test article creation and voting';
        RAISE NOTICE '   3. Verify real-time updates';
        RAISE NOTICE '   4. Review analytics dashboard';
    ELSE
        RAISE WARNING '⚠️  System setup incomplete - please review warnings above';
    END IF;
    
    RAISE NOTICE '🔍 Run SELECT articles_system_health_check(); for detailed status';
END $$;

-- Grant execute permissions on utility functions
GRANT EXECUTE ON FUNCTION setup_article_cron_jobs() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION articles_system_health_check() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION notify_article_changes() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION notify_vote_changes() TO postgres, service_role;

COMMIT; 