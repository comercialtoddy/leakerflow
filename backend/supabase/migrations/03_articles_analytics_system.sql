-- Articles Analytics System
-- This migration creates the analytics tracking system for articles

-- =======================
-- ANALYTICS TABLES
-- =======================

-- Article events tracking (views, shares, saves, comments, etc.)
CREATE TABLE IF NOT EXISTS article_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text, -- For anonymous tracking
  event_type text NOT NULL CHECK (event_type IN ('view', 'share', 'save', 'comment', 'like', 'bookmark', 'upvote', 'downvote')),
  
  -- Event metadata
  user_agent text,
  ip_address inet,
  referrer text,
  
  -- Read tracking
  read_time_seconds integer DEFAULT 0,
  scroll_percentage numeric(5,2) DEFAULT 0,
  
  -- Context data
  metadata jsonb DEFAULT '{}',
  
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

-- Article analytics aggregated by day
CREATE TABLE IF NOT EXISTS article_analytics (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
  date date NOT NULL,
  
  -- Daily metrics
  views integer DEFAULT 0,
  unique_views integer DEFAULT 0,
  shares integer DEFAULT 0,
  saves integer DEFAULT 0,
  comments integer DEFAULT 0,
  likes integer DEFAULT 0,
  bookmarks integer DEFAULT 0,
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  
  -- Engagement metrics
  avg_read_time numeric(8,2) DEFAULT 0,
  avg_scroll_percentage numeric(5,2) DEFAULT 0,
  bounce_rate numeric(5,2) DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint for article per day
  UNIQUE(article_id, date)
);

-- =======================
-- INDEXES
-- =======================

-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_article_events_article_id ON article_events(article_id);
CREATE INDEX IF NOT EXISTS idx_article_events_user_id ON article_events(user_id);
CREATE INDEX IF NOT EXISTS idx_article_events_session_id ON article_events(session_id);
CREATE INDEX IF NOT EXISTS idx_article_events_event_type ON article_events(event_type);
CREATE INDEX IF NOT EXISTS idx_article_events_created_at ON article_events(created_at DESC);

-- Analytics table indexes
CREATE INDEX IF NOT EXISTS idx_article_analytics_article_id ON article_analytics(article_id);
CREATE INDEX IF NOT EXISTS idx_article_analytics_date ON article_analytics(date DESC);

-- =======================
-- TRIGGERS
-- =======================

-- Apply updated_at trigger to analytics
CREATE TRIGGER update_article_analytics_updated_at 
    BEFORE UPDATE ON article_analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =======================
-- ROW LEVEL SECURITY
-- =======================

-- Enable RLS
ALTER TABLE article_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_analytics ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Users can view events for published articles or own articles" ON article_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM articles a 
            WHERE a.id = article_events.article_id 
            AND (a.status = 'published' OR a.user_id = auth.uid())
        )
    );

CREATE POLICY "Anyone can insert events" ON article_events
    FOR INSERT WITH CHECK (true);

-- Analytics policies  
CREATE POLICY "Users can view analytics for published articles or own articles" ON article_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM articles a 
            WHERE a.id = article_analytics.article_id 
            AND (a.status = 'published' OR a.user_id = auth.uid())
        )
    );

-- =======================
-- CORE ANALYTICS FUNCTIONS
-- =======================

-- Track article event (only for authenticated users)
CREATE OR REPLACE FUNCTION track_article_event(
    p_article_id uuid,
    p_event_type text,
    p_read_time_seconds integer DEFAULT 0,
    p_scroll_percentage numeric DEFAULT 0,
    p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
    event_id uuid;
    current_user_id uuid;
    existing_view_count integer;
BEGIN
    -- Get current authenticated user
    current_user_id := auth.uid();
    
    -- Only proceed if user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to track events';
    END IF;
    
    -- For view events, check if user already viewed this article
    IF p_event_type = 'view' THEN
        SELECT COUNT(*) INTO existing_view_count
        FROM article_events 
        WHERE article_id = p_article_id 
          AND user_id = current_user_id 
          AND event_type = 'view';
        
        -- If user already viewed this article, don't count it again
        IF existing_view_count > 0 THEN
            RETURN NULL; -- Return null to indicate no new event was created
        END IF;
    END IF;
    
    -- Insert event
    INSERT INTO article_events (
        article_id, user_id, event_type, 
        read_time_seconds, scroll_percentage, metadata
    ) VALUES (
        p_article_id, current_user_id, p_event_type,
        p_read_time_seconds, p_scroll_percentage, p_metadata
    ) RETURNING id INTO event_id;
    
    -- Update article metrics in real-time
    PERFORM update_article_metrics(p_article_id);
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Update article metrics from events
CREATE OR REPLACE FUNCTION update_article_metrics(p_article_id uuid)
RETURNS void AS $$
DECLARE
    total_views_count integer;
    unique_views_count integer;
    total_shares_count integer;
    total_saves_count integer;
    total_comments_count integer;
    avg_read_time_val numeric;
    bounce_rate_val numeric;
BEGIN
    -- Calculate metrics from events (authenticated users only)
    SELECT 
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'view'),
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'view'), -- total_views = unique_views for authenticated users
        COUNT(*) FILTER (WHERE event_type = 'share'),
        COUNT(*) FILTER (WHERE event_type = 'save'),
        COUNT(*) FILTER (WHERE event_type = 'comment'),
        AVG(read_time_seconds) FILTER (WHERE event_type = 'view' AND read_time_seconds > 0),
        COUNT(*) FILTER (WHERE event_type = 'view' AND read_time_seconds < 10) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE event_type = 'view'), 0)
    INTO 
        total_views_count, unique_views_count, total_shares_count, 
        total_saves_count, total_comments_count, avg_read_time_val, bounce_rate_val
    FROM article_events 
    WHERE article_id = p_article_id
      AND user_id IS NOT NULL; -- Only count authenticated users
    
    -- Update article with calculated metrics
    UPDATE articles SET
        total_views = COALESCE(total_views_count, 0),
        unique_views = COALESCE(unique_views_count, 0),
        total_shares = COALESCE(total_shares_count, 0),
        total_saves = COALESCE(total_saves_count, 0),
        total_comments = COALESCE(total_comments_count, 0),
        avg_read_time = COALESCE(avg_read_time_val, 0),
        bounce_rate = COALESCE(bounce_rate_val, 0),
        -- Update legacy fields for backward compatibility
        views = COALESCE(total_views_count, 0),
        engagement = CASE 
            WHEN total_views_count > 0 THEN 
                ((COALESCE(total_shares_count, 0) + COALESCE(total_saves_count, 0) + COALESCE(total_comments_count, 0)) * 100.0 / total_views_count)
            ELSE 0 
        END
    WHERE id = p_article_id;
