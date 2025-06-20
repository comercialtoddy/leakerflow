-- =======================
-- MIGRATION: Articles Voting & Analytics System
-- Consolidation of: 02_articles_voting_system.sql + 03_articles_analytics_system.sql
-- Applied fixes: Vote function with account_id, duplicate event prevention
-- =======================

BEGIN;

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
-- ANALYTICS TABLES
-- =======================

-- Article events tracking (views, shares, saves, comments, etc.)
CREATE TABLE IF NOT EXISTS article_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  account_id uuid REFERENCES basejump.accounts(id) NOT NULL, -- Basejump integration
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
  account_id uuid REFERENCES basejump.accounts(id) NOT NULL, -- Basejump integration
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

-- Voting table indexes
CREATE INDEX IF NOT EXISTS idx_article_votes_article_id ON article_votes(article_id);
CREATE INDEX IF NOT EXISTS idx_article_votes_user_id ON article_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_article_votes_vote_type ON article_votes(vote_type);
CREATE INDEX IF NOT EXISTS idx_article_votes_created_at ON article_votes(created_at DESC);

-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_article_events_article_id ON article_events(article_id);
CREATE INDEX IF NOT EXISTS idx_article_events_user_id ON article_events(user_id);
CREATE INDEX IF NOT EXISTS idx_article_events_account_id ON article_events(account_id);
CREATE INDEX IF NOT EXISTS idx_article_events_session_id ON article_events(session_id);
CREATE INDEX IF NOT EXISTS idx_article_events_event_type ON article_events(event_type);
CREATE INDEX IF NOT EXISTS idx_article_events_created_at ON article_events(created_at DESC);

-- Analytics table indexes
CREATE INDEX IF NOT EXISTS idx_article_analytics_article_id ON article_analytics(article_id);
CREATE INDEX IF NOT EXISTS idx_article_analytics_account_id ON article_analytics(account_id);
CREATE INDEX IF NOT EXISTS idx_article_analytics_date ON article_analytics(date DESC);

-- =======================
-- TRIGGERS
-- =======================

-- Apply updated_at trigger to votes
CREATE TRIGGER update_article_votes_updated_at 
    BEFORE UPDATE ON article_votes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to analytics
CREATE TRIGGER update_article_analytics_updated_at 
    BEFORE UPDATE ON article_analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =======================
-- VOTING FUNCTIONS (WITH ACCOUNT_ID FIX)
-- =======================

-- Vote on article (upvote or downvote) - Fixed to work with account_id
CREATE OR REPLACE FUNCTION vote_on_article(
    p_article_id uuid,
    p_vote_type text
)
RETURNS jsonb AS $$
DECLARE
    current_user_id uuid;
    article_account_id uuid;
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
    
    -- Get the article's account_id for event tracking
    SELECT account_id INTO article_account_id
    FROM articles 
    WHERE id = p_article_id;
    
    IF article_account_id IS NULL THEN
        RAISE EXCEPTION 'Article not found or has no account_id';
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
        
        -- Track event with account_id
        INSERT INTO article_events (article_id, user_id, account_id, event_type)
        VALUES (p_article_id, current_user_id, article_account_id, p_vote_type);
        
    ELSIF existing_vote = p_vote_type THEN
        -- Remove vote (user clicked same vote again)
        DELETE FROM article_votes 
        WHERE article_id = p_article_id AND user_id = current_user_id;
        
    ELSE
        -- Change vote
        UPDATE article_votes 
        SET vote_type = p_vote_type, updated_at = now()
        WHERE article_id = p_article_id AND user_id = current_user_id;
        
        -- Track event with account_id
        INSERT INTO article_events (article_id, user_id, account_id, event_type)
        VALUES (p_article_id, current_user_id, article_account_id, p_vote_type);
    END IF;
    
    -- Recalculate vote counts
    SELECT 
        COUNT(*) FILTER (WHERE vote_type = 'upvote'),
        COUNT(*) FILTER (WHERE vote_type = 'downvote')
    INTO new_upvotes, new_downvotes
    FROM article_votes 
    WHERE article_id = p_article_id;
    
    new_vote_score := new_upvotes - new_downvotes;
    
    -- Update article vote counts
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
        time_decay := GREATEST(0.1, 1.0 / (1.0 + hours_since_publish / 12.0));
        
        -- Reddit-style trending algorithm
        trend_score_val := (log_score * time_decay) + (article_record.upvotes * 0.1 * time_decay);
        
        -- Update article with new trend score
        UPDATE articles SET
            trend_score = trend_score_val,
            is_trending = (trend_score_val > 1.0 AND article_record.vote_score > 0)
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
-- ANALYTICS FUNCTIONS (WITH DUPLICATE PREVENTION)
-- =======================

