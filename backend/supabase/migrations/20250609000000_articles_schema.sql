-- Articles table for Discover platform
-- Auto-cleanup after 1 week using Row Level Security and periodic cleanup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create articles table (without hybrid storage columns initially)
CREATE TABLE IF NOT EXISTS articles (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  subtitle text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  tags text[] DEFAULT '{}',
  author text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'scheduled')),
  
  -- Media and sources as JSONB for flexibility
  media_items jsonb DEFAULT '[]',
  sources jsonb DEFAULT '[]',
  
  -- Metadata
  read_time text NOT NULL,
  image_url text,
  views integer DEFAULT 0,
  engagement numeric(5,2) DEFAULT 0,
  bookmarked boolean DEFAULT false,
  
  -- Voting system (Reddit-style)
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  vote_score integer DEFAULT 0, -- upvotes - downvotes
  trend_score numeric(10,2) DEFAULT 0, -- calculated trend score for Trends section
  is_trending boolean DEFAULT false, -- flag for articles that qualify for Trends
  
  -- Advanced metrics (calculated from events)
  total_views integer DEFAULT 0,
  unique_views integer DEFAULT 0,
  total_shares integer DEFAULT 0,
  total_saves integer DEFAULT 0,
  total_comments integer DEFAULT 0,
  avg_read_time numeric(8,2) DEFAULT 0,
  bounce_rate numeric(5,2) DEFAULT 0,
  
  -- Publishing
  publish_date timestamptz,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Auto-cleanup constraint (articles older than 1 week will be cleaned up)
  CONSTRAINT valid_article_age CHECK (created_at > now() - interval '1 week' OR status = 'published')
);

-- Add hybrid storage columns for large content support
DO $$
BEGIN
    -- Add content_storage_path column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'articles' AND column_name = 'content_storage_path') THEN
        ALTER TABLE articles ADD COLUMN content_storage_path text;
        COMMENT ON COLUMN articles.content_storage_path IS 'Path to content stored in Supabase Storage for large articles';
    END IF;
    
    -- Add content_size column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'articles' AND column_name = 'content_size') THEN
        ALTER TABLE articles ADD COLUMN content_size integer;
        COMMENT ON COLUMN articles.content_size IS 'Original content size in characters';
    END IF;
END $$;

-- =======================
-- VOTING SYSTEM TABLES
-- =======================

-- Article votes tracking (one vote per user per article)
CREATE TABLE IF NOT EXISTS article_votes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type text NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint: one vote per user per article
  UNIQUE(article_id, user_id)
);

