-- =======================
-- MIGRATION: Articles Advanced Analytics & Dashboard Functions
-- Consolidation of: 04_articles_analytics_advanced.sql + dashboard functions
-- Applied fixes: Account-aware analytics, time series, performance optimization
-- =======================

BEGIN;

-- =======================
-- ENHANCED DASHBOARD STATS
-- =======================

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

-- =======================
-- TIME SERIES ANALYTICS
-- =======================

-- Get time series data for charts
CREATE OR REPLACE FUNCTION get_analytics_time_series(
    p_article_id uuid DEFAULT NULL,
    p_days_back integer DEFAULT 30,
    p_metric text DEFAULT 'views' -- views, shares, saves, engagement
)
RETURNS TABLE (
    date date,
    value numeric
) AS $$
BEGIN
    IF p_article_id IS NOT NULL THEN
        -- Per-article time series
        RETURN QUERY
        SELECT 
            a.date,
            CASE p_metric
                WHEN 'views' THEN a.views::numeric
                WHEN 'shares' THEN a.shares::numeric
                WHEN 'saves' THEN a.saves::numeric
                WHEN 'engagement' THEN 
                    CASE WHEN a.views > 0 
                    THEN ((a.shares + a.saves + a.comments)::numeric / a.views) * 100
                    ELSE 0 
                    END
                ELSE a.views::numeric
            END as value
        FROM article_analytics a
        WHERE a.article_id = p_article_id
          AND a.date >= CURRENT_DATE - (p_days_back || ' days')::interval
        ORDER BY a.date;
    ELSE
        -- Aggregate time series for all accessible articles
        RETURN QUERY
        SELECT 
            aa.date,
            CASE p_metric
                WHEN 'views' THEN SUM(aa.views)::numeric
                WHEN 'shares' THEN SUM(aa.shares)::numeric
                WHEN 'saves' THEN SUM(aa.saves)::numeric
                WHEN 'engagement' THEN 
                    CASE WHEN SUM(aa.views) > 0 
                    THEN (SUM(aa.shares + aa.saves + aa.comments)::numeric / SUM(aa.views)) * 100
                    ELSE 0 
                    END
                ELSE SUM(aa.views)::numeric
            END as value
        FROM article_analytics aa
        JOIN articles a ON a.id = aa.article_id
        WHERE aa.date >= CURRENT_DATE - (p_days_back || ' days')::interval
          AND (a.created_by_user_id = auth.uid() OR a.status = 'published')
        GROUP BY aa.date
        ORDER BY aa.date;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- TOP PERFORMERS
-- =======================

