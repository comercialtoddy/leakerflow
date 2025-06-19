-- Articles Real-time Activity Tracking
-- This migration creates the real-time activity system for articles

-- =======================
-- REAL-TIME ACTIVITY TABLE
-- =======================

-- Table to track real-time user activity
CREATE TABLE IF NOT EXISTS article_realtime_activity (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
    activity_type text NOT NULL CHECK (activity_type IN ('viewing', 'reading', 'typing_comment')),
    
    -- Session tracking
    session_id text NOT NULL,
    
    -- Activity metadata
    metadata jsonb DEFAULT '{}',
    
    -- Timestamps
    started_at timestamptz DEFAULT now(),
    last_seen_at timestamptz DEFAULT now(),
    ended_at timestamptz,
    
    -- Unique constraint: one activity per user per article per session
    UNIQUE(user_id, article_id, session_id, activity_type)
);

-- =======================
-- INDEXES
-- =======================

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_article_realtime_activity_article_id ON article_realtime_activity(article_id);
CREATE INDEX IF NOT EXISTS idx_article_realtime_activity_user_id ON article_realtime_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_article_realtime_activity_last_seen ON article_realtime_activity(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_article_realtime_activity_active ON article_realtime_activity(article_id, ended_at) WHERE ended_at IS NULL;

-- =======================
-- ROW LEVEL SECURITY
-- =======================

ALTER TABLE article_realtime_activity ENABLE ROW LEVEL SECURITY;

-- Users can track their own activities
CREATE POLICY "Users can track own activities" ON article_realtime_activity
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own activities
CREATE POLICY "Users can update own activities" ON article_realtime_activity
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can view activities for articles they can access
CREATE POLICY "Users can view activities for accessible articles" ON article_realtime_activity
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM articles a 
            WHERE a.id = article_realtime_activity.article_id 
            AND (a.status = 'published' OR a.user_id = auth.uid())
        )
    );

-- =======================
-- ACTIVITY FUNCTIONS
-- =======================

-- Start or update a real-time activity
CREATE OR REPLACE FUNCTION track_realtime_activity(
    p_article_id uuid,
    p_activity_type text,
    p_session_id text,
    p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb AS $$
DECLARE
    activity_record jsonb;
    current_user_id uuid;
BEGIN
    -- Get current user
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to track activity';
    END IF;
    
    -- Insert or update activity
    INSERT INTO article_realtime_activity (
        user_id,
        article_id,
        activity_type,
        session_id,
        metadata,
        last_seen_at
    ) VALUES (
        current_user_id,
        p_article_id,
        p_activity_type,
        p_session_id,
        p_metadata,
        now()
    )
    ON CONFLICT (user_id, article_id, session_id, activity_type) 
    DO UPDATE SET
        last_seen_at = now(),
        metadata = article_realtime_activity.metadata || EXCLUDED.metadata
    RETURNING jsonb_build_object(
        'id', id,
        'activity_type', activity_type,
        'started_at', started_at,
        'last_seen_at', last_seen_at
    ) INTO activity_record;
    
    RETURN activity_record;
END;
$$ LANGUAGE plpgsql;

-- End a real-time activity
CREATE OR REPLACE FUNCTION end_realtime_activity(
    p_article_id uuid,
    p_activity_type text,
    p_session_id text
)
RETURNS boolean AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    UPDATE article_realtime_activity
    SET ended_at = now()
    WHERE user_id = current_user_id
      AND article_id = p_article_id
      AND activity_type = p_activity_type
      AND session_id = p_session_id
      AND ended_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get current active users for an article
CREATE OR REPLACE FUNCTION get_article_active_users(
    p_article_id uuid,
    p_activity_timeout_seconds integer DEFAULT 30
)
RETURNS jsonb AS $$
DECLARE
    active_users jsonb;
BEGIN
    WITH active_activities AS (
        SELECT DISTINCT ON (ara.user_id)
            ara.user_id,
            ara.activity_type,
            ara.last_seen_at,
            u.raw_user_meta_data->>'full_name' as user_name,
            u.raw_user_meta_data->>'avatar_url' as avatar_url
        FROM article_realtime_activity ara
        JOIN auth.users u ON u.id = ara.user_id
        WHERE ara.article_id = p_article_id
          AND ara.ended_at IS NULL
          AND ara.last_seen_at > now() - (p_activity_timeout_seconds || ' seconds')::interval
        ORDER BY ara.user_id, ara.last_seen_at DESC
    )
    SELECT jsonb_build_object(
        'total_active', COUNT(*),
        'viewing', COUNT(*) FILTER (WHERE activity_type = 'viewing'),
        'reading', COUNT(*) FILTER (WHERE activity_type = 'reading'),
        'typing_comment', COUNT(*) FILTER (WHERE activity_type = 'typing_comment'),
        'users', jsonb_agg(
            jsonb_build_object(
                'user_id', user_id,
                'user_name', COALESCE(user_name, 'Anonymous'),
                'avatar_url', avatar_url,
                'activity_type', activity_type,
                'last_seen_at', last_seen_at
            )
        )
    ) INTO active_users
    FROM active_activities;
    
    RETURN COALESCE(active_users, jsonb_build_object(
        'total_active', 0,
        'viewing', 0,
        'reading', 0,
        'typing_comment', 0,
        'users', '[]'::jsonb
    ));
END;
$$ LANGUAGE plpgsql;

-- Get global active users summary
CREATE OR REPLACE FUNCTION get_global_active_users(
    p_activity_timeout_seconds integer DEFAULT 30
)
RETURNS jsonb AS $$
DECLARE
    summary jsonb;
BEGIN
    WITH active_users AS (
        SELECT DISTINCT
            ara.user_id,
            ara.article_id,
            a.title as article_title,
            a.category as article_category
        FROM article_realtime_activity ara
        JOIN articles a ON a.id = ara.article_id
        WHERE ara.ended_at IS NULL
          AND ara.last_seen_at > now() - (p_activity_timeout_seconds || ' seconds')::interval
          AND (a.status = 'published' OR a.user_id = auth.uid())
    ),
    category_stats AS (
        SELECT 
            article_category as category,
            COUNT(DISTINCT user_id) as active_users
        FROM active_users
        GROUP BY article_category
    )
    SELECT jsonb_build_object(
        'total_active_users', COUNT(DISTINCT user_id),
        'total_active_articles', COUNT(DISTINCT article_id),
        'categories', COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'category', category,
                    'active_users', active_users
                )
            ) FILTER (WHERE category IS NOT NULL),
            '[]'::jsonb
        )
    ) INTO summary
    FROM active_users
    LEFT JOIN category_stats ON true;
    
    RETURN COALESCE(summary, jsonb_build_object(
        'total_active_users', 0,
        'total_active_articles', 0,
        'categories', '[]'::jsonb
    ));
END;
$$ LANGUAGE plpgsql;

-- Cleanup old activity records (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_activities()
RETURNS void AS $$
BEGIN
    -- Mark activities as ended if not seen for 5 minutes
    UPDATE article_realtime_activity
    SET ended_at = last_seen_at + INTERVAL '5 minutes'
    WHERE ended_at IS NULL
      AND last_seen_at < now() - INTERVAL '5 minutes';
    
    -- Delete activities older than 24 hours
    DELETE FROM article_realtime_activity
    WHERE (ended_at IS NOT NULL AND ended_at < now() - INTERVAL '24 hours')
       OR (last_seen_at < now() - INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql; 