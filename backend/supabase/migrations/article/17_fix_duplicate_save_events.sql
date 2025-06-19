-- Fix Duplicate Save Events
-- This migration prevents multiple save events from the same user on the same article

BEGIN;

-- =======================
-- UPDATE TRACK_ARTICLE_EVENT FUNCTION
-- =======================

-- Updated track_article_event function to prevent duplicate save events
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
    
    -- Update article metrics in real-time (if function exists)
    BEGIN
        PERFORM update_article_metrics(p_article_id);
    EXCEPTION
        WHEN OTHERS THEN
            -- Ignore if function doesn't exist yet
            NULL;
    END;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- CLEAN UP DUPLICATE SAVE EVENTS
-- =======================

-- Remove duplicate save events, keeping only the first one per user per article
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY article_id, user_id, event_type 
            ORDER BY created_at ASC
        ) as rn
    FROM article_events
    WHERE event_type = 'save'
)
DELETE FROM article_events
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- =======================
-- RECALCULATE TOTAL_SAVES
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

-- Run the recalculation
SELECT recalculate_article_saves();

-- =======================
-- UPDATE TOGGLE_ARTICLE_SAVE FUNCTION
-- =======================

-- Update the toggle_article_save function to not track event when removing save
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
        
        -- Remove the save event too
        DELETE FROM article_events
        WHERE article_id = p_article_id 
          AND user_id = current_user_id 
          AND event_type = 'save';
        
        RETURN false;
    ELSE
        -- Add save
        INSERT INTO public.saved_articles (user_id, article_id)
        VALUES (current_user_id, p_article_id)
        ON CONFLICT (user_id, article_id) DO NOTHING;
        
        -- Track save event (will only create if doesn't exist due to updated function)
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
-- VERIFICATION
-- =======================

DO $$
DECLARE
    duplicate_count integer;
    max_saves_per_user integer;
BEGIN
    -- Check for any remaining duplicate save events
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT article_id, user_id, COUNT(*) as event_count
        FROM article_events
        WHERE event_type = 'save'
        GROUP BY article_id, user_id
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE WARNING 'Still found % articles with duplicate save events', duplicate_count;
    ELSE
        RAISE NOTICE 'No duplicate save events found';
    END IF;
    
    -- Check the maximum saves per user per article (should be 1)
    SELECT MAX(save_count) INTO max_saves_per_user
    FROM (
        SELECT article_id, user_id, COUNT(*) as save_count
        FROM saved_articles
        GROUP BY article_id, user_id
    ) counts;
    
    IF max_saves_per_user > 1 THEN
        RAISE WARNING 'Found users with more than 1 save on the same article!';
    ELSE
        RAISE NOTICE 'All users have at most 1 save per article (as expected)';
    END IF;
    
    -- Display statistics
    RAISE NOTICE 'Migration completed. Save events have been deduplicated and total_saves recalculated.';
END $$;

-- =======================
-- GRANT PERMISSIONS
-- =======================

GRANT EXECUTE ON FUNCTION track_article_event(uuid, text, integer, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_article_save(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_article_saves() TO service_role;

COMMIT; 