-- Get top performing articles
CREATE OR REPLACE FUNCTION get_top_performing_articles(
    p_metric text DEFAULT 'views', -- views, engagement, shares, saves, trending
    p_limit integer DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    title text,
    subtitle text,
    category text,
    author text,
    image_url text,
    metric_value numeric,
    total_views integer,
    total_shares integer,
    total_saves integer,
    engagement numeric,
    trend_score numeric,
    created_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        a.subtitle,
        a.category,
        a.author,
        a.image_url,
        CASE p_metric
            WHEN 'views' THEN a.total_views::numeric
            WHEN 'engagement' THEN a.engagement
            WHEN 'shares' THEN a.total_shares::numeric
            WHEN 'saves' THEN a.total_saves::numeric
            WHEN 'trending' THEN a.trend_score
            ELSE a.total_views::numeric
        END as metric_value,
        a.total_views,
        a.total_shares,
        a.total_saves,
        a.engagement,
        a.trend_score,
        a.created_at
    FROM articles a
    WHERE (a.created_by_user_id = auth.uid() OR a.status = 'published')
      AND CASE p_metric
            WHEN 'trending' THEN a.is_trending = true
            ELSE true
          END
    ORDER BY 
        CASE p_metric
            WHEN 'views' THEN a.total_views
            WHEN 'engagement' THEN a.engagement::integer
            WHEN 'shares' THEN a.total_shares
            WHEN 'saves' THEN a.total_saves
            WHEN 'trending' THEN a.trend_score::integer
            ELSE a.total_views
        END DESC NULLS LAST
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- CATEGORY ANALYTICS
-- =======================

-- Get analytics by category
CREATE OR REPLACE FUNCTION get_category_analytics()
RETURNS TABLE (
    category text,
    article_count bigint,
    total_views bigint,
    total_shares bigint,
    total_saves bigint,
    avg_engagement numeric,
    avg_read_time numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.category,
        COUNT(DISTINCT a.id) as article_count,
        SUM(a.total_views)::bigint as total_views,
        SUM(a.total_shares)::bigint as total_shares,
        SUM(a.total_saves)::bigint as total_saves,
        ROUND(AVG(a.engagement)::numeric, 2) as avg_engagement,
        ROUND(AVG(a.avg_read_time)::numeric, 2) as avg_read_time
    FROM articles a
    WHERE (a.created_by_user_id = auth.uid() OR a.status = 'published')
    GROUP BY a.category
    ORDER BY total_views DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- READER BEHAVIOR INSIGHTS
-- =======================

-- Get reader behavior insights
CREATE OR REPLACE FUNCTION get_reader_behavior_insights(
    p_article_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    insights jsonb;
BEGIN
    WITH behavior_stats AS (
        SELECT 
            AVG(e.read_time_seconds) as avg_read_time,
            AVG(e.scroll_percentage) as avg_scroll_depth,
            COUNT(DISTINCT e.user_id) as unique_readers,
            COUNT(*) FILTER (WHERE e.read_time_seconds < 10) as quick_bounces,
            COUNT(*) FILTER (WHERE e.read_time_seconds > 60) as engaged_readers,
            COUNT(*) FILTER (WHERE e.scroll_percentage > 75) as full_readers,
            -- Time of day analysis
            COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM e.created_at) BETWEEN 6 AND 11) as morning_reads,
            COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM e.created_at) BETWEEN 12 AND 17) as afternoon_reads,
            COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM e.created_at) BETWEEN 18 AND 23) as evening_reads,
            COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM e.created_at) BETWEEN 0 AND 5) as night_reads
        FROM article_events e
        WHERE e.event_type = 'view'
          AND (p_article_id IS NULL OR e.article_id = p_article_id)
          AND EXISTS (
              SELECT 1 FROM articles a 
              WHERE a.id = e.article_id 
              AND (a.created_by_user_id = auth.uid() OR a.status = 'published')
          )
    )
    SELECT jsonb_build_object(
        'reading_patterns', jsonb_build_object(
            'avg_read_time_seconds', ROUND(COALESCE(avg_read_time, 0)::numeric, 0),
            'avg_scroll_depth', ROUND(COALESCE(avg_scroll_depth, 0)::numeric, 1),
            'unique_readers', COALESCE(unique_readers, 0),
            'bounce_rate', CASE 
                WHEN unique_readers > 0 
                THEN ROUND((quick_bounces::numeric / unique_readers) * 100, 1)
                ELSE 0 
            END,
            'engagement_rate', CASE 
                WHEN unique_readers > 0 
                THEN ROUND((engaged_readers::numeric / unique_readers) * 100, 1)
                ELSE 0 
            END,
            'completion_rate', CASE 
                WHEN unique_readers > 0 
                THEN ROUND((full_readers::numeric / unique_readers) * 100, 1)
                ELSE 0 
            END
        ),
        'time_distribution', jsonb_build_object(
            'morning', COALESCE(morning_reads, 0),
            'afternoon', COALESCE(afternoon_reads, 0),
            'evening', COALESCE(evening_reads, 0),
            'night', COALESCE(night_reads, 0)
        )
    ) INTO insights
    FROM behavior_stats;
    
    RETURN insights;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- ACCOUNT-AWARE ANALYTICS
-- =======================

-- Get analytics for a specific account
CREATE OR REPLACE FUNCTION get_account_analytics(
    p_account_id uuid,
    p_days_back integer DEFAULT 30
)
RETURNS jsonb AS $$
DECLARE
    analytics jsonb;
    start_date date;