END;
$$ LANGUAGE plpgsql;

-- Get article analytics summary
CREATE OR REPLACE FUNCTION get_article_analytics_summary(
    p_article_id uuid DEFAULT NULL,
    p_date_from date DEFAULT NULL,
    p_date_to date DEFAULT NULL
)
RETURNS TABLE (
    total_views bigint,
    unique_views bigint,
    total_shares bigint,
    total_saves bigint,
    total_comments bigint,
    avg_engagement_rate numeric,
    avg_read_time numeric,
    avg_bounce_rate numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        SUM(a.views)::bigint as total_views,
        SUM(a.unique_views)::bigint as unique_views,
        SUM(a.shares)::bigint as total_shares,
        SUM(a.saves)::bigint as total_saves,
        SUM(a.comments)::bigint as total_comments,
        AVG(CASE WHEN a.views > 0 THEN (a.shares + a.saves + a.comments) * 100.0 / a.views ELSE 0 END) as avg_engagement_rate,
        AVG(a.avg_read_time) as avg_read_time,
        AVG(a.bounce_rate) as avg_bounce_rate
    FROM article_analytics a
    JOIN articles art ON art.id = a.article_id
    WHERE 
        (p_article_id IS NULL OR a.article_id = p_article_id)
        AND (p_date_from IS NULL OR a.date >= p_date_from)
        AND (p_date_to IS NULL OR a.date <= p_date_to)
        AND (art.status = 'published' OR art.user_id = auth.uid());
END;
$$ LANGUAGE plpgsql;

-- Daily analytics aggregation (run via cron)
CREATE OR REPLACE FUNCTION aggregate_daily_analytics(p_date date DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void AS $$
BEGIN
    INSERT INTO article_analytics (
        article_id, date, views, unique_views, shares, saves, 
        comments, likes, bookmarks, upvotes, downvotes, avg_read_time, avg_scroll_percentage, bounce_rate
    )
    SELECT 
        article_id,
        p_date,
        COUNT(*) FILTER (WHERE event_type = 'view') as views,
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'view') as unique_views,
        COUNT(*) FILTER (WHERE event_type = 'share') as shares,
        COUNT(*) FILTER (WHERE event_type = 'save') as saves,
        COUNT(*) FILTER (WHERE event_type = 'comment') as comments,
        COUNT(*) FILTER (WHERE event_type = 'like') as likes,
        COUNT(*) FILTER (WHERE event_type = 'bookmark') as bookmarks,
        COUNT(*) FILTER (WHERE event_type = 'upvote') as upvotes,
        COUNT(*) FILTER (WHERE event_type = 'downvote') as downvotes,
        AVG(read_time_seconds) FILTER (WHERE event_type = 'view' AND read_time_seconds > 0) as avg_read_time,
        AVG(scroll_percentage) FILTER (WHERE event_type = 'view' AND scroll_percentage > 0) as avg_scroll_percentage,
        COUNT(*) FILTER (WHERE event_type = 'view' AND read_time_seconds < 10) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE event_type = 'view'), 0) as bounce_rate
    FROM article_events
    WHERE DATE(created_at) = p_date
      AND user_id IS NOT NULL -- Only count authenticated users
    GROUP BY article_id
    ON CONFLICT (article_id, date) 
    DO UPDATE SET
        views = EXCLUDED.views,
        unique_views = EXCLUDED.unique_views,
        shares = EXCLUDED.shares,
        saves = EXCLUDED.saves,
        comments = EXCLUDED.comments,
        likes = EXCLUDED.likes,
        bookmarks = EXCLUDED.bookmarks,
        upvotes = EXCLUDED.upvotes,
        downvotes = EXCLUDED.downvotes,
        avg_read_time = EXCLUDED.avg_read_time,
        avg_scroll_percentage = EXCLUDED.avg_scroll_percentage,
        bounce_rate = EXCLUDED.bounce_rate,
        updated_at = now();
END;
$$ LANGUAGE plpgsql; 