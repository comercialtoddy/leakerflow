-- Articles Initial Setup
-- This migration sets up real-time subscriptions, notifications, and initial data

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

-- =======================
-- INITIAL SAMPLE DATA
-- =======================

-- Insert sample article only if no articles exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM articles LIMIT 1) THEN
        INSERT INTO articles (
            title, 
            subtitle, 
            content, 
            category, 
            tags, 
            author, 
            status, 
            read_time, 
            image_url,
            views,
            engagement,
            upvotes,
            downvotes,
            vote_score,
            saved,
            bookmarked,
            user_id
        ) VALUES 
        (
            'Welcome to Articles Dashboard',
            'This is a sample article to demonstrate the new articles system.',
            'This article demonstrates the new articles management system integrated with Supabase. All articles are now stored in the database and will be automatically cleaned up after one week unless published.',
            'general',
            ARRAY['Welcome', 'System', 'Database'],
            'System',
            'published',
            '2 min read',
            '/api/placeholder/800/400',
            1250,
            92.5,
            15,
            2,
            13,
            false,
            false,
            (SELECT id FROM auth.users LIMIT 1)
        );
        
        -- Update saved to match bookmarked for consistency
        UPDATE articles SET saved = bookmarked;
    END IF;
END $$;

-- =======================
-- SCHEDULED JOBS SETUP
-- =======================

-- Note: These cron jobs should be set up in Supabase Dashboard or via pg_cron
-- Example cron job configurations:

-- Daily cleanup job (runs at 2 AM UTC)
-- SELECT cron.schedule('cleanup-old-articles', '0 2 * * *', 'SELECT cleanup_old_articles();');

-- Daily analytics aggregation (runs at 1 AM UTC)
-- SELECT cron.schedule('aggregate-article-analytics', '0 1 * * *', 'SELECT aggregate_daily_analytics();');

-- Hourly trend score calculation
-- SELECT cron.schedule('calculate-trending-articles', '0 * * * *', 'SELECT calculate_trend_scores();');

-- Clean up realtime activities every 30 minutes
-- SELECT cron.schedule('cleanup-realtime-activities', '*/30 * * * *', 'SELECT cleanup_old_activities();'); 