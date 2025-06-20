-- =======================
-- MIGRATION: Fix Dashboard Stats Function
-- Issue: get_enhanced_dashboard_stats was counting only articles created in time period
-- Fix: Count ALL articles for totals, use time period only for growth calculations
-- =======================

BEGIN;

-- Drop and recreate the function with the correct logic
DROP FUNCTION IF EXISTS get_enhanced_dashboard_stats(integer);

-- Get comprehensive dashboard statistics with proper time-based calculations
CREATE OR REPLACE FUNCTION get_enhanced_dashboard_stats(
    p_days_back integer DEFAULT 30
)
RETURNS jsonb AS $$
DECLARE
    stats jsonb;
    current_period_start date;
    previous_period_start date;
    current_period_end date;
BEGIN
    -- Calculate date ranges
    current_period_end := CURRENT_DATE;
    current_period_start := current_period_end - (p_days_back || ' days')::interval;
    previous_period_start := current_period_start - (p_days_back || ' days')::interval;
    
    -- Build comprehensive stats object
    WITH overall_stats AS (
        -- Get ALL articles and their total metrics (not filtered by date)
        SELECT 
            COUNT(DISTINCT a.id) as total_articles,
            COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'published') as published_articles,
            COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'draft') as draft_articles,
            SUM(a.total_views) as total_views,
            SUM(a.unique_views) as unique_views,
            SUM(a.total_shares) as total_shares,
            SUM(a.total_saves) as total_saves,
            SUM(a.total_comments) as total_comments,
            SUM(a.upvotes) as total_upvotes,
            SUM(a.downvotes) as total_downvotes,
            AVG(a.engagement) as avg_engagement,
            AVG(a.avg_read_time) as avg_read_time,
            AVG(a.bounce_rate) as avg_bounce_rate
        FROM articles a
        WHERE (a.created_by_user_id = auth.uid() OR a.status = 'published')
    ),
    current_period_stats AS (
        -- Get articles created in current period for growth calculation
        SELECT 
            COUNT(DISTINCT a.id) as new_articles,
            SUM(a.total_views) as period_views,
            SUM(a.total_shares) as period_shares,
            SUM(a.total_saves) as period_saves,
            AVG(a.engagement) as period_engagement
        FROM articles a
        WHERE a.created_at >= current_period_start
          AND a.created_at <= current_period_end
          AND (a.created_by_user_id = auth.uid() OR a.status = 'published')
    ),
    previous_period_stats AS (
        -- Get articles created in previous period for growth calculation
        SELECT 
            COUNT(DISTINCT a.id) as new_articles,
            SUM(a.total_views) as period_views,
            SUM(a.total_shares) as period_shares,
            SUM(a.total_saves) as period_saves,
            AVG(a.engagement) as period_engagement
        FROM articles a
        WHERE a.created_at >= previous_period_start
          AND a.created_at < current_period_start
          AND (a.created_by_user_id = auth.uid() OR a.status = 'published')
    ),
    trending_articles AS (
        SELECT 
            COUNT(*) as trending_count
        FROM articles
        WHERE is_trending = true
          AND status = 'published'
    ),
    recent_events AS (
        SELECT 
            COUNT(*) FILTER (WHERE event_type = 'view') as recent_views,
            COUNT(*) FILTER (WHERE event_type = 'share') as recent_shares,
            COUNT(*) FILTER (WHERE event_type = 'save') as recent_saves,
            COUNT(DISTINCT article_id) as articles_with_activity
        FROM article_events
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          AND (user_id = auth.uid() OR EXISTS (
              SELECT 1 FROM articles a 
              WHERE a.id = article_events.article_id 
              AND a.status = 'published'
          ))
    )
    SELECT jsonb_build_object(
        'overview', jsonb_build_object(
            'total_articles', COALESCE(os.total_articles, 0),
            'published_articles', COALESCE(os.published_articles, 0),
            'draft_articles', COALESCE(os.draft_articles, 0),
            'trending_articles', COALESCE(t.trending_count, 0)
        ),
        'metrics', jsonb_build_object(
            'total_views', COALESCE(os.total_views, 0),
            'unique_views', COALESCE(os.unique_views, 0),
            'total_shares', COALESCE(os.total_shares, 0),
            'total_saves', COALESCE(os.total_saves, 0),
            'total_comments', COALESCE(os.total_comments, 0),
            'total_upvotes', COALESCE(os.total_upvotes, 0),
            'total_downvotes', COALESCE(os.total_downvotes, 0),
            'avg_engagement', ROUND(COALESCE(os.avg_engagement, 0)::numeric, 2),
            'avg_read_time', ROUND(COALESCE(os.avg_read_time, 0)::numeric, 2),
            'avg_bounce_rate', ROUND(COALESCE(os.avg_bounce_rate, 0)::numeric, 2)
        ),
        'growth', jsonb_build_object(
            'articles', CASE 
                WHEN pp.new_articles > 0 THEN 
                    ROUND(((cp.new_articles - pp.new_articles)::numeric / pp.new_articles) * 100, 1)
                ELSE 0 
            END,
            'views', CASE 
                WHEN pp.period_views > 0 THEN 
                    ROUND(((cp.period_views - pp.period_views)::numeric / pp.period_views) * 100, 1)
                ELSE 0 
            END,
            'shares', CASE 
                WHEN pp.period_shares > 0 THEN 
                    ROUND(((cp.period_shares - pp.period_shares)::numeric / pp.period_shares) * 100, 1)
                ELSE 0 
            END,
            'saves', CASE 
                WHEN pp.period_saves > 0 THEN 
                    ROUND(((cp.period_saves - pp.period_saves)::numeric / pp.period_saves) * 100, 1)
                ELSE 0 
            END,
            'engagement', CASE 
                WHEN pp.period_engagement > 0 THEN 
                    ROUND(((cp.period_engagement - pp.period_engagement)::numeric / pp.period_engagement) * 100, 1)
                ELSE 0 
            END
        ),
        'recent_activity', jsonb_build_object(
            'views_24h', COALESCE(re.recent_views, 0),
            'shares_24h', COALESCE(re.recent_shares, 0),
            'saves_24h', COALESCE(re.recent_saves, 0),
            'active_articles_24h', COALESCE(re.articles_with_activity, 0)
        ),
        'period', jsonb_build_object(
            'start_date', current_period_start,
            'end_date', current_period_end,
            'days', p_days_back
        )
    ) INTO stats
    FROM overall_stats os
    CROSS JOIN current_period_stats cp
    CROSS JOIN previous_period_stats pp
    CROSS JOIN trending_articles t
    CROSS JOIN recent_events re;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_enhanced_dashboard_stats(integer) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_enhanced_dashboard_stats(integer) IS 
'Returns comprehensive dashboard statistics. Counts ALL articles for totals, uses time period only for growth calculations.';

COMMIT; 