-- Track article event (prevents duplicates for view and save events)
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
    article_account_id uuid;
    existing_event_count integer;
BEGIN
    -- Get current authenticated user
    current_user_id := auth.uid();
    
    -- Only proceed if user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to track events';
    END IF;
    
    -- Get the article's account_id
    SELECT account_id INTO article_account_id
    FROM articles 
    WHERE id = p_article_id;
    
    IF article_account_id IS NULL THEN
        RAISE EXCEPTION 'Article not found or has no account_id';
    END IF;
    
    -- For view and save events, check if user already has this event type for this article
    IF p_event_type IN ('view', 'save') THEN
        SELECT COUNT(*) INTO existing_event_count
        FROM article_events 
        WHERE article_id = p_article_id 
          AND user_id = current_user_id 
          AND event_type = p_event_type;
        
        -- If user already has this event type for this article, don't create duplicate
        IF existing_event_count > 0 THEN
            RETURN NULL; -- Return null to indicate no new event was created
        END IF;
    END IF;
    
    -- Insert event with account_id
    INSERT INTO article_events (
        article_id, user_id, account_id, event_type, 
        read_time_seconds, scroll_percentage, metadata
    ) VALUES (
        p_article_id, current_user_id, article_account_id, p_event_type,
        p_read_time_seconds, p_scroll_percentage, p_metadata
    ) RETURNING id INTO event_id;
    
    -- Update article metrics in real-time
    PERFORM update_article_metrics(p_article_id);
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
        article_id, account_id, date, views, unique_views, shares, saves, 
        comments, likes, bookmarks, upvotes, downvotes, avg_read_time, avg_scroll_percentage, bounce_rate
    )
    SELECT 
        e.article_id,
        e.account_id,
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
    FROM article_events e
    WHERE DATE(created_at) = p_date
      AND user_id IS NOT NULL -- Only count authenticated users
    GROUP BY e.article_id, e.account_id
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

-- =======================
-- VERIFICATION
-- =======================

DO $$
DECLARE
  votes_table_exists boolean;
  events_table_exists boolean;
  analytics_table_exists boolean;
  function_count integer;
BEGIN
  -- Check tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'article_votes'
  ) INTO votes_table_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'article_events'
  ) INTO events_table_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'article_analytics'
  ) INTO analytics_table_exists;
  
  IF NOT votes_table_exists OR NOT events_table_exists OR NOT analytics_table_exists THEN
    RAISE EXCEPTION 'Not all voting/analytics tables were created';
  END IF;
  
  -- Check key functions exist
  SELECT COUNT(*) INTO function_count
  FROM pg_proc 
  WHERE proname IN ('vote_on_article', 'track_article_event', 'calculate_trend_scores', 'get_user_vote');
  
  IF function_count < 4 THEN
    RAISE EXCEPTION 'Not all voting/analytics functions were created';
  END IF;
  
  -- Verify account_id column exists in events table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'article_events' AND column_name = 'account_id'
  ) THEN
    RAISE EXCEPTION 'article_events table missing account_id column';
  END IF;
  
  RAISE NOTICE 'Articles voting & analytics system setup completed successfully';
END $$;

COMMIT; 