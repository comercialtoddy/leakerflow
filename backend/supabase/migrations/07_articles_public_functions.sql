-- Articles Public Functions
-- This migration creates the main public functions for article operations

-- =======================
-- ARTICLE LISTING FUNCTION
-- =======================

-- Function to get articles with pagination and filters
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
        a.bookmarked,
        a.saved,
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

-- =======================
-- SAVE/BOOKMARK FUNCTIONS
-- =======================

-- Toggle article save status (new primary function)
CREATE OR REPLACE FUNCTION toggle_article_save(article_id uuid)
RETURNS boolean AS $$
DECLARE
    new_save_status boolean;
BEGIN
    -- Toggle both saved and bookmarked for backward compatibility
    UPDATE articles 
    SET 
        saved = NOT saved
    WHERE id = article_id
    RETURNING saved INTO new_save_status;
    
    -- Track save event only when an article is saved
    IF new_save_status AND auth.uid() IS NOT NULL THEN
        PERFORM track_article_event(article_id, 'save');
    END IF;
    
    RETURN new_save_status;
END;
$$ LANGUAGE plpgsql;

-- Keep the original toggle_article_bookmark for backward compatibility
CREATE OR REPLACE FUNCTION toggle_article_bookmark(article_id uuid)
RETURNS boolean AS $$
BEGIN
    -- Just call the new save function
    RETURN toggle_article_save(article_id);
END;
$$ LANGUAGE plpgsql;

-- =======================
-- VIEW TRACKING FUNCTION
-- =======================

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