BEGIN
    -- Check if user has access to this account
    IF NOT basejump.has_role_on_account(p_account_id) THEN
        RAISE EXCEPTION 'Access denied to account analytics';
    END IF;
    
    start_date := CURRENT_DATE - (p_days_back || ' days')::interval;
    
    WITH account_stats AS (
        SELECT 
            COUNT(DISTINCT a.id) as total_articles,
            COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'published') as published_articles,
            COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'draft') as draft_articles,
            SUM(a.total_views) as total_views,
            SUM(a.total_shares) as total_shares,
            SUM(a.total_saves) as total_saves,
            AVG(a.engagement) as avg_engagement,
            COUNT(DISTINCT a.created_by_user_id) as unique_authors
        FROM articles a
        WHERE a.account_id = p_account_id
        AND a.created_at >= start_date
    ),
    recent_activity AS (
        SELECT 
            COUNT(*) FILTER (WHERE event_type = 'view') as recent_views,
            COUNT(*) FILTER (WHERE event_type = 'share') as recent_shares,
            COUNT(*) FILTER (WHERE event_type = 'save') as recent_saves
        FROM article_events e
        WHERE e.account_id = p_account_id
        AND e.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    )
    SELECT jsonb_build_object(
        'account_id', p_account_id,
        'period_days', p_days_back,
        'articles', jsonb_build_object(
            'total', COALESCE(s.total_articles, 0),
            'published', COALESCE(s.published_articles, 0),
            'draft', COALESCE(s.draft_articles, 0),
            'unique_authors', COALESCE(s.unique_authors, 0)
        ),
        'engagement', jsonb_build_object(
            'total_views', COALESCE(s.total_views, 0),
            'total_shares', COALESCE(s.total_shares, 0),
            'total_saves', COALESCE(s.total_saves, 0),
            'avg_engagement', ROUND(COALESCE(s.avg_engagement, 0)::numeric, 2)
        ),
        'recent_activity', jsonb_build_object(
            'views_24h', COALESCE(ra.recent_views, 0),
            'shares_24h', COALESCE(ra.recent_shares, 0),
            'saves_24h', COALESCE(ra.recent_saves, 0)
        )
    ) INTO analytics
    FROM account_stats s
    CROSS JOIN recent_activity ra;
    
    RETURN analytics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- PERFORMANCE OPTIMIZATION FUNCTIONS
-- =======================

-- Function to refresh analytics cache (for heavy queries)
CREATE OR REPLACE FUNCTION refresh_analytics_cache()
RETURNS void AS $$
BEGIN
    -- Update article metrics for all articles
    UPDATE articles a
    SET 
        total_views = (
            SELECT COUNT(DISTINCT e.user_id)
            FROM article_events e
            WHERE e.article_id = a.id AND e.event_type = 'view'
        ),
        total_shares = (
            SELECT COUNT(*)
            FROM article_events e
            WHERE e.article_id = a.id AND e.event_type = 'share'
        ),
        total_saves = (
            SELECT COUNT(*)
            FROM saved_articles sa
            WHERE sa.article_id = a.id
        );
    
    -- Recalculate trend scores
    PERFORM calculate_trend_scores();
    
    RAISE NOTICE 'Analytics cache refreshed at %', now();
END;
$$ LANGUAGE plpgsql;

-- =======================
-- VERIFICATION
-- =======================

DO $$
DECLARE
  function_count integer;
BEGIN
  -- Check functions exist
  SELECT COUNT(*) INTO function_count
  FROM pg_proc 
  WHERE proname IN (
    'get_enhanced_dashboard_stats',
    'get_analytics_time_series',
    'get_top_performing_articles',
    'get_category_analytics',
    'get_reader_behavior_insights',
    'get_account_analytics',
    'refresh_analytics_cache'
  );
  
  IF function_count < 7 THEN
    RAISE WARNING 'Not all advanced analytics functions were created. Found % functions', function_count;
  END IF;
  
  RAISE NOTICE 'Articles advanced analytics & dashboard functions setup completed successfully';
END $$;

COMMIT; 