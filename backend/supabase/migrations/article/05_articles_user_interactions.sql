-- =======================
-- MIGRATION: Articles User Interactions & Public Access
-- Consolidation of: 07_articles_public_functions.sql + user interaction fixes
-- Applied fixes: User-specific saves, public article access, view tracking
-- =======================

BEGIN;

-- =======================
-- USER INTERACTION FUNCTIONS
-- =======================

-- Function to check if user has saved an article (user-specific)
CREATE OR REPLACE FUNCTION user_has_saved_article(p_article_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM saved_articles
        WHERE article_id = p_article_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle article save status (user-specific saves with duplicate prevention)
CREATE OR REPLACE FUNCTION toggle_article_save(p_article_id uuid)
RETURNS boolean AS $$
DECLARE
    current_user_id uuid;
    is_saved boolean;
BEGIN
    -- Get current authenticated user
    current_user_id := auth.uid();
    
    -- Only proceed if user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to save articles';
    END IF;
    
    -- Check if user has already saved this article
    SELECT EXISTS (
        SELECT 1 FROM saved_articles sa
        WHERE sa.article_id = p_article_id AND sa.user_id = current_user_id
    ) INTO is_saved;
    
    IF is_saved THEN
        -- Remove save
        DELETE FROM saved_articles
        WHERE article_id = p_article_id AND user_id = current_user_id;
        
        -- Remove the save event too (prevent duplicates)
        DELETE FROM article_events
        WHERE article_id = p_article_id 
          AND user_id = current_user_id 
          AND event_type = 'save';
        
        RETURN false;
    ELSE
        -- Add save
        INSERT INTO saved_articles (user_id, article_id)
        VALUES (current_user_id, p_article_id)
        ON CONFLICT (user_id, article_id) DO NOTHING;
        
        -- Track save event (will only create if doesn't exist due to duplicate prevention)
        PERFORM track_article_event(p_article_id, 'save');
        
        RETURN true;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE EXCEPTION 'Error toggling article save: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep the original toggle_article_bookmark for backward compatibility
CREATE OR REPLACE FUNCTION toggle_article_bookmark(article_id uuid)
RETURNS boolean AS $$
BEGIN
    -- Just call the new save function
    RETURN toggle_article_save(article_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- VIEW TRACKING FUNCTIONS
-- =======================

-- Function to increment article views (only for authenticated users, prevents duplicates)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- PUBLIC ARTICLE LISTING FUNCTION
-- =======================

-- Function to get user's own articles for dashboard (account-separated)
CREATE OR REPLACE FUNCTION get_user_articles_paginated(
    page_size integer DEFAULT 10,
    page_offset integer DEFAULT 0,
    filter_status text DEFAULT NULL,
    filter_category text DEFAULT NULL,
    filter_account_id uuid DEFAULT NULL
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
    sections jsonb,
    read_time text,
    image_url text,
    views integer,
    engagement numeric,
    bookmarked boolean,
    saved boolean,
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
    account_id uuid,
    total_count bigint
) AS $$
BEGIN
    -- Must be authenticated to view user articles
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to view their articles';
    END IF;

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
        a.sections,
        a.read_time,
        a.image_url,
        a.views,
        a.engagement,
        user_has_saved_article(a.id) as bookmarked, -- For backward compatibility
        user_has_saved_article(a.id) as saved,
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
        a.account_id,
        COUNT(*) OVER() as total_count
    FROM articles a
    WHERE 
        -- Only user's own articles
        a.created_by_user_id = auth.uid()
        -- Apply status filter
        AND (filter_status IS NULL OR a.status = filter_status)
        -- Apply category filter
        AND (filter_category IS NULL OR 
             (filter_category = 'trends' AND a.is_trending = true) OR
             (filter_category != 'trends' AND a.category = filter_category)
        )
        -- Apply account filter
        AND (filter_account_id IS NULL OR a.account_id = filter_account_id)
    ORDER BY 
        a.account_id, -- Group by account first
        CASE 
            WHEN filter_category = 'trends' THEN a.trend_score
            ELSE EXTRACT(EPOCH FROM COALESCE(a.publish_date, a.created_at))
        END DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get public articles for discover (public access)
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
    sections jsonb,
    read_time text,
    image_url text,
    views integer,
    engagement numeric,
    bookmarked boolean,
    saved boolean,
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
        a.sections,
        a.read_time,
        a.image_url,
        a.views,
        a.engagement,
        user_has_saved_article(a.id) as bookmarked, -- For backward compatibility
        user_has_saved_article(a.id) as saved,
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
        -- Only public published articles for discover
        a.status = 'published'
        AND a.visibility = 'public'
        -- Apply category filter
        AND (filter_category IS NULL OR 
         (filter_category = 'trends' AND a.is_trending = true) OR
         (filter_category != 'trends' AND a.category = filter_category)
        )
    ORDER BY 
        CASE 
            WHEN filter_category = 'trends' THEN a.trend_score
            ELSE EXTRACT(EPOCH FROM COALESCE(a.publish_date, a.created_at))
        END DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- ARTICLE ACCESS FUNCTIONS
-- =======================

-- Function to get a single article by ID (respects visibility and user permissions)
CREATE OR REPLACE FUNCTION get_article_by_id(p_article_id uuid)
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
    sections jsonb,
    read_time text,
    image_url text,
    views integer,
    engagement numeric,
    saved boolean,
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
    account_id uuid,
    created_by_user_id uuid,
    visibility text
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
        a.sections,
        a.read_time,
        a.image_url,
        a.views,
        a.engagement,
        user_has_saved_article(a.id) as saved,
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
        a.account_id,
        a.created_by_user_id,
        a.visibility
    FROM articles a
    WHERE a.id = p_article_id
    -- Access control is handled by RLS policies
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's saved articles
CREATE OR REPLACE FUNCTION get_user_saved_articles(
    page_size integer DEFAULT 10,
    page_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    title text,
    subtitle text,
    category text,
    author text,
    image_url text,
    read_time text,
    saved_at timestamptz,
    publish_date timestamptz,
    total_count bigint
) AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to view saved articles';
    END IF;
    
    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        a.subtitle,
        a.category,
        a.author,
        a.image_url,
        a.read_time,
        sa.created_at as saved_at,
        a.publish_date,
        COUNT(*) OVER() as total_count
    FROM saved_articles sa
    JOIN articles a ON a.id = sa.article_id
    WHERE sa.user_id = auth.uid()
    AND a.status = 'published' -- Only show published articles
    ORDER BY sa.created_at DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- UTILITY FUNCTIONS
-- =======================

-- Function to recalculate total_saves based on actual saved_articles table
CREATE OR REPLACE FUNCTION recalculate_article_saves()
RETURNS void AS $$
BEGIN
    -- Update total_saves to match the actual count in saved_articles
    UPDATE articles a
    SET total_saves = (
        SELECT COUNT(*)
        FROM saved_articles sa
        WHERE sa.article_id = a.id
    );
    
    RAISE NOTICE 'Recalculated total_saves for all articles';
END;
$$ LANGUAGE plpgsql;

-- Function to get articles trending in the last 24 hours
CREATE OR REPLACE FUNCTION get_trending_articles(
    page_size integer DEFAULT 10,
    page_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    title text,
    subtitle text,
    category text,
    author text,
    image_url text,
    trend_score numeric,
    vote_score integer,
    upvotes integer,
    total_views integer,
    created_at timestamptz,
    total_count bigint
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
        a.trend_score,
        a.vote_score,
        a.upvotes,
        a.total_views,
        a.created_at,
        COUNT(*) OVER() as total_count
    FROM articles a
    WHERE a.status = 'published'
    AND a.is_trending = true
    AND a.created_at > now() - INTERVAL '24 hours'
    ORDER BY a.trend_score DESC, a.vote_score DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- CLEANUP FUNCTIONS
-- =======================

-- Function to auto-cleanup old articles (run daily via cron)
CREATE OR REPLACE FUNCTION cleanup_old_articles()
RETURNS void AS $$
BEGIN
    -- Delete draft articles older than 1 week
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
    
    -- Cleanup old realtime activities
    PERFORM cleanup_old_activities();
    
    -- Log cleanup
    RAISE NOTICE 'Cleaned up old articles and metrics at %', now();
END;
$$ LANGUAGE plpgsql;

-- =======================
-- VERIFICATION
-- =======================

DO $$
DECLARE
  function_count integer;
  saved_articles_count integer;
BEGIN
  -- Check functions exist
  SELECT COUNT(*) INTO function_count
  FROM pg_proc 
  WHERE proname IN (
    'user_has_saved_article',
    'toggle_article_save',
    'toggle_article_bookmark',
    'increment_article_views',
    'get_articles_paginated',
    'get_user_articles_paginated',
    'get_article_by_id',
    'get_user_saved_articles',
    'get_trending_articles',
    'cleanup_old_articles',
    'recalculate_article_saves'
  );
  
  IF function_count < 11 THEN
    RAISE WARNING 'Not all user interaction functions were created. Found % functions', function_count;
  END IF;
  
  -- Check saved_articles table exists and has data integrity
  SELECT COUNT(*) INTO saved_articles_count
  FROM information_schema.tables 
  WHERE table_name = 'saved_articles';
  
  IF saved_articles_count = 0 THEN
    RAISE EXCEPTION 'saved_articles table does not exist';
  END IF;
  
  -- Recalculate saves to ensure consistency
  PERFORM recalculate_article_saves();
  
  RAISE NOTICE 'Articles user interactions & public access setup completed successfully';
END $$;

COMMIT; 