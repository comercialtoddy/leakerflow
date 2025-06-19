-- Fix vote_on_article function to work with Basejump account_id
-- This migration updates the vote_on_article function to properly handle account_id

BEGIN;

-- =======================
-- UPDATE VOTE_ON_ARTICLE FUNCTION
-- =======================

-- Updated vote_on_article function that gets account_id from the article
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
    
    -- Update article vote counts and recalculate trend score
    UPDATE articles SET
        upvotes = new_upvotes,
        downvotes = new_downvotes,
        vote_score = new_vote_score
    WHERE id = p_article_id;
    
    -- Recalculate trend score (if function exists)
    BEGIN
        PERFORM calculate_trend_scores();
    EXCEPTION
        WHEN OTHERS THEN
            -- Ignore if function doesn't exist yet
            NULL;
    END;
    
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

-- =======================
-- UPDATE TRACK_ARTICLE_EVENT FUNCTION
-- =======================

-- Updated track_article_event function to work with account_id
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
    existing_view_count integer;
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
-- GRANT PERMISSIONS
-- =======================

GRANT EXECUTE ON FUNCTION vote_on_article(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION track_article_event(uuid, text, integer, numeric, jsonb) TO authenticated;

-- =======================
-- VERIFICATION
-- =======================

-- Verify functions were updated
DO $$
BEGIN
    -- Test if vote_on_article function exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'vote_on_article' 
        AND pronargs = 2
    ) THEN
        RAISE EXCEPTION 'vote_on_article function was not created properly';
    END IF;
    
    -- Test if track_article_event function exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'track_article_event' 
        AND pronargs = 5
    ) THEN
        RAISE EXCEPTION 'track_article_event function was not created properly';
    END IF;
    
    RAISE NOTICE 'Successfully updated vote_on_article and track_article_event functions for Basejump integration';
END $$;

COMMIT; 