-- =======================
-- METRICS TRACKING TABLES
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_publish_date ON articles(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_trend_score ON articles(trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_is_trending ON articles(is_trending);
CREATE INDEX IF NOT EXISTS idx_articles_vote_score ON articles(vote_score DESC);

-- Voting table indexes
CREATE INDEX IF NOT EXISTS idx_article_votes_article_id ON article_votes(article_id);
CREATE INDEX IF NOT EXISTS idx_article_votes_user_id ON article_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_article_votes_vote_type ON article_votes(vote_type);
CREATE INDEX IF NOT EXISTS idx_article_votes_created_at ON article_votes(created_at DESC);

-- Metrics table indexes
CREATE INDEX IF NOT EXISTS idx_article_events_article_id ON article_events(article_id);
CREATE INDEX IF NOT EXISTS idx_article_events_user_id ON article_events(user_id);
CREATE INDEX IF NOT EXISTS idx_article_events_session_id ON article_events(session_id);
CREATE INDEX IF NOT EXISTS idx_article_events_event_type ON article_events(event_type);
CREATE INDEX IF NOT EXISTS idx_article_events_created_at ON article_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_article_analytics_article_id ON article_analytics(article_id);
CREATE INDEX IF NOT EXISTS idx_article_analytics_date ON article_analytics(date DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_articles_updated_at 
    BEFORE UPDATE ON articles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_article_votes_updated_at 
    BEFORE UPDATE ON article_votes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_article_analytics_updated_at 
    BEFORE UPDATE ON article_analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Categories trigger is handled in categories_schema.sql migration

-- Row Level Security (RLS)
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_analytics ENABLE ROW LEVEL SECURITY;

-- Article policies
CREATE POLICY "Users can view published articles or own articles" ON articles
    FOR SELECT USING (
        status = 'published' OR 
        auth.uid() = user_id
    );

CREATE POLICY "Users can insert own articles" ON articles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own articles" ON articles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own articles" ON articles
    FOR DELETE USING (auth.uid() = user_id);

-- Voting policies
CREATE POLICY "Users can view all votes" ON article_votes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own votes" ON article_votes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes" ON article_votes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes" ON article_votes
    FOR DELETE USING (auth.uid() = user_id);

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
-- VOTING FUNCTIONS
-- =======================

-- Vote on article (upvote or downvote)
CREATE OR REPLACE FUNCTION vote_on_article(
    p_article_id uuid,
    p_vote_type text
)
RETURNS jsonb AS $$
DECLARE
    current_user_id uuid;
    existing_vote text;
    new_upvotes integer;
    new_downvotes integer;
    new_vote_score integer;
    result jsonb;
BEGIN
    -- Get current authenticated user
    current_user_id := auth.uid();
    
    -- Only proceed if user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to vote';
    END IF;
    
    -- Validate vote type
    IF p_vote_type NOT IN ('upvote', 'downvote') THEN
        RAISE EXCEPTION 'Invalid vote type. Must be upvote or downvote';
    END IF;
    
    -- Check if user already voted on this article
    SELECT vote_type INTO existing_vote
    FROM article_votes 
    WHERE article_id = p_article_id AND user_id = current_user_id;
    
    -- Handle vote logic
    IF existing_vote IS NULL THEN
        -- New vote
        INSERT INTO article_votes (article_id, user_id, vote_type)
        VALUES (p_article_id, current_user_id, p_vote_type);
        
        -- Track event
        PERFORM track_article_event(p_article_id, p_vote_type);
        
    ELSIF existing_vote = p_vote_type THEN
        -- Remove vote (user clicked same vote again)
        DELETE FROM article_votes 
        WHERE article_id = p_article_id AND user_id = current_user_id;
        
    ELSE
        -- Change vote
        UPDATE article_votes 
        SET vote_type = p_vote_type, updated_at = now()
        WHERE article_id = p_article_id AND user_id = current_user_id;
        
        -- Track event
        PERFORM track_article_event(p_article_id, p_vote_type);
    END IF;
    
    -- Recalculate vote counts
    SELECT 
        COUNT(*) FILTER (WHERE vote_type = 'upvote'),
        COUNT(*) FILTER (WHERE vote_type = 'downvote')
    INTO new_upvotes, new_downvotes
    FROM article_votes 
    WHERE article_id = p_article_id;
    
    new_vote_score := new_upvotes - new_downvotes;
    
    -- Update article vote counts and recalculate trend score
    UPDATE articles SET
        upvotes = new_upvotes,
        downvotes = new_downvotes,
        vote_score = new_vote_score
    WHERE id = p_article_id;
    
    -- Recalculate trend score
    PERFORM calculate_trend_scores();
    
    -- Get updated user vote status
    SELECT vote_type INTO existing_vote
    FROM article_votes 
    WHERE article_id = p_article_id AND user_id = current_user_id;
    
    -- Return result
    result := jsonb_build_object(
        'upvotes', new_upvotes,
        'downvotes', new_downvotes,
        'vote_score', new_vote_score,
        'user_vote', existing_vote
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Calculate trend scores for all articles (Reddit-style algorithm)
CREATE OR REPLACE FUNCTION calculate_trend_scores()
RETURNS void AS $$
DECLARE
    article_record RECORD;
    hours_since_publish numeric;
    trend_score_val numeric;
    log_score numeric;
    time_decay numeric;
BEGIN
    FOR article_record IN 
        SELECT id, upvotes, downvotes, vote_score, created_at, publish_date
        FROM articles 
        WHERE status = 'published'
    LOOP
        -- Calculate hours since publish (use publish_date if available, otherwise created_at)
        hours_since_publish := EXTRACT(EPOCH FROM (now() - COALESCE(article_record.publish_date, article_record.created_at))) / 3600.0;
        
        -- Avoid log of zero or negative numbers
        IF article_record.vote_score <= 0 THEN
            log_score := 0;
        ELSE
            log_score := LOG(article_record.vote_score + 1);
        END IF;
        
        -- Time decay (articles lose trending power over time)
        -- More aggressive decay: articles older than 24 hours start losing significant score
        time_decay := GREATEST(0.1, 1.0 / (1.0 + hours_since_publish / 12.0));
        
        -- Reddit-style trending algorithm
        -- Higher vote score + recency bias
        trend_score_val := (log_score * time_decay) + (article_record.upvotes * 0.1 * time_decay);
        
        -- Update article with new trend score
        UPDATE articles SET
            trend_score = trend_score_val,
            is_trending = (trend_score_val > 1.0 AND article_record.vote_score > 0) -- Threshold for trending
        WHERE id = article_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Get user's vote status for an article
CREATE OR REPLACE FUNCTION get_user_vote(p_article_id uuid)
RETURNS text AS $$
DECLARE
    user_vote text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;
    
    SELECT vote_type INTO user_vote
    FROM article_votes 
    WHERE article_id = p_article_id AND user_id = auth.uid();
    
    RETURN user_vote;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- METRICS FUNCTIONS
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

-- Function to auto-cleanup old articles (run daily via cron)
CREATE OR REPLACE FUNCTION cleanup_old_articles()
RETURNS void AS $$
BEGIN
    DELETE FROM articles 
    WHERE created_at < now() - interval '1 week' 
    AND status != 'published';
    
    -- Cleanup old events (keep 30 days)
    DELETE FROM article_events 
    WHERE created_at < now() - interval '30 days';
    
    -- Cleanup old analytics (keep 90 days)
    DELETE FROM article_analytics 
    WHERE date < CURRENT_DATE - interval '90 days';
    
    -- Cleanup old votes (keep 90 days)
    DELETE FROM article_votes 
    WHERE created_at < now() - interval '90 days';
    
    -- Log cleanup
    RAISE NOTICE 'Cleaned up old articles and metrics at %', now();
END;
$$ LANGUAGE plpgsql;

-- Function to increment article views (only for authenticated users)
CREATE OR REPLACE FUNCTION increment_article_views(
    p_article_id uuid,
    p_read_time_seconds integer DEFAULT 0,
    p_scroll_percentage numeric DEFAULT 0
)
RETURNS boolean AS $$
DECLARE
    event_result uuid;
BEGIN
    -- Track view event and return whether a new view was counted
    SELECT track_article_event(
        p_article_id,
        'view',
        p_read_time_seconds,
        p_scroll_percentage
    ) INTO event_result;
    
    -- Return true if a new view was counted, false if user already viewed
    RETURN event_result IS NOT NULL;
EXCEPTION
    WHEN OTHERS THEN
        -- If user is not authenticated or any other error, return false
        RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to toggle bookmark status
CREATE OR REPLACE FUNCTION toggle_article_bookmark(article_id uuid)
RETURNS boolean AS $$
DECLARE
    new_bookmark_status boolean;
BEGIN
    UPDATE articles 
    SET bookmarked = NOT bookmarked 
    WHERE id = article_id
    RETURNING bookmarked INTO new_bookmark_status;
    
    -- Track bookmark event only when an article is bookmarked
    IF new_bookmark_status THEN
      PERFORM track_article_event(article_id, 'bookmark');
    END IF;
    
    RETURN new_bookmark_status;
END;
$$ LANGUAGE plpgsql;

-- Function to get articles with pagination (updated to support trending)
CREATE OR REPLACE FUNCTION get_articles_paginated(
    page_size integer DEFAULT 10,
    page_offset integer DEFAULT 0,
    filter_status text DEFAULT 'published',
    filter_category text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    subtitle text,
    content text,
    category text,
    tags text[],
    author text,
    status text,
    media_items jsonb,
    sources jsonb,
    read_time text,
    image_url text,
    views integer,
    engagement numeric,
    bookmarked boolean,
    upvotes integer,
    downvotes integer,
    vote_score integer,
    trend_score numeric,
    is_trending boolean,
    user_vote text,
    total_views integer,
    unique_views integer,
    total_shares integer,
    total_saves integer,
    total_comments integer,
    avg_read_time numeric,
    bounce_rate numeric,
    publish_date timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    total_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        a.subtitle,
        a.content,
        a.category,
        a.tags,
        a.author,
        a.status,
        a.media_items,
        a.sources,
        a.read_time,
        a.image_url,
        a.views,
        a.engagement,
        a.bookmarked,
        a.upvotes,
        a.downvotes,
        a.vote_score,
        a.trend_score,
        a.is_trending,
        get_user_vote(a.id) as user_vote,
        a.total_views,
        a.unique_views,
        a.total_shares,
        a.total_saves,
        a.total_comments,
        a.avg_read_time,
        a.bounce_rate,
        a.publish_date,
        a.created_at,
        a.updated_at,
        COUNT(*) OVER() as total_count
    FROM articles a
    WHERE 
        (filter_status IS NULL OR a.status = filter_status) AND
        (filter_category IS NULL OR 
         (filter_category = 'trends' AND a.is_trending = true) OR
         (filter_category != 'trends' AND a.category = filter_category)
        ) AND
        (a.status = 'published' OR a.user_id = auth.uid())
    ORDER BY 
        CASE 
            WHEN filter_category = 'trends' THEN a.trend_score
            ELSE EXTRACT(EPOCH FROM COALESCE(a.publish_date, a.created_at))
        END DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing (will be auto-cleaned after 1 week)
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
    (SELECT id FROM auth.users LIMIT 1)
);

-- Enable real-time subscriptions for articles (only if not already added)
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

-- Enable real-time for voting tables
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

-- Enable real-time for metrics tables
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
CREATE TRIGGER article_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON articles
    FOR EACH ROW EXECUTE FUNCTION notify_article_changes();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON articles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON articles TO authenticated;
GRANT SELECT ON articles TO anon; 

-- Voting tables permissions
GRANT ALL ON article_votes TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON article_votes TO authenticated;

-- Metrics tables permissions
GRANT ALL ON article_events TO postgres, service_role;
GRANT SELECT, INSERT ON article_events TO authenticated, anon;

GRANT ALL ON article_analytics TO postgres, service_role;
GRANT SELECT ON article_analytics TO authenticated, anon;

-- =======================
-- FUNCTION PERMISSIONS
-- =======================

-- Grant execute permissions on voting functions
GRANT EXECUTE ON FUNCTION vote_on_article(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_vote(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION calculate_trend_scores() TO authenticated, service_role;

-- Grant execute permissions on the function to authenticated users only
GRANT EXECUTE ON FUNCTION track_article_event(uuid, text, integer, numeric, jsonb) TO authenticated;

-- Also grant permissions for increment_article_views to authenticated users only
GRANT EXECUTE ON FUNCTION increment_article_views(uuid, integer, numeric) TO authenticated;

-- Grant permissions for other article functions that might be used
GRANT EXECUTE ON FUNCTION toggle_article_bookmark(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_article_metrics(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_article_analytics_summary(uuid, date, date) TO authenticated, anon;

-- Ensure all existing functions have proper permissions
GRANT EXECUTE ON FUNCTION get_articles_paginated(integer, integer, text, text) TO authenticated, anon;

-- =======================
-- STORAGE BUCKET SETUP
-- =======================

-- Create storage bucket for articles media (images/videos up to 15MB)
INSERT INTO storage.buckets (id, name, public)
VALUES ('articles-media', 'articles-media', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view published files" ON storage.objects;

-- More permissive storage policies for articles-media bucket
CREATE POLICY "Allow authenticated uploads to articles-media" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'articles-media');

CREATE POLICY "Allow authenticated updates to articles-media" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'articles-media');

CREATE POLICY "Allow authenticated users to view all files" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'articles-media');

CREATE POLICY "Allow authenticated users to delete their files" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'articles-media');

-- Public read access for all content (since it's article content)
CREATE POLICY "Public can view all articles-media files" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'articles-media');

-- Set file size limit to 15MB (15,728,640 bytes)
UPDATE storage.buckets 
SET file_size_limit = 15728640 
WHERE id = 'articles-media'; 