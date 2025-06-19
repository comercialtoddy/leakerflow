-- Fix User-Specific Article Saves
-- This migration creates proper user-specific saves instead of global article saves

-- =======================
-- CREATE SAVED_ARTICLES TABLE
-- =======================

-- Create saved_articles junction table for user-specific saves
CREATE TABLE IF NOT EXISTS public.saved_articles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    -- Ensure one save per user per article
    UNIQUE(user_id, article_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_articles_user_id ON public.saved_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_articles_article_id ON public.saved_articles(article_id);
CREATE INDEX IF NOT EXISTS idx_saved_articles_created_at ON public.saved_articles(created_at);

-- Add updated_at trigger (only if the function exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_saved_articles_updated_at ON public.saved_articles;
        CREATE TRIGGER update_saved_articles_updated_at
            BEFORE UPDATE ON public.saved_articles
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- =======================
-- RLS POLICIES FOR SAVED_ARTICLES
-- =======================

-- Enable RLS
ALTER TABLE public.saved_articles ENABLE ROW LEVEL SECURITY;

-- Users can only see their own saves
CREATE POLICY "saved_articles_select_policy" ON public.saved_articles
FOR SELECT USING (user_id = auth.uid());

-- Users can only create saves for themselves
CREATE POLICY "saved_articles_insert_policy" ON public.saved_articles
FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.articles a
        WHERE a.id = article_id
        AND a.status = 'published' -- Can only save published articles
    )
);

-- Users can only delete their own saves
CREATE POLICY "saved_articles_delete_policy" ON public.saved_articles
FOR DELETE USING (user_id = auth.uid());

-- =======================
-- UPDATED FUNCTIONS
-- =======================

-- Function to check if user has saved an article
CREATE OR REPLACE FUNCTION user_has_saved_article(p_article_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM public.saved_articles
        WHERE article_id = p_article_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing function first to avoid parameter name conflicts
DROP FUNCTION IF EXISTS toggle_article_save(uuid);

-- Updated toggle_article_save function
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
        SELECT 1 FROM public.saved_articles sa
        WHERE sa.article_id = p_article_id AND sa.user_id = current_user_id
    ) INTO is_saved;
    
    IF is_saved THEN
        -- Remove save
        DELETE FROM public.saved_articles
        WHERE article_id = p_article_id AND user_id = current_user_id;
        RETURN false;
    ELSE
        -- Add save
        INSERT INTO public.saved_articles (user_id, article_id)
        VALUES (current_user_id, p_article_id)
        ON CONFLICT (user_id, article_id) DO NOTHING;
        
        -- Track save event
        PERFORM track_article_event(p_article_id, 'save');
        
        RETURN true;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE EXCEPTION 'Error toggling article save: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- UPDATE GET_ARTICLES_PAGINATED FUNCTION
-- =======================

-- Updated function to include user-specific saved status
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
    FROM public.articles a
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- UPDATE TOTAL_SAVES CALCULATION
-- =======================

-- Function to update total_saves count for an article
CREATE OR REPLACE FUNCTION update_article_total_saves()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment total_saves
        UPDATE public.articles 
        SET total_saves = COALESCE(total_saves, 0) + 1
        WHERE id = NEW.article_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement total_saves
        UPDATE public.articles 
        SET total_saves = GREATEST(COALESCE(total_saves, 0) - 1, 0)
        WHERE id = OLD.article_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update total_saves
DROP TRIGGER IF EXISTS trigger_update_article_total_saves ON public.saved_articles;
CREATE TRIGGER trigger_update_article_total_saves
    AFTER INSERT OR DELETE ON public.saved_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_article_total_saves();

-- =======================
-- MIGRATE EXISTING DATA
-- =======================

-- Migrate existing saved articles (if any global saves exist)
-- This is a one-time migration to move from global saves to user-specific saves
DO $$
BEGIN
    -- This migration assumes that if an article has saved=true, 
    -- it was saved by the article author (best guess for migration)
    INSERT INTO public.saved_articles (user_id, article_id)
    SELECT DISTINCT a.user_id, a.id
    FROM public.articles a
    WHERE a.saved = true
    ON CONFLICT (user_id, article_id) DO NOTHING;
    
    -- Reset the global saved field since we now use the junction table
    UPDATE public.articles SET saved = false WHERE saved = true;
    
    RAISE NOTICE 'Migrated existing saved articles to user-specific saves';
END $$;

-- =======================
-- PERMISSIONS
-- =======================

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.saved_articles TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_saved_article(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_article_save(uuid) TO authenticated; 